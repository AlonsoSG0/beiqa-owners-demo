// tests/corpus.js — ¿Un cambio en las reglas mejora o empeora la detección?
//
// Un conjunto pequeño y etiquetado a mano. Cada par dice la verdad del negocio:
// ¿son el mismo inmueble o no? Con eso se mide precisión, recall y el costo en
// cola de revisión para cada umbral. Corre con: npm run corpus
//
// La pregunta que responde no es "¿cuántas coincidencias encuentra?", sino
// "¿qué se rompe si muevo el umbral?".
const { scorePair, MIN_COVERAGE } = require('../js/matching');
const { CATALOG, CASES } = require('../js/data');

const byId = (id) => CATALOG.find((property) => property.id === id);
const candidate = (key) => CASES[key];

// verdad: true si los dos registros hablan del mismo inmueble.
const LABELED = [
  ['naveDuplicada', 'PROP-102', true, 'el owner vuelve a subir la misma nave'],
  ['naveViaPortal', 'PROP-102', true, 'la misma nave anunciada en un portal'],
  ['ANUN-202@catalogo', 'PROP-101', true, 'el piso 4 anunciado en un portal'],
  ['oficinaPiso6', 'PROP-101', false, 'otra oficina del mismo edificio'],
  ['oficinaPiso6', 'ANUN-202', false, 'otra oficina del mismo edificio'],
  ['fotoReutilizada', 'PROP-102', false, 'foto reutilizada a 11 km'],
  ['nuevoCondesa', 'PROP-104', false, 'local en otra zona'],
  ['naveDuplicada', 'ANUN-202', false, 'nave contra oficina'],
  ['oficinaPiso6', 'PROP-103', false, 'oficina en otra colonia'],
];

// ANUN-202 también se usa como registro entrante: es el piso 4 visto desde un portal.
function resolve(key) {
  if (key === 'ANUN-202@catalogo') return byId('ANUN-202');
  return candidate(key);
}

const THRESHOLDS = [55, 60, 65, 70, 75, 80, 85, 90, 95];

function evaluateAt(threshold) {
  let truePositive = 0;
  let falsePositive = 0;
  let falseNegative = 0;
  let review = 0;
  let falsePositiveNoVeto = 0;
  const failures = [];

  LABELED.forEach(([keyA, keyB, same, note]) => {
    const a = resolve(keyA);
    const b = byId(keyB);
    const match = scorePair(a, b);
    const passes = match.score >= threshold && match.coverage >= MIN_COVERAGE;
    const linked = passes && match.vetoes.length === 0;
    // La misma regla sin la capa de vetos: sirve para medir qué aporta el veto.
    if (passes && !same) falsePositiveNoVeto += 1;
    if (!linked && match.score >= 60) review += 1;
    if (linked && same) truePositive += 1;
    else if (linked && !same) {
      falsePositive += 1;
      failures.push('vincularía distinto: ' + note + ' (' + match.score + ')');
    } else if (!linked && same) {
      falseNegative += 1;
      failures.push('deja sin vincular: ' + note + ' (' + match.score + ')');
    }
  });

  const precision = truePositive + falsePositive ? truePositive / (truePositive + falsePositive) : 0;
  const recall = truePositive + falseNegative ? truePositive / (truePositive + falseNegative) : 0;
  return { threshold, truePositive, falsePositive, falseNegative, review, precision, recall, falsePositiveNoVeto, failures };
}

function pct(value) {
  return (Math.round(value * 100) + '%').padStart(5);
}

function main() {
  console.log('Conjunto etiquetado: ' + LABELED.length + ' pares (' + LABELED.filter((p) => p[2]).length + ' iguales)\n');
  console.log('umbral  vincula  falso+  omitido  a revisión  precisión  recall  falso+ sin veto');
  const rows = THRESHOLDS.map(evaluateAt);
  rows.forEach((row) => {
    console.log(
      String(row.threshold).padStart(6) +
        String(row.truePositive + row.falsePositive).padStart(9) +
        String(row.falsePositive).padStart(8) +
        String(row.falseNegative).padStart(9) +
        String(row.review).padStart(12) +
        pct(row.precision).padStart(12) +
        pct(row.recall).padStart(8) +
        String(row.falsePositiveNoVeto).padStart(17)
    );
  });

  // El umbral de producción no puede vincular dos inmuebles distintos ni una sola vez.
  const production = rows.find((row) => row.threshold === 85);
  const problems = [];
  if (production.falsePositive > 0) problems.push('el umbral 85 vincula ' + production.falsePositive + ' par(es) que no son el mismo inmueble');
  if (production.recall === 0) problems.push('el umbral 85 no vincula ningún par igual: la regla no sirve');
  const unreviewed = LABELED.filter(([keyA, keyB, same]) => {
    if (!same) return false;
    const match = scorePair(resolve(keyA), byId(keyB));
    return match.score < 60;
  });
  if (unreviewed.length) problems.push(unreviewed.length + ' par(es) igual(es) quedan por debajo de 60 y nunca llegan a un humano');

  console.log('\nDetalle del umbral 85:');
  rows[rows.findIndex((row) => row.threshold === 85)].failures.forEach((line) => console.log('  · ' + line));
  const vetoLoad = rows.find((row) => row.threshold === 85).falsePositiveNoVeto;
  if (vetoLoad > 0) {
    console.log('\nLa columna "falso+ sin veto" es la que importa: con el mismo umbral, sin la capa de vetos\n' +
      'se vincularían ' + vetoLoad + ' par(es) que no son el mismo inmueble. El umbral solo no protege.');
  }

  if (problems.length) {
    console.error('\nRegresión de calidad:');
    problems.forEach((line) => console.error('  ✗ ' + line));
    process.exit(1);
  }
  console.log('\n✓ En 85 no se vincula ningún par distinto y todos los pares iguales llegan al menos a revisión.');
}

main();
