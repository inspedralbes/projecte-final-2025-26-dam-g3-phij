require('dotenv').config();
const { connectDB, getDB } = require('../config/db');

const now = new Date();

const systemPrompt = `Eres el narrador principal de "Valkrypt", un RPG de fantasía oscura.
Reglas globales:
- Responde siempre en español.
- Mantén un tono inmersivo, tenso y cinematográfico.
- Integra la acción del jugador de forma coherente con el contexto previo.
- Avanza la trama con consecuencias claras.
- Escribe la narrativa de forma desarrollada y natural, sin límite estricto de palabras. Evita respuestas telegráficas.
- Si la acción del jugador es violenta, imprudente o desafiante, prioriza eventos de combate.
- Debe aparecer una situación de combate con frecuencia (aprox. cada 2 acciones).
- Si hay combate, usa tipo_combate válido: escaramuza, elite o jefe.
- Si no hay combate, usa tipo_combate: ninguno.

Debes responder SIEMPRE en este formato exacto:
<NARRATIVA>
Texto narrativo aquí
</NARRATIVA>
<DECISIONES>
1) [id:accion_valida_1] Opción 1
2) [id:accion_valida_2] Opción 2
3) [id:accion_valida_3] Opción 3
</DECISIONES>
<EVENTOS>
combate: si|no
tipo_combate: escaramuza|elite|jefe|ninguno
enemigo: nombre corto o ninguno
entorno: lugar corto
tono: descriptor corto
</EVENTOS>`.trim();

const narrativeSettings = {
  key: 'global',
  active: true,
  defaultDayLimit: 30,
  introTemplate: 'La crónica "{campaignTitle}" comienza en {locationName}. Las decisiones del grupo moldearán el destino del reino. Nadie conoce aún la magnitud de lo que aguarda bajo la piedra.',
  tutorialTemplate: 'TUTORIAL DE CAMPAÑA:\n1) Cada día se divide en mañana, tarde y noche (3 acciones por día).\n2) Coordina cada turno según el tramo horario actual.\n3) La campaña termina cuando se agotan los días del capítulo.\n4) Te quedan {dayLimit} días para resolver esta misión principal.',
  initialOptions: [
    { id: 'explorar', label: 'Explorar la zona', type: 'narrative' },
    { id: 'avanzar', label: 'Avanzar por el sendero', type: 'narrative' },
    { id: 'revisar_equipo', label: 'Revisar equipo y recursos', type: 'narrative' }
  ],
  generationConfig: {
    temperature: 0.75,
    maxOutputTokens: 4096
  },
  systemPrompt,
  updatedAt: now
};

async function seedNarrativeSettings() {
  await connectDB();
  const db = getDB();
  const collection = db.collection('narrative_settings');

  await collection.updateOne(
    { key: narrativeSettings.key },
    { $set: narrativeSettings, $setOnInsert: { createdAt: now } },
    { upsert: true }
  );

  console.log('Narrative settings upserted: key=global');
}

seedNarrativeSettings()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error seeding narrative settings:', error);
    process.exit(1);
  });
