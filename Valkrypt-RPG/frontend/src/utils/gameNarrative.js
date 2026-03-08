export function compactNarrative(text) {
  return String(text || '').trim();
}

export function extractNarrativeText(fullOutput) {
  if (!fullOutput || typeof fullOutput !== 'string') return '';
  const blockMatch = fullOutput.match(/<NARRATIVA>([\s\S]*?)<\/NARRATIVA>/i);
  if (blockMatch?.[1]) return compactNarrative(blockMatch[1]);
  return compactNarrative(
    fullOutput
      .split('<DECISIONES>')[0]
      .replace(/<\/?NARRATIVA>/gi, '')
      .trim()
  );
}

export function parseEventTags(text, defaultEnvironment = '') {
  const safeText = String(text || '');
  const eventMatch = safeText.match(/<EVENTOS>([\s\S]*?)<\/EVENTOS>/i);
  const block = eventMatch?.[1] || safeText;
  const getField = (field) => {
    const match = block.match(new RegExp(`${field}\\s*:\\s*([^\\n]+)`, 'i'));
    return match?.[1] ? match[1].trim() : '';
  };
  const combateRaw = getField('combate').toLowerCase();
  return {
    combate: combateRaw === 'si' || combateRaw === 'sí',
    tipo: getField('tipo_combate') || 'escaramuza',
    enemigo: getField('enemigo') || 'hostiles desconocidos',
    entorno: getField('entorno') || defaultEnvironment,
    tono: getField('tono') || ''
  };
}

export function buildFallbackOptions(combatFirst = false) {
  const base = [
    { id: 'explorar_entorno', label: 'Explorar el entorno inmediato', type: 'narrative' },
    { id: 'avanzar_cautela', label: 'Avanzar con cautela', type: 'narrative' },
    { id: 'asegurar_recursos', label: 'Reagruparse y asegurar recursos', type: 'narrative' }
  ];
  if (combatFirst) {
    base[0] = { id: 'entrar_en_combate', label: 'Entrar en combate y tomar la iniciativa', type: 'combat' };
  }
  return base;
}

export function processFinalTags(text, eventMeta = null) {
  if (!text || typeof text !== 'string') return [];
  const events = eventMeta || parseEventTags(text, '');
  const combatLabelRegex = /(atacar|combat|embosc|cargar|golpear|defender|retirada táctica|retirada tactica|duelo|asalto)/i;
  const openTag = '<DECISIONES>';
  const closeTag = '</DECISIONES>';
  const openIdx = text.indexOf(openTag);
  if (openIdx === -1) return [];

  let block = text.slice(openIdx + openTag.length);
  const closeIdx = block.indexOf(closeTag);
  if (closeIdx !== -1) block = block.slice(0, closeIdx);
  const eventsIdx = block.indexOf('<EVENTOS>');
  if (eventsIdx !== -1) block = block.slice(0, eventsIdx);

  const toId = (label, i) => {
    const base = String(label || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40);
    return base || `opcion_${Date.now()}_${i + 1}`;
  };

  const options = block
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, i) => {
      const withId = line.match(/\[id:([^\]]+)\]\s*(.*)/i);
      if (withId) {
        const label = withId[2].trim();
        const type = combatLabelRegex.test(label) ? 'combat' : 'narrative';
        return { id: withId[1].trim(), label, type };
      }
      const numbered = line.match(/^\d+\)\s*(.*)/);
      if (numbered && numbered[1].trim()) {
        const label = numbered[1].trim();
        const type = combatLabelRegex.test(label) ? 'combat' : 'narrative';
        return { id: toId(label, i), label, type };
      }
      return null;
    })
    .filter((option) => option && option.label);

  if (events.combate) {
    const hasCombat = options.some((option) => option.type === 'combat');
    if (!hasCombat && options[0]) options[0] = { ...options[0], type: 'combat' };
  }

  return options;
}
