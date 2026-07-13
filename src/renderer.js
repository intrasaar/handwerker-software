// ============ State ============
let currentPage = 'dashboard';
let currentMonth = new Date();
let kundenListe = [];
let modalCallback = null;

// ============ Navigation ============
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    const page = item.dataset.page;
    navigateTo(page);
  });
});

function navigateTo(page) {
  currentPage = page;
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  document.querySelector(`.nav-item[data-page="${page}"]`).classList.add('active');
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(`page-${page}`).classList.add('active');
  loadPage(page);
}

function loadPage(page) {
  switch(page) {
    case 'dashboard': loadDashboard(); break;
    case 'kunden': loadKunden(); break;
    case 'angebote': loadAngebote(); break;
    case 'rechnungen': loadRechnungen(); break;
    case 'termine': loadKalender(); break;
    case 'auftraege': loadAuftraege(); break;
    case 'einstellungen': loadEinstellungen(); break;
    case 'buchungen': loadBuchungen(); break;
    case 'ust': loadUstVoranmeldung(); break;
    case 'import': break;
  }
}

// ============ Dashboard ============
async function loadDashboard() {
  const data = await api.getDashboardData();
  document.getElementById('stat-kunden').textContent = data.kunden;
  document.getElementById('stat-angebote').textContent = data.angebote.anzahl;
  document.getElementById('stat-angebote-summe').textContent = formatEuro(data.angebote.betrag);
  document.getElementById('stat-rechnungen').textContent = data.rechnungen.anzahl;
  document.getElementById('stat-rechnungen-summe').textContent = formatEuro(data.rechnungen.betrag);
  document.getElementById('stat-termine').textContent = data.termineHeute;
  document.getElementById('stat-auftraege').textContent = data.auftraege;
  document.getElementById('stat-umsatz').textContent = formatEuro(data.umsatzMonat);
}

