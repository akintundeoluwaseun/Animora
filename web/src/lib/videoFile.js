// Saving a finished MP4: the server sends it in parts of at most 4 MB (the free hosting limit),
// so we fetch every part, join them, then save the whole file.
export async function fetchVideo(url, onProgress = () => {}) {
  url = `${url}${url.includes('?') ? '&' : '?'}dl=1`;   // a real download: the server clears the MP4 2 hours later
  const first = await fetch(url, { headers: { Range: 'bytes=0-' } });
  if (first.status !== 206) return first.blob();
  const total = Number((first.headers.get('content-range') || '').split('/')[1]) || 0;
  const parts = [await first.arrayBuffer()];
  let got = parts[0].byteLength;
  while (total && got < total) {
    onProgress(got / total);
    const r = await fetch(url, { headers: { Range: `bytes=${got}-` } });
    const b = await r.arrayBuffer();
    if (!b.byteLength) break;
    parts.push(b); got += b.byteLength;
  }
  return new Blob(parts, { type: 'video/mp4' });
}

export async function downloadVideo(render, title, onProgress) {
  const blob = await fetchVideo(render.videoUrl, onProgress);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${String(title || 'animora-video').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').replace(/-{2,}/g, '-') || 'animora-video'}.mp4`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

