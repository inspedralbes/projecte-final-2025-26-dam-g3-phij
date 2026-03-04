const User = require('../models/User');
const Session = require('../models/Session');
const { getDB } = require('../config/db');
const { ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

const OTP_LENGTH = 6;
const OTP_TTL_MINUTES = Number(process.env.OTP_TTL_MINUTES || 15);
const OTP_MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS || 5);
const MAX_PROFILE_TEXT_LENGTH = {
    displayName: 32,
    title: 60,
    faction: 40,
    bio: 320,
    avatar: 500,
    character: 80
};

const sanitizeText = (value, maxLength, { allowEmpty = true } = {}) => {
    if (value === undefined || value === null) return null;
    const normalized = String(value)
        .replace(/\s+/g, ' ')
        .replace(/[<>]/g, '')
        .trim();

    if (!allowEmpty && !normalized) return null;
    if (normalized.length > maxLength) {
        return normalized.slice(0, maxLength);
    }
    return normalized;
};

const sanitizeProfileForResponse = (user) => {
    const username = String(user?.username || '').trim();
    const profile = user?.profile && typeof user.profile === 'object' ? user.profile : {};
    const displayName = sanitizeText(profile.displayName, MAX_PROFILE_TEXT_LENGTH.displayName, { allowEmpty: true }) || username;

    return {
        displayName,
        title: sanitizeText(profile.title, MAX_PROFILE_TEXT_LENGTH.title, { allowEmpty: true }) || 'Aventurero',
        faction: sanitizeText(profile.faction, MAX_PROFILE_TEXT_LENGTH.faction, { allowEmpty: true }) || 'Independiente',
        bio: sanitizeText(profile.bio, MAX_PROFILE_TEXT_LENGTH.bio, { allowEmpty: true }) || '',
        avatar: sanitizeText(profile.avatar, MAX_PROFILE_TEXT_LENGTH.avatar, { allowEmpty: true }) || ''
    };
};

const buildUserPayload = (user, extraStats = {}) => {
    const stats = {
        friends: Array.isArray(user?.friends) ? user.friends.length : 0,
        incomingRequests: Array.isArray(user?.friendRequests?.incoming) ? user.friendRequests.incoming.length : 0,
        outgoingRequests: Array.isArray(user?.friendRequests?.outgoing) ? user.friendRequests.outgoing.length : 0,
        savedCampaigns: Number(extraStats.savedCampaigns || 0)
    };

    return {
        id: String(user._id),
        username: user.username,
        character: sanitizeText(user?.character, MAX_PROFILE_TEXT_LENGTH.character, { allowEmpty: true }) || null,
        profile: sanitizeProfileForResponse(user),
        stats,
        createdAt: user.createdAt || null,
        updatedAt: user.updatedAt || null
    };
};

const validateAvatar = (avatar) => {
    if (!avatar) return true;
    return /^(https?:\/\/|\/)/i.test(avatar);
};

const generateOtp = () => {
    return Math.floor(10 ** (OTP_LENGTH - 1) + Math.random() * 9 * 10 ** (OTP_LENGTH - 1)).toString();
};

const buildOtpExpiry = () => {
    return new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
};

const hasSmtpConfig = () => {
    return Boolean(
        process.env.SMTP_HOST &&
        process.env.SMTP_PORT &&
        process.env.SMTP_USER &&
        process.env.SMTP_PASS &&
        process.env.SMTP_FROM
    );
};

const sendVerificationEmail = async ({ email, username, code }) => {
    if (!hasSmtpConfig()) {
        console.warn(`[OTP DEBUG] ${username} (${email}) => ${code}`);
        return false;
    }

    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        secure: String(process.env.SMTP_SECURE || 'false') === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });

    await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: email,
        subject: 'Valkrypt - Codigo de verificacion',
        text: `Tu codigo de verificacion es ${code}. Caduca en ${OTP_TTL_MINUTES} minutos.`
    });

    return true;
};

class AuthController {

