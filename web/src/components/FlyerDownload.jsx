import { publicMessage } from '../lib/errors.js';
// Download a flyer: a picture for WhatsApp / Instagram, or a PDF for printing. Made on this device in a few seconds.
import { useState } from 'react';
import { Button } from './ui.jsx';
import { prepareHtml } from './Preview.jsx';

const fileName = (title, ext) => `${String(title || 'flyer').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'flyer'}.${ext}`;

export default function FlyerDownload({ project, size = 'md', className = '', alt = 'outline' }) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const go = async (format) => {
    setBusy(format); setError('');
    try {
      const { exportFlyer } = await import('../lib/flyerExport.js');
      const { saveBlob } = await import('../lib/exportVideo.js');
      const blob = await exportFlyer({ html: prepareHtml(project.code), aspect: project.aspectRatio, format });
      saveBlob(blob, fileName(project.title, format));
    } catch (e) { setError(e?.message || "Couldn't make the file. Try again."); }
    finally { setBusy(''); }
  };
  return (
    <div className={className}>
      <div className="flex flex-wrap gap-2">
        <Button size={size} onClick={() => go('png')} loading={busy === 'png'} disabled={!project?.code || !!busy}>Download picture</Button>
        <Button size={size} variant={alt} onClick={() => go('pdf')} loading={busy === 'pdf'} disabled={!project?.code || !!busy}>PDF for printing</Button>
      </div>
      {error && <p className="mt-2 text-sm text-alert" role="alert">{publicMessage(error)}</p>}
    </div>
  );
}
