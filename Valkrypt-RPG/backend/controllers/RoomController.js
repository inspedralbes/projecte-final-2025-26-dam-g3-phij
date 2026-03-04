const Room = require('../models/Room');
const crypto = require('crypto');
const { ObjectId } = require('mongodb');
const { getDB } = require('../config/db');
const MIN_PLAYERS_TO_START = 2;
const DEFAULT_DAY_LIMIT = 6;
const ROLE_CATALOG = [
    { id: 'lider', label: 'Lider', priority: 1, description: 'Marca el plan y abre cada ronda.' },
    { id: 'vanguardia', label: 'Vanguardia', priority: 2, description: 'Asume el choque frontal y protege avances.' },
    { id: 'arcanista', label: 'Arcanista', priority: 3, description: 'Controla energia, rituales y respuestas magicas.' },
    { id: 'explorador', label: 'Explorador', priority: 4, description: 'Detecta rutas, riesgos y oportunidades ocultas.' },
    { id: 'guardian', label: 'Guardian', priority: 5, description: 'Defiende al grupo cuando el peligro escala.' },
    { id: 'sanador', label: 'Sanador', priority: 6, description: 'Sostiene la moral y la estabilidad de la escuadra.' }
];
const STORY_SCENES = [
    {
        id: 'campamento_derrumbado',
        title: 'Campamento Derrumbado',
        description: 'Encontráis un campamento minero destruido. Las marcas en la piedra no son naturales.',
        choices: [
            { id: 'rastrear_huellas', label: 'Rastrear huellas recientes', outcome: 'Localizais un rastro util, pero quedais expuestos.', effects: { progress: 2, threat: 1, morale: 0 } },
            { id: 'fortificar_perimetro', label: 'Fortificar perimetro y observar', outcome: 'Ganáis control de la zona y evitais emboscadas inmediatas.', effects: { progress: 1, threat: -1, morale: 1 } },
            { id: 'interrogar_superviviente', label: 'Interrogar al superviviente oculto', outcome: 'Obtienes informacion critica a cambio de tiempo y recursos.', effects: { progress: 2, threat: 0, morale: -1 } }
        ]
    },
    {
        id: 'galeria_inestable',
        title: 'Galeria Inestable',
        description: 'La galeria principal cruje. Avanzar rapido podria sepultaros.',
        choices: [
            { id: 'apuntalar_techo', label: 'Apuntalar el techo antes de avanzar', outcome: 'Reducis riesgo estructural, pero el enemigo gana tiempo.', effects: { progress: 1, threat: 0, morale: 1 } },
            { id: 'carrera_tactica', label: 'Cruzar con carrera tactica', outcome: 'Atraviesas la zona, pero atraes atencion hostil.', effects: { progress: 2, threat: 2, morale: 0 } },
            { id: 'ruta_secundaria', label: 'Buscar ruta secundaria', outcome: 'Encuentras un desvio oculto y recuperas iniciativa.', effects: { progress: 2, threat: -1, morale: 0 } }
        ]
    },
    {
        id: 'santuario_oscuro',
        title: 'Santuario Oscuro',
        description: 'Un santuario antiguo bloquea el paso con simbolos en una lengua olvidada.',
        choices: [
            { id: 'ritual_controlado', label: 'Canalizar un ritual controlado', outcome: 'La barrera cede parcialmente y revela fragmentos del mapa.', effects: { progress: 2, threat: 1, morale: -1 } },
            { id: 'demolicion_selectiva', label: 'Aplicar demolicion selectiva', outcome: 'Rompes la entrada sin desatar toda la energia sellada.', effects: { progress: 2, threat: 0, morale: 0 } },
            { id: 'negociar_con_eco', label: 'Responder al eco inteligente del santuario', outcome: 'El santuario os permite pasar, pero os marca como intrusos.', effects: { progress: 1, threat: 1, morale: 1 } }
        ]
    },
    {
        id: 'foso_de_ghouls',
        title: 'Foso de Ghouls',
        description: 'Una manada bloquea el corredor y acecha vuestro flanco.',
        choices: [
            { id: 'carga_coordinada', label: 'Carga coordinada', outcome: 'Despejais la linea central con bajas minimas.', effects: { progress: 2, threat: 1, morale: 1 } },
            { id: 'cebo_y_repliegue', label: 'Cebo y repliegue', outcome: 'El grupo mantiene cohesion, pero cede terreno.', effects: { progress: 1, threat: -1, morale: 0 } },
            { id: 'sello_arcano', label: 'Levantar un sello arcano defensivo', outcome: 'Frenas la horda y estabilizas al equipo.', effects: { progress: 1, threat: -2, morale: 1 } }
        ]
    },
    {
        id: 'camara_del_nucleo',
        title: 'Camara del Nucleo',
        description: 'Llegais al nucleo de la amenaza. El tiempo para decidir se agota.',
        choices: [
            { id: 'ataque_final', label: 'Ejecutar ataque final', outcome: 'Golpeas el corazon del problema en una ofensiva total.', effects: { progress: 3, threat: 2, morale: 0 } },
            { id: 'desactivar_fuente', label: 'Desactivar la fuente de corrupcion', outcome: 'Controlas la crisis con precision y bajas contenidas.', effects: { progress: 2, threat: -1, morale: 1 } },
            { id: 'evacuacion_tactica', label: 'Evacuar y sellar el sector', outcome: 'Salvas al equipo, pero el capitulo queda parcialmente abierto.', effects: { progress: 1, threat: -1, morale: 0 } }
        ]
    }
];
function normalizeId(value) {
    return String(value || '').trim();
}
function normalizePlayers(players) {
    return (Array.isArray(players) ? players : []).map((player) => ({
        ...player,
        userId: normalizeId(player.userId),
        username: String(player.username || '').trim(),
        character: player.character || null,
        role: player.role || null
    }));
}
function getRoleById(roleId) {
    const normalized = String(roleId || '').trim().toLowerCase();
    return ROLE_CATALOG.find((role) => role.id === normalized) || null;
}
function getRolePriority(roleId) {
    return getRoleById(roleId)?.priority || 999;
}
function sceneAt(index) {
    const safeIndex = Number.isFinite(Number(index)) ? Number(index) : 0;
    const total = STORY_SCENES.length;
    return STORY_SCENES[((safeIndex % total) + total) % total];
}
function cloneChoices(scene) {
    return (scene?.choices || []).map((choice) => ({
        id: choice.id,
        label: choice.label,
        outcome: choice.outcome,
        effects: {
            progress: Number(choice?.effects?.progress || 0),
            threat: Number(choice?.effects?.threat || 0),
            morale: Number(choice?.effects?.morale || 0)
        }
    }));
}
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
function normalizeMetrics(metrics) {
    return {
        progress: Number(metrics?.progress || 0),
        threat: Number(metrics?.threat || 0),
        morale: Number(metrics?.morale || 5)
    };
}
function applyChoiceMetrics(metrics, effects) {
    const base = normalizeMetrics(metrics);
    return {
        progress: clamp(base.progress + Number(effects?.progress || 0), 0, 20),
        threat: clamp(base.threat + Number(effects?.threat || 0), 0, 20),
        morale: clamp(base.morale + Number(effects?.morale || 0), 0, 12)
    };
}
function buildTurnOrder(players, roleAssignments) {
    return [...players]
        .sort((left, right) => {
            const leftId = normalizeId(left.userId);
            const rightId = normalizeId(right.userId);
            const roleDiff = getRolePriority(roleAssignments[leftId]) - getRolePriority(roleAssignments[rightId]);
            if (roleDiff !== 0) return roleDiff;
            const leftJoined = new Date(left.joinedAt || 0).getTime();
            const rightJoined = new Date(right.joinedAt || 0).getTime();
            return leftJoined - rightJoined;
        })
        .map((player) => normalizeId(player.userId));
}
function hasLeaderAssigned(roleAssignments) {
    return Object.values(roleAssignments || {}).some((roleId) => roleId === 'lider');
}
function allPlayersHaveRole(players, roleAssignments) {
    return players.length > 0 && players.every((player) => Boolean(roleAssignments[normalizeId(player.userId)]));
}
function roleSelectionState(players) {
    return {
        phase: 'role-selection',
        roleCatalog: ROLE_CATALOG,
        roleAssignments: {},
        turnOrder: [],
        currentTurnIndex: 0,
        currentTurnUserId: '',
        turnRound: 1,
        day: 1,
        dayLimit: DEFAULT_DAY_LIMIT,
        sceneIndex: 0,
        sceneTitle: 'Asignacion de roles',
        sceneText: 'Cada jugador debe escoger un rol. Es obligatorio que haya un Lider antes de iniciar turnos.',
        choices: [],
        metrics: { progress: 0, threat: 0, morale: 5 },
        log: [{
            type: 'system',
            message: 'La sala ha iniciado la preparacion. Elegid rol para definir el orden de turnos.',
            at: new Date()
        }],
        startedAt: new Date(),
        updatedAt: new Date()
    };
}
function summarizeRun(metrics, reason) {
    const data = normalizeMetrics(metrics);
    const status = data.threat >= 12 || data.morale <= 0
        ? 'La escuadra sobrevive, pero el coste ha sido extremo.'
        : (data.progress >= 12 ? 'Objetivo principal cumplido por la escuadra.' : 'El capitulo termina con progreso parcial.');
    return `Capitulo cerrado (${reason}). ${status} Progreso ${data.progress}, Amenaza ${data.threat}, Moral ${data.morale}.`;
}
function findPlayer(players, userId) {
    const target = normalizeId(userId);
    return players.find((player) => normalizeId(player.userId) === target) || null;
}
function isHost(room, userId) {
    return normalizeId(room?.hostId) === normalizeId(userId);
}
async function loadRoom(roomCode) {
    if (!roomCode) return null;
    const room = await Room.findByCode(String(roomCode).trim());
    if (!room) return null;
    room.players = normalizePlayers(room.players);
    return room;
}
class RoomController {
    static async createRoom(req, res) {
        try {
            const { roomName, maxPlayers, userId, username, character } = req.body;
            if (!roomName || !userId || !username) {
                return res.status(400).json({
                    success: false,
                    message: 'Faltan campos requeridos: roomName, userId, username'
                });
            }
            const roomCode = crypto.randomBytes(3).toString('hex').toUpperCase();
            const room = await Room.create({
                roomCode,
                roomName,
                maxPlayers: Number(maxPlayers) || 4,
                hostId: normalizeId(userId),
                hostName: String(username).trim(),
                character: character || null
            });
            return res.status(201).json({
                success: true,
                message: 'Sala creada correctamente',
                room: { ...room, players: normalizePlayers(room.players) }
            });
        } catch (error) {
            console.error('Error creating room:', error);
            return res.status(500).json({ success: false, message: 'Error creating room', error: error.message });
        }
    }
    static async getActiveRooms(req, res) {
        try {
            const rooms = await Room.getActiveRooms();
            return res.status(200).json({
                success: true,
                rooms: rooms.map((room) => ({ ...room, players: normalizePlayers(room.players) }))
            });
        } catch (error) {
            console.error('Error fetching rooms:', error);
            return res.status(500).json({ success: false, message: 'Error fetching rooms', error: error.message });
        }
    }
    static async getRoomDetails(req, res) {
        try {
            const { roomCode } = req.params;
            if (!roomCode) {
                return res.status(400).json({ success: false, message: 'Room code is required' });
            }
            const room = await loadRoom(roomCode);
            if (!room) {
                return res.status(404).json({ success: false, message: 'Room not found' });
            }
            return res.status(200).json({
                success: true,
                room,
                roleCatalog: ROLE_CATALOG
            });
        } catch (error) {
            console.error('Error fetching room details:', error);
            return res.status(500).json({ success: false, message: 'Error fetching room details', error: error.message });
        }
    }
    static async joinRoom(req, res) {
        try {
            const { roomCode, userId, username, character } = req.body;
            const normalizedUserId = normalizeId(userId);
            if (!roomCode || !normalizedUserId || !username) {
                return res.status(400).json({ success: false, message: 'Missing required fields: roomCode, userId, username' });
            }
            const room = await loadRoom(roomCode);
            if (!room) {
                return res.status(404).json({ success: false, message: 'Room not found' });
            }
            const alreadyJoined = room.players.some((player) => normalizeId(player.userId) === normalizedUserId);
            if (alreadyJoined) {
                return res.status(200).json({
                    success: true,
                    message: 'Player already in room',
                    room
                });
            }
            if (room.players.length >= room.maxPlayers) {
                return res.status(400).json({ success: false, message: 'Room is full' });
            }
            if (room.status !== 'waiting') {
                return res.status(400).json({ success: false, message: 'Room is not accepting new players' });
            }
            await Room.addPlayer(roomCode, normalizedUserId, String(username).trim(), character || null);
            const updatedRoom = await loadRoom(roomCode);
            return res.status(200).json({ success: true, message: 'Joined room successfully', room: updatedRoom });
        } catch (error) {
            console.error('Error joining room:', error);
            return res.status(500).json({ success: false, message: 'Error joining room', error: error.message });
        }
    }
    static async leaveRoom(req, res) {
        try {
            const { roomCode, userId } = req.body;
            const normalizedUserId = normalizeId(userId);
            if (!roomCode || !normalizedUserId) {
                return res.status(400).json({ success: false, message: 'Missing required fields: roomCode, userId' });
            }
            const room = await loadRoom(roomCode);
            if (!room) {
                return res.status(404).json({ success: false, message: 'Room not found' });
            }
            if (isHost(room, normalizedUserId)) {
                await Room.delete(roomCode);
                return res.status(200).json({ success: true, message: 'Room deleted (host left)' });
            }
            await Room.removePlayer(roomCode, normalizedUserId);
            const updatedRoom = await loadRoom(roomCode);
            if (!updatedRoom) {
                return res.status(200).json({ success: true, message: 'Left room successfully' });
            }
            const gameState = updatedRoom.gameState && typeof updatedRoom.gameState === 'object'
                ? { ...updatedRoom.gameState }
                : null;
            if (gameState && gameState.phase && gameState.phase !== 'completed') {
                const assignments = { ...(gameState.roleAssignments || {}) };
                delete assignments[normalizedUserId];
                const nextTurnOrder = Array.isArray(gameState.turnOrder)
                    ? gameState.turnOrder.filter((id) => normalizeId(id) !== normalizedUserId)
                    : [];
                let nextTurnIndex = Number.isFinite(Number(gameState.currentTurnIndex))
                    ? Number(gameState.currentTurnIndex)
                    : 0;
                if (nextTurnOrder.length > 0 && nextTurnIndex >= nextTurnOrder.length) {
                    nextTurnIndex = 0;
                }
                const nextTurnUserId = nextTurnOrder[nextTurnIndex] || '';
                const nextState = {
                    ...gameState,
                    roleAssignments: assignments,
                    turnOrder: nextTurnOrder,
                    currentTurnIndex: nextTurnIndex,
                    currentTurnUserId: nextTurnUserId,
                    updatedAt: new Date()
                };
                if (gameState.phase === 'active' && nextTurnOrder.length === 0) {
                    nextState.phase = 'completed';
                    nextState.sceneTitle = 'Partida interrumpida';
                    nextState.sceneText = 'La escuadra se disolvio antes de completar el capitulo.';
                    nextState.choices = [];
                }
                const log = Array.isArray(nextState.log) ? [...nextState.log] : [];
                log.push({
                    type: 'system',
                    message: `Un miembro ha abandonado la sala (${normalizedUserId}).`,
                    at: new Date()
                });
                nextState.log = log.slice(-120);
                await Room.collection().updateOne(
                    { roomCode: updatedRoom.roomCode },
                    { $set: { gameState: nextState, updatedAt: new Date() } }
                );
            }
            return res.status(200).json({ success: true, message: 'Left room successfully' });
        } catch (error) {
            console.error('Error leaving room:', error);
            return res.status(500).json({ success: false, message: 'Error leaving room', error: error.message });
        }
    }
    static async startGame(req, res) {
        try {
            const { roomCode, userId } = req.body;
            const normalizedUserId = normalizeId(userId);
            if (!roomCode || !normalizedUserId) {
                return res.status(400).json({ success: false, message: 'Missing required fields: roomCode, userId' });
            }
            const room = await loadRoom(roomCode);
            if (!room) {
                return res.status(404).json({ success: false, message: 'Room not found' });
            }
            if (!isHost(room, normalizedUserId)) {
                return res.status(403).json({ success: false, message: 'Only host can start the game' });
            }
            if (room.players.length < MIN_PLAYERS_TO_START) {
                return res.status(400).json({
                    success: false,
                    message: `Se necesitan al menos ${MIN_PLAYERS_TO_START} jugadores para iniciar la partida de grupo.`
                });
            }
            const withoutCharacter = room.players.filter((player) => !player.character);
            if (withoutCharacter.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: `Estos jugadores deben elegir personaje antes de iniciar: ${withoutCharacter.map((player) => player.username).join(', ')}`
                });
            }
            const resetPlayers = room.players.map((player) => ({ ...player, role: null }));
            const gameState = roleSelectionState(resetPlayers);
            await Room.collection().updateOne(
                { roomCode: room.roomCode },
                {
                    $set: {
                        status: 'in-progress',
                        players: resetPlayers,
                        gameState,
                        updatedAt: new Date()
                    }
                }
            );
            const updatedRoom = await loadRoom(roomCode);
            return res.status(200).json({
                success: true,
                message: 'Partida de grupo iniciada. Asignad roles para comenzar turnos.',
                room: updatedRoom,
                roleCatalog: ROLE_CATALOG
            });
        } catch (error) {
            console.error('Error starting game:', error);
            return res.status(500).json({ success: false, message: 'Error starting game', error: error.message });
        }
    }
    static async setCharacter(req, res) {
        try {
            const { roomCode, userId, character } = req.body;
            const normalizedUserId = normalizeId(userId);
            const normalizedCharacter = String(character || '').trim();
            if (!roomCode || !normalizedUserId || !normalizedCharacter) {
                return res.status(400).json({ success: false, message: 'Missing required fields: roomCode, userId, character' });
            }
            const room = await loadRoom(roomCode);
            if (!room) {
                return res.status(404).json({ success: false, message: 'Room not found' });
            }
            const player = findPlayer(room.players, normalizedUserId);
            if (!player) {
                return res.status(404).json({ success: false, message: 'Player not found in room' });
            }
            const players = room.players.map((entry) => {
                if (normalizeId(entry.userId) !== normalizedUserId) return entry;
                return { ...entry, character: normalizedCharacter };
            });
            await Room.collection().updateOne(
                { roomCode: room.roomCode },
                { $set: { players, updatedAt: new Date() } }
            );
            if (ObjectId.isValid(normalizedUserId)) {
                await getDB().collection('users').updateOne(
                    { _id: new ObjectId(normalizedUserId) },
                    { $set: { character: normalizedCharacter, updatedAt: new Date() } }
                );
            }
            const updatedRoom = await loadRoom(roomCode);
            return res.status(200).json({ success: true, message: 'Personaje asignado', room: updatedRoom });
        } catch (error) {
            console.error('Error setting character:', error);
            return res.status(500).json({ success: false, message: 'Error setting character', error: error.message });
        }
    }
    static async assignRole(req, res) {
        try {
            const { roomCode, userId, roleId } = req.body;
            const normalizedUserId = normalizeId(userId);
            const normalizedRoleId = String(roleId || '').trim().toLowerCase();
            if (!roomCode || !normalizedUserId || !normalizedRoleId) {
                return res.status(400).json({ success: false, message: 'Missing required fields: roomCode, userId, roleId' });
            }
            const role = getRoleById(normalizedRoleId);
            if (!role) {
                return res.status(400).json({ success: false, message: 'Rol no valido' });
            }
            const room = await loadRoom(roomCode);
            if (!room) {
                return res.status(404).json({ success: false, message: 'Room not found' });
            }
            if (room.status !== 'in-progress') {
                return res.status(400).json({ success: false, message: 'La partida no esta iniciada' });
            }
            const gameState = room.gameState && typeof room.gameState === 'object'
                ? { ...room.gameState }
                : roleSelectionState(room.players);
            if (gameState.phase !== 'role-selection') {
                return res.status(409).json({ success: false, message: 'La fase de roles ya ha terminado' });
            }
            const player = findPlayer(room.players, normalizedUserId);
            if (!player) {
                return res.status(404).json({ success: false, message: 'Player not found in room' });
            }
            if (!player.character) {
                return res.status(400).json({ success: false, message: 'Debes elegir personaje antes de seleccionar rol' });
            }
            const roleAssignments = { ...(gameState.roleAssignments || {}) };
            const ownerOfRole = Object.entries(roleAssignments)
                .find(([ownerId, assignedRoleId]) => assignedRoleId === normalizedRoleId && normalizeId(ownerId) !== normalizedUserId);
            if (ownerOfRole) {
                return res.status(409).json({ success: false, message: `El rol ${role.label} ya esta asignado.` });
            }
            roleAssignments[normalizedUserId] = normalizedRoleId;
            const players = room.players.map((entry) => {
                const entryUserId = normalizeId(entry.userId);
                if (entryUserId !== normalizedUserId) {
                    return {
                        ...entry,
                        role: roleAssignments[entryUserId] || null
                    };
                }
                return {
                    ...entry,
                    role: normalizedRoleId
                };
            });
            const nextLog = Array.isArray(gameState.log) ? [...gameState.log] : [];
            nextLog.push({
                type: 'system',
                message: `${player.username} asume el rol ${role.label}.`,
                at: new Date()
            });
            const nextState = {
                ...gameState,
                roleCatalog: ROLE_CATALOG,
                roleAssignments,
                log: nextLog.slice(-120),
                updatedAt: new Date()
            };
            if (allPlayersHaveRole(players, roleAssignments) && hasLeaderAssigned(roleAssignments)) {
                const turnOrder = buildTurnOrder(players, roleAssignments);
                const firstScene = sceneAt(0);
                const currentTurnUserId = turnOrder[0] || '';
                const currentTurnPlayer = players.find((entry) => normalizeId(entry.userId) === currentTurnUserId);
                nextState.phase = 'active';
                nextState.turnOrder = turnOrder;
                nextState.currentTurnIndex = 0;
                nextState.currentTurnUserId = currentTurnUserId;
                nextState.turnRound = 1;
                nextState.day = 1;
                nextState.dayLimit = DEFAULT_DAY_LIMIT;
                nextState.sceneIndex = 0;
                nextState.sceneTitle = firstScene.title;
                nextState.sceneText = firstScene.description;
                nextState.choices = cloneChoices(firstScene);
                nextState.metrics = normalizeMetrics(nextState.metrics);
                nextState.log = [...nextState.log, {
                    type: 'system',
                    message: `Todos los roles estan listos. Comienza el turno de ${currentTurnPlayer?.username || 'la escuadra'}.`,
                    at: new Date()
                }].slice(-120);
            }
            await Room.collection().updateOne(
                { roomCode: room.roomCode },
                {
                    $set: {
                        players,
                        gameState: nextState,
                        updatedAt: new Date()
                    }
                }
            );
            const updatedRoom = await loadRoom(roomCode);
            return res.status(200).json({
                success: true,
                message: 'Rol asignado correctamente',
                room: updatedRoom,
                roleCatalog: ROLE_CATALOG
            });
        } catch (error) {
            console.error('Error assigning role:', error);
            return res.status(500).json({ success: false, message: 'Error assigning role', error: error.message });
        }
    }
    static async submitTurnChoice(req, res) {
        try {
            const { roomCode, userId, choiceId } = req.body;
            const normalizedUserId = normalizeId(userId);
            const normalizedChoiceId = String(choiceId || '').trim().toLowerCase();
            if (!roomCode || !normalizedUserId || !normalizedChoiceId) {
                return res.status(400).json({ success: false, message: 'Missing required fields: roomCode, userId, choiceId' });
            }
            const room = await loadRoom(roomCode);
            if (!room) {
                return res.status(404).json({ success: false, message: 'Room not found' });
            }
            const gameState = room.gameState && typeof room.gameState === 'object' ? { ...room.gameState } : null;
            if (!gameState || gameState.phase !== 'active') {
                return res.status(409).json({ success: false, message: 'La partida no esta en fase de turnos activa' });
            }
            const currentTurnUserId = normalizeId(gameState.currentTurnUserId);
            if (currentTurnUserId !== normalizedUserId) {
                const currentPlayer = findPlayer(room.players, currentTurnUserId);
                return res.status(403).json({
                    success: false,
                    message: `No es tu turno. Juega ${currentPlayer?.username || 'otro jugador'}.`
                });
            }
            const actingPlayer = findPlayer(room.players, normalizedUserId);
            if (!actingPlayer) {
                return res.status(404).json({ success: false, message: 'Player not found in room' });
            }
            const currentScene = sceneAt(gameState.sceneIndex || 0);
            const selectedChoice = (currentScene.choices || []).find((choice) => choice.id === normalizedChoiceId);
            if (!selectedChoice) {
                return res.status(400).json({ success: false, message: 'La eleccion no existe para esta escena' });
            }
            const nextMetrics = applyChoiceMetrics(gameState.metrics, selectedChoice.effects);
            const log = Array.isArray(gameState.log) ? [...gameState.log] : [];
            log.push({
                type: 'turn',
                username: actingPlayer.username,
                userId: normalizedUserId,
                role: gameState.roleAssignments?.[normalizedUserId] || actingPlayer.role || null,
                sceneId: currentScene.id,
                sceneTitle: currentScene.title,
                choiceId: selectedChoice.id,
                choiceLabel: selectedChoice.label,
                outcome: selectedChoice.outcome,
                at: new Date()
            });
            const turnOrder = Array.isArray(gameState.turnOrder) ? gameState.turnOrder.map((id) => normalizeId(id)).filter(Boolean) : [];
            if (turnOrder.length === 0) {
                return res.status(409).json({ success: false, message: 'No hay orden de turnos configurado' });
            }
            const currentTurnIndex = Number.isFinite(Number(gameState.currentTurnIndex))
                ? Number(gameState.currentTurnIndex)
                : 0;
            let nextTurnIndex = currentTurnIndex + 1;
            let nextRound = Number.isFinite(Number(gameState.turnRound)) ? Number(gameState.turnRound) : 1;
            let nextDay = Number.isFinite(Number(gameState.day)) ? Number(gameState.day) : 1;
            if (nextTurnIndex >= turnOrder.length) {
                nextTurnIndex = 0;
                nextRound += 1;
                nextDay += 1;
            }
            const dayLimit = Number.isFinite(Number(gameState.dayLimit)) ? Number(gameState.dayLimit) : DEFAULT_DAY_LIMIT;
            const progressWin = nextMetrics.progress >= 12;
            const threatFail = nextMetrics.threat >= 12 || nextMetrics.morale <= 0;
            const dayLimitReached = nextDay > dayLimit;
            const nextState = {
                ...gameState,
                metrics: nextMetrics,
                turnRound: nextRound,
                day: nextDay,
                currentTurnIndex: nextTurnIndex,
                updatedAt: new Date()
            };
            if (progressWin || threatFail || dayLimitReached) {
                const reason = progressWin
                    ? 'objetivo cumplido'
                    : (threatFail ? 'amenaza critica' : 'limite de dias alcanzado');
                nextState.phase = 'completed';
                nextState.currentTurnUserId = '';
                nextState.choices = [];
                nextState.sceneTitle = 'Capitulo finalizado';
                nextState.sceneText = summarizeRun(nextMetrics, reason);
                nextState.log = [...log, {
                    type: 'system',
                    message: nextState.sceneText,
                    at: new Date()
                }].slice(-120);
            } else {
                const nextSceneIndex = (Number(gameState.sceneIndex || 0) + 1) % STORY_SCENES.length;
                const nextScene = sceneAt(nextSceneIndex);
                const nextTurnUserId = turnOrder[nextTurnIndex] || '';
                const nextTurnPlayer = findPlayer(room.players, nextTurnUserId);
                nextState.phase = 'active';
                nextState.sceneIndex = nextSceneIndex;
                nextState.sceneTitle = nextScene.title;
                nextState.sceneText = nextScene.description;
                nextState.choices = cloneChoices(nextScene);
                nextState.currentTurnUserId = nextTurnUserId;
                nextState.log = [...log, {
                    type: 'system',
                    message: `Turno de ${nextTurnPlayer?.username || 'la escuadra'} en ${nextScene.title}.`,
                    at: new Date()
                }].slice(-120);
            }
            const updateResult = await Room.collection().updateOne(
                {
                    roomCode: room.roomCode,
                    'gameState.currentTurnUserId': normalizedUserId,
                    'gameState.phase': 'active'
                },
                {
                    $set: {
                        gameState: nextState,
                        updatedAt: new Date()
                    }
                }
            );
            if (updateResult.modifiedCount === 0) {
                return res.status(409).json({
                    success: false,
                    message: 'El turno ya fue procesado por otra accion. Refresca estado.'
                });
            }
            const updatedRoom = await loadRoom(roomCode);
            return res.status(200).json({
                success: true,
                message: 'Turno procesado',
                room: updatedRoom
            });
        } catch (error) {
            console.error('Error submitting turn choice:', error);
            return res.status(500).json({ success: false, message: 'Error submitting turn choice', error: error.message });
        }
    }
    static async getPlayerRooms(req, res) {
        try {
            const { userId } = req.params;
            if (!userId) {
                return res.status(400).json({ success: false, message: 'User ID is required' });
            }
            const normalizedUserId = normalizeId(userId);
            const rooms = await Room.getPlayerRooms(normalizedUserId);
            return res.status(200).json({
                success: true,
                rooms: rooms.map((room) => ({ ...room, players: normalizePlayers(room.players) }))
            });
        } catch (error) {
            console.error('Error fetching player rooms:', error);
            return res.status(500).json({ success: false, message: 'Error fetching player rooms', error: error.message });
        }
    }
    static async deleteRoom(req, res) {
        try {
            const { roomCode, userId } = req.body;
            const normalizedUserId = normalizeId(userId);
            if (!roomCode || !normalizedUserId) {
                return res.status(400).json({ success: false, message: 'Missing required fields: roomCode, userId' });
            }
            const room = await loadRoom(roomCode);
            if (!room) {
                return res.status(404).json({ success: false, message: 'Room not found' });
            }
            if (!isHost(room, normalizedUserId)) {
                return res.status(403).json({ success: false, message: 'Only the host can delete the room' });
            }
            await Room.delete(roomCode);
            return res.status(200).json({ success: true, message: 'Room deleted successfully' });
        } catch (error) {
            console.error('Error deleting room:', error);
            return res.status(500).json({ success: false, message: 'Error deleting room', error: error.message });
        }
    }
}
module.exports = RoomController;
