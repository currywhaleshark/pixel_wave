// ============================================================
// stage/persistence.js — 모바일 Stage 초안 IndexedDB 저장
// IndexedDB를 쓸 수 없는 환경에서는 localStorage로 안전하게 폴백한다.
// ============================================================
(function initStagePersistence(root) {
  'use strict';

  const DB_NAME = 'pixel-wave-stage-sequencer';
  const DB_VERSION = 1;
  const STORE_NAME = 'drafts';
  const LOCAL_PREFIX = 'pixel-wave-stage-draft:';

  function openDatabase() {
    return new Promise((resolve, reject) => {
      if (!root.indexedDB) {
        reject(new Error('IndexedDB unavailable'));
        return;
      }
      const request = root.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME, { keyPath: 'id' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('IndexedDB open failed'));
    });
  }

  async function useStore(mode, operation) {
    const database = await openDatabase();
    try {
      return await new Promise((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, mode);
        const request = operation(transaction.objectStore(STORE_NAME));
        let result = null;
        request.onsuccess = () => { result = request.result ?? null; };
        request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
        transaction.oncomplete = () => resolve(result);
        transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted'));
      });
    } finally {
      database.close();
    }
  }

  function localStorageValue(id, value) {
    if (!root.localStorage) throw new Error('localStorage unavailable');
    const key = `${LOCAL_PREFIX}${id}`;
    if (value === undefined) {
      const text = root.localStorage.getItem(key);
      return text ? JSON.parse(text) : null;
    }
    if (value === null) root.localStorage.removeItem(key);
    else root.localStorage.setItem(key, JSON.stringify(value));
    return value;
  }

  async function saveDraft(stage, metadata = {}) {
    const record = {
      id: stage.id,
      stage: JSON.parse(JSON.stringify(stage)),
      exportedHash: metadata.exportedHash || null,
      updatedAt: new Date().toISOString(),
    };
    try {
      await useStore('readwrite', store => store.put(record));
      try { localStorageValue(stage.id, null); } catch (_fallbackError) { /* 폴백 저장소 없음 */ }
      return { ...record, storage: 'indexeddb' };
    } catch (_error) {
      localStorageValue(stage.id, record);
      return { ...record, storage: 'localstorage' };
    }
  }

  async function loadDraft(id) {
    try {
      const record = await useStore('readonly', store => store.get(id));
      if (record) return record;
      try { return localStorageValue(id); } catch (_fallbackError) { return null; }
    } catch (_error) {
      try { return localStorageValue(id); } catch (_fallbackError) { return null; }
    }
  }

  async function deleteDraft(id) {
    try {
      await useStore('readwrite', store => store.delete(id));
    } catch (_error) { /* IndexedDB가 없으면 폴백만 지운다. */ }
    try { localStorageValue(id, null); } catch (_fallbackError) { /* 저장소 없음 */ }
  }

  const api = Object.freeze({ DB_NAME, STORE_NAME, saveDraft, loadDraft, deleteDraft });
  root.StagePersistence = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
