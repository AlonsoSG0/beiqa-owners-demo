// matching.js — Reglas de coincidencia entre registros. Lógica pura, sin DOM.
//
// Criterio:
//   1. Un VETO es binario y gana al puntaje: impide vincular, nunca promueve a revisión.
//   2. Un dato faltante NO puntúa: el score se normaliza sobre lo que se pudo comparar,
//      y la cobertura se publica al lado para que nadie se engañe con un 100 de aire.
//   3. Sin ancla de ubicación no hay comparación posible: compartir el tipo no es evidencia.
//   4. El sistema VINCULA (adjunta el anuncio); una persona FUSIONA (decide la entidad).

const THRESHOLDS = { link: 85, review: 60 };

// Por debajo de esta cobertura no se vincula solo, por más alto que sea el puntaje.
const MIN_COVERAGE = 0.45;

// Diferencia de superficie que ya no puede ser el mismo inmueble.
const SURFACE_VETO = 0.3;

// Mismo predio: hasta 150 m de separación.
const SAME_SITE_KM = 0.15;

const SIGNALS = [
  { key: 'geo', label: 'Ubicación', weight: 25 },
  { key: 'address', label: 'Dirección', weight: 20 },
  { key: 'surface', label: 'Superficie rentable', weight: 15 },
  { key: 'price', label: 'Precio por m²', weight: 10 },
  { key: 'type', label: 'Tipo de inmueble', weight: 10 },
  { key: 'photos', label: 'Fotos', weight: 10 },
  { key: 'actor', label: 'Actor que lo ofrece', weight: 5 },
  { key: 'attributes', label: 'Atributos técnicos', weight: 5 },
];

const DECISION_LABELS = {
  link: 'Vincular automáticamente',
  review: 'Revisar',
  discard: 'Descartar como duplicado',
};

const ADDRESS_ABBREV = {
  av: 'avenida',
  ave: 'avenida',
  avenida: 'avenida',
  col: 'colonia',
  no: 'numero',
  num: 'numero',
  numero: 'numero',
  int: 'interior',
  ext: 'exterior',
  pque: 'parque',
  blvd: 'bulevar',
  calz: 'calzada',
  priv: 'privada',
  esq: 'esquina',
  fracc: 'fraccionamiento',
  ind: 'industrial',
  cto: 'centro',
};

const ADDRESS_STOPWORDS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y', 'en']);

// Sinónimos de tipo. Sin esto, una "bodega" scrapeada nunca se compara con una "nave".
const TYPE_FAMILIES = [
  ['nave', ['nave', 'naves', 'bodega', 'bodegas', 'almacen', 'almacenes', 'cedi', 'distribucion', 'industrial', 'manufactura']],
  ['oficina', ['oficina', 'oficinas', 'corporativo', 'despacho', 'despachos']],
  ['local', ['local', 'locales', 'comercial', 'plaza', 'tienda', 'retail']],
];

