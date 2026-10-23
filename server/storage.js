// File storage for uploads and finished MP4s.
// Supabase Storage when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set, local disk otherwise.
import { mkdir, writeFile, readFile, copyFile, readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';
import { q, one } from './db/index.js';

const LOCAL_ROOT = path.join(config.dataDir, 'storage');

export async function initStorage() {
  if (config.storageMode === 'local') {
    await mkdir(LOCAL_ROOT, { recursive: true });
    console.log(`[storage] local disk (${LOCAL_ROOT})`);
    return;
  }
  if (config.storageMode === 'db') { console.log('[storage] database (files table)'); return; }
  // Create the public bucket if it does not exist yet (ignore "already exists").
  const res = await fetch(`${config.supabaseUrl}/storage/v1/bucket`, {
    method: 'POST',
    headers: supabaseHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ id: config.supabaseBucket, name: config.supabaseBucket, public: true }),
  }).catch((e) => ({ ok: false, text: async () => e.message }));
  if (!res.ok) {
    const t = await res.text();
    if (!/exists|Duplicate/i.test(t)) console.warn(`[storage] bucket check: ${t.slice(0, 200)}`);
  }
  console.log(`[storage] Supabase bucket "${config.supabaseBucket}"`);
}

function supabaseHeaders(extra = {}) {
  return { Authorization: `Bearer ${config.supabaseServiceKey}`, apikey: config.supabaseServiceKey, ...extra };
}

export const localPathFor = (key) => path.join(LOCAL_ROOT, key);

/** Store bytes (Buffer) or a local file (path string). Returns the public URL. */
export async function putObject(key, source, contentType) {
  key = key.replace(/^\/+/, '').replace(/\.\.+/g, '.');
  if (config.storageMode === 'local') {
    const dest = localPathFor(key);
    await mkdir(path.dirname(dest), { recursive: true });
    if (typeof source === 'string') await copyFile(source, dest);
    else await writeFile(dest, source);
    return `${config.publicBaseUrl}/files/${key}`;
  }
  const body = typeof source === 'string' ? await readFile(source) : source;
  if (config.storageMode === 'db') {
    await q(`INSERT INTO files (key, content_type, data) VALUES ($1,$2,$3)
      ON CONFLICT (key) DO UPDATE SET content_type=EXCLUDED.content_type, data=EXCLUDED.data`, [key, contentType || 'application/octet-stream', Buffer.from(body)]);
    return `${config.publicBaseUrl}/files/${key}`;
  }
  const res = await fetch(`${config.supabaseUrl}/storage/v1/object/${config.supabaseBucket}/${key}`, {
    method: 'POST',
    headers: supabaseHeaders({ 'Content-Type': contentType || 'application/octet-stream', 'x-upsert': 'true', 'cache-control': '31536000' }),
    body,
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  return `${config.supabaseUrl}/storage/v1/object/public/${config.supabaseBucket}/${key}`;
}

/** The storage key behind one of our file URLs (null for outside links). */
export function keyOf(url) {
  const s = String(url || '');
  const m = s.match(/\/files\/(.+)$/) || s.match(/\/storage\/v1\/object\/public\/[^/]+\/(.+)$/);
  return m ? decodeURIComponent(m[1].split('?')[0]) : null;
}

/** Delete stored files: exact keys, or every key that starts with a prefix ({ prefix: 'renders/abc.mp4' }). Never throws. */
export async function deleteObjects(keys = [], { prefix = null } = {}) {
  keys = keys.filter(Boolean);
  try {
    if (config.storageMode === 'db') {
      if (keys.length) await q('DELETE FROM files WHERE key = ANY($1)', [keys]);
      if (prefix) await q('DELETE FROM files WHERE key LIKE $1', [prefix.replace(/[%_]/g, '\\$&') + '%']);
      return;
    }
    if (config.storageMode === 'local') {
      for (const k of keys) await unlink(localPathFor(k)).catch(() => {});
      if (prefix) {
        const dir = path.dirname(localPathFor(prefix)), base = path.basename(prefix);
        for (const f of await readdir(dir).catch(() => [])) if (f.startsWith(base)) await unlink(path.join(dir, f)).catch(() => {});
      }
      return;
    }
    if (keys.length) {
      await fetch(`${config.supabaseUrl}/storage/v1/object/${config.supabaseBucket}`, {
        method: 'DELETE', headers: supabaseHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ prefixes: keys }),
      });
    }
  } catch (e) { console.warn('[storage] delete:', e.message); }
}

/** Read a file stored in the database (storage mode 'db'). */
export async function getDbObject(key) {
  const row = await one('SELECT content_type, data FROM files WHERE key=$1', [key]);
  return row ? { type: row.content_type, data: Buffer.from(row.data) } : null;
}