// ============ Kunden ============
async function loadKunden() {
  kundenListe = await api.getKunden();
  const tbody = document.getElementById('kunden-tbody');
  tbody.innerHTML = kundenListe.map(k => `
    <tr>
      <td><strong>${escHtml(k.name)}</strong></td>
      <td>${escHtml(k.ansprechpartner || '-')}</td>
      <td>${escHtml(k.strasse || '')} ${escHtml(k.plz || '')} ${escHtml(k.ort || '')}</td>
      <td>${escHtml(k.telefon || '-')}</td>
      <td>${escHtml(k.email || '-')}</td>
      <td>
        <div class="btn-group">
          <button class="btn btn-secondary btn-small" onclick="editKunde(${k.id})">✏️</button>
          <button class="btn btn-danger btn-small" onclick="deleteKunde(${k.id})">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function showKundenForm(kunde = null) {
  const title = kunde ? 'Kunde bearbeiten' : 'Neuer Kunde';
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = `
    <div class="form-group">
      <label>Name *</label>
      <input type="text" id="k-name" value="${escHtml(kunde?.name || '')}" required>
    </div>
    <div class="form-group">
      <label>Ansprechpartner</label>
      <input type="text" id="k-ansprechpartner" value="${escHtml(kunde?.ansprechpartner || '')}">
    </div>
    <div class="form-group">
      <label>Straße & Nr.</label>
      <input type="text" id="k-strasse" value="${escHtml(kunde?.strasse || '')}">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>PLZ</label>
        <input type="text" id="k-plz" value="${escHtml(kunde?.plz || '')}">
      </div>
      <div class="form-group">
        <label>Ort</label>
        <input type="text" id="k-ort" value="${escHtml(kunde?.ort || '')}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Telefon</label>
        <input type="text" id="k-telefon" value="${escHtml(kunde?.telefon || '')}">
      </div>
      <div class="form-group">
        <label>E-Mail</label>
        <input type="text" id="k-email" value="${escHtml(kunde?.email || '')}">
      </div>
    </div>
    <div class="form-group">
      <label>Notizen</label>
      <textarea id="k-notizen" rows="3">${escHtml(kunde?.notizen || '')}</textarea>
    </div>
  `;
  document.getElementById('modal-footer').innerHTML = `
    <button class="btn btn-secondary" onclick="closeModal()">Abbrechen</button>
    <button class="btn btn-primary" onclick="saveKunde(${kunde?.id || 'null'})">Speichern</button>
  `;
  openModal();
}

async function saveKunde(id) {
  const kunde = {
    id: id,
    name: document.getElementById('k-name').value,
    ansprechpartner: document.getElementById('k-ansprechpartner').value,
    strasse: document.getElementById('k-strasse').value,
    plz: document.getElementById('k-plz').value,
    ort: document.getElementById('k-ort').value,
    telefon: document.getElementById('k-telefon').value,
    email: document.getElementById('k-email').value,
    notizen: document.getElementById('k-notizen').value
  };
  if (!kunde.name) { alert('Name ist erforderlich!'); return; }
  await api.saveKunde(kunde);
  closeModal();
  loadKunden();
}

async function editKunde(id) {
  const kunde = await api.getKunde(id);
  showKundenForm(kunde);
}

async function deleteKunde(id) {
  if (confirm('Kunde wirklich löschen?')) {
    await api.deleteKunde(id);
    loadKunden();
  }
}

// ============ Angebote ============
async function loadAngebote() {
  const liste = await api.getAngebote();
  const tbody = document.getElementById('angebote-tbody');
  tbody.innerHTML = liste.map(a => `
    <tr>
      <td><strong>${escHtml(a.nummer)}</strong></td>
      <td>${escHtml(a.kunden_name || '-')}</td>
      <td>${escHtml(a.titel)}</td>
      <td>${formatEuro(a.betrag_brutto)}</td>
      <td><span class="badge badge-${a.status}">${a.status}</span></td>
      <td>${a.gueltig_bis || '-'}</td>
      <td>
        <div class="btn-group">
          <button class="btn btn-secondary btn-small" onclick="editAngebot(${a.id})">✏️</button>
          ${a.status === 'offen' ? `<button class="btn btn-success btn-small" onclick="angebotAkzeptiert(${a.id})">✅</button>` : ''}
          ${a.status === 'akzeptiert' ? `<button class="btn btn-primary btn-small" onclick="angebotZuRechnung(${a.id})">→ Rechnung</button>` : ''}
          <button class="btn btn-secondary btn-small" onclick="viewAngebot(${a.id})">📄</button>
          <button class="btn btn-danger btn-small" onclick="deleteAngebot(${a.id})">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');
}

async function showAngebotForm(angebot = null) {
  await loadKunden();
  const nummer = angebot ? angebot.nummer : await api.getNaechsteNummer('AN');
  const title = angebot ? 'Angebot bearbeiten' : 'Neues Angebot';
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = `
    <div class="form-row-3">
      <div class="form-group">
        <label>Kunde *</label>
        <select id="a-kunde">
          <option value="">-- Kunde wählen --</option>
          ${kundenListe.map(k => `<option value="${k.id}" ${angebot?.kunden_id == k.id ? 'selected' : ''}>${escHtml(k.name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Nr.</label>
        <input type="text" id="a-nummer" value="${nummer}" readonly>
      </div>
      <div class="form-group">
        <label>Gültig bis</label>
        <input type="date" id="a-gueltig" value="${angebot?.gueltig_bis || ''}">
      </div>
    </div>
    <div class="form-group">
      <label>Titel *</label>
      <input type="text" id="a-titel" value="${escHtml(angebot?.titel || '')}">
    </div>
    <div class="form-group">
      <label>Beschreibung</label>
      <textarea id="a-beschreibung" rows="2">${escHtml(angebot?.beschreibung || '')}</textarea>
    </div>
    <div class="form-group">
      <label>MwSt-Satz (%)</label>
      <input type="number" id="a-mwst" value="${angebot?.mwst_satz || 19}" min="0" max="100">
    </div>
    <div class="form-group">
      <label>Positionen</label>
      <table class="positionen-table" id="a-positionen">
        <thead>
          <tr>
            <th class="col-nr">#</th>
            <th class="col-desc">Beschreibung</th>
            <th class="col-num">Menge</th>
            <th class="col-unit">Einheit</th>
            <th class="col-price">Einzelpreis</th>
            <th class="col-total">Gesamt</th>
            <th class="col-action"></th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
      <button class="btn btn-secondary btn-small" style="margin-top:8px" onclick="addPosition('a-positionen')">+ Position</button>
    </div>
    <div class="positionen-summen">
      <div>Netto: <strong id="a-netto">0,00 €</strong></div>
      <div>MwSt: <strong id="a-mwst-summe">0,00 €</strong></div>
      <div class="summe-brutto">Brutto: <strong id="a-brutto">0,00 €</strong></div>
    </div>
  `;
  document.getElementById('modal-footer').innerHTML = `
    <button class="btn btn-secondary" onclick="closeModal()">Abbrechen</button>
    <button class="btn btn-primary" onclick="saveAngebot(${angebot?.id || 'null'})">Speichern</button>
  `;
  openModal();

  if (angebot?.positionen) {
    for (const pos of angebot.positionen) {
      addPosition('a-positionen', pos);
    }
  } else {
    addPosition('a-positionen');
  }
  recalcSummen('a');
}

async function saveAngebot(id) {
  const positionen = getPositionen('a-positionen');
  const netto = positionen.reduce((s, p) => s + p.gesamt, 0);
  const mwstSatz = parseFloat(document.getElementById('a-mwst').value) || 19;
  const brutto = netto * (1 + mwstSatz / 100);

  const angebot = {
    id: id,
    nummer: document.getElementById('a-nummer').value,
    kunden_id: parseInt(document.getElementById('a-kunde').value),
    titel: document.getElementById('a-titel').value,
    beschreibung: document.getElementById('a-beschreibung').value,
    mwst_satz: mwstSatz,
    betrag_netto: netto,
    betrag_brutto: brutto,
    status: 'offen',
    gueltig_bis: document.getElementById('a-gueltig').value
  };
  if (!angebot.kunden_id || !angebot.titel) { alert('Kunde und Titel sind erforderlich!'); return; }
  await api.saveAngebot({ angebot, positionen });
  closeModal();
  loadAngebote();
}

async function editAngebot(id) {
  const angebot = await api.getAngebot(id);
  showAngebotForm(angebot);
}

async function deleteAngebot(id) {
  if (confirm('Angebot wirklich löschen?')) {
    await api.deleteAngebot(id);
    loadAngebote();
  }
}

async function angebotAkzeptiert(id) {
  await api.angebotAkzeptiert(id);
  loadAngebote();
}

async function angebotZuRechnung(id) {
  const rechnungId = await api.angebotZuRechnung(id);
  if (rechnungId) {
    alert('Rechnung erstellt!');
    navigateTo('rechnungen');
  }
}

async function viewAngebot(id) {
  const a = await api.getAngebot(id);
  if (!a) return;
  const inst = await api.getEinstellungen();
  document.getElementById('modal-title').textContent = `Angebot ${a.nummer}`;
  document.getElementById('modal-body').innerHTML = `
    <div style="font-family: monospace; font-size: 13px;">
      <div style="text-align:center; margin-bottom:20px;">
        <strong style="font-size:18px;">${escHtml(inst.firma)}</strong><br>
        ${escHtml(inst.anschrift)} | ${escHtml(inst.plz_ort)}<br>
        Tel: ${escHtml(inst.telefon)} | ${escHtml(inst.email)}
      </div>
      <hr style="border:1px solid #ccc; margin:16px 0;">
      <div style="margin-bottom:20px;">
        <strong style="font-size:24px;">ANGEBOT ${a.nummer}</strong><br>
        Erstellt: ${a.erstellt}<br>
        ${a.gueltig_bis ? `Gültig bis: ${a.gueltig_bis}` : ''}
      </div>
      <div style="margin-bottom:16px;">
        <strong>Kunde:</strong> ${escHtml(a.kunden_name)}<br>
        ${a.strasse ? escHtml(a.strasse) + '<br>' : ''}
        ${a.plz ? escHtml(a.plz) + ' ' : ''}${a.ort ? escHtml(a.ort) : ''}
      </div>
      <div style="margin-bottom:16px;">
        <strong>${escHtml(a.titel)}</strong><br>
        ${a.beschreibung ? escHtml(a.beschreibung) : ''}
      </div>
      <table style="width:100%; border-collapse:collapse; margin:16px 0;">
        <thead>
          <tr style="background:#f0f0f0;">
            <th style="padding:8px; text-align:left;">#</th>
            <th style="padding:8px; text-align:left;">Beschreibung</th>
            <th style="padding:8px; text-align:right;">Menge</th>
            <th style="padding:8px; text-align:right;">Preis</th>
            <th style="padding:8px; text-align:right;">Gesamt</th>
          </tr>
        </thead>
        <tbody>
          ${(a.positionen || []).map(p => `
            <tr style="border-bottom:1px solid #eee;">
              <td style="padding:8px;">${p.position}</td>
              <td style="padding:8px;">${escHtml(p.beschreibung)}</td>
              <td style="padding:8px; text-align:right;">${p.menge} ${p.einheit}</td>
              <td style="padding:8px; text-align:right;">${formatEuro(p.einzelpreis)}</td>
              <td style="padding:8px; text-align:right;">${formatEuro(p.gesamt)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div style="text-align:right; margin-top:20px; font-size:14px;">
        <div>Netto: <strong>${formatEuro(a.betrag_netto)}</strong></div>
        <div>MwSt. ${a.mwst_satz}%: <strong>${formatEuro(a.betrag_brutto - a.betrag_netto)}</strong></div>
        <div style="font-size:18px; border-top:2px solid #333; padding-top:8px; margin-top:8px;">
          <strong>Gesamt: ${formatEuro(a.betrag_brutto)}</strong>
        </div>
      </div>
      <div style="margin-top:30px; font-size:11px; color:#666; border-top:1px solid #ccc; padding-top:12px;">
        ${escHtml(inst.firma)} | ${escHtml(inst.anschrift)}, ${escHtml(inst.plz_ort)}<br>
        USt-IdNr.: ${escHtml(inst.ust_id)} | IBAN: ${escHtml(inst.iban)} | BIC: ${escHtml(inst.bic)}
      </div>
    </div>
  `;
  document.getElementById('modal-footer').innerHTML = `
    <button class="btn btn-secondary" onclick="closeModal()">Schließen</button>
    <button class="btn btn-primary" onclick="closeModal(); exportAngebotPdf(${a.id})">📄 PDF Export</button>
  `;
  openModal();
}

async function exportAngebotPdf(id) {
  const a = await api.getAngebot(id);
  const inst = await api.getEinstellungen();
  await api.exportPdf({
    nummer: a.nummer,
    titel: `Angebot ${a.nummer} — ${a.titel}`,
    datum: a.erstellt,
    kunden_name: a.kunden_name,
    positionen: a.positionen,
    betrag_netto: a.betrag_netto,
    mwst_satz: a.mwst_satz,
    betrag_brutto: a.betrag_brutto
  });
}

// ============ Rechnungen ============
async function loadRechnungen() {
  const liste = await api.getRechnungen();
  const tbody = document.getElementById('rechnungen-tbody');
  tbody.innerHTML = liste.map(r => `
    <tr>
      <td><strong>${escHtml(r.nummer)}</strong></td>
      <td>${escHtml(r.kunden_name || '-')}</td>
      <td>${escHtml(r.titel)}</td>
      <td>${formatEuro(r.betrag_brutto)}</td>
      <td><span class="badge badge-${r.status === 'bezahlt' ? 'bezahlt' : 'offen'}">${r.status}</span></td>
      <td>${r.faellig_am || '-'}</td>
      <td>
        <div class="btn-group">
          <button class="btn btn-secondary btn-small" onclick="editRechnung(${r.id})">✏️</button>
          ${r.status === 'offen' ? `<button class="btn btn-success btn-small" onclick="rechnungBezahlt(${r.id})">💰 Bezahlt</button>` : ''}
          <button class="btn btn-secondary btn-small" onclick="viewRechnung(${r.id})">📄</button>
          <button class="btn btn-danger btn-small" onclick="deleteRechnung(${r.id})">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');
}

async function showRechnungForm(rechnung = null) {
  await loadKunden();
  const nummer = rechnung ? rechnung.nummer : await api.getNaechsteNummer('RE');
  const title = rechnung ? 'Rechnung bearbeiten' : 'Neue Rechnung';
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = `
    <div class="form-row-3">
      <div class="form-group">
        <label>Kunde *</label>
        <select id="r-kunde">
          <option value="">-- Kunde wählen --</option>
          ${kundenListe.map(k => `<option value="${k.id}" ${rechnung?.kunden_id == k.id ? 'selected' : ''}>${escHtml(k.name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Nr.</label>
        <input type="text" id="r-nummer" value="${nummer}" readonly>
      </div>
      <div class="form-group">
        <label>Fällig am</label>
        <input type="date" id="r-faellig" value="${rechnung?.faellig_am || ''}">
      </div>
    </div>
    <div class="form-group">
      <label>Titel *</label>
      <input type="text" id="r-titel" value="${escHtml(rechnung?.titel || '')}">
    </div>
    <div class="form-group">
      <label>Beschreibung</label>
      <textarea id="r-beschreibung" rows="2">${escHtml(rechnung?.beschreibung || '')}</textarea>
    </div>
    <div class="form-group">
      <label>MwSt-Satz (%)</label>
      <input type="number" id="r-mwst" value="${rechnung?.mwst_satz || 19}" min="0" max="100">
    </div>
    <div class="form-group">
      <label>Positionen</label>
      <table class="positionen-table" id="r-positionen">
        <thead>
          <tr>
            <th class="col-nr">#</th>
            <th class="col-desc">Beschreibung</th>
            <th class="col-num">Menge</th>
            <th class="col-unit">Einheit</th>
            <th class="col-price">Einzelpreis</th>
            <th class="col-total">Gesamt</th>
            <th class="col-action"></th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
      <button class="btn btn-secondary btn-small" style="margin-top:8px" onclick="addPosition('r-positionen')">+ Position</button>
    </div>
    <div class="positionen-summen">
      <div>Netto: <strong id="r-netto">0,00 €</strong></div>
      <div>MwSt: <strong id="r-mwst-summe">0,00 €</strong></div>
      <div class="summe-brutto">Brutto: <strong id="r-brutto">0,00 €</strong></div>
    </div>
  `;
  document.getElementById('modal-footer').innerHTML = `
    <button class="btn btn-secondary" onclick="closeModal()">Abbrechen</button>
    <button class="btn btn-primary" onclick="saveRechnung(${rechnung?.id || 'null'})">Speichern</button>
  `;
  openModal();

  if (rechnung?.positionen) {
    for (const pos of rechnung.positionen) {
      addPosition('r-positionen', pos);
    }
  } else {
    addPosition('r-positionen');
  }
  recalcSummen('r');
}

async function saveRechnung(id) {
  const positionen = getPositionen('r-positionen');
  const netto = positionen.reduce((s, p) => s + p.gesamt, 0);
  const mwstSatz = parseFloat(document.getElementById('r-mwst').value) || 19;
  const brutto = netto * (1 + mwstSatz / 100);

  const rechnung = {
    id: id,
    nummer: document.getElementById('r-nummer').value,
    kunden_id: parseInt(document.getElementById('r-kunde').value),
    titel: document.getElementById('r-titel').value,
    beschreibung: document.getElementById('r-beschreibung').value,
    mwst_satz: mwstSatz,
    betrag_netto: netto,
    betrag_brutto: brutto,
    status: 'offen',
    faellig_am: document.getElementById('r-faellig').value
  };
  if (!rechnung.kunden_id || !rechnung.titel) { alert('Kunde und Titel sind erforderlich!'); return; }
  await api.saveRechnung({ rechnung, positionen });
  closeModal();
  loadRechnungen();
}

async function editRechnung(id) {
  const rechnung = await api.getRechnung(id);
  showRechnungForm(rechnung);
}

async function deleteRechnung(id) {
  if (confirm('Rechnung wirklich löschen?')) {
    await api.deleteRechnung(id);
    loadRechnungen();
  }
}

async function rechnungBezahlt(id) {
  await api.rechnungBezahlt(id);
  loadRechnungen();
}

async function viewRechnung(id) {
  const r = await api.getRechnung(id);
  if (!r) return;
  const inst = await api.getEinstellungen();
  document.getElementById('modal-title').textContent = `Rechnung ${r.nummer}`;
  document.getElementById('modal-body').innerHTML = `
    <div style="font-family: monospace; font-size: 13px;">
      <div style="text-align:center; margin-bottom:20px;">
        <strong style="font-size:18px;">${escHtml(inst.firma)}</strong><br>
        ${escHtml(inst.anschrift)} | ${escHtml(inst.plz_ort)}<br>
        Tel: ${escHtml(inst.telefon)} | ${escHtml(inst.email)}
      </div>
      <hr style="border:1px solid #ccc; margin:16px 0;">
      <div style="margin-bottom:20px;">
        <strong style="font-size:24px;">RECHNUNG ${r.nummer}</strong><br>
        Erstellt: ${r.erstellt}<br>
        ${r.faellig_am ? `Fällig: ${r.faellig_am}` : ''}
      </div>
      <div style="margin-bottom:16px;">
        <strong>Rechnungsempfänger:</strong><br>
        ${escHtml(r.kunden_name)}<br>
        ${r.strasse ? escHtml(r.strasse) + '<br>' : ''}
        ${r.plz ? escHtml(r.plz) + ' ' : ''}${r.ort ? escHtml(r.ort) : ''}
      </div>
      <div style="margin-bottom:16px;">
        <strong>${escHtml(r.titel)}</strong><br>
        ${r.beschreibung ? escHtml(r.beschreibung) : ''}
      </div>
      <table style="width:100%; border-collapse:collapse; margin:16px 0;">
        <thead>
          <tr style="background:#f0f0f0;">
            <th style="padding:8px; text-align:left;">#</th>
            <th style="padding:8px; text-align:left;">Beschreibung</th>
            <th style="padding:8px; text-align:right;">Menge</th>
            <th style="padding:8px; text-align:right;">Preis</th>
            <th style="padding:8px; text-align:right;">Gesamt</th>
          </tr>
        </thead>
        <tbody>
          ${(r.positionen || []).map(p => `
            <tr style="border-bottom:1px solid #eee;">
              <td style="padding:8px;">${p.position}</td>
              <td style="padding:8px;">${escHtml(p.beschreibung)}</td>
              <td style="padding:8px; text-align:right;">${p.menge} ${p.einheit}</td>
              <td style="padding:8px; text-align:right;">${formatEuro(p.einzelpreis)}</td>
              <td style="padding:8px; text-align:right;">${formatEuro(p.gesamt)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div style="text-align:right; margin-top:20px; font-size:14px;">
        <div>Netto: <strong>${formatEuro(r.betrag_netto)}</strong></div>
        <div>MwSt. ${r.mwst_satz}%: <strong>${formatEuro(r.betrag_brutto - r.betrag_netto)}</strong></div>
        <div style="font-size:18px; border-top:2px solid #333; padding-top:8px; margin-top:8px;">
          <strong>Gesamt: ${formatEuro(r.betrag_brutto)}</strong>
        </div>
      </div>
      <div style="margin-top:30px; font-size:11px; color:#666; border-top:1px solid #ccc; padding-top:12px;">
        ${escHtml(inst.firma)} | ${escHtml(inst.anschrift)}, ${escHtml(inst.plz_ort)}<br>
        USt-IdNr.: ${escHtml(inst.ust_id)} | IBAN: ${escHtml(inst.iban)} | BIC: ${escHtml(inst.bic)}
      </div>
    </div>
  `;
  document.getElementById('modal-footer').innerHTML = `
    <button class="btn btn-secondary" onclick="closeModal()">Schließen</button>
    <button class="btn btn-primary" onclick="closeModal(); exportRechnungPdf(${r.id})">📄 PDF Export</button>
  `;
  openModal();
}

async function exportRechnungPdf(id) {
  const r = await api.getRechnung(id);
  await api.exportPdf({
    nummer: r.nummer,
    titel: `Rechnung ${r.nummer} — ${r.titel}`,
    datum: r.erstellt,
    kunden_name: r.kunden_name,
    positionen: r.positionen,
    betrag_netto: r.betrag_netto,
    mwst_satz: r.mwst_satz,
    betrag_brutto: r.betrag_brutto
  });
}

// ============ Termine / Kalender ============
function prevMonth() {
  currentMonth.setMonth(currentMonth.getMonth() - 1);
  loadKalender();
}

function nextMonth() {
  currentMonth.setMonth(currentMonth.getMonth() + 1);
  loadKalender();
}

async function loadKalender() {
  const monat = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
  document.getElementById('kalender-monat').textContent = currentMonth.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

  const termine = await api.getTermine(monat);
  const termineMap = {};
  termine.forEach(t => {
    if (!termineMap[t.datum]) termineMap[t.datum] = [];
    termineMap[t.datum].push(t);
  });

  const grid = document.getElementById('kalender-grid');
  const days = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  let html = days.map(d => `<div class="kalender-header">${d}</div>`).join('');

  const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const lastDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
  let startDay = (firstDay.getDay() + 6) % 7;
  const today = new Date().toISOString().split('T')[0];

  for (let i = 0; i < startDay; i++) {
    html += `<div class="kalender-tag" style="background:#f9fafb;"></div>`;
  }

  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isHeute = dateStr === today;
    const tageTermine = termineMap[dateStr] || [];

    html += `<div class="kalender-tag ${isHeute ? 'heute' : ''}" onclick="showTerminForm(null, '${dateStr}')">
      <div class="tag-nummer">${d}</div>
      ${tageTermine.map(t => `<div class="kalender-termin" style="background:${t.farbe || '#3b82f6'}" onclick="event.stopPropagation(); editTermin(${t.id})">${escHtml(t.titel)}</div>`).join('')}
    </div>`;
  }

  grid.innerHTML = html;
}

async function showTerminForm(termin = null, datum = null) {
  await loadKunden();
  const title = termin ? 'Termin bearbeiten' : 'Neuer Termin';
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = `
    <div class="form-group">
      <label>Titel *</label>
      <input type="text" id="t-titel" value="${escHtml(termin?.titel || '')}">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Kunde</label>
        <select id="t-kunde">
          <option value="">-- Kein Kunde --</option>
          ${kundenListe.map(k => `<option value="${k.id}" ${termin?.kunden_id == k.id ? 'selected' : ''}>${escHtml(k.name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Datum *</label>
        <input type="date" id="t-datum" value="${termin?.datum || datum || ''}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Uhrzeit von</label>
        <input type="time" id="t-von" value="${termin?.uhrzeit_von || ''}">
      </div>
      <div class="form-group">
        <label>Uhrzeit bis</label>
        <input type="time" id="t-bis" value="${termin?.uhrzeit_bis || ''}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Status</label>
        <select id="t-status">
          <option value="geplant" ${termin?.status === 'geplant' ? 'selected' : ''}>Geplant</option>
          <option value="bestaetigt" ${termin?.status === 'bestaetigt' ? 'selected' : ''}>Bestätigt</option>
          <option value="erledigt" ${termin?.status === 'erledigt' ? 'selected' : ''}>Erledigt</option>
          <option value="abgesagt" ${termin?.status === 'abgesagt' ? 'selected' : ''}>Abgesagt</option>
        </select>
      </div>
      <div class="form-group">
        <label>Farbe</label>
        <input type="color" id="t-farbe" value="${termin?.farbe || '#3b82f6'}">
      </div>
    </div>
    <div class="form-group">
      <label>Beschreibung</label>
      <textarea id="t-beschreibung" rows="2">${escHtml(termin?.beschreibung || '')}</textarea>
    </div>
  `;
  document.getElementById('modal-footer').innerHTML = `
    ${termin ? `<button class="btn btn-danger" onclick="deleteTermin(${termin.id})">Löschen</button>` : ''}
    <button class="btn btn-secondary" onclick="closeModal()">Abbrechen</button>
    <button class="btn btn-primary" onclick="saveTermin(${termin?.id || 'null'})">Speichern</button>
  `;
  openModal();
}

async function saveTermin(id) {
  const termin = {
    id: id,
    kunden_id: parseInt(document.getElementById('t-kunde').value) || null,
    titel: document.getElementById('t-titel').value,
    beschreibung: document.getElementById('t-beschreibung').value,
    datum: document.getElementById('t-datum').value,
    uhrzeit_von: document.getElementById('t-von').value,
    uhrzeit_bis: document.getElementById('t-bis').value,
    status: document.getElementById('t-status').value,
    farbe: document.getElementById('t-farbe').value
  };
  if (!termin.titel || !termin.datum) { alert('Titel und Datum sind erforderlich!'); return; }
  await api.saveTermin(termin);
  closeModal();
  loadKalender();
}

async function editTermin(id) {
  const termine = await api.getTermine();
  const termin = termine.find(t => t.id === id);
  if (termin) showTerminForm(termin);
}

async function deleteTermin(id) {
  if (confirm('Termin wirklich löschen?')) {
    await api.deleteTermin(id);
    closeModal();
    loadKalender();
  }
}

// ============ Aufträge ============
async function loadAuftraege() {
  const liste = await api.getAuftraege();
  const tbody = document.getElementById('auftraege-tbody');
  tbody.innerHTML = liste.map(a => `
    <tr>
      <td><strong>${escHtml(a.nummer)}</strong></td>
      <td>${escHtml(a.kunden_name || '-')}</td>
      <td>${escHtml(a.titel)}</td>
      <td><span class="badge badge-${a.status === 'fertig' ? 'fertig' : a.status === 'in-arbeit' ? 'in-arbeit' : 'offen-orange'}">${a.status}</span></td>
      <td>${a.prioritaet}</td>
      <td>${a.start_datum || '-'}</td>
      <td>${a.end_datum || '-'}</td>
      <td>
        <div class="btn-group">
          <button class="btn btn-secondary btn-small" onclick="editAuftrag(${a.id})">✏️</button>
          <button class="btn btn-danger btn-small" onclick="deleteAuftrag(${a.id})">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');
}

async function showAuftragForm(auftrag = null) {
  await loadKunden();
  const nummer = auftrag ? auftrag.nummer : 'AU-' + String(Date.now()).slice(-5);
  const title = auftrag ? 'Auftrag bearbeiten' : 'Neuer Auftrag';
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = `
    <div class="form-row">
      <div class="form-group">
        <label>Kunde *</label>
        <select id="au-kunde">
          <option value="">-- Kunde wählen --</option>
          ${kundenListe.map(k => `<option value="${k.id}" ${auftrag?.kunden_id == k.id ? 'selected' : ''}>${escHtml(k.name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Nr.</label>
        <input type="text" id="au-nummer" value="${nummer}" readonly>
      </div>
    </div>
    <div class="form-group">
      <label>Titel *</label>
      <input type="text" id="au-titel" value="${escHtml(auftrag?.titel || '')}">
    </div>
    <div class="form-group">
      <label>Beschreibung</label>
      <textarea id="au-beschreibung" rows="2">${escHtml(auftrag?.beschreibung || '')}</textarea>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Status</label>
        <select id="au-status">
          <option value="offen" ${auftrag?.status === 'offen' ? 'selected' : ''}>Offen</option>
          <option value="in-arbeit" ${auftrag?.status === 'in-arbeit' ? 'selected' : ''}>In Arbeit</option>
          <option value="fertig" ${auftrag?.status === 'fertig' ? 'selected' : ''}>Fertig</option>
        </select>
      </div>
      <div class="form-group">
        <label>Priorität</label>
        <select id="au-prioritaet">
          <option value="niedrig" ${auftrag?.prioritaet === 'niedrig' ? 'selected' : ''}>Niedrig</option>
          <option value="normal" ${auftrag?.prioritaet === 'normal' || !auftrag ? 'selected' : ''}>Normal</option>
          <option value="hoch" ${auftrag?.prioritaet === 'hoch' ? 'selected' : ''}>Hoch</option>
          <option value="dringend" ${auftrag?.prioritaet === 'dringend' ? 'selected' : ''}>Dringend</option>
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Startdatum</label>
        <input type="date" id="au-start" value="${auftrag?.start_datum || ''}">
      </div>
      <div class="form-group">
        <label>Enddatum</label>
        <input type="date" id="au-end" value="${auftrag?.end_datum || ''}">
      </div>
    </div>
  `;
  document.getElementById('modal-footer').innerHTML = `
    <button class="btn btn-secondary" onclick="closeModal()">Abbrechen</button>
    <button class="btn btn-primary" onclick="saveAuftrag(${auftrag?.id || 'null'})">Speichern</button>
  `;
  openModal();
}

async function saveAuftrag(id) {
  const auftrag = {
    id: id,
    nummer: document.getElementById('au-nummer').value,
    kunden_id: parseInt(document.getElementById('au-kunde').value),
    titel: document.getElementById('au-titel').value,
    beschreibung: document.getElementById('au-beschreibung').value,
    status: document.getElementById('au-status').value,
    prioritaet: document.getElementById('au-prioritaet').value,
    start_datum: document.getElementById('au-start').value,
    end_datum: document.getElementById('au-end').value
  };
  if (!auftrag.kunden_id || !auftrag.titel) { alert('Kunde und Titel sind erforderlich!'); return; }
  await api.saveAuftrag(auftrag);
  closeModal();
  loadAuftraege();
}

async function editAuftrag(id) {
  const auftraege = await api.getAuftraege();
  const auftrag = auftraege.find(a => a.id === id);
  if (auftrag) showAuftragForm(auftrag);
}

async function deleteAuftrag(id) {
  if (confirm('Auftrag wirklich löschen?')) {
    await api.deleteAuftrag(id);
    loadAuftraege();
  }
}

// ============ Einstellungen ============
async function loadEinstellungen() {
  const s = await api.getEinstellungen();
  document.getElementById('set-firma').value = s.firma || '';
  document.getElementById('set-anschrift').value = s.anschrift || '';
  document.getElementById('set-plz-ort').value = s.plz_ort || '';
  document.getElementById('set-telefon').value = s.telefon || '';
  document.getElementById('set-email').value = s.email || '';
  document.getElementById('set-ust').value = s.ust_id || '';
  document.getElementById('set-iban').value = s.iban || '';
  document.getElementById('set-bic').value = s.bic || '';
}

async function saveEinstellungen() {
  await api.saveEinstellungen({
    firma: document.getElementById('set-firma').value,
    anschrift: document.getElementById('set-anschrift').value,
    plz_ort: document.getElementById('set-plz-ort').value,
    telefon: document.getElementById('set-telefon').value,
    email: document.getElementById('set-email').value,
    ust_id: document.getElementById('set-ust').value,
    iban: document.getElementById('set-iban').value,
    bic: document.getElementById('set-bic').value
  });
  alert('Einstellungen gespeichert!');
}

// ============ Positionen Helpers ============
function addPosition(tableId, data = null) {
  const table = document.getElementById(tableId);
  const tbody = table.querySelector('tbody');
  const nr = tbody.rows.length + 1;
  const row = tbody.insertRow();
  row.innerHTML = `
    <td class="col-nr">${nr}</td>
    <td class="col-desc"><input type="text" class="pos-desc" value="${escHtml(data?.beschreibung || '')}"></td>
    <td class="col-num"><input type="number" class="pos-menge" value="${data?.menge || 1}" min="0" step="0.01"></td>
    <td class="col-unit"><input type="text" class="pos-einheit" value="${escHtml(data?.einheit || 'Stk')}"></td>
    <td class="col-price"><input type="number" class="pos-preis" value="${data?.einzelpreis || 0}" min="0" step="0.01"></td>
    <td class="col-total"><span class="pos-gesamt">0,00 €</span></td>
    <td class="col-action"><button class="btn btn-danger btn-small" onclick="removePosition(this)">×</button></td>
  `;

  row.querySelectorAll('input[type="number"]').forEach(input => {
    input.addEventListener('input', () => {
      const prefix = tableId.startsWith('a') ? 'a' : 'r';
      recalcSummen(prefix);
    });
  });

  if (tableId.startsWith('a')) {
    recalcSummen('a');
  } else {
    recalcSummen('r');
  }
}

function removePosition(btn) {
  const row = btn.closest('tr');
  const tbody = row.closest('tbody');
  row.remove();
  renumberRows(tbody);
  const tableId = tbody.closest('table').id;
  const prefix = tableId.startsWith('a') ? 'a' : 'r';
  recalcSummen(prefix);
}

function renumberRows(tbody) {
  Array.from(tbody.rows).forEach((row, i) => {
    row.cells[0].textContent = i + 1;
  });
}

function getPositionen(tableId) {
  const tbody = document.getElementById(tableId).querySelector('tbody');
  return Array.from(tbody.rows).map((row, i) => ({
    position: i + 1,
    beschreibung: row.querySelector('.pos-desc').value,
    menge: parseFloat(row.querySelector('.pos-menge').value) || 0,
    einheit: row.querySelector('.pos-einheit').value,
    einzelpreis: parseFloat(row.querySelector('.pos-preis').value) || 0,
    gesamt: (parseFloat(row.querySelector('.pos-menge').value) || 0) * (parseFloat(row.querySelector('.pos-preis').value) || 0)
  }));
}

function recalcSummen(prefix) {
  const tableId = prefix === 'a' ? 'a-positionen' : 'r-positionen';
  const tbody = document.getElementById(tableId).querySelector('tbody');
  let netto = 0;

  Array.from(tbody.rows).forEach(row => {
    const menge = parseFloat(row.querySelector('.pos-menge').value) || 0;
    const preis = parseFloat(row.querySelector('.pos-preis').value) || 0;
    const gesamt = menge * preis;
    row.querySelector('.pos-gesamt').textContent = formatEuro(gesamt);
    netto += gesamt;
  });

  const mwstSatz = parseFloat(document.getElementById(`${prefix}-mwst`).value) || 19;
  const mwst = netto * mwstSatz / 100;
  const brutto = netto + mwst;

  document.getElementById(`${prefix}-netto`).textContent = formatEuro(netto);
  document.getElementById(`${prefix}-mwst-summe`).textContent = formatEuro(mwst);
  document.getElementById(`${prefix}-brutto`).textContent = formatEuro(brutto);
}

// ============ Modal ============
function openModal() {
  document.getElementById('modal-overlay').classList.add('active');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('active');
}

// ============ Helpers ============
function formatEuro(betrag) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(betrag || 0);
}

function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ============ Init ============
loadDashboard();

// ============ Buchungen (Einnahmen/Ausgaben) ============
let currentUstMonth = new Date();

async function loadBuchungen() {
  const filters = {};
  const von = document.getElementById('filter-von')?.value;
  const bis = document.getElementById('filter-bis')?.value;
  const typ = document.getElementById('filter-typ')?.value;
  
  if (von) filters.von = von;
  if (bis) filters.bis = bis;
  if (typ) filters.typ = typ;
  
  const buchungen = await api.getBuchungen(filters);
  const tbody = document.getElementById('buchungen-tbody');
  
  let einnahmen = 0;
  let ausgaben = 0;
  
  buchungen.forEach(b => {
    if (b.typ === 'einnahme') einnahmen += b.betrag;
    else ausgaben += b.betrag;
  });
  
  document.getElementById('stat-einnahmen').textContent = formatEuro(einnahmen);
  document.getElementById('stat-ausgaben').textContent = formatEuro(ausgaben);
  document.getElementById('stat-bilanz').textContent = formatEuro(einnahmen - ausgaben);
  
  tbody.innerHTML = buchungen.map(b => `
    <tr>
      <td>${b.datum}</td>
      <td><span class="badge badge-${b.typ === 'einnahme' ? 'einnahme' : 'ausgabe'}">${b.typ === 'einnahme' ? 'Einnahme' : 'Ausgabe'}</span></td>
      <td>${escHtml(b.kategorie)}</td>
      <td>${escHtml(b.beschreibung || '-')}</td>
      <td><strong>${formatEuro(b.betrag)}</strong></td>
      <td>${formatEuro(b.mwst_betrag)}</td>
      <td>
        <div class="btn-group">
          <button class="btn btn-secondary btn-small" onclick="editBuchung(${b.id})">✏️</button>
          <button class="btn btn-danger btn-small" onclick="deleteBuchung(${b.id})">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function showBuchungForm(buchung = null) {
  const title = buchung ? 'Buchung bearbeiten' : 'Neue Buchung';
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = `
    <div class="form-row">
      <div class="form-group">
        <label>Typ *</label>
        <select id="b-typ">
          <option value="einnahme" ${buchung?.typ === 'einnahme' ? 'selected' : ''}>Einnahme</option>
          <option value="ausgabe" ${buchung?.typ === 'ausgabe' ? 'selected' : ''}>Ausgabe</option>
        </select>
      </div>
      <div class="form-group">
        <label>Kategorie *</label>
        <select id="b-kategorie">
          <option value="Rechnung" ${buchung?.kategorie === 'Rechnung' ? 'selected' : ''}>Rechnung</option>
          <option value="Material" ${buchung?.kategorie === 'Material' ? 'selected' : ''}>Material</option>
          <option value="Werkzeug" ${buchung?.kategorie === 'Werkzeug' ? 'selected' : ''}>Werkzeug</option>
          <option value="Fahrtkosten" ${buchung?.kategorie === 'Fahrtkosten' ? 'selected' : ''}>Fahrtkosten</option>
          <option value="Miete" ${buchung?.kategorie === 'Miete' ? 'selected' : ''}>Miete</option>
          <option value="Versicherung" ${buchung?.kategorie === 'Versicherung' ? 'selected' : ''}>Versicherung</option>
          <option value="Sonstiges" ${buchung?.kategorie === 'Sonstiges' ? 'selected' : ''}>Sonstiges</option>
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Betrag (brutto) *</label>
        <input type="number" id="b-betrag" value="${buchung?.betrag || ''}" step="0.01" min="0" required>
      </div>
      <div class="form-group">
        <label>MwSt-Satz (%)</label>
        <input type="number" id="b-mwst" value="${buchung?.mwst_satz || 19}" min="0" max="100">
      </div>
    </div>
    <div class="form-group">
      <label>Datum *</label>
      <input type="date" id="b-datum" value="${buchung?.datum || new Date().toISOString().split('T')[0]}" required>
    </div>
    <div class="form-group">
      <label>Beschreibung</label>
      <input type="text" id="b-beschreibung" value="${escHtml(buchung?.beschreibung || '')}">
    </div>
    <div class="form-group">
      <label>Beleg-Nr.</label>
      <input type="text" id="b-beleg" value="${escHtml(buchung?.beleg_nummer || '')}">
    </div>
  `;
  document.getElementById('modal-footer').innerHTML = `
    <button class="btn btn-secondary" onclick="closeModal()">Abbrechen</button>
    <button class="btn btn-primary" onclick="saveBuchung(${buchung?.id || 'null'})">Speichern</button>
  `;
  openModal();
}

async function saveBuchung(id) {
  const buchung = {
    id: id,
    typ: document.getElementById('b-typ').value,
    kategorie: document.getElementById('b-kategorie').value,
    betrag: parseFloat(document.getElementById('b-betrag').value),
    mwst_satz: parseFloat(document.getElementById('b-mwst').value) || 19,
    datum: document.getElementById('b-datum').value,
    beschreibung: document.getElementById('b-beschreibung').value,
    beleg_nummer: document.getElementById('b-beleg').value
  };
  
  if (!buchung.betrag || !buchung.datum) {
    alert('Betrag und Datum sind erforderlich!');
    return;
  }
  
  await api.saveBuchung(buchung);
  closeModal();
  loadBuchungen();
}

async function editBuchung(id) {
  const buchung = await api.getBuchung(id);
  showBuchungForm(buchung);
}

async function deleteBuchung(id) {
  if (confirm('Buchung wirklich löschen?')) {
    await api.deleteBuchung(id);
    loadBuchungen();
  }
}

// ============ USt-Voranmeldung ============
async function loadUstVoranmeldung() {
  const monat = `${currentUstMonth.getFullYear()}-${String(currentUstMonth.getMonth() + 1).padStart(2, '0')}`;
  document.getElementById('ust-monat').textContent = currentUstMonth.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  
  const data = await api.getUstVoranmeldung(monat);
  
  document.getElementById('ust-umsatz').textContent = formatEuro(data.rechnungenNetto);
  document.getElementById('ust-pflichtig').textContent = formatEuro(data.ustPflichtig);
  document.getElementById('ust-betrag').textContent = formatEuro(data.ustBetrag);
  document.getElementById('ust-vorsteuer').textContent = formatEuro(data.vorsteuerAbzug);
  document.getElementById('ust-zahlbar').textContent = formatEuro(data.zahlbar);
}

function prevUstMonth() {
  currentUstMonth.setMonth(currentUstMonth.getMonth() - 1);
  loadUstVoranmeldung();
}

function nextUstMonth() {
  currentUstMonth.setMonth(currentUstMonth.getMonth() + 1);
  loadUstVoranmeldung();
}

// ============ E-Rechnung ============
async function exportEREchnung(rechnungId) {
  const result = await api.exportEREchnung(rechnungId);
  if (result) {
    alert('E-Rechnung als XML exportiert!');
  }
}

// ============ CSV Import ============
async function importCsv() {
  const result = await api.importCsv();
  
  if (result) {
    const container = document.getElementById('import-ergebnis');
    const content = document.getElementById('import-ergebnis-content');
    
    if (result.error) {
      content.innerHTML = `<div class="alert alert-error">${result.error}</div>`;
    } else {
      content.innerHTML = `
        <div class="alert alert-success">
          <strong>${result.anzahlImportiert}</strong> Rechnungen erfolgreich importiert.
          ${result.fehler > 0 ? `<br><strong>${result.fehler}</strong> Fehler aufgetreten.` : ''}
        </div>
        ${result.errors.length > 0 ? `
          <div class="error-list">
            <h4>Fehler:</h4>
            <ul>
              ${result.errors.map(e => `<li>Zeile ${e.zeile}: ${e.fehler}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
      `;
    }
    
    container.style.display = 'block';
    
    if (currentPage === 'buchungen') {
      loadBuchungen();
    }
  }
}

// ============ Rechnung zu Buchung ============
async function rechnungZuBuchung(rechnungId) {
  const result = await api.rechnungZuBuchung(rechnungId);
  if (result) {
    alert('Buchung erstellt!');
  } else {
    alert('Buchung existiert bereits oder Rechnung nicht bezahlt.');
  }
}
