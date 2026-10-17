// File storage for uploads and finished MP4s.
// Supabase Storage when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set, local disk otherwise.
import { mkdir, writeFile, readFile, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';

const LOCAL_ROOT = path.join(config.dataDir, 'storage');

export async function initStorage() {
  if (config.storageMode === 'local') {
    await mkdir(LOCAL_ROOT, { recursive: true });
    console.log(`[storage] local disk (${LOCAL_ROOT})`);
    return;
  }
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
  const res = await fetch(`${config.supabaseUrl}/storage/v1/object/${config.supabaseBucket}/${key}`, {
    method: 'POST',
    headers: supabaseHeaders({ 'Content-Type': contentType || 'application/octet-stream', 'x-upsert': 'true', 'cache-control': '31536000' }),
    body,
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  return `${config.supabaseUrl}/storage/v1/object/public/${config.supabaseBucket}/${key}`;
}
