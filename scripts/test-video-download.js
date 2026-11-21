import assert from 'node:assert/strict';
import { fetchVideo } from '../web/src/lib/videoFile.js';

const file = Buffer.from([0, 0, 0, 16, ...Buffer.from('ftypisom'), 0, 0, 0, 0]);
const response = (body, status, headers) => new Response(body, { status, headers });
const originalFetch = globalThis.fetch;

try {
  // A normal complete 206 response is joined and returned as an MP4.
  globalThis.fetch = async () => response(file, 206, {
    'content-type': 'video/mp4',
    'content-range': `bytes 0-${file.length - 1}/${file.length}`,
  });
  const complete = await fetchVideo('/api/render-file/test');
  assert.equal(complete.type, 'video/mp4');
  assert.equal(complete.size, file.length);

  // If a proxy or fallback route sends the website instead of the MP4, refuse to save it.
  globalThis.fetch = async () => response('<!doctype html><title>Animora</title>', 200, { 'content-type': 'text/html; charset=utf-8' });
  await assert.rejects(fetchVideo('/api/render-file/test'), /web page instead of an MP4/);

  // A multi-part download must have contiguous, correctly sized ranges.
  const splitAt = 12;
  let calls = 0;
  globalThis.fetch = async (_url, options) => {
    calls++;
    if (options.headers.Range === 'bytes=0-') return response(file.subarray(0, splitAt), 206, {
      'content-type': 'video/mp4', 'content-range': `bytes 0-${splitAt - 1}/${file.length}`,
    });
    assert.equal(options.headers.Range, `bytes=${splitAt}-`);
    return response(file.subarray(splitAt), 206, {
      'content-type': 'video/mp4', 'content-range': `bytes ${splitAt}-${file.length - 1}/${file.length}`,
    });
  };
  const ranged = await fetchVideo('/api/render-file/test');
  assert.equal(calls, 2);
  assert.equal(ranged.size, file.length);

  // Never accept a short chunk, even if it claims to be an MP4.
  globalThis.fetch = async () => response(file.subarray(0, 8), 206, {
    'content-type': 'video/mp4', 'content-range': `bytes 0-${file.length - 1}/${file.length}`,
  });
  await assert.rejects(fetchVideo('/api/render-file/test'), /incomplete/);

  console.log('Video-download tests passed: MP4 accepted; HTML and incomplete ranges rejected.');
} finally {
  globalThis.fetch = originalFetch;
}
