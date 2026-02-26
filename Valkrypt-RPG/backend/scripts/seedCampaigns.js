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

