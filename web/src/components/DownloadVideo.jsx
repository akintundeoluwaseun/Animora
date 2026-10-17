// "Download MP4": your phone or computer records the video and saves the file (nothing is stored online).
// The recording itself runs in lib/exportJob.js so it continues while you move around the app.
import { useState } from 'react';
import { Button, Modal } from './ui.jsx';
import { startExport, useExportJob } from '../lib/exportJob.js';

export default function DownloadVideo({ project, size = 'md', className = '' }) {
  const job = useExportJob();
  const [open, setOpen] = useState(false);
  const [quality, setQuality] = useState(() => (window.innerWidth < 900 ? 'fast' : 'hd'));
  const busy = job.status === 'working';
  const start = () => { setOpen(false); startExport({ project, quality }); };
  return (
    <>
      <Button size={size} className={className} onClick={() => setOpen(true)} disabled={!project?.code || busy}>
        {busy && job.projectId === project.id ? (job.progress?.stage === 'Recording' ? `Downloading ${Math.round((job.progress.done / Math.max(1, job.progress.total)) * 100)}%` : 'Getting ready…') : busy ? 'Another download is running' : 'Download MP4'}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} label="Download your video">
        <h2 className="text-xl font-bold">Download your video</h2>
        <p className="mt-2 text-sm text-ink-soft">Your phone or computer makes the MP4 and saves it to your downloads. The progress shows on this button and in your notifications. Keep Animora open until it's done.</p>
        <div className="mt-4 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Quality">
          {[['hd', 'HD 1080p', 'Sharpest, slower'], ['fast', 'Quick 720p', 'About 3× faster']].map(([v, l, d]) => (
            <button key={v} type="button" role="radio" aria-checked={quality === v} onClick={() => setQuality(v)}
              className={`rounded-[10px] border p-3 text-left ${quality === v ? 'border-ink bg-ink text-white' : 'border-ink/15 bg-white text-ink'}`}>
              <span className="block font-semibold">{l}</span><span className="block text-xs opacity-70">{d}</span>
            </button>
          ))}
        </div>
        <div className="mt-5 flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={() => setOpen(false)}>Cancel</Button>
          <Button className="flex-1" onClick={start}>Start</Button>
        </div>
      </Modal>
    </>
  );
}
