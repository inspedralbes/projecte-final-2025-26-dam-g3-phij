const User = require('../models/User');
const Session = require('../models/Session');
const { getDB } = require('../config/db');
const { ObjectId } = require('mongodb');
const {
    PROFILE_LIMITS,
    sanitizeText,
    sanitizeProfileForResponse,
    buildAdvancedProfileData
} = require('../utils/profileStats');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { Resend } = require('resend');
const { isAdminUser } = require('../middleware/auth');

const OTP_LENGTH = 6;
const OTP_TTL_MINUTES = Number(process.env.OTP_TTL_MINUTES || 15);
const OTP_MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS || 5);
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const SMTP_DEFAULT_HOST = 'smtp-relay.brevo.com';
const SMTP_DEFAULT_PORT = 587;
const ALLOW_OTP_DEBUG = String(process.env.ALLOW_OTP_DEBUG || '').toLowerCase() === 'true';

const OTP_PROVIDER = String(process.env.OTP_PROVIDER || 'resend').toLowerCase();
const RESEND_API_KEY = String(process.env.RESEND_API_KEY || '').trim();
const EMAIL_FROM = String(process.env.EMAIL_FROM || 'onboarding@resend.dev').trim();
const EMAIL_FROM_FALLBACK = String(process.env.EMAIL_FROM_FALLBACK || 'onboarding@resend.dev').trim();
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

const buildUserPayload = (user, advanced = {}) => {
    const safeStats = advanced?.stats && typeof advanced.stats === 'object'
        ? advanced.stats
        : {
            friends: Array.isArray(user?.friends) ? user.friends.length : 0,
            incomingRequests: Array.isArray(user?.friendRequests?.incoming) ? user.friendRequests.incoming.length : 0,
            outgoingRequests: Array.isArray(user?.friendRequests?.outgoing) ? user.friendRequests.outgoing.length : 0,
            savedCampaigns: 0
        };

    return {
        id: String(user._id),
        username: user.username,
        character: sanitizeText(user?.character, PROFILE_LIMITS.character, { allowEmpty: true }) || null,
        profile: sanitizeProfileForResponse(user),
        stats: safeStats,
        achievements: Array.isArray(advanced?.achievements) ? advanced.achievements : [],
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

const getSmtpConfig = () => {
    const host = String(process.env.SMTP_HOST || process.env.EMAIL_HOST || SMTP_DEFAULT_HOST).trim();
    const port = Number(process.env.SMTP_PORT || process.env.EMAIL_PORT || SMTP_DEFAULT_PORT);
    const user = String(process.env.SMTP_USER || process.env.EMAIL_USER || '').trim();
    const pass = String(process.env.SMTP_PASS || process.env.EMAIL_PASS || '').trim();
    const from = String(process.env.SMTP_FROM || process.env.EMAIL_FROM || user || '').trim();
    const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;
    const rejectUnauthorized = String(process.env.SMTP_TLS_REJECT_UNAUTHORIZED || 'true').toLowerCase() !== 'false';
    return {
        host,
        port: Number.isFinite(port) ? port : SMTP_DEFAULT_PORT,
        secure,
        user,
        pass,
        from,
        rejectUnauthorized
    };
};

const hasSmtpConfig = () => {
    const cfg = getSmtpConfig();
    return Boolean(cfg.host && cfg.port && cfg.user && cfg.pass && cfg.from);
};

const sendVerificationEmail = async ({ email, username, code }) => {
    
const subject = 'Valkrypt · Codi OTP de verificació';
    const text = `Hola ${username},

El teu codi de verificació és: ${code}
Caduca en ${OTP_TTL_MINUTES} minuts.

Si no has iniciat aquest registre, ignora aquest correu.`;
    const html = `
      <div style="background:#0b0b0e;padding:32px;font-family:Inter,Segoe UI,Arial,sans-serif;color:#e8e8ef">
        <div style="max-width:560px;margin:0 auto;background:#13131a;border:1px solid #2a2a35;border-radius:14px;overflow:hidden">
          <div style="padding:18px 22px;background:linear-gradient(135deg,#1d1f2b,#12121a)">
            <h1 style="margin:0;font-size:20px;color:#f3d38a;letter-spacing:.5px">Valkrypt</h1>
            <p style="margin:6px 0 0;color:#b7b7c8;font-size:13px">Verificació de compte</p>
          </div>
          <div style="padding:22px">
            <p style="margin:0 0 12px">Hola <strong>${username}</strong>,</p>
            <p style="margin:0 0 16px;color:#c8c8d8">Introdueix aquest codi OTP per activar el teu compte:</p>
            <div style="display:inline-block;padding:12px 16px;border:1px solid #f3d38a;border-radius:10px;font-size:28px;letter-spacing:6px;color:#f3d38a;font-weight:700">
              ${code}
            </div>
            <p style="margin:16px 0 0;color:#a7a7ba;font-size:13px">Caduca en ${OTP_TTL_MINUTES} minuts.</p>
            <p style="margin:10px 0 0;color:#8f8fa3;font-size:12px">Si no has iniciat aquest registre, pots ignorar aquest correu.</p>
          </div>
        </div>
      </div>
    `;

    if (OTP_PROVIDER === 'resend') {

        if (!resend) {
            console.warn('[OTP] RESEND_API_KEY no configurada.');
            return false;
        }

        let result = await resend.emails.send({
            from: EMAIL_FROM,
            to: email,
            subject,
            text,
            html,
        });

        if (result?.error && EMAIL_FROM_FALLBACK && EMAIL_FROM_FALLBACK !== EMAIL_FROM) {
            const msg = String(result.error.message || '');
            if (/verify|domain|from|sender/i.test(msg)) {
                result = await resend.emails.send({
                    from: EMAIL_FROM_FALLBACK,
                    to: email,
                    subject,
                    text,
                    html,
                });
            }
        }

        if (result?.error) {
            throw new Error(`Resend error: ${result.error.message || JSON.stringify(result.error)}`);
        }

        return true;
    }

    const smtp = getSmtpConfig();
    if (!hasSmtpConfig()) {
        console.warn(`[OTP DEBUG] ${username} (${email}) => ${code}`);
        return false;
    }

    const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: {
            user: smtp.user,
            pass: smtp.pass
        },
        tls: {
            rejectUnauthorized: smtp.rejectUnauthorized
        }
    });

    await transporter.sendMail({ from: smtp.from, to: email, subject, text, html });
    return true;
};

