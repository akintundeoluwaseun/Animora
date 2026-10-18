// Download a flyer as a picture (PNG) or a print-ready PDF, made in the browser from the flyer's page.
import { loadFrame } from './exportVideo.js';
import { prepareFastCapture } from './fastCapture.js';

const SIZES = { '9:16': [1080, 1920], '1:1': [1080, 1080], '4:5': [1080, 1350], 'A4': [1240, 1754], '16:9': [1920, 1080] };

async function drawFlyer(html, aspect, scale) {
  const [W, H] = SIZES[aspect] || SIZES['4:5'];
  const width = Math.round(W * scale), height = Math.round(H * scale);
  const { frame, win, doc } = await loadFrame(html, W, H);
  try {
    const capture = await prepareFastCapture(doc, { width: W, height: H, outWidth: width, outHeight: height });
    const img = await capture();
    const c = document.createElement('canvas'); c.width = width; c.height = height;
    const g = c.getContext('2d');
    g.fillStyle = win.getComputedStyle(doc.body).backgroundColor || '#fff'; g.fillRect(0, 0, width, height);
    g.drawImage(img, 0, 0, width, height);
    return c;
  } finally { frame.remove(); }
}

/** A one-page PDF holding the flyer as a JPEG, page size in points (A4 = 595 x 842). */
async function pdfFrom(canvas, aspect) {
  const jpeg = new Uint8Array(await (await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.92))).arrayBuffer());
  const [pw, ph] = aspect === 'A4' ? [595.28, 841.89] : [canvas.width * 0.5, canvas.height * 0.5];
  const enc = new TextEncoder();
  const parts = [], offsets = [];
  let size = 0;
  const push = (x) => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); size += b.length; };
  const obj = (n, body) => { offsets[n] = size; push(`${n} 0 obj\n`); body(); push('\nendobj\n'); };
  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  obj(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2, () => push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'));
  obj(3, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw.toFixed(2)} ${ph.toFixed(2)}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`));
  obj(4, () => { push(`<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`); push(jpeg); push('\nendstream'); });
  const content = `q ${pw.toFixed(2)} 0 0 ${ph.toFixed(2)} 0 0 cm /Im0 Do Q`;
  obj(5, () => push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`));
  const xref = size;
  push(`xref\n0 6\n0000000000 65535 f \n${[1, 2, 3, 4, 5].map((n) => `${String(offsets[n]).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(parts, { type: 'application/pdf' });
}

export async function exportFlyer({ html, aspect = '4:5', format = 'png' }) {
  const scale = aspect === 'A4' ? 2 : format === 'pdf' ? 2 : 1;   // print: twice the screen size (about 300 dpi on A4)
  const canvas = await drawFlyer(html, aspect, scale);
  if (format === 'pdf') return pdfFrom(canvas, aspect);
  return new Promise((r) => canvas.toBlob(r, 'image/png'));
}
