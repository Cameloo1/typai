import { createContext, type ReactElement, useEffect, useMemo, useRef, useState } from "react";

import type { TypaiCoreContextValue, TypaiCoreFactory, TypaiProviderProps } from "./types";

export const TypaiCoreContext = createContext<TypaiCoreContextValue>({
  typai: null,
  status: "idle",
  error: null,
  completion: null,
  core: null,
  loading: false,
});

type CoreFactoryCache = {
  factory: TypaiCoreFactory;
  promise: ReturnType<TypaiCoreFactory>;
};

export function TypaiProvider({
  children,
  typai,
  core,
  createCore,
  completion,
}: TypaiProviderProps): ReactElement {
  const providedCore = typai ?? core ?? null;
  const factoryCacheRef = useRef<CoreFactoryCache | null>(null);
  const [contextValue, setContextValue] = useState<TypaiCoreContextValue>(() => ({
    typai: providedCore,
    status: providedCore !== null ? "ready" : createCore !== undefined ? "loading" : "idle",
    error: null,
    completion: null,
    core: providedCore,
    loading: providedCore === null && createCore !== undefined,
  }));

  useEffect(() => {
    if (providedCore !== null) {
      setContextValue({
        typai: providedCore,
        status: "ready",
        error: null,
        completion: null,
        core: providedCore,
        loading: false,
      });
      return;
    }

    if (createCore === undefined) {
      setContextValue({
        typai: null,
        status: "idle",
        error: null,
        completion: null,
        core: null,
        loading: false,
      });
      return;
    }

    let active = true;
    let cache = factoryCacheRef.current;

    if (cache === null || cache.factory !== createCore) {
      cache = {
        factory: createCore,
        promise: createCore(),
      };
      factoryCacheRef.current = cache;
    }

    setContextValue({
      typai: null,
      status: "loading",
      error: null,
      completion: null,
      core: null,
      loading: true,
    });

    cache.promise.then(
      (createdCore) => {
        if (!active) {
          return;
        }

        setContextValue({
          typai: createdCore,
          status: "ready",
          error: null,
          completion: null,
          core: createdCore,
          loading: false,
        });
      },
      (error: unknown) => {
        if (!active) {
          return;
        }

        setContextValue({
          typai: null,
          status: "error",
          error,
          completion: null,
          core: null,
          loading: false,
        });
      },
    );

    return () => {
      active = false;
    };
  }, [providedCore, createCore]);

  const value = useMemo(
    () => ({
      typai: contextValue.typai,
      status: contextValue.status,
      error: contextValue.error,
      completion: completion ?? null,
      core: contextValue.core,
      loading: contextValue.loading,
    }),
    [
      contextValue.typai,
      contextValue.status,
      contextValue.error,
      completion,
      contextValue.core,
      contextValue.loading,
    ],
  );

  return <TypaiCoreContext.Provider value={value}>{children}</TypaiCoreContext.Provider>;
}
