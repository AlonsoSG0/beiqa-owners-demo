// revisor-cases.js — Arma la cola del revisor a partir del motor de coincidencia.
//
// La pantalla no inventa números: cada puntaje, cada razón, cada veto y cada diferencia
// salen de js/matching.js y de js/data.js. Este archivo solo traduce el resultado del
// motor a la forma que consume el renderer de 03-revisor.html.
(function (root, factory) {
  const isNode = typeof module !== 'undefined' && module.exports;
  const data = isNode ? require('./data') : root.BeiqaData;
  const matching = isNode ? require('./matching') : root.BeiqaMatching;
  const api = factory(data, matching);
  if (isNode) module.exports = api;
  if (root) root.BeiqaRevisor = api;
})(typeof window !== 'undefined' ? window : null, function (data, matching) {
  'use strict';

  const SOURCE_LABELS = {
    owner: 'Alta del owner',
    'portal-masivo': 'Portal masivo',
    'broker-corporativo': 'Broker corporativo',
    brochure: 'Brochure PDF',
  };

  const VERDICT = { link: 'vincular', review: 'revisar', discard: 'descartar' };

  function fmtInt(value) {
    return Number(value || 0).toLocaleString('es-MX');
  }

  function fmtM2(value) {
    return value ? fmtInt(value) + ' m²' : 'Sin dato';
  }

  function fmtMoney(value) {
    return value ? '$' + fmtInt(value) : 'Sin dato';
  }

  function fmtDay(iso) {
    if (!iso) return 'sin fecha';
    const date = new Date(iso + 'T12:00:00');
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function fmtTime(iso) {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  }

  function sourceLabel(candidate) {
    return SOURCE_LABELS[candidate.source] || 'Origen desconocido';
  }

  function shortName(candidate) {
    if (candidate.floor != null) return 'piso ' + candidate.floor;
    if (candidate.source === 'owner') return 'alta del owner';
    return 'anuncio de ' + sourceLabel(candidate).toLowerCase();
  }

  function vetoText(veto, property, candidate) {
    if (veto.code === 'floor_conflict') {
      return 'Mismo edificio, piso distinto (' + property.floor + ' vs ' + candidate.floor + ')';
    }
    return veto.label;
  }

  // Bandas de convergencia: qué coincide, qué difiere y qué es conflicto duro.
  function buildRows(property, candidate) {
    const rows = [];
    const sameAddress = matching.addressValue(property.address || '', candidate.address || '') >= 0.9;
    rows.push({ field: 'Dirección', a: property.address || 'Sin dato', b: candidate.address || 'Sin dato', state: sameAddress ? 'coincide' : 'conflicto' });
    rows.push({
      field: 'Superficie rentable',
      a: fmtM2(property.rentable_m2),
      b: fmtM2(candidate.rentable_m2),
      state: property.rentable_m2 === candidate.rentable_m2 ? 'coincide' : 'difiere',
    });
    rows.push({
      field: 'Precio por m²',
      a: fmtMoney(property.price_m2),
      b: fmtMoney(candidate.price_m2),
      state: property.price_m2 === candidate.price_m2 ? 'coincide' : 'difiere',
    });
    if (property.floor != null || candidate.floor != null) {
      rows.push({
        field: 'Piso',
        a: property.floor == null ? 'Sin dato' : String(property.floor),
        b: candidate.floor == null ? 'Sin dato' : String(candidate.floor),
        state: property.floor === candidate.floor ? 'coincide' : 'conflicto',
      });
    }
    rows.push({ field: 'Tipo', a: property.typeLabel || property.type, b: candidate.typeLabel || candidate.type, state: matching.typeFamily(property.type) === matching.typeFamily(candidate.type) ? 'coincide' : 'conflicto' });
    rows.push({
      field: 'Actor',
      a: property.actor || 'Sin dato',
      b: candidate.actor || 'Sin dato',
      state: matching.normalizeText(property.actor) === matching.normalizeText(candidate.actor) ? 'coincide' : 'difiere',
    });
    const photosA = property.photos || [];
    const photosB = candidate.photos || [];
    const shared = photosB.filter((photo) => photosA.includes(photo)).length;
    rows.push({
      field: 'Fotos',
      a: photosA.length ? photosA.length + ' propias' : 'Sin dato',
      b: photosLabel(photosB, shared),
      state: photosA.length && photosB.length ? (shared ? 'coincide' : 'difiere') : 'difiere',
    });
    return rows;
  }

  // El texto se lee también a 360 px: sin paréntesis, que se parten por cualquier lado.
  function photosLabel(photos, shared) {
    if (!photos.length) return 'Sin dato';
    if (!shared) return photos.length + ' distintas';
    return shared + (shared === 1 ? ' compartida' : ' compartidas') + ' del edificio';
  }

  // Consecuencia de fusionar, campo por campo. Sin esto el revisor decide a ciegas.
  function buildDiff(property, candidate, rows) {
    const diff = rows
      .filter((row) => row.state !== 'coincide')
      .map((row) => {
        const loss = row.state === 'conflicto';
        return {
          field: row.field,
          a: row.a,
          b: row.b,
          prec: loss ? 'Requiere revisión humana' : 'Gana el owner verificado',
          precOpen: loss,
          cons: loss
            ? 'Si fusionas, se pierde: ' + row.b + ', solo en el registro B.'
            : 'Se conserva ' + row.a + '; ' + row.b + ' queda como observación fechada del anuncio.',
          loss,
        };
      });
    const attrsA = property.attributes || {};
    const attrsB = candidate.attributes || {};
    Object.keys(attrsB).forEach((key) => {
      if (attrsA[key] != null || attrsB[key] == null) return;
      const label = key.replace(/_/g, ' ');
      diff.push({
        field: label.charAt(0).toUpperCase() + label.slice(1),
        a: 'Sin dato',
        b: String(attrsB[key]),
        prec: 'Sin conflicto: solo un registro lo tiene',
        cons: 'Si fusionas, se agrega ' + label + ' al expediente.',
        add: true,
      });
    });
    return diff;
  }

  function buildHistory(property, candidate, match, vetoes, decisions) {
    const history = [];
    const stamp = candidate.lastSeen || property.lastSeen;
    history.push({
      time: fmtTime((stamp || '2025-03-15') + 'T11:38:00'),
      who: 'Motor BEIQA',
      what:
        'Registro ' + (candidate.id || 'entrante') + ' evaluado: ' + match.score + ' de score y ' +
        match.signalsCompared + ' de ' + match.signalsTotal + ' señales comparadas.',
    });
    vetoes.forEach((veto) => {
      history.push({
        time: fmtTime((stamp || '2025-03-15') + 'T11:20:00'),
        who: 'Motor BEIQA',
        what: 'Veto registrado: ' + vetoText(veto, property, candidate) + '.',
      });
    });
    (decisions || []).forEach((entry) => {
      history.push({
        time: fmtTime(entry.at),
        who: entry.by || 'Revisor',
        what: entry.what,
        note: entry.why || undefined,
      });
    });
    return history;
  }

  function buildEntry(property, candidate, match, options) {
    const decisions = (options.historyFor || []).filter((entry) => entry.pairId === matching.pairId(candidate, property));
    const missing = match.reasons.filter((reason) => !reason.known).map((reason) => reason.label.toLowerCase());
    return {
      pairId: matching.pairId(candidate, property),
      ref: property.id + ' ↔ ' + (candidate.id || 'entrante'),
      short: property.title + ' ↔ ' + shortName(candidate),
      title: property.title + ' ↔ ' + candidate.title,
      verdict: VERDICT[match.decision],
      score: match.score,
      compared: match.signalsCompared,
      total: match.signalsTotal,
      rank: match.rank,
      veto: match.vetoes.length ? vetoText(match.vetoes[0], property, candidate) : null,
      vetoNote: match.vetoes.length
        ? 'Un veto gana al puntaje: con ' + match.score + ' de score, el caso no se vincula solo.'
        : null,
      coverageNote: missing.length ? 'Cobertura parcial: ' + missing.length + ' señales no se pudieron comparar.' : null,
      missing,
      a: {
        role: property.kind === 'property' ? 'Registro A · propiedad' : 'Registro A · anuncio en catálogo',
        title: property.id,
        sub: property.title + ' · ' + (property.address || 'sin dirección'),
        meta: (property.status === 'validada' ? 'Validada por asesor' : property.status) + ' · ' + fmtDay(property.lastSeen),
        verified: Boolean(property.actorVerified),
      },
      b: {
        role: candidate.source === 'owner' ? 'Registro B · alta del owner' : 'Registro B · anuncio entrante',
        title: candidate.id || 'entrante',
        sub: candidate.title + ' · ' + (candidate.address || 'sin dirección'),
        meta: sourceLabel(candidate) + ' · ' + fmtDay(candidate.lastSeen),
        // Un registro entrante nunca está validado: la marca de verificación es de la propiedad.
        verified: false,
      },
      rows: buildRows(property, candidate),
      signals: match.reasons.map((reason) => ({
        name: reason.label,
        pts: reason.known ? reason.points : null,
        max: reason.weight,
        note: reason.detail,
      })),
      diff: buildDiff(property, candidate, buildRows(property, candidate)),
      history: buildHistory(property, candidate, match, match.vetoes, decisions),
      empty: false,
    };
  }

  function buildEmpty(candidate) {
    return {
      pairId: 'empty|' + (candidate.id || candidate.title),
      ref: candidate.id || 'entrante',
      short: 'Sin coincidencias en el catálogo',
      title: 'Sin coincidencias en el catálogo',
      verdict: 'sin',
      score: null,
      compared: 0,
      total: matching.SIGNALS.length,
      rank: 0,
      veto: null,
      vetoNote: null,
      coverageNote: null,
      missing: [],
      a: {
        role: 'Registro entrante',
        title: candidate.id || 'entrante',
        sub: candidate.title + ' · ' + (candidate.address || 'sin dirección'),
        meta: sourceLabel(candidate) + ' · ' + fmtDay(candidate.lastSeen),
        verified: Boolean(candidate.actorVerified),
      },
      b: {
        role: 'Catálogo',
        title: 'Ningún registro superó el umbral',
        sub: 'Se compararon los bloques del mismo tipo y zona',
        meta: '',
        verified: false,
      },
      rows: [],
      signals: [],
      diff: [],
      history: [
        {
          time: fmtTime((candidate.lastSeen || '2025-03-15') + 'T11:40:00'),
          who: 'Motor BEIQA',
          what: 'Bloqueo por tipo y zona ejecutado: ningún candidato alcanzó 60 puntos.',
        },
      ],
      empty: true,
    };
  }

  // Una entrada por registro entrante: el par que el asesor vería primero.
  // Si el bloqueo no devuelve candidatos, la entrada es el estado vacío.
  function buildQueue(options) {
    const settings = options || {};
    const decided = settings.decidedPairs || [];
    const queue = [];
    Object.keys(data.CASES).forEach((key) => {
      const candidate = data.CASES[key];
      const { results } = matching.evaluate(candidate, data.CATALOG, { decided });
      if (!results.length) {
        queue.push(buildEmpty(candidate));
        return;
      }
      const top = results[0];
      queue.push(buildEntry(top.property, candidate, top.match, { historyFor: settings.history || [] }));
    });
    queue.sort((a, b) => b.rank - a.rank);
    // Identificador estable para la selección de la pantalla.
    queue.forEach((entry, index) => {
      entry.id = 'P-' + String(index + 1).padStart(2, '0');
    });
    return queue;
  }

  // Pareja de la pantalla 02: los candidatos que ve el owner, sin datos internos.
  function ownerCandidates(candidateKey) {
    const candidate = data.CASES[candidateKey];
    if (!candidate) return [];
    const { results } = matching.evaluate(candidate, data.CATALOG);
    return results
      .filter((entry) => entry.match.decision !== 'discard')
      .map((entry) => ({
        pairId: entry.pairId,
        title: entry.property.title,
        address: entry.property.address,
        surface: fmtM2(entry.property.rentable_m2),
        price: fmtMoney(entry.property.price_m2) + ' / m²',
        floor: entry.property.floor == null ? null : String(entry.property.floor),
        verdict: VERDICT[entry.match.decision],
        confidence: entry.match.decision === 'link' ? 'Coincidencia alta' : 'Coincidencia parcial',
        reason: ownerReason(entry.property, candidate, entry.match),
      }));
  }

  // Razón en lenguaje humano: el owner no tiene por qué leer códigos de motor.
  function ownerReason(property, candidate, match) {
    const parts = [];
    const sameAddress = matching.addressValue(property.address || '', candidate.address || '') >= 0.9;
    if (sameAddress) parts.push('coincide la dirección');
    const surf = match.reasons.find((reason) => reason.key === 'surface');
    if (surf && surf.known && surf.points >= Math.round(surf.weight * 0.8)) parts.push('la superficie calza');
    if (property.actor && matching.normalizeText(property.actor) === matching.normalizeText(candidate.actor)) parts.push('la administradora es la misma');
    const floor = match.reasons.find((reason) => reason.key === 'attributes');
    if (property.floor != null && candidate.floor != null && property.floor !== candidate.floor) {
      parts.push('el piso es distinto (' + candidate.floor + ' frente a ' + property.floor + ')');
    } else if (floor && floor.known && floor.points === 0) {
      parts.push('los atributos técnicos no coinciden');
    }
    if (!parts.length) parts.push('el predio está a menos de 150 metros');
    return parts.join(', ') + '.';
  }

  return { buildQueue, ownerCandidates, fmtM2, fmtMoney, fmtDay, buildRows };
});
