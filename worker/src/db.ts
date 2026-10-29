// The part of Cloudflare D1's API the backend uses, so the same code runs on D1 and, in the tests, on Node's built-in SQLite.

export interface Stmt {
  bind(...values: unknown[]): Stmt;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta: { changes: number } }>;
}

export interface Db {
  prepare(sql: string): Stmt;
  /** Runs the statements in order, all or none. */
  batch(statements: Stmt[]): Promise<unknown[]>;
}

/** The part of an R2 bucket the backend uses. */
export interface Bucket {
  put(key: string, value: ArrayBuffer, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  get(key: string): Promise<{ body: ReadableStream | ArrayBuffer; httpMetadata?: { contentType?: string } } | null>;
  delete(key: string): Promise<void>;
  list(options: { prefix: string }): Promise<{ objects: { key: string }[] }>;
}

export const one = <T>(db: Db, sql: string, ...values: unknown[]): Promise<T | null> => db.prepare(sql).bind(...values).first<T>();
export const many = async <T>(db: Db, sql: string, ...values: unknown[]): Promise<T[]> => (await db.prepare(sql).bind(...values).all<T>()).results;
export const exec = async (db: Db, sql: string, ...values: unknown[]): Promise<number> => (await db.prepare(sql).bind(...values).run()).meta.changes;
