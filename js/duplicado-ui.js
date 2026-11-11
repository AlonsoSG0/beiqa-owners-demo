(function () {
  'use strict';
  var store = BeiqaStore.createStore(sessionStorage);
  var own = BeiqaData.CASES.oficinaPiso6;
  var candidates = BeiqaRevisor.ownerCandidates('oficinaPiso6');
  var list = document.getElementById('candidate-list');
  var live = document.getElementById('live');
  function element(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }
  var ownBody = document.getElementById('own-record');
  ownBody.appendChild(element('p', 'own-title', own.title));
  var details = element('dl', 'own-data');
  [['Dirección', own.address], ['Superficie', BeiqaRevisor.fmtM2(own.rentable_m2)], ['Precio', BeiqaRevisor.fmtMoney(own.price_m2) + ' / m²'], ['Piso', String(own.floor)]].forEach(function (item) {
    var datum = element('div', 'datum');
    datum.appendChild(element('dt', '', item[0]));
    datum.appendChild(element('dd', '', item[1]));
    details.appendChild(datum);
  });
  ownBody.appendChild(details);
  document.getElementById('candidate-count').textContent = candidates.length + ' coincidencias';
  document.getElementById('candidate-note').textContent = candidates.length + ' registros · elige el que sea tu inmueble';
  candidates.forEach(function (candidate, index) {
    var card = element('label', 'cand');
    var id = 'candidate-' + index;
    card.htmlFor = id;
    var radio = element('input');
    radio.type = 'radio'; radio.name = 'candidato'; radio.id = id; radio.value = candidate.pairId;
    card.appendChild(radio);
    var body = element('span', 'cand-body');
    var top = element('span', 'cand-top');
    var heading = element('span');
    heading.appendChild(element('span', 'cand-title', candidate.title));
    var address = element('span', 'cand-addr', candidate.address); address.style.display = 'block'; heading.appendChild(address);
    top.appendChild(heading); top.appendChild(element('span', 'cand-badge', candidate.confidence)); body.appendChild(top);
    var figures = element('span', 'cand-figures');
    [['Superficie', candidate.surface], ['Precio', candidate.price], ['Piso', candidate.floor == null ? 'Sin dato' : candidate.floor]].forEach(function (item) {
      var fig = element('span', 'fig'); fig.appendChild(element('span', 'fig-k', item[0])); fig.appendChild(element('span', 'fig-v num', item[1])); figures.appendChild(fig);
    });
    body.appendChild(figures); body.appendChild(element('span', 'reason', candidate.reason)); card.appendChild(body); list.appendChild(card);
  });
  var error = document.getElementById('claim-error');
  function render() {
    var state = store.read().ownerDuplicate;
    var valid = state && state.caseKey === 'oficinaPiso6';
    document.getElementById('candidates-block').hidden = !!valid;
    document.getElementById('status-claim').hidden = !valid || state.status !== 'claim';
    document.getElementById('status-new').hidden = !valid || state.status !== 'new';
    if (valid && state.status === 'claim') {
      var candidate = candidates.find(function (c) { return c.pairId === state.pairId; });
      document.getElementById('claim-detail').textContent = 'Reclamaste ' + (candidate ? candidate.title + ' · ' + candidate.address : 'el inmueble seleccionado') + '. Un asesor de BEIQA confirma la titularidad antes de publicar.';
    }
    document.getElementById('new-detail').textContent = 'El registro ' + own.title + ' · ' + own.address + ' pasa a validación del asesor antes de publicar.';
  }
  function decide(status, pairId) {
    var message = status === 'claim' ? 'Reclamo en verificación' : 'Pasa a validación del asesor';
    store.change({ ownerDuplicate: { caseKey: 'oficinaPiso6', status: status, pairId: pairId || null } }, { what: message });
    error.hidden = true; render(); live.textContent = message;
    var heading = document.getElementById(status === 'claim' ? 'h-claim' : 'h-new'); heading.tabIndex = -1; heading.focus();
  }
  document.getElementById('btn-claim').addEventListener('click', function () {
    var selected = list.querySelector('input:checked');
    if (!selected) { error.hidden = false; live.textContent = error.textContent; var first = list.querySelector('input'); if (first) first.focus(); return; }
    decide('claim', selected.value);
  });
  list.addEventListener('change', function () { error.hidden = true; });
  document.getElementById('btn-not-mine').addEventListener('click', function () { decide('new'); });
  ['undo-claim', 'undo-new'].forEach(function (id) { document.getElementById(id).addEventListener('click', function () {
    store.change({ ownerDuplicate: null }, { what: 'Decisión de coincidencia deshecha' }); render(); live.textContent = 'Decisión deshecha. Vuelves a elegir.'; document.getElementById('btn-claim').focus();
  }); });
  render();
})();