    static async register(req, res) {
        const { username, email, password } = req.body;

        try {
            if (!username || !email || !password) {
                return res.status(400).json({ error: "Faltan campos requeridos." });
            }

            const existingUser = await User.findByUsername(username);
            const existingEmail = await User.findByEmail(email);
            
            if (existingUser || existingEmail) {
                return res.status(409).json({ error: "El usuario o email ya están registrados." });
            }

            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
            const otpCode = generateOtp();
            const verificationCodeHash = await bcrypt.hash(otpCode, 10);
            const verificationCodeExpiresAt = buildOtpExpiry();

            const result = await User.create({
                username,
                email: email.toLowerCase(),
                password: hashedPassword,
                verified: false,
                verificationCodeHash,
                verificationCodeExpiresAt,
                verificationAttempts: 0
            });

            let otpSentByEmail = false;
            try {
                otpSentByEmail = await sendVerificationEmail({ email: email.toLowerCase(), username, code: otpCode });
            } catch (mailError) {
                console.error("No se pudo enviar el email OTP:", mailError);
            }

            const response = {
                success: true,
                requiresVerification: true,
                message: otpSentByEmail
                    ? "Registro completado. Revisa tu correo para verificar la cuenta."
                    : "Registro completado. No hay SMTP configurado; usa el codigo OTP mostrado en logs del backend.",
                userId: result.insertedId,
                username
            };

            if (process.env.NODE_ENV !== 'production') {
                response.debugCode = otpCode;
            }

            res.status(201).json({ 
                ...response
            });

        } catch (error) {
            console.error("Error en el registro:", error);
            res.status(500).json({ error: "Error interno del servidor." });
        }
    }

    static async verify(req, res) {
        try {
            const { username, code } = req.body;

            if (!username || !code) {
                return res.status(400).json({ error: "Debes enviar username y codigo OTP." });
            }

            if (!/^\d{6}$/.test(String(code))) {
                return res.status(400).json({ error: "El codigo OTP debe tener 6 digitos." });
            }

            const user = await User.findByUsername(username);
            if (!user) {
                return res.status(404).json({ error: "Usuario no encontrado." });
            }

            if (user.verified) {
                return res.json({ success: true, message: "La cuenta ya estaba verificada." });
            }

            if ((user.verificationAttempts || 0) >= OTP_MAX_ATTEMPTS) {
                return res.status(429).json({
                    error: "Demasiados intentos fallidos. Registra de nuevo o implementa reenvio OTP."
                });
            }

            if (!user.verificationCodeHash || !user.verificationCodeExpiresAt) {
                return res.status(400).json({ error: "No hay un codigo OTP activo para este usuario." });
            }

            if (new Date(user.verificationCodeExpiresAt).getTime() < Date.now()) {
                return res.status(400).json({ error: "El codigo OTP ha caducado. Registra de nuevo." });
            }

            const isValidCode = await bcrypt.compare(String(code), user.verificationCodeHash);
            if (!isValidCode) {
                await User.incrementVerificationAttempts(user._id);
                return res.status(401).json({ error: "Codigo OTP incorrecto." });
            }

            await User.markVerified(user._id);
            res.json({ success: true, message: "Cuenta verificada correctamente." });
        } catch (error) {
            console.error("Error en verificacion OTP:", error);
            res.status(500).json({ error: "Error en el proceso de verificación." });
        }
    }

    static async login(req, res) {
        const { username, password } = req.body;

        try {
            const user = await User.findByUsername(username);
            if (!user) {
                return res.status(401).json({ error: "Credenciales inválidas." });
            }

            if (!user.verified) {
                return res.status(403).json({
                    error: "Tu cuenta no esta verificada. Introduce el codigo OTP.",
                    needsVerification: true
                });
            }

            const validPass = await bcrypt.compare(password, user.password);
            if (!validPass) {
                return res.status(401).json({ error: "Credenciales inválidas." });
            }

            try {
                const clientInfo = req.headers['user-agent'] || 'Valkrypt-Client';
                await Session.start(user._id, clientInfo); 
            } catch (sessionError) {
                console.error("Error al persistir la sesión:", sessionError);
            }

            const token = jwt.sign(
                { id: user._id, username: user.username },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );

            res.json({
                success: true,
                token,
                user: { 
                    id: String(user._id), 
                    username: user.username,
                    character: sanitizeText(user?.character, MAX_PROFILE_TEXT_LENGTH.character, { allowEmpty: true }) || null,
                    profile: sanitizeProfileForResponse(user),
                    saveData: user.saveData,
                    friends: Array.isArray(user.friends) ? user.friends : [],
                    friendRequests: {
                        incoming: Array.isArray(user?.friendRequests?.incoming) ? user.friendRequests.incoming : [],
                        outgoing: Array.isArray(user?.friendRequests?.outgoing) ? user.friendRequests.outgoing : []
                    }
                }
            });

        } catch (error) {
            console.error("Error en login:", error);
            res.status(500).json({ error: "Error de autenticación." });
        }
    }

