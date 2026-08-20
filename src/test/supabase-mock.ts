import { vi } from "vitest"

/**
 * Minimal chainable stand-in for the Supabase query builder.
 *
 * Real PostgREST queries chain filter/modifier methods (`.select`, `.eq`,
 * `.order`, `.limit`, ...) and then either await the builder directly or call a
 * terminal (`.single`, `.maybeSingle`). This mock makes every chain method
 * return `this`, makes the builder thenable, and resolves every terminal to the
 * one `{ data, error }` result configured for the table it was opened on.
 */
export type QueryResult = { data?: unknown; error?: unknown; count?: number | null }

type TableResult = QueryResult | (() => QueryResult)

// Chain methods that return the builder unchanged so calls keep flowing.
// (`in` is a reserved word, so the set is built from string keys.)
const CHAIN_METHODS = [
  "select",
  "insert",
  "update",
  "delete",
  "upsert",
  "eq",
  "neq",
  "in",
  "is",
  "not",
  "gte",
  "lt",
  "match",
  "or",
  "order",
  "limit",
] as const

class QueryBuilder implements PromiseLike<QueryResult> {
  // Chain methods are assigned dynamically in the constructor; the index
  // signature lets tests read them back (e.g. `builder.insert`) as vi mocks.
  [key: string]: unknown

  // Terminals — resolve to the configured result.
  single = vi.fn(() => Promise.resolve(this.result))
  maybeSingle = vi.fn(() => Promise.resolve(this.result))

  constructor(private result: QueryResult) {
    for (const name of CHAIN_METHODS) {
      ;(this as Record<string, unknown>)[name] = vi.fn(() => this)
    }
  }

  // Make the builder awaitable directly (queries without a terminal).
  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.result).then(onfulfilled, onrejected)
  }
}

export interface MockClientOptions {
  /** Result returned by `auth.getSession()`. */
  session?: unknown
  /** Per-table `{ data, error }` results, keyed by table name. */
  tables?: Record<string, TableResult>
}

/**
 * Build a fake Supabase client whose `.from(table)` and `.auth.getSession()`
 * return the configured results. `from()` is a vi.fn so tests can assert which
 * tables were queried.
 */
export function createMockClient(options: MockClientOptions = {}) {
  const { session = null, tables = {} } = options

  const builders: Record<string, QueryBuilder[]> = {}

  const from = vi.fn((table: string) => {
    const configured = tables[table]
    const result =
      typeof configured === "function" ? configured() : configured ?? { data: null, error: null }
    const builder = new QueryBuilder(result)
    ;(builders[table] ??= []).push(builder)
    return builder
  })

  const getSession = vi.fn(() => Promise.resolve({ data: { session }, error: null }))
  const getUser = vi.fn(() =>
    Promise.resolve({
      data: { user: (session as { user?: unknown } | null)?.user ?? null },
      error: null,
    })
  )

  // Defaults to a no-op result; tests that exercise an RPC call (e.g. the
  // stock-checked order-item insert) reassign `client.rpc` to a fitted mock.
  const rpc = vi.fn(() => Promise.resolve({ data: null, error: null }))

  return {
    from,
    auth: { getSession, getUser },
    rpc,
    /** Every QueryBuilder opened via `.from(table)`, in call order. */
    buildersFor: (table: string): QueryBuilder[] => builders[table] ?? [],
  }
}

/**
 * Forge an unsigned JWT whose payload carries the given `app_metadata` claims.
 * Only the middle (payload) segment is ever decoded by the app, so the header
 * and signature can be placeholders.
 */
export function makeAccessToken(appMetadata: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url")
  const payload = Buffer.from(JSON.stringify({ app_metadata: appMetadata })).toString("base64url")
  return `${header}.${payload}.sig`
}

/** Build a fake Supabase session object with the given user id and claims. */
export function makeSession(
  userId: string,
  appMetadata: Record<string, unknown> = {},
  email = "user@example.com"
) {
  return {
    access_token: makeAccessToken(appMetadata),
    user: { id: userId, email },
  }
}
