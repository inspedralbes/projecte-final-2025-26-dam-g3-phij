require('dotenv').config();
const { connectDB, getDB } = require('../config/db');

const now = new Date();

const coreHeroes = [
  {
    id: 'kaelen',
    name: 'Kaelen',
    role: 'Guerrero ex-capitán',
    weapon: 'Mandoble "Rompehuesos"',
    icon: '⚔️',
    hp: 52,
    maxHp: 52
  },
  {
    id: 'vax',
    name: 'Vax "Dedos de Hollín"',
    role: 'Pícaro y estafador',
    weapon: 'Dagas curvas gemelas',
    icon: '🗡️',
    hp: 38,
    maxHp: 38
  },
  {
    id: 'elara',
    name: 'Elara Vane',
    role: 'Arcanista de la Disformidad',
    weapon: 'Magia rúnica inestable',
    icon: '🩸',
    hp: 30,
    maxHp: 30
  },
  {
    id: 'sorin',
    name: 'Sorin',
    role: 'Clérigo excomulgado',
    weapon: 'Ritos de sangre y sanación',
    icon: '⚖️',
    hp: 44,
    maxHp: 44
  }
];

const campaigns = [
  {
    id: 'piedraprofunda',
    slug: 'piedraprofunda',
    title: 'La Sombra de Piedraprofunda',
    desc: 'Cuatro condenados por la Corona son enviados a las minas de Piedraprofunda para cerrar una Grieta Mayor antes de que el Abismo devore Valkrypt.',
    location: 'Minas de Piedraprofunda',
    img: 'https://images.unsplash.com/photo-1519074063912-ad25b5ce4924?q=80&w=600',
    dayLimit: 30,
    introText: 'La Corona ha marcado a tu escuadra para una misión urgente en Piedraprofunda. El objetivo oficial es investigar la desaparición de los convoyes mineros. Lo que hallaréis allí pondrá a prueba vuestra lealtad, vuestra sangre y vuestra capacidad de decidir bajo presión.',
    tutorialText: 'TUTORIAL: Cada decisión consume tiempo. Lee el historial antes de actuar, coordina al grupo y prioriza objetivos. Esta campaña tiene 30 días y 3 acciones por día (mañana, tarde y noche): cuando se agoten, el capítulo terminará con el estado que hayas logrado.',
    active: true,
    lore: {
      sourceTitle: 'Valkrypt (PDF)',
      chapters: [
        'Lluvia de Ceniza y Dados Cargados',
        'La Oferta del Diablo',
        'Ecos en la Niebla',
        'La Liturgia del Silencio',
        'El Precio de la Sangre y el Fuego',
        'Oro Manchado y Pergaminos de Sangre',
        'Los Dueños del Perro Ciego'
      ],
      arc: 'Primera campaña: incursión a Piedraprofunda, clausura de la Grieta y revelación de la conspiración de la Corona.'
    },
    heroes: coreHeroes,
    updatedAt: now
  },
  {
    id: 'minas',
    slug: 'minas-del-norte',
    title: 'El Invierno de las Minas',
    desc: 'Tras Piedraprofunda, la corte prepara las Minas del Norte para la Gran Apertura. El invierno trae cultos, anomalías y una guerra por la barrera entre mundos.',
    location: 'Minas del Norte',
    img: 'https://images.unsplash.com/photo-1505118380757-91f5f5832de0?q=80&w=600',
    dayLimit: 36,
    introText: 'El eco de Piedraprofunda todavía no se ha extinguido y ya llegan informes peores desde el Norte. Tu escuadra entra en un territorio congelado donde la logística, la moral y el tiempo son tan letales como cualquier criatura del Abismo.',
    tutorialText: 'TUTORIAL: Gestiona riesgos por día, evita combates innecesarios y conserva recursos para eventos críticos. Esta campaña dispone de 36 días de capítulo y 3 acciones por día antes del cierre narrativo.',
    active: true,
    lore: {
      sourceTitle: 'Valkrypt (PDF)',
      arc: 'Campaña siguiente sugerida por el epílogo: expansión de la Disformidad y plan del Rey de la Máscara de Hierro.'
    },
    heroes: coreHeroes,
    updatedAt: now
  }
];

async function seedCampaigns() {
  await connectDB();
  const db = getDB();
  const collection = db.collection('campaigns');

  let insertedOrUpdated = 0;
  for (const campaign of campaigns) {
    const { id } = campaign;
    const existing = await collection.findOne({ id });
    const update = existing
      ? { $set: campaign }
      : { $set: { ...campaign, createdAt: now } };

    await collection.updateOne({ id }, update, { upsert: true });
    insertedOrUpdated += 1;
  }

  console.log(`Campaigns upserted: ${insertedOrUpdated}`);
}

seedCampaigns()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error seeding campaigns:', error);
    process.exit(1);
  });
