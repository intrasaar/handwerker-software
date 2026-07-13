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
    case 'eingangsrechnungen': loadEingangsrechnungen(); break;
    case 'lieferanten': loadLieferanten(); break;
    case 'mahnungen': loadMahnungen(); break;
    case 'termine': loadKalender(); break;
    case 'auftraege': loadAuftraege(); break;
    case 'aufmasse': loadAufmasse(); break;
    case 'artikel': loadArtikel(); break;
    case 'kasse': loadKasse(); break;
    case 'subunternehmer': loadSubunternehmer(); break;
    case 'einstellungen': loadEinstellungen(); break;
    case 'buchungen': loadBuchungen(); break;
    case 'ust': loadUstVoranmeldung(); break;
    case 'datev': loadDatev(); break;
    case 'regeln': loadRegeln(); break;
    case 'aufgaben': ladeAufgaben(); ladeKontenrahmen(); break;
    case 'doppelbuchfuehrung': ladeBuchungenSH(); ladeKontenrahmen(); break;
    case 'branchen': break;
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
    <button class="btn btn-primary" onclick="exportERechnung(${r.id})" style="background:var(--accent-orange);">⚡ E-Rechnung</button>
  `;
  openModal();
}

async function exportERechnung(id) {
  const result = await api.exportEREchnung(id);
  if (result && result.success) {
    alert('E-Rechnung exportiert:\n' + result.path);
  } else {
    alert('Fehler beim Export: ' + (result ? result.error : 'Unbekannt'));
  }
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
  loadServerEinstellungen();
  ladeLizenzStatus();
}

// ============ Lizenz in Einstellungen ============

async function ladeLizenzStatus() {
  const result = await api.checkLicense();
  const statusBox = document.getElementById('set-license-status');
  const icon = document.getElementById('set-license-icon');
  const text = document.getElementById('set-license-text');
  const detail = document.getElementById('set-license-detail');
  const fp = await api.getFingerprint();
  const fpEl = document.getElementById('set-license-fp');
  if (fpEl) fpEl.textContent = fp;

  if (result.valid) {
    statusBox.style.borderColor = result.tageRest <= 7 ? 'var(--accent-orange)' : 'var(--accent-green)';
    icon.textContent = result.tageRest <= 7 ? '⚠️' : '✅';
    text.textContent = result.tageRest <= 7 ? `Trial: noch ${result.tageRest} Tage` : 'Lizenz aktiv';
    detail.textContent = result.tageRest <= 7
      ? `Trial läuft ab am ${result.ablaufDatum}`
      : `Gültig bis ${result.ablaufDatum} · ${result.tageRest} Tage verbleibend`;
  } else {
    statusBox.style.borderColor = 'var(--accent-red)';
    icon.textContent = '❌';
    text.textContent = 'Nicht lizenziert';
    detail.textContent = result.grund || 'Bitte Lizenzschlüssel eingeben';
  }
}

async function aktiviereLizenz() {
  const key = document.getElementById('set-license-key').value.trim();
  const msg = document.getElementById('set-license-msg');
  msg.style.display = 'block';
  if (!key) {
    msg.style.color = 'var(--accent-red)';
    msg.textContent = 'Bitte Lizenzschlüssel eingeben.';
    return;
  }
  const result = await api.activateLicense(key);
  if (result.valid) {
    msg.style.color = 'var(--accent-green)';
    msg.textContent = `✅ Aktiviert! Gültig bis ${result.ablaufDatum} (${result.tageRest} Tage)`;
    document.getElementById('set-license-key').value = '';
    ladeLizenzStatus();
    checkLicenseOnStartup();
  } else {
    msg.style.color = 'var(--accent-red)';
    msg.textContent = `❌ ${result.grund}`;
  }
}

async function deaktiviereLizenz() {
  if (!confirm('Lizenz wirklich deaktivieren? Die Software wird danach im Trial-Modus weitergearbeitet.')) return;
  try {
    const fs = require('fs');
    const path = require('path');
    const dataPath = path.join(require('electron').remote?.app?.getPath('userData') || '.', 'data');
    const licFile = path.join(dataPath, 'license.json');
    if (fs.existsSync(licFile)) {
      fs.unlinkSync(licFile);
    }
    document.getElementById('set-license-msg').style.display = 'block';
    document.getElementById('set-license-msg').style.color = 'var(--accent-orange)';
    document.getElementById('set-license-msg').textContent = 'Lizenz deaktiviert. Bitte App neu starten.';
    ladeLizenzStatus();
  } catch (err) {
    document.getElementById('set-license-msg').style.display = 'block';
    document.getElementById('set-license-msg').style.color = 'var(--accent-red)';
    document.getElementById('set-license-msg').textContent = `Fehler: ${err.message}`;
  }
}

// ============ Updates in Einstellungen ============

async function pruefeUpdates() {
  const msg = document.getElementById('set-update-msg');
  const text = document.getElementById('set-update-text');
  const detail = document.getElementById('set-update-detail');
  const icon = document.getElementById('set-update-icon');

  msg.style.display = 'block';
  msg.style.color = 'var(--text-secondary)';
  msg.textContent = '🔍 Suche läuft...';

  try {
    const response = await fetch('https://api.github.com/repos/intrasaar/handwerker-software/releases/latest', {
      headers: { 'Accept': 'application/vnd.github.v3+json' },
    });

    if (!response.ok) throw new Error('Keine Verbindung zum Server');

    const release = await response.json();
    const remoteVersion = release.tag_name?.replace('v', '') || '';
    const localVersion = (await api.getAppInfo()).version;

    detail.textContent = `Letzte Prüfung: ${new Date().toLocaleString('de-DE')}`;

    // Version vergleichen: nur als Update melden wenn remote NEUER ist
    const remoteParts = remoteVersion.split('.').map(Number);
    const localParts = localVersion.split('.').map(Number);
    let remoteNeuer = false;
    for (let i = 0; i < 3; i++) {
      const r = remoteParts[i] || 0;
      const l = localParts[i] || 0;
      if (r > l) { remoteNeuer = true; break; }
      if (r < l) break;
    }

    if (remoteNeuer) {
      msg.style.color = 'var(--accent-green)';
      msg.textContent = `📥 Update verfügbar: v${remoteVersion}`;
      icon.textContent = '📥';

      const downloadUrl = release.assets?.[0]?.browser_download_url;
      if (downloadUrl) {
        msg.innerHTML += `<br><a href="${downloadUrl}" style="color:var(--accent-blue); font-weight:bold;" onclick="event.preventDefault(); require('electron').shell.openExternal('${downloadUrl}')">Herunterladen</a>`;
      }
    } else {
      msg.style.color = 'var(--accent-green)';
      msg.textContent = `✅ Aktuelle Version (v${localVersion})`;
      icon.textContent = '✅';
    }
  } catch (err) {
    msg.style.color = 'var(--accent-orange)';
    msg.textContent = `⚠️ Update-Check fehlgeschlagen: ${err.message}`;
    icon.textContent = '⚠️';
    detail.textContent = `Letzte Prüfung: ${new Date().toLocaleString('de-DE')}`;
  }
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

// ============ Copyright ============
document.getElementById('copyright-year').textContent = new Date().getFullYear();

// ============ Lizenz-System ============
async function checkLicenseOnStartup() {
  const result = await api.checkLicense();
  const statusEl = document.getElementById('license-status');
  const modal = document.getElementById('activation-modal');

  if (result.valid) {
    if (result.tageRest <= 7) {
      statusEl.className = 'license-status trial';
      statusEl.textContent = `Trial: noch ${result.tageRest} Tage`;
    } else {
      statusEl.className = 'license-status active';
      statusEl.textContent = `Aktiviert bis ${result.ablaufDatum}`;
    }
    modal.style.display = 'none';
    document.body.classList.remove('locked');
  } else {
    statusEl.className = 'license-status inactive';
    statusEl.textContent = result.grund || 'Nicht aktiviert';
    modal.style.display = 'flex';
    document.body.classList.add('locked');
    const fp = await api.getFingerprint();
    document.getElementById('fingerprint-display').textContent = fp;
  }
}

// Aktivierungs-Button
document.getElementById('btn-activate').addEventListener('click', async () => {
  const key = document.getElementById('license-key-input').value.trim();
  const errorEl = document.getElementById('license-error');
  const successEl = document.getElementById('license-success');

  errorEl.style.display = 'none';
  successEl.style.display = 'none';

  if (!key) {
    errorEl.textContent = 'Bitte geben Sie einen Lizenzschlüssel ein.';
    errorEl.style.display = 'block';
    return;
  }

  const result = await api.activateLicense(key);
  if (result.valid) {
    successEl.textContent = `Aktiviert! Gültig bis ${result.ablaufDatum} (${result.tageRest} Tage)`;
    successEl.style.display = 'block';
    setTimeout(() => {
      document.getElementById('activation-modal').style.display = 'none';
      document.body.classList.remove('locked');
      checkLicenseOnStartup();
    }, 1500);
  } else {
    errorEl.textContent = result.grund;
    errorEl.style.display = 'block';
  }
});

// Enter-Taste im Lizenzfeld
document.getElementById('license-key-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('btn-activate').click();
});

// ============ Menu-Navigation ============
if (api.onNavigate) {
  api.onNavigate((page) => navigateTo(page));
}
if (api.onShowLicense) {
  api.onShowLicense(() => {
    document.getElementById('activation-modal').style.display = 'flex';
    api.getFingerprint().then(fp => {
      document.getElementById('fingerprint-display').textContent = fp;
    });
  });
}
if (api.onToggleSidebar) {
  api.onToggleSidebar(() => {
    const sidebar = document.querySelector('.sidebar');
    sidebar.style.display = sidebar.style.display === 'none' ? 'flex' : 'none';
  });
}

// ============ Eingangsrechnungen ============
async function loadEingangsrechnungen() {
  const data = await api.getEingangsrechnungen();
  document.getElementById('eingangsrechnungen-tbody').innerHTML = data.map(e => `
    <tr>
      <td><strong>${escHtml(e.nummer)}</strong></td>
      <td>${escHtml(e.lieferant_name || '-')}</td>
      <td>${escHtml(e.titel || '-')}</td>
      <td>${formatEuro(e.betrag_brutto)}</td>
      <td><span class="status-badge status-${e.status}">${e.status}</span></td>
      <td>${e.faellig_am || '-'}</td>
      <td>
        <div class="btn-group">
          <button class="btn btn-secondary btn-small" onclick="editEingangsrechnung(${e.id})">✏️</button>
          ${e.status !== 'bezahlt' ? `<button class="btn btn-success btn-small" onclick="eingangsrechnungBezahlt(${e.id})">✅</button>` : ''}
          <button class="btn btn-danger btn-small" onclick="deleteEingangsrechnung(${e.id})">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function showEingangsrechnungForm(ein = null) {
  const title = ein ? 'Eingangsrechnung bearbeiten' : 'Neue Eingangsrechnung';
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = `
    <div class="form-row">
      <div class="form-group"><label>Nr. *</label><input type="text" id="er-nummer" value="${escHtml(ein?.nummer || '')}"></div>
      <div class="form-group"><label>Lieferant *</label><select id="er-lieferant"></select></div>
    </div>
    <div class="form-group"><label>Titel</label><input type="text" id="er-titel" value="${escHtml(ein?.titel || '')}"></div>
    <div class="form-row">
      <div class="form-group"><label>Netto</label><input type="number" step="0.01" id="er-netto" value="${ein?.betrag_netto || 0}"></div>
      <div class="form-group"><label>MwSt %</label><input type="number" step="0.01" id="er-mwst" value="${ein?.mwst_satz || 19}"></div>
      <div class="form-group"><label>Brutto</label><input type="number" step="0.01" id="er-brutto" value="${ein?.betrag_brutto || 0}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Status</label><select id="er-status"><option value="offen"${ein?.status==='offen'?' selected':''}>Offen</option><option value="bezahlt"${ein?.status==='bezahlt'?' selected':''}>Bezahlt</option></select></div>
      <div class="form-group"><label>Fällig am</label><input type="date" id="er-faellig" value="${ein?.faellig_am || ''}"></div>
    </div>`;
  document.getElementById('modal-footer').innerHTML = `
    <button class="btn btn-secondary" onclick="closeModal()">Abbrechen</button>
    <button class="btn btn-primary" onclick="saveEingangsrechnung(${ein?.id || 'null'})">Speichern</button>`;
  openModal();
  api.getLieferanten().then(lf => {
    const sel = document.getElementById('er-lieferant');
    sel.innerHTML = lf.map(l => `<option value="${l.id}"${ein?.lieferanten_id===l.id?' selected':''}>${escHtml(l.name)}</option>`).join('');
  });
}

