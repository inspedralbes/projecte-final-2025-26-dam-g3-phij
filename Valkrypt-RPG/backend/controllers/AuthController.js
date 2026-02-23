const User = require('../models/User');
const Session = require('../models/Session');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Resend } = require('resend');

const resend = new Resend('re_9wbZB2wt_HtYLDCAMY4Dk78b2cGwGJXEF');

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
            const vCode = Math.floor(100000 + Math.random() * 900000).toString();
            const result = await User.create({
                username,
                email: email.toLowerCase(),
                password: hashedPassword,
                verificationCode: vCode,
                verified: false
            });

            await resend.emails.send({
                from: 'Valkrypt <onboarding@resend.dev>',
                to: email,
                subject: 'Verificación de Cuenta - Valkrypt',
                html: `<div style="background:#000; color:#d4af37; padding:20px; text-align:center; border:2px solid #d4af37;">
                        <h1>VALKRYPT</h1>
                        <p>Introduce este código para despertar en el reino:</p>
                        <h2 style="font-size:30px; letter-spacing:5px;">${vCode}</h2>
                      </div>`
            });

            res.status(201).json({ 
                success: true, 
                message: "Revisa tu correo para verificar tu cuenta.",
                userId: result.insertedId 
            });

        } catch (error) {
            console.error("Error en el registro:", error);
            res.status(500).json({ error: "Error interno del servidor." });
        }
    }

    static async verify(req, res) {
        try {
            const { username, code } = req.body;
            const user = await User.findByUsername(username);

            if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

            if (String(user.verificationCode) === String(code)) {
                await User.collection().updateOne(
                    { username },
                    { $set: { verified: true }, $unset: { verificationCode: "" } }
                );
                res.json({ success: true, message: "Cuenta verificada con éxito" });
            } else {
                res.status(400).json({ error: "Código incorrecto" });
            }
        } catch (error) {
            res.status(500).json({ error: "Error en la verificación" });
        }
    }

    static async login(req, res) {
        const { username, password } = req.body;

        try {
            const user = await User.findByUsername(username);
            if (!user) {
                return res.status(401).json({ error: "Usuario no encontrado." });
            }

            if (!user.verified) {
                return res.status(403).json({ error: "Debes verificar tu cuenta antes de entrar." });
            }

            const validPass = await bcrypt.compare(password, user.password);
            if (!validPass) {
                return res.status(401).json({ error: "Contraseña incorrecta." });
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
            res.status(500).json({ error: "Error de autenticación." });
        }
    }

    static async logout(req, res) {
        try {
            const userId = req.user.id; 
            await Session.end(userId);
            res.json({ success: true, message: "Sesión cerrada correctamente." });
        } catch (error) {
            res.status(500).json({ error: "Error al cerrar sesión." });
        }
    }
}

module.exports = AuthController;