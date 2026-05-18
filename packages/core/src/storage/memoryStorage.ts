import type { TypaiStorage } from "../types";

export function createMemoryStorage(): TypaiStorage {
  const namespaces = new Map<string, Map<string, unknown>>();

  return {
    async get<T>(namespace: string, key: string): Promise<T | null> {
      const value = namespaces.get(namespace)?.get(key);

      return value === undefined ? null : cloneValue(value as T);
    },

    async set<T>(namespace: string, key: string, value: T): Promise<void> {
      getNamespace(namespaces, namespace).set(key, cloneValue(value));
    },

    async delete(namespace: string, key: string): Promise<void> {
      namespaces.get(namespace)?.delete(key);
    },

    async list<T>(namespace: string): Promise<Array<{ key: string; value: T }>> {
      const values = namespaces.get(namespace);

      if (values === undefined) {
        return [];
      }

      return [...values.entries()].map(([key, value]) => ({
        key,
        value: cloneValue(value as T),
      }));
    },

    async clear(namespace: string): Promise<void> {
      namespaces.delete(namespace);
    },
  };
}

function getNamespace(
  namespaces: Map<string, Map<string, unknown>>,
  namespace: string,
): Map<string, unknown> {
  let values = namespaces.get(namespace);

  if (values === undefined) {
    values = new Map<string, unknown>();
    namespaces.set(namespace, values);
  }

  return values;
}

function cloneValue<T>(value: T): T {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
}
