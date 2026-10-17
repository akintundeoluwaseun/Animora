// Fast frame capture for our own video pages. Instead of copying every element's computed style into
// each frame (slow), we embed the page's stylesheet, fonts and pictures ONCE, then for every frame only
// serialize the elements (GSAP keeps the animated values in their style attributes) into an SVG
// foreignObject and let the browser rasterize it. Several frames are rasterized at the same time.

const toDataUrl = async (url, cache) => {
  if (!url || url.startsWith('data:')) return url;
  if (cache.has(url)) return cache.get(url);
  const p = fetch(url, { mode: 'cors' }).then((r) => (r.ok ? r.blob() : null)).then((b) => (b ? new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => res(url); fr.readAsDataURL(b); }) : url)).catch(() => url);
  cache.set(url, p);
  return p;
};

async function embedCssUrls(css, base, cache) {
  const urls = [...new Set([...css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)].map((m) => m[1]).filter((u) => !u.startsWith('data:')))];
  const map = {};
  await Promise.all(urls.map(async (u) => { map[u] = await toDataUrl(new URL(u, base).href, cache); }));
  return css.replace(/url\(\s*["']?([^"')]+)["']?\s*\)/g, (m, u) => (map[u] ? `url("${map[u]}")` : m));
}

/** Prepare a loaded page for fast capture. Returns capture() -> Promise<HTMLImageElement> of the current frame. */
export async function prepareFastCapture(doc, { width, height, outWidth = width, outHeight = height }) {
  const cache = new Map();
  const base = doc.baseURI;
  // 1. one stylesheet: inline <style> blocks + linked CSS (Google Fonts) with every url() embedded
  let css = '';
  for (const node of [...doc.querySelectorAll('style, link[rel="stylesheet"]')]) {
    if (node.tagName === 'STYLE') css += `${node.textContent}\n`;
    else { try { const t = await (await fetch(node.href)).text(); css += `${await embedCssUrls(t, node.href, cache)}\n`; } catch { /* font CDN blocked: fallback fonts */ } }
  }
  css = await embedCssUrls(css, base, cache);
  css = css.replace(/:root\b/g, 'html');   // inside the SVG image the root element is <svg>, not <html>
  // 2. pictures: swap every <img> src for an embedded copy (once)
  await Promise.all([...doc.images].map(async (img) => {
    const d = await toDataUrl(img.currentSrc || img.src, cache);
    if (d && d !== img.src) { img.removeAttribute('srcset'); img.src = d; }
  }));
  await Promise.all([...doc.images].map((img) => (img.decode ? img.decode().catch(() => {}) : null)));
  // inline style background images (rare)
  for (const el of doc.querySelectorAll('[style*="url("]')) el.setAttribute('style', await embedCssUrls(el.getAttribute('style'), base, cache));
  // 3. scripts and stylesheets are no longer needed in the copies
  doc.querySelectorAll('script, link, style, noscript').forEach((n) => n.remove());
  const styleEl = doc.createElement('style');
  styleEl.textContent = css;
  doc.head.appendChild(styleEl);

  const ser = new XMLSerializer();
  const htmlAttrs = () => [...doc.documentElement.attributes].map((a) => `${a.name}="${a.value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`).join(' ');
  return async function capture() {
    const body = ser.serializeToString(doc.body);
    const head = ser.serializeToString(styleEl);
    // the page is laid out at full size (viewBox) but rasterized straight at the output size
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${outWidth}" height="${outHeight}" viewBox="0 0 ${width} ${height}"><foreignObject x="0" y="0" width="${width}" height="${height}"><html xmlns="http://www.w3.org/1999/xhtml" ${htmlAttrs()}><head>${head}</head>${body}</html></foreignObject></svg>`;
    // a data: URL (not a blob: URL) so the canvas stays readable for the video encoder
    const img = new Image();
    img.decoding = 'async';
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    await img.decode();
    return img;
  };
}
