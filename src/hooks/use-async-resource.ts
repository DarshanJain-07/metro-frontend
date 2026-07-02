"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DependencyList,
} from "react";

type AsyncResourceLoader<T> = (context: {
  signal: AbortSignal;
}) => Promise<T>;

interface AsyncResourceOptions<T> {
  deps?: DependencyList;
  enabled?: boolean;
  initialData?: T;
}

export function isAbortError(error: unknown) {
  return (
    error instanceof DOMException && error.name === "AbortError"
  );
}

export function useAsyncResource<T>(
  loader: AsyncResourceLoader<T>,
  options: AsyncResourceOptions<T> = {},
) {
  const { deps = [], enabled = true, initialData = null } = options;
  const [data, setData] = useState<T | null>(initialData);
  const [error, setError] = useState<unknown>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [refetchIndex, setRefetchIndex] = useState(0);
  const loaderRef = useRef(loader);
  const requestIdRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    loaderRef.current = loader;
  }, [loader]);

  const refetch = useCallback(() => {
    setRefetchIndex((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!enabled) {
      controllerRef.current?.abort();
      controllerRef.current = null;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsLoading(false);
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setIsLoading(true);
    setError(null);

    async function load() {
      try {
        const nextData = await loaderRef.current({ signal: controller.signal });
        if (requestIdRef.current !== requestId || controller.signal.aborted) {
          return;
        }
        setData(nextData);
      } catch (nextError) {
        if (
          controller.signal.aborted ||
          isAbortError(nextError) ||
          requestIdRef.current !== requestId
        ) {
          return;
        }
        setError(nextError);
      } finally {
        if (requestIdRef.current === requestId && !controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      controller.abort();
    };
    // `deps` is the caller-owned resource identity, similar to a query key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, refetchIndex, ...deps]);

  return { data, error, isLoading, refetch, setData };
}
