window.AU = window.AU || {};

AU.ui = (() => {
  const U = () => AU.util;
  let currentModel = null;

  function qualityPill(status, label) {
    const map = { certified: 'good', partial: 'warn', estimate: 'info', blocked: 'bad', fact: 'good', calculated: 'info', signal: 'warn' };
    return `<span class="pill ${map[status] || 'muted'}">${U().escapeHtml(label || status)}</span>`;
  }

  function riskHtml(risk) {
    return `<span class="risk ${risk.key}">${U().escapeHtml(risk.label)}</span>`;
  }

  function kpi(label, value, sub = '', cls = '') {
    return `<div class="kpi"><div class="kpi-label">${U().escapeHtml(label)}</div><div class="kpi-value ${cls}">${value}</div>${sub ? `<div class="kpi-sub">${sub}</div>` : ''}</div>`;
  }

  function deltaText(delta) {
    if (delta === null || !Number.isFinite(delta)) return `<span class="delta-neutral">comparaison indisponible</span>`;
    const cls = delta > 0.001 ? 'delta-up' : delta < -0.001 ? 'delta-down' : 'delta-neutral';
    return `<span class="${cls}">${delta >= 0 ? '+' : ''}${(delta * 100).toFixed(1)} %</span>`;
  }

  function viewHeader(title, subtitle, actions = '') {
    return `<div class="view-header"><div><h1>${U().escapeHtml(title)}</h1><p>${subtitle}</p></div><div class="view-actions">${actions}</div></div>`;
  }

  function bars(rows, valueFn, labelFn, formatFn, limit = 8) {
    const subset = rows.slice(0, limit);
    const max = Math.max(1, ...subset.map(valueFn));
    return `<div class="bar-list">${subset.map(r => {
      const v = valueFn(r);
      const w = Math.max(1, v / max * 100);
      return `<div class="bar-row"><div class="bar-label" title="${U().escapeHtml(labelFn(r))}">${U().escapeHtml(labelFn(r))}</div><div class="bar-track"><div class="bar-fill" style="width:${w.toFixed(1)}%"></div></div><div class="bar-value">${formatFn(v)}</div></div>`;
    }).join('')}</div>`;
  }

  function sparkCanvas(id, rows, valueKey) {
    return `<canvas class="spark" id="${id}" data-spark-key="${valueKey}"></canvas><div class="axis-note"><span>${rows.length ? U().formatDate(rows[0].date) : ''}</span><span>${rows.length ? U().formatDate(rows.at(-1).date) : ''}</span></div>`;
  }

  function drawSpark(canvas, rows, valueKey) {
    if (!canvas || !rows.length) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(300, rect.width * dpr);
    canvas.height = Math.max(100, rect.height * dpr);
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const w = rect.width, h = rect.height;
    const vals = rows.map(r => Number(r[valueKey]) || 0);
    const min = Math.min(...vals), max = Math.max(...vals);
    const range = max - min || 1;
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(146,162,178,.18)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) { const y = h * i / 4; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    ctx.strokeStyle = '#35d17f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    rows.forEach((r, i) => {
      const x = rows.length === 1 ? w / 2 : i / (rows.length - 1) * w;
      const y = h - 8 - ((Number(r[valueKey]) || 0) - min) / range * (h - 18);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.stroke();
  }

  function intelligenceBadge(level) {
    const labels = {critical:'CRITIQUE',warning:'IMPORTANT',opportunity:'OPPORTUNITÉ',positive:'POSITIF',info:'INFO',quality:'QUALITÉ'};
    return `<span class="intel-badge ${level}">${labels[level] || String(level).toUpperCase()}</span>`;
  }

  function confidenceBadge(f) {
    return `<span class="confidence-badge">Confiance ${U().escapeHtml(f.confidenceLabel || '')} · ${U().integer(f.confidence || 0)} %</span>`;
  }

  function findingCard(f, compact = false) {
    const facts = (f.facts || []).map(x => `<li>${U().escapeHtml(x)}</li>`).join('');
    const hypotheses = (f.hypotheses || []).map(x => `<li>${U().escapeHtml(x)}</li>`).join('');
    const actions = (f.actions || []).map(x => `<li>${U().escapeHtml(x)}</li>`).join('');
    return `<article class="intel-finding ${f.level}">
      <div class="intel-finding-head"><div>${intelligenceBadge(f.level)} ${confidenceBadge(f)}</div>${f.impactAmount ? `<strong class="impact ${f.impactAmount < 0 ? 'negative':'positive'}">${f.impactAmount >= 0 ? '+' : ''}${U().money(f.impactAmount)}</strong>` : ''}</div>
      <h3>${U().escapeHtml(f.title)}</h3>
      <p>${U().escapeHtml(f.summary || '')}</p>
      ${compact ? '' : `<details class="intel-evidence"><summary>Voir l’explication et les preuves</summary>
        ${f.explanation ? `<p class="intel-explanation">${U().escapeHtml(f.explanation)}</p>` : ''}
        ${facts ? `<h4>Faits utilisés</h4><ul>${facts}</ul>` : ''}
        ${hypotheses ? `<h4>Hypothèses distinctes des faits</h4><ul>${hypotheses}</ul>` : ''}
        ${actions ? `<h4>Action recommandée</h4><ul>${actions}</ul>` : ''}
        <div class="quality-tag">${U().escapeHtml(f.quality || '')}</div>
      </details>`}
    </article>`;
  }

  function executiveHero(model) {
    const intel = model.intelligence;
    if (!intel) return '';
    const h = intel.health;
    const statusClass = h.score >= 78 ? 'good' : h.score >= 60 ? 'watch' : h.score >= 45 ? 'warning' : 'critical';
    return `<section class="executive-hero ${statusClass}">
      <div class="health-score"><span>Indice de pilotage</span><strong>${h.score}</strong><small>/100</small></div>
      <div class="executive-copy"><span class="eyebrow">DIAGNOSTIC AUTONOME</span><h2>${U().escapeHtml(h.status)}</h2><p>${U().escapeHtml(intel.brief[0] || 'Analyse terminée.')}</p></div>
      <div class="executive-meta"><span>Comparaison automatique</span><strong>${U().escapeHtml(intel.windows.current.label)}</strong><small>vs ${U().escapeHtml(intel.windows.previous.label)}</small></div>
    </section>`;
  }

  function askPanel(model) {
    return `<section class="panel ask-panel"><div class="panel-title"><div><h2>Demander à Analysis Ultimate</h2><div class="panel-sub">Moteur local : les réponses sont générées uniquement à partir des calculs et preuves de tes fichiers.</div></div><span class="pill good">100 % local</span></div>
      <div class="ask-row"><input id="intelQuestion" class="search-input ask-input" placeholder="Ex. Pourquoi mon CA baisse ? Quels clients suis-je en train de perdre ?"><button id="intelAskBtn" class="btn btn-primary">Analyser</button></div>
      <div class="question-chips"><button data-q="Pourquoi mon CA bouge ?">Pourquoi mon CA bouge ?</button><button data-q="Quels clients suis-je en train de perdre ?">Clients à risque</button><button data-q="Que dois-je commander ?">Stock à sécuriser</button><button data-q="Quels produits sont moteurs ?">Produits moteurs</button><button data-q="Quel impact ont les vacances scolaires ?">Vacances scolaires</button><button data-q="Quelles actions sont prioritaires ?">Actions prioritaires</button></div>
      <div id="intelAnswer" class="intel-answer hidden"></div>
    </section>`;
  }

  function renderAnswer(answer) {
    const items = (answer.items || []).map(x => `<div class="answer-block"><h4>${U().escapeHtml(x.title)}</h4><p>${U().escapeHtml(x.text || '')}</p>${x.bullets?.length ? `<ul>${x.bullets.map(b=>`<li>${U().escapeHtml(b)}</li>`).join('')}</ul>`:''}<span class="quality-tag">${U().escapeHtml(x.confidence || '')} · ${U().escapeHtml(x.quality || '')}</span></div>`).join('');
    const extra = (answer.extra || []).length ? `<div class="answer-extra"><h4>Éléments utiles</h4><ul>${answer.extra.map(x=>`<li>${U().escapeHtml(x)}</li>`).join('')}</ul></div>` : '';
    return `<div class="answer-head"><span class="eyebrow">RÉPONSE CALCULÉE</span><h3>${U().escapeHtml(answer.title || 'Analyse')}</h3><p>${U().escapeHtml(answer.intro || '')}</p></div>${items}${extra}`;
  }

  function bindAsk(model, root) {
    const input = root.querySelector('#intelQuestion');
    const btn = root.querySelector('#intelAskBtn');
    const answerRoot = root.querySelector('#intelAnswer');
    if (!input || !btn || !answerRoot) return;
    const run = q => {
      const text = q || input.value.trim();
      if (!text) return;
      input.value = text;
      const answer = AU.intelligence.answerQuestion(model, text);
      answerRoot.innerHTML = renderAnswer(answer);
      answerRoot.classList.remove('hidden');
    };
    btn.addEventListener('click', () => run());
    input.addEventListener('keydown', e => { if (e.key === 'Enter') run(); });
    root.querySelectorAll('[data-q]').forEach(b => b.addEventListener('click', () => run(b.dataset.q)));
  }

  function dashboard(model, root) {
    const ref = model.range.max;
    const intel = model.intelligence;
    const current = intel?.metrics?.current || AU.analytics.periodSummary(model.transactions, U().addDays(ref,-29), ref);
    const prev = intel?.metrics?.previous || AU.analytics.periodSummary(model.transactions, U().addDays(ref,-59), U().addDays(ref,-30));
    const last90 = model.daily.filter(d => d.date >= U().addDays(ref, -89));
    const riskHigh = model.customers.filter(c => c.risk.key === 'high').length;
    const riskAny = model.customers.filter(c => ['watch','risk','high'].includes(c.risk.key)).length;
    const stockTension = model.products.filter(p => ['negative','out','critical'].includes(p.stockStatus) && p.qty30 > 0).length;
    const q = model.quality;
    const topFindings = intel?.findings?.filter(f=>f.category!=='quality').slice(0,5) || [];
    const windowDays = intel?.windows?.current?.days || 30;

    root.innerHTML = viewHeader('Vue générale', `Données du ${U().formatDate(model.range.min)} au ${U().formatDate(model.range.max)} · ${U().integer(model.transactions.length)} transactions`, qualityPill(q.status, q.status === 'certified' ? 'Croisement certifié' : 'Croisement contrôlé')) +
      executiveHero(model) +
      `<div class="kpi-grid section-gap">
        ${kpi(`CA TTC · ${windowDays} jours`, U().money(current.caTTC), deltaText(U().pctChange(current.caTTC, prev.caTTC)) + ` vs ${windowDays} j précédents`)}
        ${kpi(`Tickets · ${windowDays} jours`, U().integer(current.tickets), deltaText(U().pctChange(current.tickets, prev.tickets)))}
        ${kpi('Panier moyen', U().money(current.avgBasket), deltaText(U().pctChange(current.avgBasket, prev.avgBasket)))}
        ${kpi(`Marge · ${windowDays} jours`, U().money(current.margin), current.marginRate !== null ? `${U().percent(current.marginRate)} du CA HT` : '')}
        ${kpi('Clients à surveiller', U().integer(riskAny), `${riskHigh} en risque élevé`)}
        ${kpi('Stock sous tension', U().integer(stockTension), 'références vendues récemment')}
      </div>
      <div class="grid-2">
        <section class="panel"><div class="panel-title"><div><h2>CA quotidien · 90 derniers jours</h2><div class="panel-sub">Jours actifs ; les anomalies sont comparées aux mêmes jours de semaine.</div></div></div>${sparkCanvas('salesSpark', last90, 'caTTC')}</section>
        <section class="panel"><div class="panel-title"><div><h2>Ce qu’Analysis Ultimate a compris</h2><div class="panel-sub">Diagnostics classés par importance et confiance.</div></div><button class="btn btn-small" data-go-intelligence>Tout voir</button></div><div class="intel-mini-list">${topFindings.map(f=>findingCard(f,true)).join('') || '<div class="empty-mini">Aucun signal notable.</div>'}</div></section>
      </div>
      ${askPanel(model)}
      <div class="grid-equal section-gap">
        <section class="panel"><div class="panel-title"><h2>Rayons par CA</h2><span class="panel-sub">Période complète</span></div>${bars(model.rayons, r => r.ca, r => r.rayon, U().money, 9)}</section>
        <section class="panel"><div class="panel-title"><h2>Clients à risque élevé</h2><span class="panel-sub">Triés par valeur mensuelle estimée</span></div>${riskTable(model.customers.filter(c=>c.risk.key==='high').sort((a,b)=>b.estimatedMonthlyValue-a.estimatedMonthlyValue).slice(0,8))}</section>
      </div>
      <div class="grid-equal section-gap">
        <section class="panel"><div class="panel-title"><h2>Vacances scolaires Zone A</h2><span class="panel-sub">Comparaison par jour actif</span></div>${holidaySummary(model)}</section>
        <section class="panel"><div class="panel-title"><h2>Audit rapide</h2><span class="panel-sub">Ce qui limite la certification</span></div>${qualityQuick(model)}</section>
      </div>`;
    requestAnimationFrame(() => drawSpark(document.getElementById('salesSpark'), last90, 'caTTC'));
    bindClientRows(root);
    bindAsk(model, root);
    root.querySelector('[data-go-intelligence]')?.addEventListener('click', () => AU.app.switchView('intelligence'));
  }

  function riskTable(rows) {
    if (!rows.length) return '<div class="empty-mini">Aucun client en risque élevé selon l’historique disponible.</div>';
    return `<div class="data-table-wrap"><table class="data-table"><thead><tr><th>Client</th><th>Dernière visite</th><th>Retard</th><th class="numeric">Valeur/mois*</th></tr></thead><tbody>${rows.map(c => `<tr data-client-code="${U().escapeHtml(c.client.codeClient)}"><td><strong>${U().escapeHtml(c.client.name)}</strong><br><span class="muted">${U().escapeHtml(c.client.city)}</span></td><td>${U().formatDate(c.lastVisit)}</td><td>${c.overdueRatio ? `${c.overdueRatio.toFixed(1)}× habitude` : '—'}</td><td class="numeric">${U().money(c.estimatedMonthlyValue)}</td></tr>`).join('')}</tbody></table></div><div class="panel-sub" style="margin-top:7px">* estimation basée sur le rythme historique observé, pas une prévision garantie.</div>`;
  }

  function holidaySummary(model) {
    const h = model.holidayComparison;
    return `<div class="quality-grid">
      <div class="quality-card"><span>CA/jour actif · vacances</span><strong>${U().money(h.school.avgCaDay)}</strong><span>${h.school.activeDays} jours actifs</span></div>
      <div class="quality-card"><span>CA/jour actif · hors vacances</span><strong>${U().money(h.normal.avgCaDay)}</strong><span>${h.normal.activeDays} jours actifs</span></div>
      <div class="quality-card"><span>Écart CA/jour</span><strong>${h.caDayDelta === null ? '—' : `${h.caDayDelta >= 0 ? '+' : ''}${(h.caDayDelta*100).toFixed(1)} %`}</strong><span>Zone A / Clermont-Ferrand</span></div>
      <div class="quality-card"><span>Écart panier</span><strong>${h.basketDelta === null ? '—' : `${h.basketDelta >= 0 ? '+' : ''}${(h.basketDelta*100).toFixed(1)} %`}</strong><span>vacances vs hors vacances</span></div>
    </div>`;
  }

  function qualityQuick(model) {
    const q = model.quality;
    return `<div class="alert-list">
      <div class="alert-row ${q.transactionConflicts ? 'bad':'good'}"><span class="alert-dot"></span><div><strong>Conflits inter-fichiers : ${q.transactionConflicts}</strong><p>${q.transactionConflicts ? 'Analyse bloquée tant que les transactions contradictoires ne sont pas résolues.' : `${q.duplicateTransactionsIgnored} transaction(s) identique(s) de chevauchement ignorée(s).`}</p></div></div>
      <div class="alert-row ${q.clientCertifiedCoverage > .95 ? 'good':''}"><span class="alert-dot"></span><div><strong>Rattachement client certifié : ${U().percent(q.clientCertifiedCoverage)}</strong><p>Couverture avec correspondances probables incluse : ${U().percent(q.clientAnyCoverage)}.</p></div></div>
      <div class="alert-row ${q.catalogueCoverage > .98 ? 'good':''}"><span class="alert-dot"></span><div><strong>Catalogue : ${U().percent(q.catalogueCoverage)} des lignes rattachées</strong><p>${q.catalogCounts.missing} ligne(s) sans référence catalogue actuelle.</p></div></div>
      <div class="alert-row ${q.financialIntegrity === null || q.financialIntegrity > .999 ? 'good':''}"><span class="alert-dot"></span><div><strong>Contrôle financier : ${q.financialIntegrity === null ? 'non disponible' : U().percent(q.financialIntegrity)}</strong><p>Vérification Vente HT − Achat HT = Marge quand les trois champs sont présents.</p></div></div>
    </div>`;
  }

  function clientsView(model, root) {
    root.innerHTML = viewHeader('Clients 360°', `${U().integer(model.clients.length)} fiches clients · revisite calculée par jour d’achat`, `<button class="btn" id="exportClients">Exporter la synthèse CSV</button>`) +
      `<section class="panel">
        <div class="table-tools"><input id="clientSearch" class="search-input" placeholder="Nom, code client, e-mail, téléphone, ville…"><select id="riskFilter" class="select-input"><option value="">Tous les statuts</option><option value="high">Risque élevé</option><option value="risk">Risque</option><option value="watch">À surveiller</option><option value="active">Actif</option><option value="insufficient">Historique insuffisant</option><option value="no-sales">Sans vente rattachée</option></select><span id="clientCount" class="pill muted"></span></div>
        <div id="clientTable"></div>
      </section>`;
    const input = root.querySelector('#clientSearch');
    const risk = root.querySelector('#riskFilter');
    const table = root.querySelector('#clientTable');
    function draw() {
      const q = U().normText(input.value);
      const rf = risk.value;
      let rows = model.customers.filter(c => {
        if (rf === 'no-sales' && c.txs.length) return false;
        if (rf && rf !== 'no-sales' && c.risk.key !== rf) return false;
        if (!q) return true;
        const hay = U().normText([c.client.name,c.client.codeClient,c.client.email,c.client.phone,c.client.city].join(' '));
        return hay.includes(q);
      });
      rows.sort((a,b) => (b.risk.severity-a.risk.severity) || (b.totalSpend-a.totalSpend));
      root.querySelector('#clientCount').textContent = `${U().integer(rows.length)} client(s)`;
      table.innerHTML = clientTable(rows.slice(0,300));
      bindClientRows(table);
    }
    input.addEventListener('input', draw); risk.addEventListener('change', draw); draw();
    root.querySelector('#exportClients').addEventListener('click', () => {
      const rows = model.customers.map(c => ({
        'Code client':c.client.codeClient,'Client':c.client.name,'Ville':c.client.city,'Visites':c.visitCount,'Transactions':c.transactionCount,
        'CA TTC':c.totalSpend.toFixed(2),'Marge':c.totalMargin.toFixed(2),'Panier moyen':c.avgBasket.toFixed(2),'Derniere visite':U().dateKey(c.lastVisit),
        'Intervalle median jours':c.medianInterval ?? '', 'Jours depuis derniere visite':c.daysSinceLast ?? '', 'Statut risque':c.risk.label,'Score risque':Math.round(c.risk.score),
        'Valeur mensuelle estimee':c.estimatedMonthlyValue.toFixed(2),'Qualite rattachement':c.identityQuality
      }));
      U().downloadText('analysis-ultimate-clients.csv', U().toCsv(rows), 'text/csv;charset=utf-8');
    });
  }

  function clientTable(rows) {
    if (!rows.length) return '<div class="empty-mini">Aucun client ne correspond aux filtres.</div>';
    return `<div class="data-table-wrap"><table class="data-table"><thead><tr><th>Client</th><th>Statut</th><th>Dernière visite</th><th class="numeric">Visites</th><th class="numeric">CA TTC</th><th class="numeric">Panier</th><th>Habitude</th><th>Produit n°1</th></tr></thead><tbody>${rows.map(c => `<tr data-client-code="${U().escapeHtml(c.client.codeClient)}"><td><strong>${U().escapeHtml(c.client.name || 'Sans nom')}</strong><br><span class="muted mono">${U().escapeHtml(c.client.codeClient)}</span> · <span class="muted">${U().escapeHtml(c.client.city)}</span></td><td>${riskHtml(c.risk)}</td><td>${U().formatDate(c.lastVisit)}${c.daysSinceLast!==null?`<br><span class="muted">il y a ${c.daysSinceLast} j</span>`:''}</td><td class="numeric">${c.visitCount}</td><td class="numeric">${U().money(c.totalSpend)}</td><td class="numeric">${U().money(c.avgBasket)}</td><td>${c.medianInterval?`${Math.round(c.medianInterval)} j médian`:'—'}${c.overdueRatio?`<br><span class="muted">retard ${c.overdueRatio.toFixed(1)}×</span>`:''}</td><td class="truncate">${U().escapeHtml(c.topProducts[0]?.label || '—')}</td></tr>`).join('')}</tbody></table></div>${rows.length>=300?'<div class="panel-sub" style="margin-top:8px">Affichage limité à 300 résultats : utilisez la recherche pour cibler un client.</div>':''}`;
  }

  function bindClientRows(scope) {
    scope.querySelectorAll('[data-client-code]').forEach(tr => tr.addEventListener('click', () => showClientDetail(tr.dataset.clientCode)));
  }

  function showClientDetail(code) {
    const model = currentModel;
    const c = model?.customerByCode.get(code);
    if (!c) return;
    const modal = document.getElementById('detailModal');
    const content = document.getElementById('detailContent');
    const evidence = [...new Set(c.txs.flatMap(t=>t.clientMatchEvidence || []))];
    content.innerHTML = `<div class="profile-head"><div><span class="eyebrow">FICHE CLIENT 360°</span><h2>${U().escapeHtml(c.client.name || 'Client sans nom')}</h2><p>Code client <span class="mono">${U().escapeHtml(c.client.codeClient)}</span> · créé le ${U().formatDate(c.client.createdAt)}</p><div class="profile-contact">${c.client.phone?qualityPill('partial',c.client.phone):''}${c.client.email?qualityPill('partial',c.client.email):''}${c.client.city?qualityPill('partial',`${c.client.postal} ${c.client.city}`):''}</div></div><div>${riskHtml(c.risk)}<br><span class="panel-sub">score ${Math.round(c.risk.score)}/100</span></div></div>
      <div class="profile-kpis">${kpi('CA TTC',U().money(c.totalSpend),`${c.transactionCount} transactions`)}${kpi('Visites',U().integer(c.visitCount),'jours d’achat uniques')}${kpi('Panier moyen',U().money(c.avgBasket))}${kpi('Revisite médiane',c.medianInterval?`${Math.round(c.medianInterval)} j`:'—',c.expectedNext?`prochaine théorique ${U().formatDate(c.expectedNext)}`:'historique insuffisant')}${kpi('Depuis dernière visite',c.daysSinceLast!==null?`${c.daysSinceLast} j`:'—',c.lastVisit?U().formatDate(c.lastVisit):'aucune vente')}</div>
      <div class="grid-equal">
        <section class="panel"><h3>Signaux comportementaux</h3><div class="signal-list">${c.signals.length?c.signals.map(s=>`<div class="signal"><strong>${U().escapeHtml(s.strength.toUpperCase())}</strong> · ${U().escapeHtml(s.text)}<div class="quality-tag">${s.quality}</div></div>`).join(''):'<div class="empty-mini">Aucun signal notable calculable.</div>'}</div></section>
        <section class="panel"><h3>Qualité du rattachement</h3><p class="muted">${c.identityQuality==='certified'?'Les transactions rattachées utilisent des identifiants forts concordants.':'Au moins une transaction repose sur un rattachement probable et doit rester identifiable comme tel.'}</p>${evidence.length?`<div class="alert-list">${evidence.map(e=>`<div class="alert-row good"><span class="alert-dot"></span><div>${U().escapeHtml(e)}</div></div>`).join('')}</div>`:'<div class="empty-mini">Aucune vente rattachée.</div>'}</section>
      </div>
      <div class="grid-equal section-gap">
        <section class="panel"><h3>Produits favoris</h3>${bars(c.topProducts,r=>Math.max(0,r.ca),r=>r.label,U().money,8)}</section>
        <section class="panel"><h3>Rayons favoris</h3>${bars(c.topRayons,r=>Math.max(0,r.ca),r=>r.label,U().money,6)}</section>
      </div>
      <section class="profile-section panel"><h3>Matériel acheté / possédé probable</h3>${c.equipment.length?`<div class="data-table-wrap"><table class="data-table"><thead><tr><th>Date</th><th>Matériel</th><th>Famille</th><th class="numeric">Qté</th><th class="numeric">TTC</th></tr></thead><tbody>${c.equipment.slice().sort((a,b)=>b.date-a.date).map(x=>`<tr><td>${U().formatDate(x.date)}</td><td>${U().escapeHtml(x.designation)}</td><td>${U().escapeHtml(x.family)}</td><td class="numeric">${U().number(x.qty)}</td><td class="numeric">${U().money(x.ttc)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty-mini">Aucun achat classé comme POD / KIT / BOX / CLEAROMISEUR / RECONSTRUCTIBLE dans l’historique.</div>'}<div class="panel-sub" style="margin-top:7px">« Possédé probable » signifie acheté dans l’historique ; le logiciel ne peut pas certifier que le client l’utilise encore.</div></section>
      <section class="profile-section panel"><h3>Chronologie des visites</h3><div class="timeline">${c.visits.slice(-20).reverse().map(v=>`<div class="timeline-row"><div class="date">${U().formatDate(v.date)}</div><div>${v.lines.slice(0,4).map(l=>U().escapeHtml(l.designation)).join(' · ')}${v.lines.length>4?' …':''}</div><strong>${U().money(v.ttc)}</strong></div>`).join('')||'<div class="empty-mini">Aucune visite rattachée.</div>'}</div></section>`;
    modal.classList.remove('hidden');
  }

  function productsView(model, root) {
    const rayons = [...new Set(model.products.map(p=>p.rayon).filter(Boolean))].sort(U().sortFrench);
    root.innerHTML = viewHeader('Produits', `${U().integer(model.products.length)} références rencontrées dans les ventes`, `<button class="btn" id="exportProducts">Exporter CSV</button>`) + `<section class="panel"><div class="table-tools"><input id="productSearch" class="search-input" placeholder="Désignation ou code article…"><select id="productRayon" class="select-input"><option value="">Tous les rayons</option>${rayons.map(r=>`<option>${U().escapeHtml(r)}</option>`).join('')}</select><span id="productCount" class="pill muted"></span></div><div id="productTable"></div></section>`;
    const search=root.querySelector('#productSearch'), rayon=root.querySelector('#productRayon'), table=root.querySelector('#productTable');
    function draw(){const q=U().normText(search.value);let rows=model.products.filter(p=>(!rayon.value||p.rayon===rayon.value)&&(!q||U().normText(`${p.designation} ${p.code}`).includes(q)));root.querySelector('#productCount').textContent=`${U().integer(rows.length)} produit(s)`;table.innerHTML=productTable(rows.slice(0,300));bindProductRows(table)}
    search.addEventListener('input',draw);rayon.addEventListener('change',draw);draw();
    root.querySelector('#exportProducts').addEventListener('click',()=>{const rows=model.products.map(p=>({'Code article':p.code,'Designation':p.designation,'Rayon':p.rayon,'Famille':p.famille,'CA TTC':p.ca.toFixed(2),'Marge':p.margin.toFixed(2),'Quantite':p.qty,'Tickets':p.tickets,'Clients':p.clients,'Taux reachat':p.repeatRate??'','Stock':p.stock??'','Couverture jours':p.coverageDays??'','Tendance 30j':p.trend30??''}));U().downloadText('analysis-ultimate-produits.csv',U().toCsv(rows),'text/csv;charset=utf-8')});
  }

  function stockLabel(status){return ({negative:'Stock négatif',out:'Rupture',critical:'Critique <7 j',low:'Faible <21 j',dormant:'Dormant',ok:'OK',unknown:'Non catalogué'})[status]||status}
  function stockClass(status){return ['negative','out','critical'].includes(status)?'bad':status==='low'||status==='dormant'?'warn':status==='ok'?'good':'muted'}
  function productTable(rows){if(!rows.length)return'<div class="empty-mini">Aucun produit.</div>';return`<div class="data-table-wrap"><table class="data-table"><thead><tr><th>Produit</th><th>Rayon / famille</th><th class="numeric">CA TTC</th><th class="numeric">Qté</th><th class="numeric">Clients</th><th class="numeric">Réachat</th><th class="numeric">30 j</th><th>Stock</th></tr></thead><tbody>${rows.map(p=>`<tr data-product-code="${U().escapeHtml(p.code)}"><td><strong>${U().escapeHtml(p.designation)}</strong><br><span class="mono muted">${U().escapeHtml(p.code)}</span></td><td>${U().escapeHtml(p.rayon||'Non classé')}<br><span class="muted">${U().escapeHtml(p.famille||'—')}</span></td><td class="numeric">${U().money(p.ca)}</td><td class="numeric">${U().number(p.qty)}</td><td class="numeric">${p.clients}</td><td class="numeric">${p.repeatRate!==null?U().percent(p.repeatRate):'—'}</td><td class="numeric">${p.trend30===null?'—':deltaText(p.trend30)}</td><td>${qualityPill(stockClass(p.stockStatus),p.stock===null?'Historique':`${p.stock} · ${stockLabel(p.stockStatus)}`)}</td></tr>`).join('')}</tbody></table></div>`}
  function bindProductRows(scope){scope.querySelectorAll('[data-product-code]').forEach(tr=>tr.addEventListener('click',()=>showProductDetail(tr.dataset.productCode)))}
  function showProductDetail(code){const p=currentModel?.productByCode.get(code);if(!p)return;const modal=document.getElementById('detailModal'),content=document.getElementById('detailContent');content.innerHTML=`<div class="profile-head"><div><span class="eyebrow">FICHE PRODUIT</span><h2>${U().escapeHtml(p.designation)}</h2><p class="mono">${U().escapeHtml(p.code)}</p></div><div>${qualityPill(stockClass(p.stockStatus),stockLabel(p.stockStatus))}</div></div><div class="profile-kpis">${kpi('CA TTC',U().money(p.ca),`${p.tickets} tickets`)}${kpi('Marge',U().money(p.margin),p.marginRate!==null?U().percent(p.marginRate):'')}${kpi('Clients',U().integer(p.clients),p.repeatRate!==null?`${U().percent(p.repeatRate)} réacheteurs`:'')}${kpi('Stock',p.stock===null?'—':U().number(p.stock),p.coverageDays!==null?`${Math.max(0,p.coverageDays).toFixed(1)} j de couverture`:'couverture non calculable')}${kpi('Tendance 30 j',p.trend30===null?'—':`${p.trend30>=0?'+':''}${(p.trend30*100).toFixed(1)} %`,`${U().money(p.sale30)} vs ${U().money(p.prev30)}`)}</div><div class="grid-equal"><section class="panel"><h3>Classification</h3><div class="alert-list"><div class="alert-row good"><span class="alert-dot"></span><div><strong>${U().escapeHtml(p.rayon||'Non classé')}</strong><p>${U().escapeHtml(p.famille||'Famille non classée')} · ${U().escapeHtml(p.sousFamille||'sans sous-famille')}</p></div></div><div class="alert-row"><span class="alert-dot"></span><div><strong>Catalogue actuel</strong><p>${p.current?`Présent · fournisseur ${U().escapeHtml(p.supplier||'non renseigné')} · prix catalogue ${U().money(p.currentPrice)}`:'Référence absente du catalogue courant.'}</p></div></div></div></section><section class="panel"><h3>Vitesse & rotation</h3><div class="quality-grid"><div class="quality-card"><span>Qté 30 j</span><strong>${U().number(p.qty30)}</strong></div><div class="quality-card"><span>Qté 90 j</span><strong>${U().number(p.qty90)}</strong></div><div class="quality-card"><span>Vitesse</span><strong>${p.velocity30.toFixed(2)}/j</strong></div><div class="quality-card"><span>Prix moyen observé</span><strong>${p.avgUnitPrice!==null?U().money(p.avgUnitPrice):'—'}</strong></div></div></section></div>`;modal.classList.remove('hidden')}

  function rayonsView(model, root){root.innerHTML=viewHeader('Rayons & familles','Performance commerciale, marge, clientèle et tendance récente')+`<div class="grid-equal"><section class="panel"><h2>Poids des rayons</h2>${bars(model.rayons,r=>Math.max(0,r.ca),r=>r.rayon,U().money,15)}</section><section class="panel"><h2>Tendance 30 jours</h2><div class="data-table-wrap"><table class="data-table"><thead><tr><th>Rayon</th><th class="numeric">30 j</th><th class="numeric">30 j précédents</th><th class="numeric">Évolution</th></tr></thead><tbody>${model.rayons.map(r=>`<tr><td>${U().escapeHtml(r.rayon)}</td><td class="numeric">${U().money(r.ca30)}</td><td class="numeric">${U().money(r.prev30)}</td><td class="numeric">${r.trend30===null?'—':deltaText(r.trend30)}</td></tr>`).join('')}</tbody></table></div></section></div><section class="panel section-gap"><h2>Détail familles</h2><div class="data-table-wrap"><table class="data-table"><thead><tr><th>Rayon</th><th>Famille</th><th class="numeric">CA TTC</th><th class="numeric">Marge</th><th class="numeric">Taux marge/HT</th><th class="numeric">Tickets</th><th class="numeric">Clients</th><th class="numeric">Produits</th></tr></thead><tbody>${model.families.map(f=>`<tr><td>${U().escapeHtml(f.rayon)}</td><td><strong>${U().escapeHtml(f.famille)}</strong></td><td class="numeric">${U().money(f.ca)}</td><td class="numeric">${U().money(f.margin)}</td><td class="numeric">${f.marginRate!==null?U().percent(f.marginRate):'—'}</td><td class="numeric">${f.tickets}</td><td class="numeric">${f.clients}</td><td class="numeric">${f.products}</td></tr>`).join('')}</tbody></table></div></section>`}

  function stockView(model, root){root.innerHTML=viewHeader('Stock','Couverture calculée à partir des ventes récentes et du catalogue courant',`<button class="btn" id="exportStock">Exporter CSV</button>`)+`<div class="kpi-grid">${kpi('Stock négatif',model.products.filter(p=>p.stockStatus==='negative').length)}${kpi('Ruptures actives',model.products.filter(p=>p.stockStatus==='out').length)}${kpi('Critique <7 jours',model.products.filter(p=>p.stockStatus==='critical').length)}${kpi('Faible <21 jours',model.products.filter(p=>p.stockStatus==='low').length)}${kpi('Dormant 90 jours',model.products.filter(p=>p.stockStatus==='dormant').length)}${kpi('Références historiques',model.products.filter(p=>p.stock===null).length)}</div><section class="panel"><div class="table-tools"><input id="stockSearch" class="search-input" placeholder="Produit ou code…"><select id="stockFilter" class="select-input"><option value="">Tous les statuts</option><option value="negative">Stock négatif</option><option value="out">Rupture</option><option value="critical">Critique</option><option value="low">Faible</option><option value="dormant">Dormant</option><option value="ok">OK</option><option value="unknown">Historique / absent catalogue</option></select><span id="stockCount" class="pill muted"></span></div><div id="stockTable"></div></section>`;const search=root.querySelector('#stockSearch'),filter=root.querySelector('#stockFilter'),table=root.querySelector('#stockTable');function draw(){const q=U().normText(search.value);let rows=model.products.filter(p=>(!filter.value||p.stockStatus===filter.value)&&(!q||U().normText(`${p.designation} ${p.code}`).includes(q)));rows.sort((a,b)=>{const order={negative:0,out:1,critical:2,low:3,dormant:4,ok:5,unknown:6};return(order[a.stockStatus]-order[b.stockStatus])||(b.qty30-a.qty30)});root.querySelector('#stockCount').textContent=`${rows.length} référence(s)`;table.innerHTML=productTable(rows.slice(0,300));bindProductRows(table)}search.addEventListener('input',draw);filter.addEventListener('change',draw);draw();root.querySelector('#exportStock').addEventListener('click',()=>{const rows=model.products.map(p=>({'Code article':p.code,'Designation':p.designation,'Rayon':p.rayon,'Stock':p.stock??'','Statut':stockLabel(p.stockStatus),'Ventes qte 30j':p.qty30,'Ventes qte 90j':p.qty90,'Vitesse/jour':p.velocity30.toFixed(4),'Couverture jours':p.coverageDays??''}));U().downloadText('analysis-ultimate-stock.csv',U().toCsv(rows),'text/csv;charset=utf-8')})}

  function calendarView(model, root){const monthly=[...U().groupBy(model.daily,d=>d.monthKey).entries()].map(([month,days])=>({month,ca:U().sum(days.map(d=>d.caTTC)),tickets:U().sum(days.map(d=>d.tickets)),activeDays:days.length,avgDay:days.length?U().sum(days.map(d=>d.caTTC))/days.length:0,holidayDays:days.filter(d=>d.isSchoolHoliday).length})).sort((a,b)=>a.month.localeCompare(b.month));root.innerHTML=viewHeader('Périodes & vacances','Calendrier scolaire Zone A intégré pour Clermont-Ferrand ; comparaison normalisée par jours actifs')+holidaySummary(model)+`<div class="grid-equal section-gap"><section class="panel"><h2>CA mensuel</h2>${bars(monthly,m=>m.ca,m=>m.month,U().money,18)}</section><section class="panel"><h2>Mois et jours actifs</h2><div class="data-table-wrap"><table class="data-table"><thead><tr><th>Mois</th><th class="numeric">CA</th><th class="numeric">Tickets</th><th class="numeric">Jours actifs</th><th class="numeric">CA/jour</th><th class="numeric">Jours vacances</th></tr></thead><tbody>${monthly.map(m=>`<tr><td>${m.month}</td><td class="numeric">${U().money(m.ca)}</td><td class="numeric">${m.tickets}</td><td class="numeric">${m.activeDays}</td><td class="numeric">${U().money(m.avgDay)}</td><td class="numeric">${m.holidayDays}</td></tr>`).join('')}</tbody></table></div></section></div><section class="panel section-gap"><h2>Journal quotidien</h2><div class="data-table-wrap"><table class="data-table"><thead><tr><th>Date</th><th>Période</th><th class="numeric">CA TTC</th><th class="numeric">Tickets</th><th class="numeric">Panier</th></tr></thead><tbody>${model.daily.slice().reverse().slice(0,250).map(d=>`<tr><td>${U().formatDate(d.date)}</td><td>${d.schoolHoliday?qualityPill('info',d.schoolHoliday):d.publicHoliday?qualityPill('warn',d.publicHoliday):'<span class="muted">Hors vacances</span>'}</td><td class="numeric">${U().money(d.caTTC)}</td><td class="numeric">${d.tickets}</td><td class="numeric">${U().money(d.avgBasket)}</td></tr>`).join('')}</tbody></table></div><div class="panel-sub" style="margin-top:8px">Les périodes scolaires ne sont classées que lorsque la date figure dans le calendrier Zone A intégré. Aucune période inconnue n’est inventée.</div></section>`}

  function associationsView(model,root){const name=code=>model.productByCode.get(code)?.designation||code;root.innerHTML=viewHeader('Paniers associés','Associations calculées au niveau ticket : support, confiance et lift')+`<section class="panel"><div class="panel-sub" style="margin-bottom:12px">Le lift supérieur à 1 indique que deux produits apparaissent ensemble plus souvent que ne le laisserait attendre leur fréquence individuelle. Ce n’est pas une preuve de causalité.</div><div class="data-table-wrap"><table class="data-table"><thead><tr><th>Produit A</th><th>Produit B</th><th class="numeric">Tickets ensemble</th><th class="numeric">Support</th><th class="numeric">A → B</th><th class="numeric">B → A</th><th class="numeric">Lift</th></tr></thead><tbody>${model.associations.map(a=>`<tr><td>${U().escapeHtml(name(a.a))}</td><td>${U().escapeHtml(name(a.b))}</td><td class="numeric">${a.count}</td><td class="numeric">${U().percent(a.support)}</td><td class="numeric">${U().percent(a.confidenceAB)}</td><td class="numeric">${U().percent(a.confidenceBA)}</td><td class="numeric"><strong>${a.lift.toFixed(2)}</strong></td></tr>`).join('')||'<tr><td colspan="7">Pas assez de co-occurrences.</td></tr>'}</tbody></table></div></section>`}

  function compareView(model,root){const ref=U().dateKey(model.range.max),aStart=U().dateKey(U().addDays(model.range.max,-29)),bEnd=U().dateKey(U().addDays(model.range.max,-30)),bStart=U().dateKey(U().addDays(model.range.max,-59));root.innerHTML=viewHeader('Comparateur de périodes','Compare deux périodes arbitraires avec les mêmes règles de calcul')+`<section class="panel"><div class="compare-grid"><div class="compare-box"><h3>Période A</h3><div class="date-row"><input id="fromA" type="date" class="date-input" value="${aStart}"><input id="toA" type="date" class="date-input" value="${ref}"></div></div><div class="vs">VS</div><div class="compare-box"><h3>Période B</h3><div class="date-row"><input id="fromB" type="date" class="date-input" value="${bStart}"><input id="toB" type="date" class="date-input" value="${bEnd}"></div></div></div><div style="margin-top:12px"><button id="runCompare" class="btn btn-primary">Comparer</button></div><div id="compareResults"></div></section>`;function parse(id){const v=root.querySelector(id).value;return v?new Date(v+'T00:00:00'):null}function draw(){const r=AU.analytics.periodComparison(model,parse('#fromA'),parse('#toA'),parse('#fromB'),parse('#toB'));root.querySelector('#compareResults').innerHTML=`<div class="comparison-results">${comparisonCard('CA TTC',r.A.caTTC,r.B.caTTC,r.deltas.caTTC,U().money)}${comparisonCard('Tickets',r.A.tickets,r.B.tickets,r.deltas.tickets,U().integer)}${comparisonCard('Clients',r.A.clients,r.B.clients,r.deltas.clients,U().integer)}${comparisonCard('Panier moyen',r.A.avgBasket,r.B.avgBasket,r.deltas.avgBasket,U().money)}${comparisonCard('Marge',r.A.margin,r.B.margin,r.deltas.margin,U().money)}${comparisonCard('Quantités',r.A.qty,r.B.qty,r.deltas.qty,U().number)}${comparisonCard('Jours actifs',r.A.activeDays,r.B.activeDays,U().pctChange(r.A.activeDays,r.B.activeDays),U().integer)}${comparisonCard('CA / jour actif',r.A.avgPerActiveDay,r.B.avgPerActiveDay,r.deltas.avgPerActiveDay,U().money)}</div>`}root.querySelector('#runCompare').addEventListener('click',draw);draw()}
  function comparisonCard(label,a,b,d,fmt){return`<div class="comparison-card"><span>${U().escapeHtml(label)}</span><strong>${fmt(a)}</strong><small>${deltaText(d)}</small><div class="panel-sub">B : ${fmt(b)}</div></div>`}

  function qualityView(model,root){const q=model.quality;const c=q.matchCounts,cat=q.catalogCounts;root.innerHTML=viewHeader('Qualité & traçabilité','Audit complet des imports et du croisement — aucune ambiguïté n’est masquée')+`<div class="quality-grid"><div class="quality-card"><span>Transactions certifiées client</span><strong>${U().percent(q.clientCertifiedCoverage)}</strong><span>${c.certified} / ${model.transactions.length}</span></div><div class="quality-card"><span>Rattachement client total</span><strong>${U().percent(q.clientAnyCoverage)}</strong><span>inclut ${c.probable} probable(s)</span></div><div class="quality-card"><span>Couverture catalogue</span><strong>${U().percent(q.catalogueCoverage)}</strong><span>${cat.missing} ligne(s) manquante(s)</span></div><div class="quality-card"><span>Intégrité financière</span><strong>${q.financialIntegrity===null?'—':U().percent(q.financialIntegrity)}</strong><span>HT − achat = marge</span></div></div><div class="grid-equal section-gap"><section class="panel"><h2>Rattachement clients</h2><div class="alert-list"><div class="alert-row good"><span class="alert-dot"></span><div><strong>${c.certified} certifiées</strong><p>Identifiant fort exact et unique ou combinaison concordante.</p></div></div><div class="alert-row"><span class="alert-dot"></span><div><strong>${c.probable} probables</strong><p>Nom exact et unique uniquement ; jamais présenté comme certifié.</p></div></div><div class="alert-row"><span class="alert-dot"></span><div><strong>${c.anonymous} anonymes</strong><p>Aucune identité exploitable dans la vente.</p></div></div><div class="alert-row ${c.conflict?'bad':''}"><span class="alert-dot"></span><div><strong>${c.conflict} conflits</strong><p>Des identifiants forts pointent vers plusieurs fiches ; l’analyse doit être bloquée si cela arrive.</p></div></div></div></section><section class="panel"><h2>Rattachement catalogue</h2><div class="alert-list"><div class="alert-row good"><span class="alert-dot"></span><div><strong>${cat.exact} lignes exactes</strong><p>Code article strictement identique.</p></div></div><div class="alert-row good"><span class="alert-dot"></span><div><strong>${cat.normalized} lignes normalisées</strong><p>Différence de zéros initiaux uniquement et correspondance catalogue unique.</p></div></div><div class="alert-row"><span class="alert-dot"></span><div><strong>${cat.missing} lignes historiques absentes</strong><p>${U().money(q.missingCatalogCA)} de CA historique concerné.</p></div></div><div class="alert-row"><span class="alert-dot"></span><div><strong>${q.missingCategoryLines} lignes sans rayon final</strong><p>Ces lignes ne sont pas attribuées artificiellement à une catégorie.</p></div></div></div></section></div><section class="panel section-gap"><h2>Imports</h2>${importAudit(model)}</section><section class="panel section-gap"><h2>Règles de confiance</h2><div class="alert-list"><div class="alert-row good"><span class="alert-dot"></span><div><strong>Certifié</strong><p>Donnée source exacte ou calcul déterministe à partir de données contrôlées.</p></div></div><div class="alert-row"><span class="alert-dot"></span><div><strong>Partiel</strong><p>Le calcul est exact sur la couverture disponible, mais une partie des données n’est pas rattachable.</p></div></div><div class="alert-row"><span class="alert-dot"></span><div><strong>Estimation / signal</strong><p>Indicateur statistique ou explication possible. Ne doit jamais être formulé comme une cause certaine.</p></div></div><div class="alert-row bad"><span class="alert-dot"></span><div><strong>Blocage</strong><p>Conflit structurel ou identifiants contradictoires : Analysis Ultimate refuse de poursuivre silencieusement.</p></div></div></div></section>`}

  function importAudit(model){const ventes=Array.isArray(model.imports.ventes)?model.imports.ventes:[model.imports.ventes].filter(Boolean);const imports=[model.imports.clients,...ventes,model.imports.catalogue].filter(Boolean);return`<div class="data-table-wrap"><table class="data-table"><thead><tr><th>Source</th><th>Fichier</th><th class="numeric">Lignes</th><th>État</th><th>Avertissements</th></tr></thead><tbody>${imports.map(i=>`<tr><td>${U().escapeHtml(AU.FILE_RULES[i.type]?.label||i.type)}</td><td>${U().escapeHtml(i.fileName)}</td><td class="numeric">${U().integer(i.rowCount)}</td><td>${qualityPill(i.ok?'certified':'blocked',i.ok?'Validé':'Refusé')}</td><td>${U().escapeHtml((i.report?.warnings||[]).join(' · ')||'Aucun')}</td></tr>`).join('')}</tbody></table></div><div class="panel-sub" style="margin-top:8px">Chevauchements Ventes exacts ignorés : ${model.salesMerge.duplicateTransactions.length}. Conflits Ventes : ${model.salesMerge.conflicts.length}.</div>`}

  function alertsView(model, root) {
    const high = model.customers.filter(c => c.risk.key === 'high').sort((a,b)=>b.estimatedMonthlyValue-a.estimatedMonthlyValue);
    const signaled = high.filter(c => c.signals.length);
    const unavailableFavorite = high.filter(c => c.signals.some(s => s.type === 'catalogue' || s.type === 'stock'));
    const stock = model.products.filter(p => ['negative','out','critical'].includes(p.stockStatus) && p.qty30 > 0).sort((a,b)=>b.qty30-a.qty30);
    root.innerHTML = viewHeader('Alertes & opportunités','Priorités calculées à partir des habitudes observées ; les causes restent des signaux, jamais des certitudes') +
      `<div class="kpi-grid">${kpi('Risque élevé',high.length,'clients réguliers')}${kpi('Avec signal explicatif',signaled.length,'au moins un signal détecté')}${kpi('Produit favori indisponible',unavailableFavorite.length,'catalogue absent ou stock actuel ≤ 0')}${kpi('Stock actif sous tension',stock.length,'vendu sur les 30 derniers jours')}${kpi('Valeur mensuelle à risque',U().money(U().sum(high.map(c=>c.estimatedMonthlyValue))),'estimation historique')}${kpi('Clients à surveiller',model.customers.filter(c=>c.risk.key==='watch').length,'avant risque élevé')}</div>
      <div class="grid-2"><section class="panel"><div class="panel-title"><h2>Clients prioritaires</h2><span class="panel-sub">Valeur mensuelle estimée décroissante</span></div>${riskTable(high.slice(0,40))}</section><section class="panel"><div class="panel-title"><h2>Raisons possibles à investiguer</h2><span class="panel-sub">Signaux vérifiables en boutique</span></div><div class="signal-list">${signaled.slice(0,20).map(c=>`<div class="signal" data-client-code="${U().escapeHtml(c.client.codeClient)}"><strong>${U().escapeHtml(c.client.name)}</strong> · ${U().escapeHtml(c.signals[0].text)}<div class="quality-tag">${c.signals[0].quality} · cliquer pour la fiche</div></div>`).join('')||'<div class="empty-mini">Aucun signal exploitable.</div>'}</div></section></div>
      <section class="panel section-gap"><div class="panel-title"><h2>Références à sécuriser</h2><span class="panel-sub">Stock actuel confronté à la vitesse récente</span></div>${productTable(stock.slice(0,80))}</section>`;
    bindClientRows(root); bindProductRows(root);
  }

  function fidelityView(model, root) {
    const statusCounts = ['active','watch','risk','high'].map(key => ({key,count:model.customers.filter(c=>c.risk.key===key).length}));
    root.innerHTML = viewHeader('Fidélisation & zones','Cohortes basées sur le premier achat observé dans la période chargée, pas sur une date d’inscription supposée') +
      `<div class="kpi-grid">${kpi('Clients avec achats',model.customers.filter(c=>c.visitCount>0).length)}${kpi('Actifs',statusCounts.find(x=>x.key==='active').count)}${kpi('À surveiller',statusCounts.find(x=>x.key==='watch').count)}${kpi('Risque',statusCounts.find(x=>x.key==='risk').count)}${kpi('Risque élevé',statusCounts.find(x=>x.key==='high').count)}${kpi('Sans vente rattachée',model.customers.filter(c=>!c.visitCount).length)}</div>
      <section class="panel"><div class="panel-title"><h2>Cohortes de premier achat observé</h2><span class="panel-sub">M+N = part de la cohorte ayant au moins une visite dans le mois correspondant</span></div><div class="data-table-wrap"><table class="data-table"><thead><tr><th>Cohorte</th><th class="numeric">Clients</th><th class="numeric">CA cumulé</th><th class="numeric">M0</th><th class="numeric">M+1</th><th class="numeric">M+2</th><th class="numeric">M+3</th><th class="numeric">M+4</th><th class="numeric">M+5</th><th class="numeric">M+6</th></tr></thead><tbody>${model.cohorts.map(c=>`<tr><td><strong>${c.cohort}</strong></td><td class="numeric">${c.size}</td><td class="numeric">${U().money(c.totalSpend)}</td>${c.retention.map(r=>`<td class="numeric">${U().percent(r.rate)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>
      <div class="grid-equal section-gap"><section class="panel"><h2>Zones clientes par CA</h2>${bars(model.geography,r=>r.caTTC,r=>`${r.postal} ${r.city}`,U().money,15)}</section><section class="panel"><h2>Détail géographique</h2><div class="data-table-wrap"><table class="data-table"><thead><tr><th>Zone</th><th class="numeric">CA</th><th class="numeric">Tickets</th><th class="numeric">Clients</th><th class="numeric">Panier</th></tr></thead><tbody>${model.geography.slice(0,80).map(g=>`<tr><td>${U().escapeHtml(`${g.postal} ${g.city}`)}</td><td class="numeric">${U().money(g.caTTC)}</td><td class="numeric">${g.tickets}</td><td class="numeric">${g.clients}</td><td class="numeric">${U().money(g.avgBasket)}</td></tr>`).join('')}</tbody></table></div><div class="panel-sub" style="margin-top:8px">Uniquement les transactions rattachées à une fiche client avec ville ou code postal exploitable.</div></section></div>`;
  }

  function salesforceView(model, root) {
    const d = model.discountAnalysis;
    root.innerHTML = viewHeader('Vendeurs & remises','Lecture commerciale brute : aucune correction par nombre d’heures travaillées n’est possible sans planning') +
      `<div class="kpi-grid">${kpi('Tickets remisés',d.discounted.tickets,`${U().percent(d.discountedShare)} des tickets`)}${kpi('Montant remises',U().money(d.discountAmount))}${kpi('Panier avec remise',U().money(d.discounted.avgBasket))}${kpi('Panier sans remise',U().money(d.fullPrice.avgBasket))}${kpi('CA avec remise',U().money(d.discounted.caTTC))}${kpi('CA sans remise',U().money(d.fullPrice.caTTC))}</div>
      <section class="panel"><div class="panel-title"><h2>Performance par vendeur</h2><span class="panel-sub">À interpréter avec le temps de présence et les créneaux, absents des extractions actuelles</span></div><div class="data-table-wrap"><table class="data-table"><thead><tr><th>Vendeur</th><th class="numeric">CA TTC</th><th class="numeric">Tickets</th><th class="numeric">Panier</th><th class="numeric">Marge</th><th class="numeric">Clients</th><th class="numeric">Tickets remisés</th><th class="numeric">Part remisée</th><th class="numeric">Remises €</th></tr></thead><tbody>${model.vendors.map(v=>`<tr><td><strong>${U().escapeHtml(v.vendor)}</strong></td><td class="numeric">${U().money(v.caTTC)}</td><td class="numeric">${v.tickets}</td><td class="numeric">${U().money(v.avgBasket)}</td><td class="numeric">${U().money(v.margin)}</td><td class="numeric">${v.clients}</td><td class="numeric">${v.discountedTickets}</td><td class="numeric">${U().percent(v.discountedShare)}</td><td class="numeric">${U().money(v.discount)}</td></tr>`).join('')}</tbody></table></div></section>`;
  }

  function intelligenceView(model, root) {
    const intel = model.intelligence;
    if (!intel) {
      root.innerHTML = viewHeader('Diagnostic autonome','Le moteur d’intelligence n’a pas pu être initialisé.') + '<div class="empty-mini">Aucun diagnostic disponible.</div>';
      return;
    }
    const findings = intel.findings.filter(f=>f.category!=='quality');
    const critical = findings.filter(f=>['critical','warning'].includes(f.level)).length;
    const opportunities = findings.filter(f=>['opportunity','positive'].includes(f.level)).length;
    const highRisk = intel.watchlists.highRisk;
    const stock = intel.watchlists.stock;
    root.innerHTML = viewHeader('Diagnostic autonome', `Analyse générée automatiquement à partir de ${U().integer(model.transactions.length)} transactions · aucune question préalable nécessaire`, `<span class="pill good">Moteur local explicable</span>`) +
      executiveHero(model) +
      `<div class="kpi-grid section-gap">
        ${kpi('Diagnostics', U().integer(findings.length), `${critical} prioritaires`)}
        ${kpi('Opportunités', U().integer(opportunities), 'signaux positifs exploitables')}
        ${kpi('Clients risque élevé', U().integer(highRisk.length), U().money(U().sum(highRisk.map(c=>c.estimatedMonthlyValue)))+' / mois estimés')}
        ${kpi('Stock sensible', U().integer(stock.length), 'références actives')}
        ${kpi('Couverture clients certifiée', U().percent(model.quality.clientCertifiedCoverage))}
        ${kpi('Couverture catalogue', U().percent(model.quality.catalogueCoverage))}
      </div>
      <div class="grid-intelligence section-gap">
        <section class="panel intelligence-main"><div class="panel-title"><div><h2>Conclusions autonomes</h2><div class="panel-sub">Faits et hypothèses restent séparés. Les diagnostics sont triés par impact et confiance.</div></div><select id="intelFilter" class="select-input"><option value="">Tout afficher</option><option value="critical">Critique</option><option value="warning">Important</option><option value="opportunity">Opportunités</option><option value="positive">Positif</option><option value="customer">Clients</option><option value="product">Produits</option><option value="stock">Stock</option><option value="margin">Marge</option><option value="calendar">Calendrier</option></select></div><div id="intelFindings" class="intel-finding-list"></div></section>
        <aside class="intel-side">
          <section class="panel"><div class="panel-title"><h2>Actions prioritaires</h2><span class="panel-sub">Issues des diagnostics</span></div><ol class="action-list">${intel.actions.slice(0,10).map(a=>`<li><span class="action-level ${a.level}"></span><div><strong>${U().escapeHtml(a.action)}</strong><small>${U().escapeHtml(a.sourceTitle)} · confiance ${a.confidence} %</small></div></li>`).join('') || '<li>Aucune action prioritaire.</li>'}</ol></section>
          <section class="panel section-gap"><div class="panel-title"><h2>Décomposition du CA</h2><span class="panel-sub">Identité arithmétique exacte</span></div><div class="decomposition"><div><span>Effet tickets</span><strong class="${intel.metrics.decomposition.trafficEffect<0?'negative':'positive'}">${intel.metrics.decomposition.trafficEffect>=0?'+':''}${U().money(intel.metrics.decomposition.trafficEffect)}</strong></div><div><span>Effet panier</span><strong class="${intel.metrics.decomposition.basketEffect<0?'negative':'positive'}">${intel.metrics.decomposition.basketEffect>=0?'+':''}${U().money(intel.metrics.decomposition.basketEffect)}</strong></div><div><span>Variation totale</span><strong>${intel.metrics.decomposition.totalDelta>=0?'+':''}${U().money(intel.metrics.decomposition.totalDelta)}</strong></div></div></section>
        </aside>
      </div>
      ${askPanel(model)}
      <div class="grid-equal section-gap">
        <section class="panel"><div class="panel-title"><h2>Clients les plus prioritaires</h2><span class="panel-sub">Risque individuel × valeur historique</span></div>${riskTable(highRisk.slice(0,15))}</section>
        <section class="panel"><div class="panel-title"><h2>Stock à sécuriser</h2><span class="panel-sub">Vitesse 30 jours et couverture</span></div>${productTable(stock.slice(0,15))}</section>
      </div>`;

    const filter = root.querySelector('#intelFilter');
    const list = root.querySelector('#intelFindings');
    const draw = () => {
      const f = filter.value;
      const rows = findings.filter(x => !f || x.level === f || x.category === f);
      list.innerHTML = rows.map(x=>findingCard(x,false)).join('') || '<div class="empty-mini">Aucun diagnostic dans ce filtre.</div>';
    };
    filter.addEventListener('change', draw); draw();
    bindAsk(model, root); bindClientRows(root); bindProductRows(root);
  }

  function render(view,model,root){currentModel=model;if(!model){return}const views={dashboard,intelligence:intelligenceView,clients:clientsView,alerts:alertsView,fidelity:fidelityView,products:productsView,rayons:rayonsView,stock:stockView,salesforce:salesforceView,calendar:calendarView,associations:associationsView,compare:compareView,quality:qualityView};(views[view]||dashboard)(model,root)}
  function closeDetail(){document.getElementById('detailModal')?.classList.add('hidden')}
  function toast(message,type='good'){const root=document.getElementById('toastRoot');const el=document.createElement('div');el.className=`toast ${type}`;el.textContent=message;root.appendChild(el);setTimeout(()=>el.remove(),4500)}

  return {render,showClientDetail,showProductDetail,closeDetail,toast};
})();
