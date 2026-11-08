// Saving a finished MP4: the server sends it in parts of at most 4 MB (the free hosting limit),
// so we fetch every part, join them, then save the whole file. Never save an error/HTML page as .mp4.
function downloadError(status) {
  if (status === 404 || status === 410) return new Error('This MP4 is no longer available. Open Animora and make the video again.');
  return new Error('The MP4 download did not finish. Check your internet connection and try again.');
}

function assertVideoResponse(response) {
  if (!response.ok) throw downloadError(response.status);
  const type = (response.headers.get('content-type') || '').toLowerCase();
  if (!type.startsWith('video/mp4') && !type.startsWith('application/octet-stream')) {
    throw new Error('Animora received a web page instead of an MP4, so it did not save that file. Check your connection and try again.');
  }
}

async function request(url, headers) {
  try { return await fetch(url, { headers }); }
  catch { throw new Error('The MP4 download was interrupted. Reconnect to the internet and try again.'); }
}

async function assertMp4(blob) {
  if (!blob || blob.size < 12 || await blob.slice(4, 8).text() !== 'ftyp') {
    throw new Error('The downloaded file is not a complete MP4. Nothing was saved; please try again.');
  }
}

export async function fetchVideo(url, onProgress = () => {}) {
  url = `${url}${url.includes('?') ? '&' : '?'}dl=1`;   // a real download: the server clears the MP4 2 hours later
  const first = await request(url, { Range: 'bytes=0-' });
  assertVideoResponse(first);

  // A proxy may ignore Range and return the complete MP4 with 200; accept only a real MP4 response.
  if (first.status === 200) {
    const blob = await first.blob();
    await assertMp4(blob);
    return new Blob([blob], { type: 'video/mp4' });
  }
  if (first.status !== 206) throw downloadError(first.status);

  const range = String(first.headers.get('content-range') || '').match(/^bytes\s+(\d+)-(\d+)\/(\d+)$/i);
  if (!range || Number(range[1]) !== 0) throw new Error('The MP4 server returned an invalid download range. Please try again.');
  const total = Number(range[3]);
  if (!Number.isSafeInteger(total) || total < 12) throw new Error('The MP4 server returned an invalid file size. Please try again.');

  const parts = [await first.arrayBuffer()];
  let got = parts[0].byteLength;
  if (got !== Number(range[2]) + 1) throw new Error('The MP4 download was incomplete. Check your connection and try again.');
  while (got < total) {
    onProgress(got / total);
    const r = await request(url, { Range: `bytes=${got}-` });
    assertVideoResponse(r);
    if (r.status !== 206) throw new Error('The MP4 download was interrupted. Check your connection and try again.');
    const nextRange = String(r.headers.get('content-range') || '').match(/^bytes\s+(\d+)-(\d+)\/(\d+)$/i);
    if (!nextRange || Number(nextRange[1]) !== got || Number(nextRange[3]) !== total) {
      throw new Error('The MP4 server returned an incomplete download range. Please try again.');
    }
    const bytes = await r.arrayBuffer();
    if (!bytes.byteLength || bytes.byteLength !== Number(nextRange[2]) - got + 1) {
      throw new Error('The MP4 download was incomplete. Check your connection and try again.');
    }
    parts.push(bytes);
    got += bytes.byteLength;
    if (got > total) throw new Error('The MP4 server returned more data than expected. Please try again.');
  }

  if (got !== total) throw new Error('The MP4 download was incomplete. Check your connection and try again.');
  const blob = new Blob(parts, { type: 'video/mp4' });
  await assertMp4(blob);
  return blob;
}

export async function downloadVideo(render, title, onProgress) {
  const blob = await fetchVideo(render.videoUrl, onProgress);
  const url = URL.createObjectURL(blob);
  const safeTitle = String(title || 'animora-video').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').replace(/-{2,}/g, '-').slice(0, 60) || 'animora-video';
  const a = document.createElement('a');
  a.href = url; a.download = `${safeTitle}.mp4`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
