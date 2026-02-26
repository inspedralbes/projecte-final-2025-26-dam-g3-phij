require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectDB } = require('./config/db');
const AuthController = require('./controllers/AuthController');
const NarrativeController = require('./controllers/NarrativeController');

const app = express();

app.use(cors());
app.use(express.json());

app.post('/api/auth/register', AuthController.register);
app.post('/api/auth/verify', AuthController.verify);
app.post('/api/auth/login', AuthController.login);
app.post('/api/auth/logout', AuthController.logout);

app.get('/api/game/load/:userId', NarrativeController.loadProgress);
app.post('/api/game/action', NarrativeController.processAction);
app.post('/api/game/stream', NarrativeController.stream);

app.get('/', (req, res) => res.send('⚔️ Valkrypt API v1.0 - Atlas Connected'));

const PORT = process.env.PORT || 3000;

connectDB().then(() => {
    app.listen(PORT, () => console.log(`⚔️ Servidor Valkrypt en puerto ${PORT}`));
}).catch(err => {
    console.error(err);
    process.exit(1);
});