function normalizeText(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeAddress(value) {
  const tokens = normalizeText(value).split(' ').filter(Boolean);
  const expanded = tokens.map((token) => ADDRESS_ABBREV[token] || token);
  return expanded.filter((token) => !ADDRESS_STOPWORDS.has(token)).join(' ');
}

function typeFamily(value) {
  const tokens = normalizeText(value).split(' ').filter(Boolean);
  if (!tokens.length) return null;
  for (const [family, synonyms] of TYPE_FAMILIES) {
    if (tokens.some((token) => synonyms.includes(token))) return family;
  }
  return null;
}

function normalizeType(value) {
  return typeFamily(value) || normalizeText(value);
}

function tokenSet(value) {
  return new Set(normalizeText(value).split(' ').filter(Boolean));
}

function tokenSimilarity(a, b) {
  const setA = tokenSet(a);
  const setB = tokenSet(b);
  if (!setA.size || !setB.size) return 0;
  let intersection = 0;
  setA.forEach((token) => {
    if (setB.has(token)) intersection += 1;
  });
  return intersection / (setA.size + setB.size - intersection);
}

function haversineKm(a, b) {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return null;
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const h = s1 * s1 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * s2 * s2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Tolerancia relativa: 5% de diferencia es el mismo dato, 35% es otro inmueble.
function toleranceScore(diffPct) {
  if (diffPct <= 0.05) return 1;
  if (diffPct <= 0.1) return 0.8;
  if (diffPct <= 0.2) return 0.5;
  if (diffPct <= 0.35) return 0.2;
  return 0;
}

function relativeDiff(a, b) {
  return Math.abs(a - b) / Math.max(a, b);
}

function numberTokens(value) {
  return normalizeText(value).split(' ').filter((token) => /^\d+$/.test(token));
}

function addressValue(a, b) {
  const similarity = tokenSimilarity(normalizeAddress(a), normalizeAddress(b));
  const numbersA = numberTokens(a);
  const numbersB = numberTokens(b);
  const sameNumber = numbersA.some((n) => numbersB.includes(n));
  // El número de calle es la señal fuerte; el resto de las palabras suele cambiar de forma.
  return sameNumber ? Math.min(1, similarity + 0.25) : similarity;
}

function geoValue(km) {
  if (km == null) return null;
  if (km < 0.1) return 1;
  if (km < 0.3) return 0.9;
  if (km < 0.5) return 0.7;
  if (km < 1) return 0.4;
  if (km < 2) return 0.2;
  return 0;
}

function geoDetail(km) {
  if (km == null) return 'Sin coordenadas para comparar';
  if (km < 0.1) return 'Mismo predio, a ' + km.toFixed(2) + ' km';
  if (km < 2) return 'A ' + km.toFixed(2) + ' km';
  return 'Lejos, a ' + km.toFixed(1) + ' km';
}

function compareAttributes(a, b) {
  const attrsA = a.attributes || {};
  const attrsB = b.attributes || {};
  const keys = [...new Set([...Object.keys(attrsA), ...Object.keys(attrsB)])];
  let comparable = 0;
  let hits = 0;
  keys.forEach((key) => {
    if (attrsA[key] != null && attrsB[key] != null) {
      comparable += 1;
      if (String(attrsA[key]) === String(attrsB[key])) hits += 1;
    }
  });
  if (!comparable) return null;
  return { value: hits / comparable, detail: hits + ' de ' + comparable + ' atributos coinciden' };
}

// Cada señal devuelve `known: false` cuando no hay con qué comparar. No puntúa.
function buildSignals(a, b) {
  const km = haversineKm(a, b);
  const geo = geoValue(km);
  const dirA = normalizeAddress(a.address);
  const dirB = normalizeAddress(b.address);
  const addr = dirA && dirB ? addressValue(a.address, b.address) : null;
  const surfA = Number(a.rentable_m2) || 0;
  const surfB = Number(b.rentable_m2) || 0;
  const surface = surfA && surfB ? toleranceScore(relativeDiff(surfA, surfB)) : null;
  const priceA = Number(a.price_m2) || 0;
  const priceB = Number(b.price_m2) || 0;
  const price = priceA && priceB ? toleranceScore(relativeDiff(priceA, priceB)) : null;
  const famA = typeFamily(a.type);
  const famB = typeFamily(b.type);
  const type = famA && famB ? (famA === famB ? 1 : 0) : null;
  const photosA = a.photos || [];
  const photosB = b.photos || [];
  let photos = null;
  let photosDetail = 'Sin fotos para comparar';
  if (photosA.length && photosB.length) {
    const shared = photosA.filter((p) => photosB.includes(p)).length;
    photos = shared > 0 ? 1 : 0;
    photosDetail = shared > 0 ? shared + ' foto(s) en común' : 'Fotos distintas, ninguna en común';
  }
  const actorA = normalizeText(a.actor);
  const actorB = normalizeText(b.actor);
  const actor = actorA && actorB ? (actorA === actorB ? 1 : 0) : null;
  const attrs = compareAttributes(a, b);

  const raw = {
    geo: { value: geo, detail: geoDetail(km) },
    address: { value: addr, detail: addr == null ? 'Sin dirección para comparar' : 'Similitud de dirección: ' + Math.round(addr * 100) + '%' },
    surface: {
      value: surface,
      detail:
        surface == null
          ? 'Falta superficie en un registro'
          : surfA.toLocaleString('es-MX') + ' m² vs ' + surfB.toLocaleString('es-MX') + ' m² (' + Math.round(relativeDiff(surfA, surfB) * 100) + '% de diferencia)',
    },
    price: {
      value: price,
      detail:
        price == null
          ? 'Falta precio en un registro'
          : '$' + priceA.toLocaleString('es-MX') + ' vs $' + priceB.toLocaleString('es-MX') + ' por m² (' + Math.round(relativeDiff(priceA, priceB) * 100) + '%)',
    },
    type: { value: type, detail: type == null ? 'Falta el tipo en un registro' : (famA === famB ? 'Mismo tipo: ' + famA : 'Tipos distintos: ' + famA + ' vs ' + famB) },
    photos: { value: photos, detail: photosDetail },
    actor: { value: actor, detail: actor == null ? 'Actor no conocido en un registro' : (actorA === actorB ? 'Mismo actor: ' + a.actor : a.actor + ' vs ' + b.actor) },
    attributes: { value: attrs ? attrs.value : null, detail: attrs ? attrs.detail : 'Sin atributos técnicos para comparar' },
  };

  return SIGNALS.map((signal) => {
    const entry = raw[signal.key];
    const known = entry.value != null;
    return {
      key: signal.key,
      label: signal.label,
      weight: signal.weight,
      value: known ? entry.value : null,
      points: known ? Math.round(entry.value * signal.weight) : 0,
      detail: entry.detail,
      known,
    };
  });
}

function buildVetoes(a, b, ctx) {
  const vetoes = [];
  const famA = typeFamily(a.type);
  const famB = typeFamily(b.type);
  if (famA && famB && famA !== famB) {
    vetoes.push({
      code: 'type_conflict',
      label: 'Tipo de inmueble incompatible',
      detail: 'Se comparó ' + famA + ' contra ' + famB + '.',
    });
  }

  const floorA = a.floor == null ? null : Number(a.floor);
  const floorB = b.floor == null ? null : Number(b.floor);
  if (floorA != null && floorB != null && floorA !== floorB && ctx.sameSite) {
    vetoes.push({
      code: 'floor_conflict',
      label: 'Mismo edificio, piso distinto',
      detail: 'Piso ' + floorA + ' frente a piso ' + floorB + '. Son dos unidades del mismo inmueble.',
    });
  }

  const surfA = Number(a.rentable_m2) || 0;
  const surfB = Number(b.rentable_m2) || 0;
  if (surfA && surfB && relativeDiff(surfA, surfB) > SURFACE_VETO) {
    vetoes.push({
      code: 'surface_conflict',
      label: 'Superficie incompatible',
      detail: surfA.toLocaleString('es-MX') + ' m² vs ' + surfB.toLocaleString('es-MX') + ' m²: no puede ser el mismo espacio rentable.',
    });
  }

  if (a.actorVerified && b.actorVerified && normalizeText(a.actor) && normalizeText(b.actor) && normalizeText(a.actor) !== normalizeText(b.actor)) {
    vetoes.push({
      code: 'owner_conflict',
      label: 'Dos owners verificados distintos',
      detail: a.actor + ' y ' + b.actor + ' tienen titularidad verificada sobre el inmueble.',
    });
  }
  return vetoes;
}

// Decisión a partir de las tres piezas. Se expone aparte para poder probar los bordes.
function decide({ score, coverage, vetoes = [], hasAnchor = true }) {
  if (!hasAnchor) return 'discard';
  const blocked = vetoes.length > 0;
  if (score >= THRESHOLDS.link && coverage >= MIN_COVERAGE && !blocked) return 'link';
  if (score >= THRESHOLDS.review && coverage >= MIN_COVERAGE) return 'review';
  // Mucha similitud de lo poco que se pudo comparar: lo completa un humano, no la máquina.
  if (score >= THRESHOLDS.link) return 'review';
  return 'discard';
}

function scorePair(a, b) {
  const km = haversineKm(a, b);
  const dirA = normalizeAddress(a.address);
  const dirB = normalizeAddress(b.address);
  const hasAnchor = km != null || Boolean(dirA && dirB);
  const signals = buildSignals(a, b);

  if (!hasAnchor) {
    return {
      score: 0,
      coverage: 0,
      rank: 0,
      signalsCompared: 0,
      signalsTotal: SIGNALS.length,
      decision: 'discard',
      decisionLabel: DECISION_LABELS.discard,
      note: 'Sin ancla de ubicación: compartir el tipo no es evidencia de que sea el mismo inmueble.',
      vetoes: [],
      reasons: signals,
    };
  }

  const comparable = signals.filter((s) => s.known);
  const totalWeight = comparable.reduce((sum, s) => sum + s.weight, 0);
  const points = comparable.reduce((sum, s) => sum + s.points, 0);
  const score = totalWeight ? Math.round((points / totalWeight) * 100) : 0;
  const coverage = Math.round((totalWeight / 100) * 100) / 100;

  const sameSite = (km != null && km < SAME_SITE_KM) || addressValue(a.address || '', b.address || '') >= 0.8;
  const vetoes = buildVetoes(a, b, { sameSite });
  const decision = decide({ score, coverage, vetoes, hasAnchor });

  return {
    score,
    coverage,
    rank: Math.round(score * coverage),
    signalsCompared: comparable.length,
    signalsTotal: SIGNALS.length,
    decision,
    decisionLabel: DECISION_LABELS[decision],
    vetoes,
    reasons: signals,
  };
}

function pairId(a, b) {
  return [a.id || a.title || '?', b.id || b.title || '?'].sort().join('|');
}

// Blocking: nunca 200 mil contra 200 mil. Se compara dentro del mismo tipo y del mismo
// barrio, o a menos de 2 km. Los sinónimos de tipo se resuelven antes de bloquear.
function findCandidates(candidate, catalog) {
  return catalog
    .filter((property) => {
      if (property.id && candidate.id && property.id === candidate.id) return false;
      const famCandidate = typeFamily(candidate.type);
      const famProperty = typeFamily(property.type);
      if (famCandidate && famProperty && famCandidate !== famProperty) return false;
      const km = haversineKm(candidate, property);
      const zoneCandidate = normalizeText(candidate.zone || candidate.colonia || '');
      const zoneProperty = normalizeText(property.zone || property.colonia || '');
      const sameZone = Boolean(zoneCandidate) && zoneCandidate === zoneProperty;
      return sameZone || (km != null && km < 2);
    })
    .map((property) => ({ property, match: scorePair(candidate, property) }))
    .sort((x, y) => y.match.rank - x.match.rank);
}

// Devuelve los pares con su veredicto, ya sin los que se decidieron antes.
// `decided`: [{ pairId, decision, at, by }] — un par descartado no se vuelve a proponer.
function evaluate(candidate, catalog, options = {}) {
  const decided = new Map((options.decided || []).map((entry) => [entry.pairId, entry]));
  const all = findCandidates(candidate, catalog);
  let suppressed = 0;
  const results = [];
  all.forEach((entry) => {
    const id = pairId(candidate, entry.property);
    if (decided.has(id)) {
      suppressed += 1;
      return;
    }
    results.push({ ...entry, pairId: id, prior: null });
  });
  return { results, suppressed };
}

const api = {
  THRESHOLDS,
  MIN_COVERAGE,
  SURFACE_VETO,
  SIGNALS,
  DECISION_LABELS,
  normalizeText,
  normalizeAddress,
  normalizeType,
  typeFamily,
  tokenSimilarity,
  haversineKm,
  addressValue,
  scorePair,
  decide,
  findCandidates,
  evaluate,
  pairId,
};

if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.BeiqaMatching = api;
