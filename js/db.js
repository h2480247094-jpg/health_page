const DB_NAME = 'HealthTracker';
const DB_VERSION = 2;
const STORE_NAME = 'health_records';

let _dbPromise = null;

function getDB() {
  if (!_dbPromise) {
    _dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
          store.createIndex('date', 'date', { unique: false });
        }
        if (!db.objectStoreNames.contains('skin_photos')) {
          const photoStore = db.createObjectStore('skin_photos', { keyPath: 'id', autoIncrement: true });
          photoStore.createIndex('date', 'date', { unique: false });
        }
      };
      request.onsuccess = (e) => resolve(e.target.result);
      request.onerror = (e) => {
        _dbPromise = null;
        reject(e.target.error);
      };
      request.onblocked = () => {
        _dbPromise = null;
      };
    });
  }
  return _dbPromise;
}

function withStore(mode) {
  return getDB().then(db => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    return { store, tx, db };
  });
}

async function addRecord(record) {
  const { store, tx } = await withStore('readwrite');
  return new Promise((resolve, reject) => {
    const data = { ...record, createdAt: Date.now() };
    const request = store.add(data);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function updateRecord(id, record) {
  const { store, tx } = await withStore('readwrite');
  return new Promise((resolve, reject) => {
    const request = store.get(id);
    request.onsuccess = () => {
      const existing = request.result;
      if (!existing) { reject(new Error('Record not found')); return; }
      const updated = { ...existing, ...record, id: existing.id, createdAt: existing.createdAt };
      const putReq = store.put(updated);
      putReq.onsuccess = () => resolve(putReq.result);
      putReq.onerror = () => reject(putReq.error);
    };
    request.onerror = () => reject(request.error);
  });
}

async function deleteRecord(id) {
  const { store, tx } = await withStore('readwrite');
  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function getAllRecords() {
  const { store, tx } = await withStore('readonly');
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getRecordsByDateRange(startDate, endDate) {
  const { store, tx } = await withStore('readonly');
  return new Promise((resolve, reject) => {
    const index = store.index('date');
    const range = IDBKeyRange.bound(startDate, endDate);
    const request = index.getAll(range);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getRecordById(id) {
  const { store, tx } = await withStore('readonly');
  return new Promise((resolve, reject) => {
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ===== Photo Store =====
function withPhotoStore(mode) {
  return getDB().then(db => {
    const tx = db.transaction('skin_photos', mode);
    const store = tx.objectStore('skin_photos');
    return { store, tx, db };
  });
}

async function addPhoto(photoData) {
  const { store, tx } = await withPhotoStore('readwrite');
  return new Promise((resolve, reject) => {
    const data = { ...photoData, createdAt: Date.now() };
    const request = store.add(data);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getAllPhotos() {
  const { store, tx } = await withPhotoStore('readonly');
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function deletePhoto(id) {
  const { store, tx } = await withPhotoStore('readwrite');
  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
