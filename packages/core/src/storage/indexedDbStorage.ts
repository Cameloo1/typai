import type { TypaiStorage } from "../types";

export interface CreateIndexedDbStorageOptions {
  dbName?: string;
  storeName?: string;
  version?: number;
}

type IndexedDbRecord<T = unknown> = {
  id: string;
  namespace: string;
  key: string;
  value: T;
  updatedAt: number;
};

const defaultDbName = "typai";
const defaultStoreName = "typai";
const namespaceIndexName = "namespace";

export function createIndexedDbStorage(options: CreateIndexedDbStorageOptions = {}): TypaiStorage {
  const dbName = options.dbName ?? defaultDbName;
  const storeName = options.storeName ?? defaultStoreName;
  const version = options.version ?? 1;
  const dbPromise = openDatabase(dbName, storeName, version);

  return {
    async get<T>(namespace: string, key: string): Promise<T | null> {
      const db = await dbPromise;
      const record = await runRequest<IndexedDbRecord<T> | undefined>(
        getStore(db, storeName, "readonly").get(recordId(namespace, key)),
      );

      return record?.value ?? null;
    },

    async set<T>(namespace: string, key: string, value: T): Promise<void> {
      const db = await dbPromise;
      const transaction = db.transaction(storeName, "readwrite");
      const record: IndexedDbRecord<T> = {
        id: recordId(namespace, key),
        namespace,
        key,
        value,
        updatedAt: Date.now(),
      };

      transaction.objectStore(storeName).put(record);

      await waitForTransaction(transaction);
    },

    async delete(namespace: string, key: string): Promise<void> {
      const db = await dbPromise;
      const transaction = db.transaction(storeName, "readwrite");

      transaction.objectStore(storeName).delete(recordId(namespace, key));

      await waitForTransaction(transaction);
    },

    async list<T>(namespace: string): Promise<Array<{ key: string; value: T }>> {
      const db = await dbPromise;
      const transaction = db.transaction(storeName, "readonly");
      const records = await getRecordsForNamespace<T>(
        transaction.objectStore(storeName),
        namespace,
      );

      await waitForTransaction(transaction);

      return records.map((record) => ({
        key: record.key,
        value: record.value,
      }));
    },

    async clear(namespace: string): Promise<void> {
      const db = await dbPromise;
      const transaction = db.transaction(storeName, "readwrite");
      const store = transaction.objectStore(storeName);

      await deleteRecordsForNamespace(store, namespace);
      await waitForTransaction(transaction);
    },
  };
}

function openDatabase(dbName: string, storeName: string, version: number): Promise<IDBDatabase> {
  const indexedDb = globalThis.indexedDB;

  if (indexedDb === undefined) {
    return Promise.reject(new Error("Typai IndexedDB storage requires globalThis.indexedDB."));
  }

  return new Promise((resolve, reject) => {
    const request = indexedDb.open(dbName, version);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(storeName)) {
        const store = db.createObjectStore(storeName, { keyPath: "id" });
        store.createIndex(namespaceIndexName, "namespace", { unique: false });
      }
    };

    request.onerror = () => {
      reject(indexedDbError("open", request.error));
    };

    request.onsuccess = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(storeName)) {
        db.close();
        reject(
          new Error(
            `Typai IndexedDB storage object store "${storeName}" is missing. Increase the database version to create it.`,
          ),
        );
        return;
      }

      resolve(db);
    };
  });
}

function getStore(db: IDBDatabase, storeName: string, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(storeName, mode).objectStore(storeName);
}

function getRecordsForNamespace<T>(
  store: IDBObjectStore,
  namespace: string,
): Promise<Array<IndexedDbRecord<T>>> {
  return new Promise((resolve, reject) => {
    const records: Array<IndexedDbRecord<T>> = [];
    const request = store.index(namespaceIndexName).openCursor(IDBKeyRange.only(namespace));

    request.onerror = () => {
      reject(indexedDbError("list", request.error));
    };

    request.onsuccess = () => {
      const cursor = request.result;

      if (cursor === null) {
        resolve(records);
        return;
      }

      records.push(cursor.value as IndexedDbRecord<T>);
      cursor.continue();
    };
  });
}

function deleteRecordsForNamespace(store: IDBObjectStore, namespace: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = store.index(namespaceIndexName).openCursor(IDBKeyRange.only(namespace));

    request.onerror = () => {
      reject(indexedDbError("clear", request.error));
    };

    request.onsuccess = () => {
      const cursor = request.result;

      if (cursor === null) {
        resolve();
        return;
      }

      cursor.delete();
      cursor.continue();
    };
  });
}

function runRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onerror = () => {
      reject(indexedDbError("request", request.error));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };
  });
}

function waitForTransaction(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => {
      resolve();
    };

    transaction.onerror = () => {
      reject(indexedDbError("transaction", transaction.error));
    };

    transaction.onabort = () => {
      reject(indexedDbError("transaction", transaction.error));
    };
  });
}

function indexedDbError(operation: string, error: DOMException | null): Error {
  return new Error(`Typai IndexedDB storage ${operation} failed: ${error?.message ?? "unknown"}`);
}

function recordId(namespace: string, key: string): string {
  return `${namespace}:${key}`;
}
