/**
 * Shared IndexedDB connection manager: single cached open connection per database,
 * automatic cleanup on close / versionchange / blocked / open errors, and one-shot
 * recovery if a stale connection throws InvalidStateError.
 */
export interface IdDb {
  open: () => Promise<IDBDatabase | null>;
  tx: <T>(
    storeName: string,
    mode: IDBTransactionMode,
    fn: (store: IDBObjectStore) => IDBRequest<T>,
  ) => Promise<T | null>;
  reset: () => void;
}

export function createIdb(
  name: string,
  version: number,
  onUpgrade: (db: IDBDatabase) => void,
): IdDb {
  let pending: Promise<IDBDatabase | null> | null = null;
  let activeDb: IDBDatabase | null = null;

  const reset = () => {
    pending = null;
    if (activeDb) {
      try {
        activeDb.close();
      } catch {
        /* ignore close errors */
      }
      activeDb = null;
    }
  };

  const open = (): Promise<IDBDatabase | null> => {
    if (typeof indexedDB === "undefined") return Promise.resolve(null);
    if (!pending) {
      pending = new Promise<IDBDatabase | null>((resolve) => {
        try {
          const req = indexedDB.open(name, version);
          req.onupgradeneeded = () => {
            onUpgrade(req.result);
          };
          req.onsuccess = () => {
            const db = req.result;
            activeDb = db;
            db.onclose = () => {
              if (activeDb === db) activeDb = null;
              pending = null;
            };
            db.onversionchange = () => {
              try {
                db.close();
              } catch {
                /* ignore close errors */
              }
              if (activeDb === db) activeDb = null;
              pending = null;
            };
            resolve(db);
          };
          req.onerror = () => {
            pending = null;
            activeDb = null;
            resolve(null);
          };
          req.onblocked = () => {
            pending = null;
            activeDb = null;
            resolve(null);
          };
        } catch {
          pending = null;
          activeDb = null;
          resolve(null);
        }
      });
    }
    return pending;
  };

  const runReq = <T>(
    db: IDBDatabase,
    storeName: string,
    mode: IDBTransactionMode,
    fn: (store: IDBObjectStore) => IDBRequest<T>,
  ): { started: true; promise: Promise<T | null> } | { started: false; retryable: boolean } => {
    try {
      const store = db.transaction(storeName, mode).objectStore(storeName);
      const req = fn(store);
      return {
        started: true,
        promise: new Promise<T | null>((resolve) => {
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(null);
        }),
      };
    } catch (err) {
      const retryable =
        err instanceof Error && (err.name === "InvalidStateError" || /closing|closed/i.test(err.message));
      return { started: false, retryable };
    }
  };

  const tx = async <T>(
    storeName: string,
    mode: IDBTransactionMode,
    fn: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T | null> => {
    const db = await open();
    if (!db) return null;
    const attempt = runReq(db, storeName, mode, fn);
    if (attempt.started) return attempt.promise;
    if (!attempt.retryable) return null;
    // Connection closed right before transaction(): reopen once cleanly.
    reset();
    const fresh = await open();
    if (!fresh) return null;
    const retry = runReq(fresh, storeName, mode, fn);
    return retry.started ? retry.promise : null;
  };

  return { open, tx, reset };
}
