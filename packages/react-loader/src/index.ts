import type { ContentSourceMap, QueryParams } from '@sanity/client'
import {
  createQueryStore as createCoreQueryStore,
  type CreateQueryStoreOptions,
  type LiveModeState,
  type QueryStoreState,
} from '@sanity/core-loader'
import {
  startTransition as _startTransition,
  type TransitionFunction,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react'

export type * from '@sanity/core-loader'

export type UseQueryHook = <Response = unknown, Error = unknown>(
  query: string,
  params?: QueryParams,
  options?: UseQueryOptions<Response>,
) => QueryStoreState<Response, Error>
export interface UseQueryOptions<Response = unknown> {
  initialData?: Response
  initialSourceMap?: ContentSourceMap
  startTransition?: TransitionFunction
}
export type UseLiveModeHook = () => LiveModeState

export interface QueryStore {
  query: <Response>(query: string, params?: QueryParams) => Promise<Response>
  useQuery: UseQueryHook
  useLiveMode: UseLiveModeHook
}

export const createQueryStore = (
  options: CreateQueryStoreOptions,
): {
  query: <Response>(query: string, params?: QueryParams) => Promise<Response>
  useQuery: <Response = unknown, Error = unknown>(
    query: string,
    params?: QueryParams,
    options?: UseQueryOptions<Response>,
  ) => QueryStoreState<Response, Error>
  useLiveMode: () => void
} => {
  const { createFetcherStore, $LiveMode, unstable__cache } =
    createCoreQueryStore(options)
  const initialFetch = {
    loading: true,
    data: undefined,
    error: undefined,
    sourceMap: undefined,
  } satisfies QueryStoreState<Response, Error>
  const initialLiveMode = $LiveMode.value!

  const DEFAULT_PARAMS = {}
  const useQuery = <Response, Error>(
    query: string,
    params: QueryParams = DEFAULT_PARAMS,
    options: UseQueryOptions<Response> = {},
  ) => {
    const {
      initialData: _initialData,
      initialSourceMap: _initialSourceMap,
      startTransition = _startTransition,
    } = options
    const [initialData] = useState(() => _initialData)
    const [initialSourceMap] = useState(() => _initialSourceMap)
    const $params = useMemo(() => JSON.stringify(params), [params])
    const [snapshot, setSnapshot] = useState<QueryStoreState<Response, Error>>(
      () => ({
        ...initialFetch,
        data: initialData,
        sourceMap: initialSourceMap,
      }),
    )
    useEffect(() => {
      const fetcher = createFetcherStore<Response, Error>(
        query,
        JSON.parse($params),
        initialData,
        initialSourceMap,
      )
      const unlisten = fetcher.listen((snapshot) =>
        startTransition(() => setSnapshot(snapshot)),
      )
      return () => unlisten()
    }, [$params, initialData, initialSourceMap, query, startTransition])
    return snapshot
  }

  const useLiveMode: UseLiveModeHook = () => {
    const store = useSyncExternalStore(
      useCallback((onStoreChange) => $LiveMode.listen(onStoreChange), []),
      () => $LiveMode.get(),
      () => initialLiveMode,
    )

    return store
  }
  const query = async <Response>(
    query: string,
    params: QueryParams = {},
  ): Promise<Response> => {
    if (typeof document !== 'undefined') {
      throw new Error(
        'Cannot use `query` in a browser environment, you should use it inside a loader, getStaticProps, getServerSideProps, getInitialProps, or in a React Server Component.',
      )
    }
    const { result } = await unstable__cache.fetch<Response>(
      JSON.stringify({ query, params }),
    )
    return result
  }

  return { query, useQuery, useLiveMode }
}
