window.AU = window.AU || {};

AU.storage = (() => {
  const DB_NAME = 'analysis-ultimate-db';
  const DB_VERSION = 1;
  let dbPromise = null;

  function openDb() {
    if (!('indexedDB' in window)) return Promise.reject(new Error('IndexedDB indisponible dans ce navigateur.'));
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('state')) db.createObjectStore('state');
        if (!db.objectStoreNames.contains('snapshots')) db.createObjectStore('snapshots', { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  async function put(store, key, value) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      const os = tx.objectStore(store);
      const req = key === undefined ? os.put(value) : os.put(value, key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function get(store, key) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async function getAll(store) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async function clearStore(store) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      const req = tx.objectStore(store).clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async function saveSession(session) {
    return put('state', 'latestSession', { ...session, savedAt: new Date() });
  }

  async function loadSession() {
    return get('state', 'latestSession');
  }

  async function saveStockSnapshot(catalogueImport) {
    if (!catalogueImport?.ok) return;
    const day = AU.util.dateKey(catalogueImport.importedAt || new Date());
    const id = `${day}|${catalogueImport.fileName}|${catalogueImport.sourceLastModified?.getTime?.() || ''}`;
    const existing = await get('snapshots', id);
    if (existing) return;
    await put('snapshots', undefined, {
      id,
      capturedAt: catalogueImport.importedAt || new Date(),
      sourceFile: catalogueImport.fileName,
      sourceLastModified: catalogueImport.sourceLastModified || null,
      items: catalogueImport.normalized.map(x => ({ articleCode: x.articleCode, stock: x.stock, saleTTC: x.saleTTC, rayon: x.rayon, famille: x.famille }))
    });
  }

  async function listStockSnapshots() {
    const rows = await getAll('snapshots');
    return rows.sort((a, b) => new Date(a.capturedAt) - new Date(b.capturedAt));
  }

  async function clearAll() {
    await Promise.all([clearStore('state'), clearStore('snapshots')]);
  }

  return { saveSession, loadSession, saveStockSnapshot, listStockSnapshots, clearAll };
})();