class AuthController {

    static async register(req, res) {
        const { username, email, password } = req.body;

        try {
            if (!username || !email || !password) {
                return res.status(400).json({ error: "Falten camps obligatoris." });
            }
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim().toLowerCase())) {
                return res.status(400).json({ error: "Format de correu no vàlid." });
            }
            if (String(password).length < 8) {
                return res.status(400).json({ error: "La contrasenya ha de tenir mínim 8 caràcters." });
            }

            const existingUser = await User.findByUsername(username);
            const existingEmail = await User.findByEmail(email);
            
            if (existingUser || existingEmail) {
                return res.status(409).json({ error: "L'usuari o el correu ja estan registrats." });
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
                verificationAttempts: 0,
                verificationLastSentAt: new Date()
            });

            const smtpConfigured = OTP_PROVIDER === "resend" ? Boolean(resend) : hasSmtpConfig();
            let otpSentByEmail = false;
            try {
                otpSentByEmail = await sendVerificationEmail({ email: email.toLowerCase(), username, code: otpCode });
            } catch (mailError) {
                console.error("No s'ha pogut enviar el correu OTP:", mailError);
            }

            const response = {
                success: true,
                requiresVerification: true,
                message: otpSentByEmail
                    ? "Registre completat. Revisa el teu correu per verificar el compte."
                    : (smtpConfigured
                        ? "Registre completat, però no s'ha pogut enviar el correu OTP. Revisa la configuració del proveïdor d'email."
                        : "Registre completat. No hi ha SMTP configurat; fes servir el codi OTP mostrat als logs del backend."),
                userId: result.insertedId,
                username
            };

            if (ALLOW_OTP_DEBUG) {
                response.debugCode = otpCode;
            }

            res.status(201).json({ 
                ...response
            });

        } catch (error) {
            console.error("Error al registre:", error);
            res.status(500).json({ error: "Error intern del servidor." });
        }
    }

    static async verify(req, res) {
        try {
            const { username, code } = req.body;

            if (!username || !code) {
                return res.status(400).json({ error: "Has d'enviar username i codi OTP." });
            }

            if (!/^\d{6}$/.test(String(code))) {
                return res.status(400).json({ error: "El codi OTP ha de tenir 6 digits." });
            }

            const user = await User.findByUsername(username);
            if (!user) {
                return res.status(404).json({ error: "Usuari no trobat." });
            }

            if (user.verified) {
                return res.json({ success: true, message: "El compte ja estava verificat." });
            }

            if ((user.verificationAttempts || 0) >= OTP_MAX_ATTEMPTS) {
                return res.status(429).json({
                    error: "Massa intents fallits. Torna't a registrar o implementa reenviament OTP."
                });
            }

            if (!user.verificationCodeHash || !user.verificationCodeExpiresAt) {
                return res.status(400).json({ error: "No hi ha cap codi OTP actiu per a aquest usuari." });
            }

            if (new Date(user.verificationCodeExpiresAt).getTime() < Date.now()) {
                return res.status(400).json({ error: "El codi OTP ha caducat. Torna't a registrar." });
            }

            const isValidCode = await bcrypt.compare(String(code), user.verificationCodeHash);
            if (!isValidCode) {
                await User.incrementVerificationAttempts(user._id);
                return res.status(401).json({ error: "Codi OTP incorrecte." });
            }

            await User.markVerified(user._id);
            res.json({ success: true, message: "Compte verificat correctament." });
        } catch (error) {
            console.error("Error en verificació OTP:", error);
            res.status(500).json({ error: "Error en el procés de verificació." });
        }
    }

    static async resendOtp(req, res) {
        try {
            const { username } = req.body || {};
            if (!username) {
                return res.status(400).json({ error: "Has d'enviar username." });
            }

            const user = await User.findByUsername(username);
            if (!user) return res.status(404).json({ error: "Usuari no trobat." });
            if (user.verified) return res.status(400).json({ error: "El compte ja està verificat." });

            const lastSent = new Date(user.verificationLastSentAt || 0).getTime();
            const elapsed = Date.now() - lastSent;
            if (elapsed < OTP_RESEND_COOLDOWN_MS) {
                const waitSeconds = Math.ceil((OTP_RESEND_COOLDOWN_MS - elapsed) / 1000);
                return res.status(429).json({ error: `Espera ${waitSeconds}s per reenviar el codi.` });
            }

            const otpCode = generateOtp();
            const verificationCodeHash = await bcrypt.hash(otpCode, 10);
            const verificationCodeExpiresAt = buildOtpExpiry();
            await User.updateVerificationCode(user._id, verificationCodeHash, verificationCodeExpiresAt);

            const smtpConfigured = OTP_PROVIDER === "resend" ? Boolean(resend) : hasSmtpConfig();
            let otpSentByEmail = false;
            try {
                otpSentByEmail = await sendVerificationEmail({ email: user.email, username: user.username, code: otpCode });
            } catch (mailError) {
                console.error("No s'ha pogut reenviar OTP:", mailError);
            }

            const response = {
                success: true,
                message: otpSentByEmail
                    ? "Codi reenviat."
                    : (smtpConfigured
                        ? "Codi regenerat, però no s'ha pogut enviar el correu OTP."
                        : "Codi regenerat. SMTP no configurat; revisa logs backend.")
            };
            if (ALLOW_OTP_DEBUG) response.debugCode = otpCode;
            return res.json(response);
        } catch (error) {
            console.error("Error reenviant OTP:", error);
            return res.status(500).json({ error: "No s'ha pogut reenviar el codi OTP." });
        }
    }

    static async login(req, res) {
        const { username, password } = req.body;

        try {
            const user = await User.findByUsername(username);
            if (!user) {
                return res.status(401).json({ error: "Credencials invàlides." });
            }

            if (!user.verified) {
                return res.status(403).json({
                    error: "El teu compte no està verificat. Introdueix el codi OTP.",
                    needsVerification: true
                });
            }
            if (user.suspended) {
                return res.status(403).json({ error: "Compte suspès per administració." });
            }

            const validPass = await bcrypt.compare(password, user.password);
            if (!validPass) {
                return res.status(401).json({ error: "Credencials invàlides." });
            }

            try {
                const clientInfo = req.headers['user-agent'] || 'Valkrypt-Client';
                await Session.start(user._id, clientInfo); 
            } catch (sessionError) {
                console.error("Error en persistir la sessió:", sessionError);
            }

            const token = jwt.sign(
                { id: user._id, username: user.username, isAdmin: isAdminUser(user.username) },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );

            res.json({
                success: true,
                token,
                user: { 
                    id: String(user._id), 
                    username: user.username,
                    character: sanitizeText(user?.character, PROFILE_LIMITS.character, { allowEmpty: true }) || null,
                    profile: sanitizeProfileForResponse(user),
                    saveData: user.saveData,
                    friends: Array.isArray(user.friends) ? user.friends : [],
                    friendRequests: {
                        incoming: Array.isArray(user?.friendRequests?.incoming) ? user.friendRequests.incoming : [],
                        outgoing: Array.isArray(user?.friendRequests?.outgoing) ? user.friendRequests.outgoing : []
                    },
                    isAdmin: isAdminUser(user.username)
                }
            });

        } catch (error) {
            console.error("Error en iniciar sessió:", error);
            res.status(500).json({ error: "Error d'autenticació." });
        }
    }

    static async getProfile(req, res) {
        try {
            const { userId } = req.params;
            if (!userId || !ObjectId.isValid(String(userId))) {
                return res.status(400).json({ error: "ID d'usuari no vàlid." });
            }

            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({ error: "Usuari no trobat." });
            }

            const db = getDB();
            const advanced = await buildAdvancedProfileData(db, user);

            return res.json({
                success: true,
                user: buildUserPayload(user, advanced)
            });
        } catch (error) {
            console.error("Error cargando perfil:", error);
            return res.status(500).json({ error: "No s'ha pogut carregar el perfil." });
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
                return res.status(400).json({ error: "ID d'usuari no vàlid." });
            }

            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({ error: "Usuari no trobat." });
            }

            const nextDisplayName = sanitizeText(displayName, PROFILE_LIMITS.displayName, { allowEmpty: true });
            const nextTitle = sanitizeText(title, PROFILE_LIMITS.title, { allowEmpty: true });
            const nextFaction = sanitizeText(faction, PROFILE_LIMITS.faction, { allowEmpty: true });
            const nextBio = sanitizeText(bio, PROFILE_LIMITS.bio, { allowEmpty: true });
            const nextAvatar = sanitizeText(avatar, PROFILE_LIMITS.avatar, { allowEmpty: true });
            const nextCharacter = sanitizeText(character, PROFILE_LIMITS.character, { allowEmpty: true });

            if (nextAvatar && !validateAvatar(nextAvatar)) {
                return res.status(400).json({ error: "L'avatar ha de ser una URL http(s) o una ruta local vàlida." });
            }

            const profileUpdates = {};
            if (displayName !== undefined) profileUpdates['profile.displayName'] = nextDisplayName || user.username;
            if (title !== undefined) profileUpdates['profile.title'] = nextTitle || 'Aventurero';
            if (faction !== undefined) profileUpdates['profile.faction'] = nextFaction || 'Independiente';
            if (bio !== undefined) profileUpdates['profile.bio'] = nextBio || '';
            if (avatar !== undefined) profileUpdates['profile.avatar'] = nextAvatar || '';
            if (character !== undefined) profileUpdates.character = nextCharacter || null;

            if (Object.keys(profileUpdates).length === 0) {
                return res.status(400).json({ error: "No hi ha canvis vàlids per actualitzar." });
            }

            await User.updateProfile(userId, profileUpdates);

            const updatedUser = await User.findById(userId);
            const db = getDB();
            const advanced = await buildAdvancedProfileData(db, updatedUser);

            return res.json({
                success: true,
                message: "Perfil actualizado correctamente.",
                user: buildUserPayload(updatedUser, advanced)
            });
        } catch (error) {
            console.error("Error actualizando perfil:", error);
            return res.status(500).json({ error: "No s'ha pogut actualitzar el perfil." });
        }
    }

    static async logout(req, res) {
        try {
            const userId = req?.user?.id || req?.body?.userId;
            if (!userId) {
                return res.status(400).json({ error: "userId obligatori per tancar sessió." });
            }
            await Session.end(userId);
            res.json({ success: true, message: "Sessió tancada correctament." });
        } catch (error) {
            console.error("Error en tancar sessió:", error);
            res.status(500).json({ error: "Error en tancar sessió." });
        }
    }
}

module.exports = AuthController;
