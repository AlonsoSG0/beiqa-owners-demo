// tests/matching.test.js — Reglas de coincidencia.
// Se corre con: npm test
//
// Criterio de estas pruebas: cada una pinnea la DECISIÓN y el MOTIVO, no un rango de puntaje.
// Un test que solo dice "score >= 60" pasa aunque el caso se comporte al revés.
const test = require('node:test');
const assert = require('node:assert/strict');
const { scorePair, evaluate, decide, normalizeAddress, normalizeType, typeFamily, MIN_COVERAGE } = require('../js/matching');
const { CATALOG, CASES } = require('../js/data');

const byId = (id) => CATALOG.find((p) => p.id === id);
const vetoCodes = (r) => r.vetoes.map((v) => v.code).sort();

test('la misma nave que el owner vuelve a subir: se vincula sola', () => {
  const r = scorePair(CASES.naveDuplicada, byId('PROP-102'));
  assert.equal(r.decision, 'link');
  assert.equal(r.score, 100);
  assert.equal(r.coverage, 1);
  assert.deepEqual(vetoCodes(r), []);
});

test('caso héroe: dos oficinas distintas del mismo edificio NO se vinculan, aunque el puntaje sea altísimo', () => {
  const r = scorePair(CASES.oficinaPiso6, byId('PROP-101'));
  assert.ok(r.score >= 90, 'el parecido real es altísimo, el puntaje debe reflejarlo: ' + r.score);
  assert.equal(r.decision, 'review', 'el piso distinto impide vincular');
  assert.deepEqual(vetoCodes(r), ['floor_conflict']);
  // El motivo tiene que ser legible para el revisor, no un código.
  assert.match(r.vetoes[0].label, /piso distinto/i);
  assert.match(r.vetoes[0].detail, /4/);
  assert.match(r.vetoes[0].detail, /6/);
});

test('la misma nave vista desde un portal masivo: revisión, no vinculación', () => {
  const r = scorePair(CASES.naveViaPortal, byId('PROP-102'));
  assert.equal(r.decision, 'review');
  assert.equal(r.score, 75);
  assert.deepEqual(vetoCodes(r), []);
  // La dirección no coincide: tiene que verse en las razones, no diluirse en el total.
  const dir = r.reasons.find((x) => x.key === 'address');
  assert.ok(dir.points <= 5, 'la dirección distinta debe costar puntos: ' + dir.points);
});

test('foto reutilizada en un inmueble a 12 km: se descarta', () => {
  const r = scorePair(CASES.fotoReutilizada, byId('PROP-102'));
  assert.equal(r.decision, 'discard');
  assert.equal(r.score, 48);
  // El parecido de fotos existe y aun así no alcanza: eso es lo que hay que probar.
  assert.equal(r.reasons.find((x) => x.key === 'photos').points, 10);
});

test('inmueble nuevo en otra zona: ningún candidato fuerte', () => {
  const { results } = evaluate(CASES.nuevoCondesa, CATALOG);
  assert.equal(results.filter((r) => r.match.decision !== 'discard').length, 0);
});

test('simetría: el par puntúa igual en los dos sentidos', () => {
  const a = byId('PROP-102');
  const b = CASES.naveViaPortal;
  const ab = scorePair(a, b);
  const ba = scorePair(b, a);
  assert.equal(ab.score, ba.score);
  assert.equal(ab.coverage, ba.coverage);
  assert.deepEqual(ab.reasons.map((r) => r.points), ba.reasons.map((r) => r.points));
});

test('un dato faltante no puntúa: sin ancla de ubicación no hay veredicto, solo descarte', () => {
  const sinNada = { type: 'oficina' };
  const r = scorePair(sinNada, { type: 'oficina' });
  assert.equal(r.coverage, 0);
  assert.equal(r.score, 0);
  assert.equal(r.decision, 'discard', 'compartir el tipo no es evidencia de nada');
});

test('cobertura: mucha similitud con poca evidencia no alcanza para vincular', () => {
  // Solo ubicación y tipo: puntaje perfecto de lo poco que se pudo comparar.
  const a = { type: 'oficina', lat: 19.4342, lng: -99.2035 };
  const b = { type: 'oficina', lat: 19.4342, lng: -99.2035 };
  const r = scorePair(a, b);
  assert.equal(r.score, 100, 'de lo comparado, coincide todo');
  assert.ok(r.coverage < MIN_COVERAGE, 'pero la evidencia es insuficiente: ' + r.coverage);
  assert.equal(r.decision, 'review', 'va a un humano, no se vincula solo');
});

test('bordes de umbral: 85 vincula, 84.9 revisa, 60 revisa, 59.9 descarta', () => {
  const base = { coverage: 1, vetoes: [], hasAnchor: true };
  assert.equal(decide({ ...base, score: 85 }), 'link');
  assert.equal(decide({ ...base, score: 84.9 }), 'review');
  assert.equal(decide({ ...base, score: 60 }), 'review');
  assert.equal(decide({ ...base, score: 59.9 }), 'discard');
});

test('un veto impide vincular pero no promueve: un par débil sigue descartado', () => {
  const r = decide({ score: 20, coverage: 1, vetoes: [{ code: 'surface_conflict' }], hasAnchor: true });
  assert.equal(r, 'discard', 'el veto no puede llenar la cola de revisión con basura');
});

test('sinónimos de tipo: una bodega y una nave son el mismo tipo para comparar', () => {
  assert.equal(typeFamily('Bodega industrial'), 'nave');
  assert.equal(typeFamily('Nave industrial'), 'nave');
  assert.equal(typeFamily('Centro de distribución'), 'nave');
  assert.equal(typeFamily('Corporativo'), 'oficina');
  assert.equal(typeFamily('Local comercial'), 'local');
  assert.equal(normalizeType('BODEGA'), 'nave');
});

test('normalización de dirección: abreviaturas y acentos no cambian el resultado', () => {
  assert.equal(normalizeAddress('Av. Industria 123'), normalizeAddress('Avenida Industria 123'));
  assert.equal(normalizeAddress('Calle José María Ibarra 45'), normalizeAddress('CALLE JOSE MARIA IBARRA 45'));
  assert.notEqual(normalizeAddress('Av. Horacio 1850'), normalizeAddress('Av. Horacio 1890'));
});

test('la cola se ordena por confianza (parecido × evidencia), no por parecido solo', () => {
  const { results } = evaluate(CASES.oficinaPiso6, CATALOG);
  const ranks = results.map((r) => r.rank);
  assert.deepEqual(ranks, [...ranks].sort((x, y) => y - x));
});

test('descartar un par no se vuelve a proponer sin un cambio', () => {
  const seen = evaluate(CASES.naveViaPortal, CATALOG);
  const par = seen.results[0];
  const decididos = [{ pairId: par.pairId, decision: 'discard', at: '2025-03-15T10:00:00Z' }];
  const otraVez = evaluate(CASES.naveViaPortal, CATALOG, { decided: decididos });
  assert.equal(otraVez.results.filter((r) => r.match.decision !== 'discard').length, 0);
  assert.equal(otraVez.suppressed, 1, 'el par queda registrado como ya decidido');
});
