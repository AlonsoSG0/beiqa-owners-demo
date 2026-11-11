// tests/revisor-cases.test.js — El adaptador que traduce el motor a la pantalla.
//
// Lo que se prueba acá no es la regla de coincidencia (eso vive en matching.test.js),
// sino que la vista reciba datos coherentes: que el registro entrante no se ofrezca a
// sí mismo como duplicado, que el caso con veto lo traiga, y que los textos de la banda
// de convergencia se puedan leer también en pantalla angosta.
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildQueue, ownerCandidates, buildRows } = require('../js/revisor-cases');
const { CATALOG, CASES } = require('../js/data');

const byId = (id) => CATALOG.find((p) => p.id === id);

test('la cola tiene una entrada por caso, con identificador estable', () => {
  const queue = buildQueue({});
  assert.equal(queue.length, Object.keys(CASES).length);
  assert.deepEqual(queue.map((c) => c.id), ['P-01', 'P-02', 'P-03', 'P-04', 'P-05', 'P-06']);
  assert.deepEqual(
    queue.map((c) => c.verdict).sort(),
    ['descartar', 'revisar', 'revisar', 'revisar', 'sin', 'vincular']
  );
});

test('el caso héroe llega a la pantalla con su veto y su veredicto', () => {
  const hero = buildQueue({}).find((c) => c.pairId.includes('PROP-101|A-4471') || c.veto);
  assert.ok(hero, 'tiene que existir la entrada con veto');
  assert.equal(hero.verdict, 'revisar');
  assert.match(hero.veto, /piso distinto \(4 vs 6\)/i);
  assert.ok(hero.score >= 90, 'el parecido real se sigue viendo: ' + hero.score);
});

test('la banda de convergencia marca el piso como conflicto, no como diferencia', () => {
  const rows = buildRows(byId('PROP-101'), CASES.oficinaPiso6);
  const piso = rows.find((row) => row.field === 'Piso');
  assert.equal(piso.state, 'conflicto');
  assert.equal(piso.a, '4');
  assert.equal(piso.b, '6');
  assert.equal(rows.find((row) => row.field === 'Dirección').state, 'coincide');
});

test('los textos de la banda no traen paréntesis: se parten mal en pantalla angosta', () => {
  const queue = buildQueue({});
  queue.forEach((entry) => {
    entry.rows.forEach((row) => {
      assert.doesNotMatch(row.a, /[()]/, row.field + ' en ' + entry.id);
      assert.doesNotMatch(row.b, /[()]/, row.field + ' en ' + entry.id);
    });
  });
});

test('las fotos compartidas se cuentan en singular y en plural', () => {
  const rows = buildRows(byId('PROP-101'), CASES.oficinaPiso6);
  const fotos = rows.find((row) => row.field === 'Fotos');
  assert.equal(fotos.b, '3 compartidas del edificio');
  const rowsUno = buildRows(byId('PROP-102'), CASES.naveViaPortal);
  assert.equal(rowsUno.find((row) => row.field === 'Fotos').b, '1 compartida del edificio');
});

test('el owner no ve su propio registro como candidato', () => {
  const candidatos = ownerCandidates('oficinaPiso6');
  assert.ok(candidatos.length > 0);
  assert.equal(
    candidatos.filter((c) => c.title === CASES.oficinaPiso6.title && c.pairId.endsWith('A-4471')).length,
    0,
    'el registro entrante no puede aparecer como candidato de sí mismo'
  );
});

test('cada fila del diff declara precedencia y consecuencia', () => {
  const entry = buildQueue({}).find((c) => c.id === 'P-02');
  assert.ok(entry.diff.length > 0);
  entry.diff.forEach((row) => {
    assert.ok(row.prec, row.field + ' sin precedencia');
    assert.ok(row.cons, row.field + ' sin consecuencia');
  });
  assert.ok(entry.diff.some((row) => row.loss), 'el caso héroe pierde algo si se fusiona');
});
