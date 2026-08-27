window.AU = window.AU || {};

AU.importer = (() => {
  const U = () => AU.util;

  function canonicalHeaders(row) {
    const out = {};
    for (const [key, value] of Object.entries(row || {})) {
      const clean = U().cleanText(key);
      if (clean) out[clean] = value;
    }
    return out;
  }

  function validateColumns(type, rows, parseErrors = []) {
    const rule = AU.FILE_RULES[type];
    const columns = rows.length ? Object.keys(rows[0]).map(U().cleanText) : [];
    const missingRequired = rule.required.filter(c => !columns.includes(c));
    const missingRecommended = rule.recommended.filter(c => !columns.includes(c));
    const errors = [];
    const warnings = [];

    if (!rows.length) errors.push('Le fichier ne contient aucune ligne exploitable.');
    if (missingRequired.length) errors.push(`Colonnes obligatoires manquantes : ${missingRequired.join(', ')}.`);
    if (missingRecommended.length) warnings.push(`Colonnes recommandées absentes : ${missingRecommended.join(', ')}.`);
    if (parseErrors.length) {
      const serious = parseErrors.filter(e => e && e.code !== 'TooFewFields');
      if (serious.length) warnings.push(`${serious.length} avertissement(s) de parsing CSV détecté(s).`);
    }

    return { columns, missingRequired, missingRecommended, errors, warnings };
  }

  function validateRows(type, rows, report) {
    const errors = report.errors;
    const warnings = report.warnings;
    const metrics = {};

    if (type === 'clients') {
      const codes = rows.map(r => U().cleanText(r['Code client'])).filter(Boolean);
      const unique = new Set(codes);
      metrics.nonEmptyCodes = codes.length;
      metrics.uniqueCodes = unique.size;
      metrics.duplicateCodes = codes.length - unique.size;
      metrics.emailCoverage = rows.length ? rows.filter(r => U().normEmail(r['E-mail'])).length / rows.length : 0;
      metrics.phoneCoverage = rows.length ? rows.filter(r => U().normPhone(r['Telephone'])).length / rows.length : 0;
      if (codes.length !== rows.length) errors.push(`${rows.length - codes.length} fiche(s) client sans Code client.`);
      if (metrics.duplicateCodes > 0) errors.push(`${metrics.duplicateCodes} Code(s) client dupliqué(s). Le croisement est bloqué.`);
    }

    if (type === 'ventes') {
      let invalidDates = 0;
      let invalidArticle = 0;
      let financialMismatch = 0;
      let financialChecked = 0;
      for (const r of rows) {
        if (!U().parseTgmDate(r.Date)) invalidDates++;
        if (!U().normArticleCode(r['Code article'])) invalidArticle++;
        const ht = U().toNullableNumber(r['Vente HT']);
        const cost = U().toNullableNumber(r['Achat HT']);
        const margin = U().toNullableNumber(r.Marge);
        if (ht !== null && cost !== null && margin !== null) {
          financialChecked++;
          if (Math.abs((ht - cost) - margin) > 0.03) financialMismatch++;
        }
      }
      metrics.invalidDates = invalidDates;
      metrics.invalidArticleCodes = invalidArticle;
      metrics.financialChecked = financialChecked;
      metrics.financialMismatch = financialMismatch;
      metrics.financialIntegrity = financialChecked ? 1 - financialMismatch / financialChecked : null;
      if (invalidDates > 0) errors.push(`${invalidDates} ligne(s) de vente avec date invalide.`);
      if (invalidArticle > 0) errors.push(`${invalidArticle} ligne(s) de vente sans Code article.`);
      if (financialMismatch > 0) warnings.push(`${financialMismatch} ligne(s) ont une différence > 0,03 € entre Vente HT - Achat HT et Marge.`);
    }

    if (type === 'catalogue') {
      const codes = rows.map(r => U().normArticleCode(r['Code article'])).filter(Boolean);
      const unique = new Set(codes);
      metrics.nonEmptyCodes = codes.length;
      metrics.uniqueCodes = unique.size;
      metrics.duplicateCodes = codes.length - unique.size;
      metrics.zeroStock = rows.filter(r => U().toNumber(r.Stock) === 0).length;
      metrics.negativeStock = rows.filter(r => U().toNumber(r.Stock) < 0).length;
      if (codes.length !== rows.length) errors.push(`${rows.length - codes.length} article(s) sans Code article.`);
      if (metrics.duplicateCodes > 0) errors.push(`${metrics.duplicateCodes} Code(s) article dupliqué(s) dans le catalogue.`);
      if (metrics.negativeStock > 0) warnings.push(`${metrics.negativeStock} référence(s) avec stock négatif.`);
    }

    return metrics;
  }

  async function parseExcel(file, onProgress) {
    if (!window.XLSX) throw new Error('Le moteur XLSX n’est pas chargé. Vérifiez la connexion Internet lors du premier lancement.');
    onProgress?.(10, 'Lecture du classeur…');
    const buffer = await file.arrayBuffer();
    onProgress?.(45, 'Décodage Excel…');
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: false, dense: false });
    if (!workbook.SheetNames.length) throw new Error('Le classeur ne contient aucune feuille.');
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: '', raw: false, blankrows: false });
    onProgress?.(90, 'Validation des colonnes…');
    return { rows: rows.map(canonicalHeaders), sheetName: workbook.SheetNames[0], parseErrors: [] };
  }

  function parseCsv(file, onProgress) {
    return new Promise((resolve, reject) => {
      if (!window.Papa) {
        reject(new Error('Le moteur CSV n’est pas chargé. Vérifiez la connexion Internet lors du premier lancement.'));
        return;
      }
      const rows = [];
      const errors = [];
      let seen = 0;
      Papa.parse(file, {
        header: true,
        skipEmptyLines: 'greedy',
        worker: true,
        dynamicTyping: false,
        transformHeader: h => U().cleanText(h),
        chunkSize: 1024 * 1024 * 2,
        chunk(results) {
          for (const r of results.data || []) rows.push(canonicalHeaders(r));
          if (results.errors?.length) errors.push(...results.errors);
          seen += results.data?.length || 0;
          const approx = file.size ? Math.min(88, 10 + Math.log10(Math.max(10, seen)) * 14) : 50;
          onProgress?.(approx, `${U().integer(seen)} lignes lues…`);
        },
        complete() {
          onProgress?.(92, 'Validation du CSV…');
          resolve({ rows, sheetName: null, parseErrors: errors });
        },
        error(err) { reject(err); }
      });
    });
  }

  function normalizeClient(r, idx) {
    return {
      _row: idx + 2,
      codeClient: U().cleanText(r['Code client']),
      identifiant: U().cleanText(r.Identifiant),
      civilite: U().cleanText(r['Etat civil']),
      name: U().cleanText(r['Nom prenom']),
      nameKey: U().normText(r['Nom prenom']),
      address1: U().cleanText(r['Adresse 1']),
      address2: U().cleanText(r['Adresse 2']),
      address3: U().cleanText(r['Adresse 3']),
      addressKey: U().normText(r['Adresse 1']),
      postal: U().normPostal(r['Code postal']),
      city: U().cleanText(r.Ville),
      cityKey: U().normText(r.Ville),
      country: U().cleanText(r.Pays),
      phone: U().cleanText(r.Telephone),
      phoneKey: U().normPhone(r.Telephone),
      email: U().cleanText(r['E-mail']),
      emailKey: U().normEmail(r['E-mail']),
      marketingConsent: U().cleanText(r['Comm. commerciale']),
      nonCommercialConsent: U().cleanText(r['Comm. non commerciale']),
      birthday: U().cleanText(r.Anniversaire),
      age: U().toNullableNumber(r.Age),
      profession: U().cleanText(r.Profession),
      alert: U().cleanText(r.Alerte),
      createdAt: U().parseTgmDate(r['Date creation']),
      creationStore: U().cleanText(r['Creation sur'])
    };
  }

  function normalizeSale(r, idx) {
    const date = U().parseTgmDate(r.Date);
    const articleCode = U().normArticleCode(r['Code article']);
    return {
      _row: idx + 2,
      date,
      dateKey: U().dateKey(date),
      saleNo: U().cleanText(r['Num. vente']),
      ticket: U().cleanText(r.Ticket),
      vendor: U().cleanText(r.Vendeur),
      clientType: U().cleanText(r['Type de client']),
      clientName: U().cleanText(r.Client),
      clientNameKey: U().normText(r.Client),
      clientAddress: U().cleanText(r['Adresse 1']),
      clientAddressKey: U().normText(r['Adresse 1']),
      clientPostal: U().normPostal(r['Code postal']),
      clientCity: U().cleanText(r.Ville),
      clientCityKey: U().normText(r.Ville),
      clientPhone: U().cleanText(r.Telephone),
      clientPhoneKey: U().normPhone(r.Telephone),
      clientEmail: U().cleanText(r['E-mail']),
      clientEmailKey: U().normEmail(r['E-mail']),
      articleCode,
      articleCodeLoose: U().looseArticleCode(articleCode),
      designation: U().cleanText(r.Designation),
      designationComplete: U().cleanText(r['Designation complete']),
      rayon: U().cleanText(r.Rayon),
      famille: U().cleanText(r.Famille),
      sousFamille: U().cleanText(r['Sous-famille']),
      isReturn: /oui/i.test(U().cleanText(r.Retour)) || U().toNumber(r.Quantite) < 0,
      qty: U().toNumber(r.Quantite),
      purchaseHT: U().toNumber(r['Achat HT']),
      margin: U().toNumber(r.Marge),
      saleHT: U().toNumber(r['Vente HT']),
      saleTTC: U().toNumber(r['Vente TTC']),
      discountPct: U().toNumber(r['% Remise']) / 100,
      discount: U().toNumber(r.Remise),
      comment: U().cleanText(r.Commentaire),
      invoice: U().cleanText(r.Facture),
      catalogSource: U().cleanText(r['Catalogue(s)']),
      period: U().periodMeta(date),
      transactionKey: ''
    };
  }

  function normalizeCatalogue(r, idx) {
    const articleCode = U().normArticleCode(r['Code article']);
    return {
      _row: idx + 2,
      articleCode,
      articleCodeLoose: U().looseArticleCode(articleCode),
      designation: U().cleanText(r.Designation),
      year: U().toNullableNumber(r.Annee),
      rayon: U().cleanText(r.Rayon),
      famille: U().cleanText(r.Famille),
      sousFamille: U().cleanText(r['Sous-famille']),
      type: U().cleanText(r.Type),
      supplier: U().cleanText(r.Fournisseur),
      stock: U().toNumber(r.Stock),
      saleHT: U().toNumber(r['Vente HT']),
      vat: U().toNumber(r.TVA),
      saleTTC: U().toNumber(r['Vente TTC']),
      createdAt: U().parseTgmDate(r['Date de creation']),
      modifiedAt: U().parseTgmDate(r['Derniere modification']),
      catalogSource: U().cleanText(r['Catalogue(s)'])
    };
  }

  function assignTransactionKeys(sales) {
    // TGM's Ticket is preferred; Num. vente + timestamp is a deterministic fallback.
    for (const line of sales) {
      const core = line.ticket || line.saleNo || 'SANS-ID';
      line.transactionKey = `${core}|${line.date ? line.date.getTime() : ''}`;
    }
  }

  function dateRange(rows, accessor) {
    const dates = rows.map(accessor).filter(d => d instanceof Date && !Number.isNaN(d));
    if (!dates.length) return { min: null, max: null };
    let min = dates[0], max = dates[0];
    for (const d of dates) {
      if (d < min) min = d;
      if (d > max) max = d;
    }
    return { min, max };
  }

  async function parseFile(type, file, onProgress) {
    if (!file) throw new Error('Aucun fichier sélectionné.');
    const rule = AU.FILE_RULES[type];
    if (!rule) throw new Error('Type de fichier inconnu.');
    const ext = U().cleanText(file.name).toLowerCase().split('.').pop();
    if (!rule.extensions.includes(ext)) throw new Error(`${rule.label} doit être au format ${rule.extensions.join(' / ').toUpperCase()}.`);

    onProgress?.(2, `Ouverture de ${file.name}…`);
    const parsed = type === 'ventes' ? await parseCsv(file, onProgress) : await parseExcel(file, onProgress);
    const baseReport = validateColumns(type, parsed.rows, parsed.parseErrors);
    if (!U().filenameMatches(file.name, type)) {
      baseReport.warnings.unshift(`Nom inattendu : « ${file.name} ». Le fichier a été placé manuellement dans la zone ${rule.label}, son contenu est donc contrôlé avant acceptation.`);
    }
    const metrics = validateRows(type, parsed.rows, baseReport);
    if (baseReport.errors.length) {
      return {
        ok: false, type, fileName: file.name, fileSize: file.size, rowCount: parsed.rows.length,
        sheetName: parsed.sheetName, report: { ...baseReport, metrics }, rows: null, normalized: null
      };
    }

    onProgress?.(96, 'Normalisation des données…');
    let normalized;
    if (type === 'clients') normalized = parsed.rows.map(normalizeClient);
    else if (type === 'ventes') {
      normalized = parsed.rows.map(normalizeSale);
      assignTransactionKeys(normalized);
      const range = dateRange(normalized, x => x.date);
      metrics.minDate = range.min;
      metrics.maxDate = range.max;
      metrics.transactionCount = new Set(normalized.map(x => x.transactionKey)).size;
      metrics.totalTTC = U().sum(normalized.map(x => x.saleTTC));
      metrics.totalHT = U().sum(normalized.map(x => x.saleHT));
      metrics.totalMargin = U().sum(normalized.map(x => x.margin));
      metrics.returnLines = normalized.filter(x => x.isReturn).length;
    } else normalized = parsed.rows.map(normalizeCatalogue);

    onProgress?.(100, 'Fichier validé.');
    return {
      ok: true, type, fileName: file.name, fileSize: file.size, rowCount: parsed.rows.length,
      sheetName: parsed.sheetName, report: { ...baseReport, metrics }, rows: null, normalized,
      importedAt: new Date(), sourceLastModified: file.lastModified ? new Date(file.lastModified) : null
    };
  }

  return { parseFile };
})();
