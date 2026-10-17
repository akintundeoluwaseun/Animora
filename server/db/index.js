// Database access. Production: Supabase Postgres via DATABASE_URL.
// Local/offline: PGlite (real Postgres compiled to WASM, stored in data/pglite) - same SQL, zero setup.
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { config, ROOT } from '../config.js';

let driver; // { query(sql, params) -> {rows}, exec(sql), transaction(fn) }

export async function initDb() {
  if (driver) return driver;
  if (config.databaseUrl) {
    const pg = (await import('pg')).default;
    pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v))); // numeric -> number
    pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v)));   // bigint -> number
    const pool = new pg.Pool({
      connectionString: config.databaseUrl,
      ssl: /localhost|127\.0\.0\.1/.test(config.databaseUrl) ? false : { rejectUnauthorized: false },
      max: 10,
    });
    driver = {
      kind: 'postgres',
      query: (sql, params) => pool.query(sql, params),
      exec: (sql) => pool.query(sql),
      async transaction(fn) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const out = await fn({ query: (s, p) => client.query(s, p) });
          await client.query('COMMIT');
          return out;
        } catch (e) {
          await client.query('ROLLBACK').catch(() => {});
          throw e;
        } finally {
          client.release();
        }
      },
      close: () => pool.end(),
    };
  } else {
    const { PGlite, types } = await import('@electric-sql/pglite');
    const dir = path.join(config.dataDir, 'pglite');
    await mkdir(dir, { recursive: true });
    const db = await PGlite.create(dir, {
      parsers: { [types.NUMERIC]: (v) => Number(v), [types.INT8]: (v) => Number(v) },
    });
    // PGlite is single-connection: serialise transactions so they never interleave.
    let chain = Promise.resolve();
    driver = {
      kind: 'pglite',
      query: (sql, params) => db.query(sql, params),
      exec: (sql) => db.exec(sql),
      transaction(fn) {
        const run = chain.then(() => db.transaction((tx) => fn({ query: (s, p) => tx.query(s, p) })));
        chain = run.catch(() => {});
        return run;
      },
      close: () => db.close(),
    };
  }
  const schema = await readFile(path.join(ROOT, 'server/db/schema.sql'), 'utf8');
  await driver.exec(schema);
  console.log(`[db] ready (${driver.kind})`);
  return driver;
}

export const q = async (sql, params = []) => (await driver.query(sql, params)).rows;
export const one = async (sql, params = []) => (await q(sql, params))[0] || null;
export const tx = (fn) => driver.transaction(async (t) => fn({
  q: async (s, p = []) => (await t.query(s, p)).rows,
  one: async (s, p = []) => (await t.query(s, p)).rows[0] || null,
}));
export const closeDb = () => driver?.close();
