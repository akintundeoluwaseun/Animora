// Database access. Production: Supabase Postgres via DATABASE_URL.
// Local/offline: PGlite (real Postgres compiled to WASM, stored in data/pglite) - same SQL, zero setup.
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { config, ROOT } from '../config.js';

let driver; // { query(sql, params) -> {rows}, exec(sql), transaction(fn) }

/**
 * Read DATABASE_URL by hand so it works however it was pasted: passwords with symbols (# @ / ? %),
 * leftover [ ] around the password, quotes around the whole thing, or a "DATABASE_URL=" in front.
 * The password is everything between the first ':' after the user name and the LAST '@'.
 */
export function connectionParts(url) {
  let s = String(url || '').trim().replace(/^DATABASE_URL\s*=\s*/i, '').trim().replace(/^["'`]+|["'`]+$/g, '').trim();
  const i = s.indexOf('://');
  if (i < 0) return { invalid: 'it does not start with postgresql://' };
  const rest = s.slice(i + 3);
  const at = rest.lastIndexOf('@');
  if (at < 0) return { invalid: 'it has no @ between the password and the address' };
  const userinfo = rest.slice(0, at), hostpart = rest.slice(at + 1);
  const c = userinfo.indexOf(':');
  const user = c < 0 ? userinfo : userinfo.slice(0, c);
  let password = c < 0 ? '' : userinfo.slice(c + 1);
  if (/^\[.*\]$/.test(password)) password = password.slice(1, -1);       // someone left the [ ] from [YOUR-PASSWORD]
  const dec = (x) => { try { return decodeURIComponent(x); } catch { return x; } };
  if (/%[0-9a-f]{2}/i.test(password)) password = dec(password);
  const [hostport, dbq = ''] = hostpart.split(/\/(.*)/s);
  const [host, port] = hostport.split(':');
  const database = dec(dbq.split('?')[0]) || 'postgres';
  if (!host) return { invalid: 'the address after @ is empty' };
  return { user: dec(user), password, host, port: Number(port) || 5432, database };
}

/** The connection string with the password hidden, for error messages. */
export function maskedUrl(url) {
  const p = connectionParts(url);
  if (p.invalid) return `(unreadable, ${String(url || '').trim().length} characters)`;   // never echo it: it might be the password
  return `postgresql://${p.user}:****@${p.host}:${p.port}/${p.database}`;
}

export async function initDb() {
  if (driver) return driver;
  if (config.databaseUrl) {
    const pg = (await import('pg')).default;
    pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v))); // numeric -> number
    pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v)));   // bigint -> number
    const parts = connectionParts(config.databaseUrl);
    if (parts.invalid) throw new Error(`DATABASE_URL (${String(config.databaseUrl).trim().length} characters) can't be read: ${parts.invalid}. It should look like postgresql://postgres.<project id>:<password>@aws-1-eu-west-2.pooler.supabase.com:6543/postgres`);
    const { invalid, ...conn } = parts; // eslint-disable-line no-unused-vars
    const pool = new pg.Pool({
      ...conn,
      ssl: /localhost|127\.0\.0\.1/.test(config.databaseUrl) ? false : { rejectUnauthorized: false },
      max: config.serverless ? 3 : 10,
      connectionTimeoutMillis: 10000,
    });
    // Fail fast with the address we tried (never the password), instead of hanging until the host times out.
    try { await pool.query('SELECT 1'); } catch (e) {
      await pool.end().catch(() => {});
      throw new Error(`database ${maskedUrl(config.databaseUrl)} - ${e.message}`);
    }
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