async function saveEingangsrechnung(id) {
  const data = {
    id, nummer: document.getElementById('er-nummer').value,
    lieferanten_id: parseInt(document.getElementById('er-lieferant').value),
    titel: document.getElementById('er-titel').value,
    betrag_netto: parseFloat(document.getElementById('er-netto').value) || 0,
    mwst_satz: parseFloat(document.getElementById('er-mwst').value) || 19,
    mwst_betrag: 0, betrag_brutto: parseFloat(document.getElementById('er-brutto').value) || 0,
    status: document.getElementById('er-status').value,
    faellig_am: document.getElementById('er-faellig').value || null
  };
  data.mwst_betrag = data.betrag_brutto - data.betrag_netto;
  await api.saveEingangsrechnung(data);
  closeModal(); loadEingangsrechnungen();
}

function editEingangsrechnung(id) { api.getEingangsrechnung(id).then(e => showEingangsrechnungForm(e)); }
async function deleteEingangsrechnung(id) { if (confirm('Löschen?')) { await api.deleteEingangsrechnung(id); loadEingangsrechnungen(); } }
async function eingangsrechnungBezahlt(id) { await api.eingangsrechnungZuBuchung(id); loadEingangsrechnungen(); }

// ============ Lieferanten ============
async function loadLieferanten() {
  const data = await api.getLieferanten();
  document.getElementById('lieferanten-tbody').innerHTML = data.map(l => `
    <tr>
      <td><strong>${escHtml(l.name)}</strong></td>
      <td>${escHtml(l.ansprechpartner || '-')}</td>
      <td>${escHtml(l.strasse || '')} ${escHtml(l.plz || '')} ${escHtml(l.ort || '')}</td>
      <td>${escHtml(l.telefon || '-')}</td>
      <td>${escHtml(l.email || '-')}</td>
      <td>
        <div class="btn-group">
          <button class="btn btn-secondary btn-small" onclick="editLieferant(${l.id})">✏️</button>
          <button class="btn btn-danger btn-small" onclick="deleteLieferant(${l.id})">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function showLieferantForm(l = null) {
  document.getElementById('modal-title').textContent = l ? 'Lieferant bearbeiten' : 'Neuer Lieferant';
  document.getElementById('modal-body').innerHTML = `
    <div class="form-group"><label>Name *</label><input type="text" id="lf-name" value="${escHtml(l?.name || '')}"></div>
    <div class="form-group"><label>Ansprechpartner</label><input type="text" id="lf-ansprechpartner" value="${escHtml(l?.ansprechpartner || '')}"></div>
    <div class="form-group"><label>Straße & Nr.</label><input type="text" id="lf-strasse" value="${escHtml(l?.strasse || '')}"></div>
    <div class="form-row">
      <div class="form-group"><label>PLZ</label><input type="text" id="lf-plz" value="${escHtml(l?.plz || '')}"></div>
      <div class="form-group"><label>Ort</label><input type="text" id="lf-ort" value="${escHtml(l?.ort || '')}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Telefon</label><input type="text" id="lf-telefon" value="${escHtml(l?.telefon || '')}"></div>
      <div class="form-group"><label>E-Mail</label><input type="text" id="lf-email" value="${escHtml(l?.email || '')}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>IBAN</label><input type="text" id="lf-iban" value="${escHtml(l?.iban || '')}"></div>
      <div class="form-group"><label>USt-IdNr.</label><input type="text" id="lf-ust" value="${escHtml(l?.ust_id || '')}"></div>
    </div>`;
  document.getElementById('modal-footer').innerHTML = `
    <button class="btn btn-secondary" onclick="closeModal()">Abbrechen</button>
    <button class="btn btn-primary" onclick="saveLieferant(${l?.id || 'null'})">Speichern</button>`;
  openModal();
}

async function saveLieferant(id) {
  await api.saveLieferant({ id, name: document.getElementById('lf-name').value, ansprechpartner: document.getElementById('lf-ansprechpartner').value, strasse: document.getElementById('lf-strasse').value, plz: document.getElementById('lf-plz').value, ort: document.getElementById('lf-ort').value, telefon: document.getElementById('lf-telefon').value, email: document.getElementById('lf-email').value, iban: document.getElementById('lf-iban').value, ust_id: document.getElementById('lf-ust').value, notizen: '' });
  closeModal(); loadLieferanten();
}

function editLieferant(id) { api.getLieferant(id).then(l => showLieferantForm(l)); }
async function deleteLieferant(id) { if (confirm('Löschen?')) { await api.deleteLieferant(id); loadLieferanten(); } }

// ============ Mahnwesen ============
async function loadMahnungen() {
  const data = await api.getMahnungen();
  document.getElementById('mahnungen-tbody').innerHTML = data.map(m => `
    <tr>
      <td>${escHtml(m.rechnung_nummer || '-')}</td>
      <td>${escHtml(m.kunden_name || '-')}</td>
      <td><strong>Stufe ${m.mahnstufe}</strong></td>
      <td>${formatEuro(m.betrag)}</td>
      <td>${formatEuro(m.gebuehr)}</td>
      <td>${m.faellig_bis || '-'}</td>
      <td><span class="status-badge status-${m.status}">${m.status}</span></td>
      <td>
        ${m.status !== 'bezahlt' ? `<button class="btn btn-success btn-small" onclick="mahnungBezahlt(${m.id})">✅ Bezahlt</button>` : ''}
      </td>
    </tr>
  `).join('');
}

async function mahnungBezahlt(id) { await api.mahnungBezahlen(id); loadMahnungen(); }

// ============ Aufmaß ============
async function loadAufmasse() {
  const data = await api.getAufmasse();
  document.getElementById('aufmasse-tbody').innerHTML = data.map(a => `
    <tr>
      <td><strong>${escHtml(a.titel)}</strong></td>
      <td>${escHtml(a.kunden_name || '-')}</td>
      <td>${escHtml(a.auftrag_titel || '-')}</td>
      <td>${a.datum}</td>
      <td>
        <div class="btn-group">
          <button class="btn btn-secondary btn-small" onclick="editAufmass(${a.id})">✏️</button>
          <button class="btn btn-danger btn-small" onclick="deleteAufmass(${a.id})">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function showAufmassForm(af = null) {
  document.getElementById('modal-title').textContent = af ? 'Aufmaß bearbeiten' : 'Neues Aufmaß';
  document.getElementById('modal-body').innerHTML = `
    <div class="form-group"><label>Titel *</label><input type="text" id="am-titel" value="${escHtml(af?.titel || '')}"></div>
    <div class="form-row">
      <div class="form-group"><label>Kunde</label><select id="am-kunde"></select></div>
      <div class="form-group"><label>Auftrag</label><select id="am-auftrag"></select></div>
    </div>
    <div class="form-group"><label>Datum</label><input type="date" id="am-datum" value="${af?.datum || new Date().toISOString().split('T')[0]}"></div>
    <div class="form-group"><label>Notizen</label><textarea id="am-notizen" rows="3">${escHtml(af?.notizen || '')}</textarea></div>
    <h4 style="margin-top:16px;">Positionen</h4>
    <div id="am-positionen"></div>
    <button class="btn btn-secondary btn-small" onclick="addAufmassPosition()" style="margin-top:8px;">+ Position</button>`;
  document.getElementById('modal-footer').innerHTML = `
    <button class="btn btn-secondary" onclick="closeModal()">Abbrechen</button>
    <button class="btn btn-primary" onclick="saveAufmass(${af?.id || 'null'})">Speichern</button>`;
  openModal();
  api.getKunden().then(kl => {
    document.getElementById('am-kunde').innerHTML = kl.map(k => `<option value="${k.id}"${af?.kunden_id===k.id?' selected':''}>${escHtml(k.name)}</option>`).join('');
  });
  api.getAuftraege().then(al => {
    document.getElementById('am-auftrag').innerHTML = `<option value="">Kein Auftrag</option>` + al.map(a => `<option value="${a.id}"${af?.auftraege_id===a.id?' selected':''}>${escHtml(a.titel)}</option>`).join('');
  });
  window._amPositions = af?.positionen || [];
  renderAufmassPositionen();
}

function renderAufmassPositionen() {
  const container = document.getElementById('am-positionen');
  if (!container) return;
  container.innerHTML = (window._amPositions || []).map((p, i) => `
    <div class="form-row" style="align-items:end; margin-bottom:8px;">
      <div class="form-group" style="flex:2;"><input type="text" placeholder="Beschreibung" value="${escHtml(p.beschreibung || '')}" onchange="window._amPositions[${i}].beschreibung=this.value"></div>
      <div class="form-group" style="flex:0.5;"><input type="number" placeholder="Menge" value="${p.menge || 1}" onchange="window._amPositions[${i}].menge=+this.value"></div>
      <div class="form-group" style="flex:0.5;"><input type="text" placeholder="Einheit" value="${escHtml(p.einheit || 'm')}" onchange="window._amPositions[${i}].einheit=this.value"></div>
      <div class="form-group" style="flex:0.5;"><input type="number" step="0.01" placeholder="Breite" value="${p.breite || 0}" onchange="window._amPositions[${i}].breite=+this.value"></div>
      <div class="form-group" style="flex:0.5;"><input type="number" step="0.01" placeholder="Höhe" value="${p.hoehe || 0}" onchange="window._amPositions[${i}].hoehe=+this.value"></div>
      <div class="form-group" style="flex:0.5;"><input type="number" step="0.01" placeholder="Preis" value="${p.einzelpreis || 0}" onchange="window._amPositions[${i}].einzelpreis=+this.value"></div>
      <button class="btn btn-danger btn-small" onclick="window._amPositions.splice(${i},1);renderAufmassPositionen()">×</button>
    </div>
  `).join('');
}

function addAufmassPosition() {
  window._amPositions = window._amPositions || [];
  window._amPositions.push({ beschreibung: '', menge: 1, einheit: 'm', breite: 0, hoehe: 0, flaeche: 0, einzelpreis: 0, gesamt: 0 });
  renderAufmassPositionen();
}

async function saveAufmass(id) {
  const positionen = (window._amPositions || []).map((p, i) => ({ ...p, position: i + 1, flaeche: p.breite * p.hoehe * p.menge, gesamt: p.einzelpreis * p.menge * (p.breite * p.hoehe || 1) }));
  await api.saveAufmass({ aufmass: { id, titel: document.getElementById('am-titel').value, kunden_id: parseInt(document.getElementById('am-kunde').value) || null, auftraege_id: parseInt(document.getElementById('am-auftrag').value) || null, datum: document.getElementById('am-datum').value, notizen: document.getElementById('am-notizen').value }, positionen });
  closeModal(); loadAufmasse();
}

function editAufmass(id) { api.getAufmassEinzel(id).then(a => showAufmassForm(a)); }
async function deleteAufmass(id) { if (confirm('Löschen?')) { await api.deleteAufmass(id); loadAufmasse(); } }

// ============ Artikel / Lager ============
async function loadArtikel() {
  const data = await api.getArtikel();
  document.getElementById('artikel-tbody').innerHTML = data.map(a => `
    <tr>
      <td><strong>${escHtml(a.name)}</strong></td>
      <td>${escHtml(a.sku || '-')}</td>
      <td>${a.bestand} ${escHtml(a.einheit)}</td>
      <td>${a.mindestbestand}</td>
      <td>${formatEuro(a.einkaufspreis)}</td>
      <td>${formatEuro(a.verkaufspreis)}</td>
      <td>${escHtml(a.lagerplatz || '-')}</td>
      <td>
        <div class="btn-group">
          <button class="btn btn-secondary btn-small" onclick="showLagerbewegungForm(${a.id})">📦</button>
          <button class="btn btn-secondary btn-small" onclick="editArtikel(${a.id})">✏️</button>
          <button class="btn btn-danger btn-small" onclick="deleteArtikel(${a.id})">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');
  const warns = await api.mindestbestandWarnung();
  const warnEl = document.getElementById('mindestbestand-warnung');
  if (warns.length > 0) {
    warnEl.style.display = 'block';
    warnEl.innerHTML = `<strong>⚠️ Mindestbestand erreicht:</strong> ${warns.map(w => `${w.name} (${w.bestand} ${w.einheit})`).join(', ')}`;
  } else {
    warnEl.style.display = 'none';
  }
}

function showArtikelForm(a = null) {
  document.getElementById('modal-title').textContent = a ? 'Artikel bearbeiten' : 'Neuer Artikel';
  document.getElementById('modal-body').innerHTML = `
    <div class="form-row">
      <div class="form-group" style="flex:2;"><label>Name *</label><input type="text" id="at-name" value="${escHtml(a?.name || '')}"></div>
      <div class="form-group"><label>SKU</label><input type="text" id="at-sku" value="${escHtml(a?.sku || '')}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Einheit</label><select id="at-einheit"><option value="Stk"${a?.einheit==='Stk'?' selected':''}>Stk</option><option value="m"${a?.einheit==='m'?' selected':''}>m</option><option value="m²"${a?.einheit==='m²'?' selected':''}>m²</option><option value="kg"${a?.einheit==='kg'?' selected':''}>kg</option><option value="l"${a?.einheit==='l'?' selected':''}>l</option><option value="Paar"${a?.einheit==='Paar'?' selected':''}>Paar</option></select></div>
      <div class="form-group"><label>Barcode</label><input type="text" id="at-barcode" value="${escHtml(a?.barcode || '')}"></div>
      <div class="form-group"><label>Kategorie</label><input type="text" id="at-kategorie" value="${escHtml(a?.kategorie || '')}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Einkaufspreis</label><input type="number" step="0.01" id="at-ek" value="${a?.einkaufspreis || 0}"></div>
      <div class="form-group"><label>Verkaufspreis</label><input type="number" step="0.01" id="at-vk" value="${a?.verkaufspreis || 0}"></div>
      <div class="form-group"><label>MwSt %</label><input type="number" step="0.01" id="at-mwst" value="${a?.mwst_satz || 19}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Bestand</label><input type="number" id="at-bestand" value="${a?.bestand || 0}"></div>
      <div class="form-group"><label>Mindestbestand</label><input type="number" id="at-min" value="${a?.mindestbestand || 0}"></div>
      <div class="form-group"><label>Lagerplatz</label><input type="text" id="at-lager" value="${escHtml(a?.lagerplatz || '')}"></div>
    </div>`;
  document.getElementById('modal-footer').innerHTML = `
    <button class="btn btn-secondary" onclick="closeModal()">Abbrechen</button>
    <button class="btn btn-primary" onclick="saveArtikel(${a?.id || 'null'})">Speichern</button>`;
  openModal();
}

async function saveArtikel(id) {
  await api.saveArtikel({ id, name: document.getElementById('at-name').value, sku: document.getElementById('at-sku').value, einheit: document.getElementById('at-einheit').value, einkaufspreis: parseFloat(document.getElementById('at-ek').value) || 0, verkaufspreis: parseFloat(document.getElementById('at-vk').value) || 0, mwst_satz: parseFloat(document.getElementById('at-mwst').value) || 19, bestand: parseInt(document.getElementById('at-bestand').value) || 0, mindestbestand: parseInt(document.getElementById('at-min').value) || 0, lagerplatz: document.getElementById('at-lager').value, barcode: document.getElementById('at-barcode').value, kategorie: document.getElementById('at-kategorie').value, notizen: '' });
  closeModal(); loadArtikel();
}

function editArtikel(id) { api.getArtikelEinzel(id).then(a => showArtikelForm(a)); }
async function deleteArtikel(id) { if (confirm('Löschen?')) { await api.deleteArtikel(id); loadArtikel(); } }

function showLagerbewegungForm(artikelId) {
  document.getElementById('modal-title').textContent = 'Lagerbewegung';
  document.getElementById('modal-body').innerHTML = `
    <div class="form-row">
      <div class="form-group"><label>Typ</label><select id="lb-typ"><option value="eingang">Wareneingang</option><option value="ausgang">Warenausgang</option><option value="korrektur">Korrektur</option></select></div>
      <div class="form-group"><label>Menge</label><input type="number" id="lb-menge" value="1"></div>
    </div>
    <div class="form-group"><label>Grund</label><input type="text" id="lb-grund" placeholder="z.B. Lieferung, Reparatur..."></div>
    <div class="form-group"><label>Mitarbeiter</label><input type="text" id="lb-mitarbeiter"></div>`;
  document.getElementById('modal-footer').innerHTML = `
    <button class="btn btn-secondary" onclick="closeModal()">Abbrechen</button>
    <button class="btn btn-primary" onclick="saveLagerbewegung(${artikelId})">Speichern</button>`;
  openModal();
}

async function saveLagerbewegung(artikelId) {
  const now = new Date();
  await api.lagerbewegung({ artikel_id: artikelId, typ: document.getElementById('lb-typ').value, menge: parseInt(document.getElementById('lb-menge').value) || 0, datum: now.toISOString().split('T')[0], uhrzeit: now.toTimeString().split(' ')[0], grund: document.getElementById('lb-grund').value, mitarbeiter: document.getElementById('lb-mitarbeiter').value });
  closeModal(); loadArtikel();
}

// ============ Kassenbuch ============
async function loadKasse() {
  const data = await api.getKasse({});
  const stand = await api.kasseStand();
  document.getElementById('kasse-einnahmen').textContent = formatEuro(stand.einnahmen);
  document.getElementById('kasse-ausgaben').textContent = formatEuro(stand.ausgaben);
  document.getElementById('kasse-stand').textContent = formatEuro(stand.kassenstand);
  document.getElementById('kasse-tbody').innerHTML = data.map(k => `
    <tr>
      <td>${k.datum}</td>
      <td>${k.uhrzeit || '-'}</td>
      <td><span class="status-badge status-${k.typ === 'einnahme' ? 'bezahlt' : 'offen'}">${k.typ}</span></td>
      <td>${escHtml(k.kategorie || '-')}</td>
      <td>${escHtml(k.beschreibung || '-')}</td>
      <td>${formatEuro(k.betrag)}</td>
      <td>${escHtml(k.mitarbeiter || '-')}</td>
      <td>
        <div class="btn-group">
          <button class="btn btn-secondary btn-small" onclick="editKasse(${k.id})">✏️</button>
          <button class="btn btn-danger btn-small" onclick="deleteKasse(${k.id})">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function showKasseForm(e = null) {
  document.getElementById('modal-title').textContent = e ? 'Eintrag bearbeiten' : 'Neuer Kassen-Eintrag';
  document.getElementById('modal-body').innerHTML = `
    <div class="form-row">
      <div class="form-group"><label>Typ *</label><select id="ka-typ"><option value="einnahme"${e?.typ==='einnahme'?' selected':''}>Einnahme</option><option value="ausgabe"${e?.typ==='ausgabe'?' selected':''}>Ausgabe</option></select></div>
      <div class="form-group"><label>Betrag *</label><input type="number" step="0.01" id="ka-betrag" value="${e?.betrag || ''}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Datum *</label><input type="date" id="ka-datum" value="${e?.datum || new Date().toISOString().split('T')[0]}"></div>
      <div class="form-group"><label>Uhrzeit</label><input type="time" id="ka-uhrzeit" value="${e?.uhrzeit || new Date().toTimeString().split(' ')[0].substring(0,5)}"></div>
    </div>
    <div class="form-group"><label>Kategorie</label><input type="text" id="ka-kategorie" value="${escHtml(e?.kategorie || '')}"></div>
    <div class="form-group"><label>Beschreibung</label><input type="text" id="ka-beschreibung" value="${escHtml(e?.beschreibung || '')}"></div>
    <div class="form-group"><label>Mitarbeiter</label><input type="text" id="ka-mitarbeiter" value="${escHtml(e?.mitarbeiter || '')}"></div>`;
  document.getElementById('modal-footer').innerHTML = `
    <button class="btn btn-secondary" onclick="closeModal()">Abbrechen</button>
    <button class="btn btn-primary" onclick="saveKasse(${e?.id || 'null'})">Speichern</button>`;
  openModal();
}

async function saveKasse(id) {
  await api.saveKasse({ id, typ: document.getElementById('ka-typ').value, betrag: parseFloat(document.getElementById('ka-betrag').value) || 0, datum: document.getElementById('ka-datum').value, uhrzeit: document.getElementById('ka-uhrzeit').value, kategorie: document.getElementById('ka-kategorie').value, beschreibung: document.getElementById('ka-beschreibung').value, mitarbeiter: document.getElementById('ka-mitarbeiter').value });
  closeModal(); loadKasse();
}

function editKasse(id) { api.getKasse({}).then(data => { const e = data.find(x => x.id === id); if (e) showKasseForm(e); }); }
async function deleteKasse(id) { if (confirm('Löschen?')) { await api.deleteKasse(id); loadKasse(); } }

// ============ Subunternehmer ============
async function loadSubunternehmer() {
  const data = await api.getSubunternehmer();
  document.getElementById('subunternehmer-tbody').innerHTML = data.map(s => `
    <tr>
      <td><strong>${escHtml(s.name)}</strong></td>
      <td>${escHtml(s.ansprechpartner || '-')}</td>
      <td>${formatEuro(s.stundensatz)}/h</td>
      <td>${escHtml(s.telefon || '-')}</td>
      <td>${escHtml(s.email || '-')}</td>
      <td>
        <div class="btn-group">
          <button class="btn btn-secondary btn-small" onclick="editSubunternehmer(${s.id})">✏️</button>
          <button class="btn btn-danger btn-small" onclick="deleteSubunternehmer(${s.id})">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function showSubunternehmerForm(s = null) {
  document.getElementById('modal-title').textContent = s ? 'Subunternehmer bearbeiten' : 'Neuer Subunternehmer';
  document.getElementById('modal-body').innerHTML = `
    <div class="form-group"><label>Name *</label><input type="text" id="su-name" value="${escHtml(s?.name || '')}"></div>
    <div class="form-group"><label>Ansprechpartner</label><input type="text" id="su-ansprechpartner" value="${escHtml(s?.ansprechpartner || '')}"></div>
    <div class="form-group"><label>Straße & Nr.</label><input type="text" id="su-strasse" value="${escHtml(s?.strasse || '')}"></div>
    <div class="form-row">
      <div class="form-group"><label>PLZ</label><input type="text" id="su-plz" value="${escHtml(s?.plz || '')}"></div>
      <div class="form-group"><label>Ort</label><input type="text" id="su-ort" value="${escHtml(s?.ort || '')}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Telefon</label><input type="text" id="su-telefon" value="${escHtml(s?.telefon || '')}"></div>
      <div class="form-group"><label>E-Mail</label><input type="text" id="su-email" value="${escHtml(s?.email || '')}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>IBAN</label><input type="text" id="su-iban" value="${escHtml(s?.iban || '')}"></div>
      <div class="form-group"><label>USt-IdNr.</label><input type="text" id="su-ust" value="${escHtml(s?.ust_id || '')}"></div>
    </div>
    <div class="form-group"><label>Stundensatz (€/h)</label><input type="number" step="0.01" id="su-satz" value="${s?.stundensatz || 0}"></div>`;
  document.getElementById('modal-footer').innerHTML = `
    <button class="btn btn-secondary" onclick="closeModal()">Abbrechen</button>
    <button class="btn btn-primary" onclick="saveSubunternehmer(${s?.id || 'null'})">Speichern</button>`;
  openModal();
}

async function saveSubunternehmer(id) {
  await api.saveSubunternehmer({ id, name: document.getElementById('su-name').value, ansprechpartner: document.getElementById('su-ansprechpartner').value, strasse: document.getElementById('su-strasse').value, plz: document.getElementById('su-plz').value, ort: document.getElementById('su-ort').value, telefon: document.getElementById('su-telefon').value, email: document.getElementById('su-email').value, iban: document.getElementById('su-iban').value, ust_id: document.getElementById('su-ust').value, stundensatz: parseFloat(document.getElementById('su-satz').value) || 0, notizen: '' });
  closeModal(); loadSubunternehmer();
}

function editSubunternehmer(id) { api.getSubunternehmerEinzel(id).then(s => showSubunternehmerForm(s)); }
async function deleteSubunternehmer(id) { if (confirm('Löschen?')) { await api.deleteSubunternehmer(id); loadSubunternehmer(); } }

// ============ DATEV-Export ============
function loadDatev() {
  const now = new Date();
  document.getElementById('datev-monat').value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

async function exportDatev() {
  const monat = document.getElementById('datev-monat').value;
  if (!monat) { alert('Bitte Monat wählen'); return; }
  await api.exportDatev(monat);
}

async function exportUstXml() {
  const monat = document.getElementById('datev-monat').value;
  if (!monat) { alert('Bitte Monat wählen'); return; }
  await api.exportUstVoranmeldung(monat);
}

// ============ Automatisierung / Regeln ============
async function loadRegeln() {
  const data = await api.getRegeln();
  document.getElementById('regeln-tbody').innerHTML = data.map(r => `
    <tr>
      <td><strong>${escHtml(r.name)}</strong></td>
      <td>${escHtml(r.typ)}</td>
      <td>${escHtml(r.bedingung)}</td>
      <td>${escHtml(r.aktion)}</td>
      <td>${r.aktiv ? '✅' : '❌'}</td>
      <td>
        <div class="btn-group">
          <button class="btn btn-secondary btn-small" onclick="editRegel(${r.id})">✏️</button>
          <button class="btn btn-danger btn-small" onclick="deleteRegel(${r.id})">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function showRegelForm(r = null) {
  document.getElementById('modal-title').textContent = r ? 'Regel bearbeiten' : 'Neue Regel';
  document.getElementById('modal-body').innerHTML = `
    <div class="form-group"><label>Name *</label><input type="text" id="rg-name" value="${escHtml(r?.name || '')}"></div>
    <div class="form-group"><label>Typ</label><select id="rg-typ"><option value="rechnung-erstellt"${r?.typ==='rechnung-erstellt'?' selected':''}>Rechnung erstellt</option><option value="rechnung-offen"${r?.typ==='rechnung-offen'?' selected':''}>Rechnung offen > 30 Tage</option><option value="mindestbestand"${r?.typ==='mindestbestand'?' selected':''}>Mindestbestand erreicht</option><option value="auftrag-erstellt"${r?.typ==='auftrag-erstellt'?' selected':''}>Auftrag erstellt</option></select></div>
    <div class="form-group"><label>Bedingung</label><input type="text" id="rg-bedingung" value="${escHtml(r?.bedingung || '')}" placeholder="z.B. betrag > 1000"></div>
    <div class="form-group"><label>Aktion</label><input type="text" id="rg-aktion" value="${escHtml(r?.aktion || '')}" placeholder="z.B. mahnung-erstellen"></div>
    <div class="form-group"><label><input type="checkbox" id="rg-aktiv" ${r?.aktiv !== 0 ? 'checked' : ''}> Aktiv</label></div>`;
  document.getElementById('modal-footer').innerHTML = `
    <button class="btn btn-secondary" onclick="closeModal()">Abbrechen</button>
    <button class="btn btn-primary" onclick="saveRegel(${r?.id || 'null'})">Speichern</button>`;
  openModal();
}

async function saveRegel(id) {
  await api.saveRegel({ id, name: document.getElementById('rg-name').value, typ: document.getElementById('rg-typ').value, bedingung: document.getElementById('rg-bedingung').value, aktion: document.getElementById('rg-aktion').value, aktiv: document.getElementById('rg-aktiv').checked ? 1 : 0 });
  closeModal(); loadRegeln();
}

function editRegel(id) { api.getRegeln().then(data => { const r = data.find(x => x.id === id); if (r) showRegelForm(r); }); }
async function deleteRegel(id) { if (confirm('Löschen?')) { await api.deleteRegel(id); loadRegeln(); } }

// ============ Server-Einstellungen ============
async function saveServerEinstellungen() {
  const modus = document.getElementById('set-modus').value;
  const serverUrl = document.getElementById('set-server-url').value;
  const serverKey = document.getElementById('set-server-key').value;
  const clientId = document.getElementById('set-client-id').value;
  localStorage.setItem('hw-modus', modus);
  localStorage.setItem('hw-server-url', serverUrl);
  localStorage.setItem('hw-server-key', serverKey);
  localStorage.setItem('hw-client-id', clientId);
  showServerStatus('Einstellungen gespeichert.', 'success');
}

function loadServerEinstellungen() {
  document.getElementById('set-modus').value = localStorage.getItem('hw-modus') || 'lokal';
  document.getElementById('set-server-url').value = localStorage.getItem('hw-server-url') || '';
  document.getElementById('set-server-key').value = localStorage.getItem('hw-server-key') || '';
  document.getElementById('set-client-id').value = localStorage.getItem('hw-client-id') || '';
}

async function testServerVerbindung() {
  const url = document.getElementById('set-server-url').value;
  const key = document.getElementById('set-server-key').value;
  if (!url) { showServerStatus('Bitte Server-URL eingeben.', 'error'); return; }
  showServerStatus('Verbindung wird getestet...', 'pending');
  try {
    const response = await fetch(`${url}/api/health`, { headers: { 'X-API-Key': key } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    showServerStatus(`Verbunden! Server: v${data.version}, Uptime: ${Math.round(data.uptime)}s, Clients: ${data.clients}`, 'success');
  } catch (err) {
    showServerStatus(`Verbindung fehlgeschlagen: ${err.message}`, 'error');
  }
}

function showServerStatus(msg, type) {
  const el = document.getElementById('server-status');
  el.style.display = 'block';
  el.style.background = type === 'success' ? '#d1fae5' : type === 'error' ? '#fee2e2' : '#e0e7ff';
  el.style.color = type === 'success' ? '#065f46' : type === 'error' ? '#991b1b' : '#3730a3';
  el.textContent = msg;
}

// Patch loadEinstellungen um auch Server-Werte zu laden
const _origLoadEinstellungen = typeof loadEinstellungen === 'function' ? loadEinstellungen : null;

// ============ Branchen-Schnittstellen ============
let gaebDaten = null;

function switchBranchenTab(tab) {
  document.querySelectorAll('.branchen-tab').forEach(t => t.style.display = 'none');
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`branchen-${tab}`).style.display = 'block';
  document.getElementById(`tab-${tab}`).classList.add('active');
  if (tab === 'ids') loadIDSConnect();
}

// DATANORM
async function importDatanorm() {
  const result = await api.importDatanorm();
  if (!result) return;
  const el = document.getElementById('datanorm-ergebnis');
  el.style.display = 'block';
  el.style.background = '#d1fae5';
  el.style.color = '#065f46';
  el.textContent = `Import abgeschlossen: ${result.importiert} neue, ${result.aktualisiert} aktualisierte Artikel (gesamt: ${result.gesamt}, Lieferant: ${result.lieferant || 'Unbekannt'})`;
}

async function exportDatanorm() {
  await api.exportDatanorm();
}

// GAEB
async function importGaeb85() {
  const result = await api.importGaeb85();
  if (!result) return;
  gaebDaten = result;
  showGaebVorschau(result);
}

async function importGaeb90() {
  const result = await api.importGaeb90();
  if (!result) return;
  gaebDaten = result;
  showGaebVorschau(result);
}

function showGaebVorschau(daten) {
  const el = document.getElementById('gaeb-ergebnis');
  el.style.display = 'block';
  el.style.background = '#dbeafe';
  el.style.color = '#1e40af';
  el.textContent = `Importiert: ${daten.leistungen.length} Positionen — ${daten.kopf.titel || daten.kopf.projekt || 'Kein Titel'}`;

  const tbody = document.getElementById('gaeb-vorschau-tbody');
  tbody.innerHTML = daten.leistungen.map(l => `
    <tr>
      <td>${l.position}</td>
      <td>${escHtml(l.text)}</td>
      <td>${l.menge}</td>
      <td>${escHtml(l.einheit)}</td>
      <td>${l.preis !== null ? formatEuro(l.preis) : '-'}</td>
      <td>${l.gesamt ? formatEuro(l.gesamt) : '-'}</td>
    </tr>
  `).join('');
  document.getElementById('gaeb-vorschau').style.display = 'block';
}

async function gaebZuAngebot() {
  if (!gaebDaten) return;
  const angebot = await api.gaebZuAngebot(gaebDaten);
  alert(`Angebot erstellt: ${angebot.titel}\nNetto: ${formatEuro(angebot.betrag_netto)}\nBrutto: ${formatEuro(angebot.betrag_brutto)}\n\nWird in Angebote gespeichert.`);
}

async function exportGaeb85() {
  const kopf = { vergabenummer: '', titel: 'Leistungsverzeichnis', ersteller: '' };
  const leistungen = [];
  await api.exportGaeb85(kopf, leistungen);
}

// IDS-Connect
async function loadIDSConnect() {
  const kataloge = await api.lieferantenKataloge();
  const katContainer = document.getElementById('ids-kataloge');
  katContainer.innerHTML = kataloge.map(k => `
    <button class="btn btn-secondary btn-small" onclick="loadArtikelKatalog('${escHtml(k.name)}')">${escHtml(k.name)}</button>
  `).join('') || '<span style="color:var(--text-light);">Keine Kataloge vorhanden. Zuerst BMEcat importieren.</span>';

  const lieferanten = await api.getLieferanten();
  const sel = document.getElementById('ids-lieferant');
  sel.innerHTML = lieferanten.map(l => `<option value="${l.id}">${escHtml(l.name)}</option>`).join('');
}

async function loadArtikelKatalog(kategorie) {
  const artikel = await api.artikelNachKategorie(kategorie);
  const tbody = document.getElementById('ids-artikel-tbody');
  tbody.innerHTML = artikel.map(a => `
    <tr>
      <td>${escHtml(a.sku || '-')}</td>
      <td>${escHtml(a.name)}</td>
      <td><input type="checkbox" class="ids-bestellen" data-id="${a.id}" data-name="${escHtml(a.name)}" data-sku="${escHtml(a.sku || '')}" data-preis="${a.einkaufspreis || 0}" data-einheit="${escHtml(a.einheit || 'Stk')}"></td>
      <td><input type="number" class="ids-menge" data-id="${a.id}" value="1" min="1" style="width:60px;"></td>
      <td>${formatEuro(a.einkaufspreis || 0)}</td>
    </tr>
  `).join('');
}

async function importBMEcat() {
  const result = await api.importBMEcat();
  if (!result) return;
  const el = document.getElementById('ids-ergebnis');
  el.style.display = 'block';
  el.style.background = '#d1fae5';
  el.style.color = '#065f46';
  el.textContent = `Katalog importiert: ${result.importiert} neue, ${result.aktualisiert} aktualisierte Artikel (${result.lieferant || 'Unbekannt'})`;
  loadIDSConnect();
}

async function exportBMEcat() {
  await api.exportBMEcat();
}

async function bestellungErstellen() {
  const checks = document.querySelectorAll('.ids-bestellen:checked');
  if (checks.length === 0) { alert('Bitte mindestens einen Artikel auswählen.'); return; }

  const positionen = [];
  checks.forEach(c => {
    const menge = document.querySelector(`.ids-menge[data-id="${c.dataset.id}"]`);
    positionen.push({
      sku: c.dataset.sku,
      name: c.dataset.name,
      menge: parseInt(menge ? menge.value : 1),
      preis: parseFloat(c.dataset.preis),
      einheit: c.dataset.einheit
    });
  });

  const lieferantId = document.getElementById('ids-lieferant').value;
  const lieferant = await api.getLieferant(parseInt(lieferantId));
  const bestellung = await api.bestellungErstellen({
    kunde: 'Eigener Betrieb',
    lieferant: lieferant ? lieferant.name : 'Unbekannt',
    positionen
  });

  alert(`Bestellung erstellt: ${bestellung.bestell_nr}\nNetto: ${formatEuro(bestellung.netto)}\nDatei wird zum Speichern angeboten.`);
}

// ============ Aufgabenverwaltung ============

async function ladeAufgaben() {
  const status = document.getElementById('aufg-filter-status')?.value || '';
  const prio = document.getElementById('aufg-filter-prio')?.value || '';
  const aufgaben = await api.getAufgaben({ status, prioritaet: prio });
  const tbody = document.getElementById('aufgaben-tbody');
  if (!tbody) return;

  const prioColors = { dringend: '#dc3545', hoch: '#ff9900', normal: '#0066cc', niedrig: '#999' };
  const statusColors = { offen: '#ff9900', 'in-arbeit': '#0066cc', erledigt: '#28a745' };

  tbody.innerHTML = aufgaben.map(a => `
    <tr>
      <td><strong>${a.titel}</strong>${a.beschreibung ? '<br><small style="color:#888">' + a.beschreibung.substring(0, 60) + '</small>' : ''}</td>
      <td>${a.zustandig || '—'}</td>
      <td><span style="color:${prioColors[a.prioritaet] || '#999'}; font-weight:600; text-transform:uppercase; font-size:12px;">${a.prioritaet || 'normal'}</span></td>
      <td>${a.faelligkeit ? new Date(a.faelligkeit).toLocaleDateString('de-DE') : '—'}</td>
      <td><span style="background:${statusColors[a.status] || '#999'}; color:#fff; padding:2px 8px; border-radius:10px; font-size:11px;">${a.status}</span></td>
      <td>${a.quelle || 'manuell'}</td>
      <td>
        <button class="btn btn-sm btn-secondary" onclick="editiereAufgabe(${a.id})">✏️</button>
        <button class="btn btn-sm btn-secondary" onclick="loescheAufgabe(${a.id})" style="color:var(--danger);">✕</button>
      </td>
    </tr>
  `).join('') || '<tr><td colspan="7" style="text-align:center; color:#999; padding:24px;">Keine Aufgaben vorhanden</td></tr>';

  const stats = await api.getAufgabenStatistik();
  document.getElementById('aufg-offen').textContent = stats.offen;
  document.getElementById('aufg-inarbeit').textContent = stats.inArbeit;
  document.getElementById('aufg-erledigt').textContent = stats.erledigt;
  document.getElementById('aufg-ueberfaellig').textContent = stats.ueberfaellig;
}

async function showAufgabenForm(aufgabe = null) {
  const titel = aufgabe ? 'Aufgabe bearbeiten' : 'Neue Aufgabe';
  const html = `
    <div class="form-group">
      <label>Titel *</label>
      <input type="text" id="aufg-titel" value="${aufgabe?.titel || ''}" class="form-control" required>
    </div>
    <div class="form-group">
      <label>Beschreibung</label>
      <textarea id="aufg-beschreibung" class="form-control" rows="3">${aufgabe?.beschreibung || ''}</textarea>
    </div>
    <div style="display:flex; gap:12px;">
      <div class="form-group" style="flex:1">
        <label>Zuständig</label>
        <input type="text" id="aufg-zustandig" value="${aufgabe?.zustandig || ''}" class="form-control">
      </div>
      <div class="form-group" style="flex:1">
        <label>Priorität</label>
        <select id="aufg-prioritaet" class="form-control">
          <option value="dringend" ${aufgabe?.prioritaet === 'dringend' ? 'selected' : ''}>Dringend</option>
          <option value="hoch" ${aufgabe?.prioritaet === 'hoch' ? 'selected' : ''}>Hoch</option>
          <option value="normal" ${aufgabe?.prioritaet === 'normal' || !aufgabe ? 'selected' : ''}>Normal</option>
          <option value="niedrig" ${aufgabe?.prioritaet === 'niedrig' ? 'selected' : ''}>Niedrig</option>
        </select>
      </div>
    </div>
    <div style="display:flex; gap:12px;">
      <div class="form-group" style="flex:1">
        <label>Fälligkeit</label>
        <input type="date" id="aufg-faelligkeit" value="${aufgabe?.faelligkeit ? aufgabe.faelligkeit.split('T')[0] : ''}" class="form-control">
      </div>
      <div class="form-group" style="flex:1">
        <label>Status</label>
        <select id="aufg-status" class="form-control">
          <option value="offen" ${aufgabe?.status === 'offen' || !aufgabe ? 'selected' : ''}>Offen</option>
          <option value="in-arbeit" ${aufgabe?.status === 'in-arbeit' ? 'selected' : ''}>In Arbeit</option>
          <option value="erledigt" ${aufgabe?.status === 'erledigt' ? 'selected' : ''}>Erledigt</option>
        </select>
      </div>
    </div>
  `;
  showFormModal(titel, html, async () => {
    const data = {
      id: aufgabe?.id,
      titel: document.getElementById('aufg-titel').value,
      beschreibung: document.getElementById('aufg-beschreibung').value,
      zustandig: document.getElementById('aufg-zustandig').value,
      prioritaet: document.getElementById('aufg-prioritaet').value,
      faelligkeit: document.getElementById('aufg-faelligkeit').value || null,
      status: document.getElementById('aufg-status').value,
    };
    await api.saveAufgabe(data);
    ladeAufgaben();
  });
}

async function editiereAufgabe(id) {
  const aufgaben = await api.getAufgaben();
  const aufgabe = aufgaben.find(a => a.id === id);
  if (aufgabe) showAufgabenForm(aufgabe);
}

async function loescheAufgabe(id) {
  if (!confirm('Aufgabe wirklich löschen?')) return;
  await api.deleteAufgabe(id);
  ladeAufgaben();
}

// ============ Doppelte Buchführung ============

async function ladeKontenrahmen() {
  const konten = await api.getKontenrahmen();
  const select = document.getElementById('sh-filter-konto');
  if (!select) return;
  select.innerHTML = '<option value="">Alle Konten</option>' + konten.map(k =>
    `<option value="${k.konto_nr}">${k.konto_nr} ${k.konto_name}</option>`
  ).join('');
}

async function ladeBuchungenSH() {
  const konto = document.getElementById('sh-filter-konto')?.value || '';
  const von = document.getElementById('sh-filter-von')?.value || '';
  const bis = document.getElementById('sh-filter-bis')?.value || '';
  const buchungen = await api.getBuchungenSollHaben({ konto, von, bis });
  const tbody = document.getElementById('sh-tbody');
  if (!tbody) return;

  tbody.innerHTML = buchungen.map(b => `
    <tr>
      <td>${new Date(b.buchungsdatum).toLocaleDateString('de-DE')}</td>
      <td>${b.konto_nr} ${b.konto_name || ''}</td>
      <td><span style="color:${b.typ === 'Soll' ? '#0066cc' : '#28a745'}; font-weight:600;">${b.typ}</span></td>
      <td style="text-align:right; font-weight:600;">${formatEuro(b.betrag)}</td>
      <td>${b.gegenkonto || '—'}</td>
      <td>${b.beleg_nr || '—'}</td>
      <td>${b.buchungstitel || '—'}</td>
      <td>
        <button class="btn btn-sm btn-secondary" onclick="editiereBuchungSH(${b.id})">✏️</button>
        <button class="btn btn-sm btn-secondary" onclick="loescheBuchungSH(${b.id})" style="color:var(--danger);">✕</button>
      </td>
    </tr>
  `).join('') || '<tr><td colspan="8" style="text-align:center; color:#999; padding:24px;">Keine Buchungen vorhanden</td></tr>';

  // Salden anzeigen
  const saldoContainer = document.getElementById('sh-salden');
  if (saldoContainer) {
    const kontoSalden = await api.getKontenraeumeSumme();
    saldoContainer.innerHTML = '<h3 style="margin-bottom:12px;">Kontensalden</h3><table class="data-table"><thead><tr><th>Konto</th><th>Name</th><th>Soll</th><th>Haben</th><th>Saldo</th></tr></thead><tbody>' +
      kontoSalden.map(ks => `
        <tr>
          <td>${ks.konto_nr}</td>
          <td>${ks.konto_name}</td>
          <td style="text-align:right;">${formatEuro(ks.soll)}</td>
          <td style="text-align:right;">${formatEuro(ks.haben)}</td>
          <td style="text-align:right; font-weight:bold; color:${(ks.soll - ks.haben) >= 0 ? '#0066cc' : '#dc3545'};">${formatEuro(ks.soll - ks.haben)}</td>
        </tr>
      `).join('') +
      '</tbody></table>';
  }
}

async function showBuchungSHForm(buchung = null) {
  const konten = await api.getKontenrahmen();
  const titel = buchung ? 'Buchung bearbeiten' : 'Neue Buchung (Soll/Haben)';
  const html = `
    <div style="display:flex; gap:12px;">
      <div class="form-group" style="flex:1">
        <label>Konto (Soll/Haben) *</label>
        <select id="sh-konto" class="form-control" required>
          ${konten.map(k => `<option value="${k.konto_nr}" ${buchung?.konto_nr === k.konto_nr ? 'selected' : ''}>${k.konto_nr} ${k.konto_name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group" style="flex:1">
        <label>Buchungsart *</label>
        <select id="sh-typ" class="form-control">
          <option value="Soll" ${buchung?.typ === 'Soll' || !buchung ? 'selected' : ''}>Soll</option>
          <option value="Haben" ${buchung?.typ === 'Haben' ? 'selected' : ''}>Haben</option>
        </select>
      </div>
    </div>
    <div style="display:flex; gap:12px;">
      <div class="form-group" style="flex:1">
        <label>Betrag *</label>
        <input type="number" id="sh-betrag" value="${buchung?.betrag || ''}" class="form-control" step="0.01" required>
      </div>
      <div class="form-group" style="flex:1">
        <label>Gegenkonto</label>
        <select id="sh-gegenkonto" class="form-control">
          <option value="">—</option>
          ${konten.map(k => `<option value="${k.konto_nr}" ${buchung?.gegenkonto === k.konto_nr ? 'selected' : ''}>${k.konto_nr} ${k.konto_name}</option>`).join('')}
        </select>
      </div>
    </div>
    <div style="display:flex; gap:12px;">
      <div class="form-group" style="flex:1">
        <label>Buchungsdatum *</label>
        <input type="date" id="sh-datum" value="${buchung?.buchungsdatum ? buchung.buchungsdatum.split('T')[0] : new Date().toISOString().split('T')[0]}" class="form-control" required>
      </div>
      <div class="form-group" style="flex:1">
        <label>Beleg-Nr.</label>
        <input type="text" id="sh-beleg" value="${buchung?.beleg_nr || ''}" class="form-control">
      </div>
    </div>
    <div class="form-group">
      <label>Buchungstitel</label>
      <input type="text" id="sh-titel" value="${buchung?.buchungstitel || ''}" class="form-control">
    </div>
  `;
  showFormModal(titel, html, async () => {
    const kontoNr = document.getElementById('sh-konto').value;
    const konto = konten.find(k => k.konto_nr === kontoNr);
    const data = {
      id: buchung?.id,
      konto_nr: kontoNr,
      konto_name: konto?.konto_name || '',
      typ: document.getElementById('sh-typ').value,
      betrag: parseFloat(document.getElementById('sh-betrag').value),
      gegenkonto: document.getElementById('sh-gegenkonto').value,
      buchungstitel: document.getElementById('sh-titel').value,
      beleg_nr: document.getElementById('sh-beleg').value,
      buchungsdatum: document.getElementById('sh-datum').value,
    };
    await api.saveBuchungSollHaben(data);
    ladeBuchungenSH();
  });
}

async function editiereBuchungSH(id) {
  const buchungen = await api.getBuchungenSollHaben();
  const b = buchungen.find(x => x.id === id);
  if (b) showBuchungSHForm(b);
}

async function loescheBuchungSH(id) {
  if (!confirm('Buchung wirklich löschen?')) return;
  await api.deleteBuchungSollHaben(id);
  ladeBuchungenSH();
}

async function exportIcsKalender() {
  const pfad = await api.exportIcs();
  if (pfad) alert(`Kalender exportiert: ${pfad}`);
}

async function exportSepaUeberweisungen() {
  const pfad = await api.exportSepaUeberweisungen();
  if (pfad) alert(`SEPA-Überweisungen exportiert: ${pfad}`);
}

async function exportSepaLastschrift() {
  const pfad = await api.exportSepaLastschrift();
  if (pfad) alert(`SEPA-Lastschrift exportiert: ${pfad}`);
}

// ============ Startup ============
checkLicenseOnStartup();
loadDashboard();
