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
  const RECOVERY_PREFIX = 'pixel-wave-stage-recovery:';
  const CLIPBOARD_KEY = 'pixel-wave-stage-fragment';
  const TEMPLATE_KEY = 'pixel-wave-stage-section-template';
  const CURRENT_SCHEMA_VERSION = 1;

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function migrateStage(input) {
    const stage = clone(input);
    const from = Number(stage?.schemaVersion) || 0;
    if (!stage || typeof stage !== 'object') throw new Error('Stage JSON 객체가 필요합니다.');
    if (from > CURRENT_SCHEMA_VERSION) {
      throw new Error(`이 편집기보다 새로운 Stage 스키마 v${from}입니다. JSON 내보내기만 사용하세요.`);
    }
    const changes = [];
    if (from === 0) {
      stage.format ||= 'pixel-wave-stage';
      stage.schemaVersion = 1;
      stage.registryVersion ||= 1;
      stage.draft = stage.draft !== false;
      stage.dependencies ||= {};
      stage.items ||= [];
      for (const item of stage.items) {
        if (item.timing && !item.timing.domain) item.timing.domain = item.type === 'terrain-object' ? 'distance' : 'time';
      }
      changes.push('v0 문서에 format, schemaVersion, timing.domain 기본값을 추가했습니다.');
    }
    return { stage, from, to: CURRENT_SCHEMA_VERSION, migrated: changes.length > 0, changes };
  }

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
      revision: Number(metadata.revision) || 0,
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
    let persistent = null;
    try {
      const record = await useStore('readonly', store => store.get(id));
      persistent = record || null;
      if (!persistent) {
        try { persistent = localStorageValue(id); } catch (_fallbackError) { persistent = null; }
      }
    } catch (_error) {
      try { persistent = localStorageValue(id); } catch (_fallbackError) { persistent = null; }
    }
    const recovery = loadRecovery(id);
    if (!persistent) return recovery;
    if (!recovery) return persistent;
    return String(recovery.updatedAt || '') > String(persistent.updatedAt || '') ? recovery : persistent;
  }

  async function deleteDraft(id) {
    try {
      await useStore('readwrite', store => store.delete(id));
    } catch (_error) { /* IndexedDB가 없으면 폴백만 지운다. */ }
    try { localStorageValue(id, null); } catch (_fallbackError) { /* 저장소 없음 */ }
    deleteRecovery(id);
  }

  function saveRecovery(stage, metadata = {}) {
    if (!root.localStorage || !stage?.id) return null;
    const record = {
      id: stage.id,
      stage: clone(stage),
      exportedHash: metadata.exportedHash || null,
      revision: Number(metadata.revision) || 0,
      updatedAt: new Date().toISOString(),
      storage: 'recovery',
    };
    root.localStorage.setItem(`${RECOVERY_PREFIX}${stage.id}`, JSON.stringify(record));
    return record;
  }

  function loadRecovery(id) {
    try {
      const text = root.localStorage?.getItem(`${RECOVERY_PREFIX}${id}`);
      return text ? JSON.parse(text) : null;
    } catch (_error) { return null; }
  }

  function deleteRecovery(id) {
    try { root.localStorage?.removeItem(`${RECOVERY_PREFIX}${id}`); } catch (_error) { /* 선택 기능 */ }
  }

  function writePortable(key, value) {
    if (!root.localStorage) throw new Error('브라우저 로컬 저장소를 사용할 수 없습니다.');
    root.localStorage.setItem(key, JSON.stringify(value));
    return value;
  }

  function readPortable(key) {
    try {
      const text = root.localStorage?.getItem(key);
      return text ? JSON.parse(text) : null;
    } catch (_error) { return null; }
  }

  function saveClipboard(fragment) { return writePortable(CLIPBOARD_KEY, fragment); }
  function loadClipboard() { return readPortable(CLIPBOARD_KEY); }
  function saveTemplate(template) { return writePortable(TEMPLATE_KEY, template); }
  function loadTemplate() { return readPortable(TEMPLATE_KEY); }

  async function storageEstimate() {
    try {
      const estimate = await root.navigator?.storage?.estimate?.();
      return {
        supported: !!estimate,
        usage: Number(estimate?.usage) || 0,
        quota: Number(estimate?.quota) || 0,
        ratio: estimate?.quota ? estimate.usage / estimate.quota : 0,
      };
    } catch (_error) { return { supported: false, usage: 0, quota: 0, ratio: 0 }; }
  }

  function resolveSyncConflict(localRecord, remoteRecord) {
    if (!localRecord) return { winner: clone(remoteRecord), conflict: null };
    if (!remoteRecord) return { winner: clone(localRecord), conflict: null };
    const localRevision = Number(localRecord.revision) || 0;
    const remoteRevision = Number(remoteRecord.revision) || 0;
    if (localRecord.baseRevision === remoteRevision) return { winner: clone(localRecord), conflict: null };
    if (remoteRecord.baseRevision === localRevision) return { winner: clone(remoteRecord), conflict: null };
    return {
      winner: null,
      conflict: {
        id: localRecord.id || remoteRecord.id,
        local: clone(localRecord),
        remote: clone(remoteRecord),
        detectedAt: new Date().toISOString(),
      },
    };
  }

  const api = Object.freeze({
    DB_NAME, STORE_NAME, CURRENT_SCHEMA_VERSION,
    saveDraft, loadDraft, deleteDraft, saveRecovery, loadRecovery, deleteRecovery,
    saveClipboard, loadClipboard, saveTemplate, loadTemplate, storageEstimate,
    migrateStage, resolveSyncConflict,
  });
  root.StagePersistence = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