    static async getProfile(req, res) {
        try {
            const { userId } = req.params;
            if (!userId || !ObjectId.isValid(String(userId))) {
                return res.status(400).json({ error: "ID de usuario no valido." });
            }

            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({ error: "Usuario no encontrado." });
            }

            const db = getDB();
            const savedCampaigns = await db.collection('saves').countDocuments({
                userId: new ObjectId(String(userId))
            });

            return res.json({
                success: true,
                user: buildUserPayload(user, { savedCampaigns })
            });
        } catch (error) {
            console.error("Error cargando perfil:", error);
            return res.status(500).json({ error: "No se pudo cargar el perfil." });
        }
    }

    static async updateProfile(req, res) {
        try {
            const {
                userId,
                displayName,
                title,
                faction,
                bio,
                avatar,
                character
            } = req.body || {};

            if (!userId || !ObjectId.isValid(String(userId))) {
                return res.status(400).json({ error: "ID de usuario no valido." });
            }

            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({ error: "Usuario no encontrado." });
            }

            const nextDisplayName = sanitizeText(displayName, MAX_PROFILE_TEXT_LENGTH.displayName, { allowEmpty: true });
            const nextTitle = sanitizeText(title, MAX_PROFILE_TEXT_LENGTH.title, { allowEmpty: true });
            const nextFaction = sanitizeText(faction, MAX_PROFILE_TEXT_LENGTH.faction, { allowEmpty: true });
            const nextBio = sanitizeText(bio, MAX_PROFILE_TEXT_LENGTH.bio, { allowEmpty: true });
            const nextAvatar = sanitizeText(avatar, MAX_PROFILE_TEXT_LENGTH.avatar, { allowEmpty: true });
            const nextCharacter = sanitizeText(character, MAX_PROFILE_TEXT_LENGTH.character, { allowEmpty: true });

            if (nextAvatar && !validateAvatar(nextAvatar)) {
                return res.status(400).json({ error: "El avatar debe ser una URL http(s) o una ruta local válida." });
            }

            const profileUpdates = {};
            if (displayName !== undefined) profileUpdates['profile.displayName'] = nextDisplayName || user.username;
            if (title !== undefined) profileUpdates['profile.title'] = nextTitle || 'Aventurero';
            if (faction !== undefined) profileUpdates['profile.faction'] = nextFaction || 'Independiente';
            if (bio !== undefined) profileUpdates['profile.bio'] = nextBio || '';
            if (avatar !== undefined) profileUpdates['profile.avatar'] = nextAvatar || '';
            if (character !== undefined) profileUpdates.character = nextCharacter || null;

            if (Object.keys(profileUpdates).length === 0) {
                return res.status(400).json({ error: "No hay cambios válidos para actualizar." });
            }

            await User.updateProfile(userId, profileUpdates);

            const updatedUser = await User.findById(userId);
            const db = getDB();
            const savedCampaigns = await db.collection('saves').countDocuments({
                userId: new ObjectId(String(userId))
            });

            return res.json({
                success: true,
                message: "Perfil actualizado correctamente.",
                user: buildUserPayload(updatedUser, { savedCampaigns })
            });
        } catch (error) {
            console.error("Error actualizando perfil:", error);
            return res.status(500).json({ error: "No se pudo actualizar el perfil." });
        }
    }

    static async logout(req, res) {
        try {
            const userId = req?.user?.id || req?.body?.userId;
            if (!userId) {
                return res.status(400).json({ error: "userId requerido para cerrar sesión." });
            }
            await Session.end(userId);
            res.json({ success: true, message: "Sesión cerrada correctamente." });
        } catch (error) {
            console.error("Error en logout:", error);
            res.status(500).json({ error: "Error al cerrar sesión." });
        }
    }
}

module.exports = AuthController;
