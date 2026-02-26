const User = require('../models/User');
const Session = require('../models/Session');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

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
            const result = await User.create({
                username,
                email: email.toLowerCase(),
                password: hashedPassword,
                verified: true,
                verificationCode: null
            });

            res.status(201).json({ 
                success: true, 
                message: "Registro completado con éxito. Ya puedes iniciar sesión.",
                userId: result.insertedId 
            });

        } catch (error) {
            console.error("Error en el registro:", error);
            res.status(500).json({ error: "Error interno del servidor." });
        }
    }

    static async verify(req, res) {
        try {
            res.json({ success: true, message: "La cuenta no requiere verificación manual." });
        } catch (error) {
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

            if (user.verified === false) {
                await User.updateVerification(user._id, true);
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
                    id: user._id, 
                    username: user.username,
                    saveData: user.saveData 
                }
            });

        } catch (error) {
            console.error("Error en login:", error);
            res.status(500).json({ error: "Error de autenticación." });
        }
    }

    static async logout(req, res) {
        try {
            const userId = req.user.id; 
            await Session.end(userId);
            res.json({ success: true, message: "Sesión cerrada correctamente." });
        } catch (error) {
            console.error("Error en logout:", error);
            res.status(500).json({ error: "Error al cerrar sesión." });
        }
    }
}

module.exports = AuthController;