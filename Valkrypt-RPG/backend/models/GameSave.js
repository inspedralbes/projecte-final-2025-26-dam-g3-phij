const GameState = require('../models/GameState');

const GameSaveController = {
  loadGame: async (req, res) => {
    try {
      const { userId } = req.params;
      

      const gameState = await GameState.findOne({ userId });


      if (!gameState) {
        return res.status(404).json({ message: "No se encontró partida guardada para este usuario." });
      }

      return res.status(200).json(gameState);
    } catch (error) {
      console.error("Error al cargar de Atlas:", error);
      return res.status(500).json({ message: "Error en la conexión con la base de datos." });
    }
  },


  handleAction: async (req, res) => {
    try {
      const { userId, action } = req.body;
      const gameState = await GameState.findOne({ userId });

      if (!gameState) {
        return res.status(404).json({ message: "No puedes realizar una acción sin una partida activa." });
      }


      gameState.history.push({ 
        type: "narrative", 
        content: `> Has elegido: ${action.label}` 
      });
      
      await gameState.save();
      return res.status(200).json(gameState);
    } catch (error) {
      console.error("Error al guardar acción:", error);
      return res.status(500).json({ message: "Error al actualizar el historial." });
    }
  },

  updateHealth: async (userId, heroName, damageAmount) => {
    try {
      const gameState = await GameState.findOne({ userId });
      if (!gameState) return;

      gameState.party = gameState.party.map(hero => {
        if (hero.name.toLowerCase() === heroName.toLowerCase()) {
          hero.hp = Math.max(0, hero.hp - damageAmount);
        }
        return hero;
      });

      await gameState.save();
      return gameState;
    } catch (error) {
      console.error("Error actualizando vida real:", error);
    }
  }
};

module.exports = GameSaveController;