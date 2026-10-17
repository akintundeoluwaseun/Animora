// "Download MP4": the browser records the video from its code, frame by frame, and saves the file.
// Nothing is uploaded or stored online; on another phone the same code is simply recorded again.
import { useRef, useState } from 'react';
import { Alert, Button, Modal } from './ui.jsx';
import { prepareHtml } from './Preview.jsx';

const fileName = (title) => `${String(title || 'animora-video').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').replace(/-{2,}/g, '-').slice(0, 60) || 'animora-video'}.mp4`;
const mmss = (s) => (s >= 60 ? `${Math.floor(s / 60)} min ${Math.round(s % 60)} s` : `${Math.max(1, Math.round(s))} s`);

export default function DownloadVideo({ project, size = 'md', className = '' }) {
  const [open, setOpen] = useState(false);
  const [quality, setQuality] = useState(() => (window.innerWidth < 900 ? 'fast' : 'hd'));
  const [state, setState] = useState('idle');   // idle | working | done
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');
  const abort = useRef(null);

  const start = async () => {
    setError(''); setState('working'); setProgress({ stage: 'Getting ready', done: 0, total: 1 });
    abort.current = new AbortController();
    try {
      const { exportVideo, saveBlob } = await import('../lib/exportVideo.js');
      const blob = await exportVideo({ html: prepareHtml(project.code), aspect: project.aspectRatio || '9:16', fps: 30, quality, signal: abort.current.signal, onProgress: setProgress });
      saveBlob(blob, fileName(project.title));
      setState('done');
    } catch (e) {
      setState('idle');
      if (e?.name !== 'AbortError') setError(e?.message || "Couldn't make the video. Try again.");
    }
  };
  const close = () => { abort.current?.abort(); setOpen(false); setState('idle'); setProgress(null); };
  const pct = progress ? Math.round((progress.done / Math.max(1, progress.total)) * 100) : 0;

  return (
    <>
      <Button size={size} className={className} onClick={() => setOpen(true)} disabled={!project?.code}>Download MP4</Button>
      <Modal open={open} onClose={state === 'working' ? undefined : close} label="Download your video">
        <h2 className="text-xl font-bold">Download your video</h2>
        {state === 'idle' && (
          <>
            <p className="mt-2 text-sm text-ink-soft">Your phone or computer records the video right here, then saves the MP4. Keep this page open until it finishes.</p>
            <div className="mt-4 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Quality">
              {[['hd', 'HD 1080p', 'Sharpest'], ['fast', 'Quick 720p', 'About twice as fast']].map(([v, l, d]) => (
                <button key={v} type="button" role="radio" aria-checked={quality === v} onClick={() => setQuality(v)}
                  className={`rounded-[10px] border p-3 text-left ${quality === v ? 'border-ink bg-ink text-white' : 'border-ink/15 bg-white'}`}>
                  <span className="block font-semibold">{l}</span><span className="block text-xs opacity-70">{d}</span>
                </button>
              ))}
            </div>
            <div className="mt-3"><Alert>{error}</Alert></div>
            <div className="mt-4 flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={close}>Cancel</Button>
              <Button className="flex-1" onClick={start}>Start</Button>
            </div>
          </>
        )}
        {state === 'working' && (
          <>
            <p className="mt-2 text-sm text-ink-soft" aria-live="polite">
              {progress?.stage === 'Recording' ? `Recording frame ${progress.done} of ${progress.total}${progress.eta != null ? ` · about ${mmss(progress.eta)} left` : ''}` : `${progress?.stage || 'Working'}…`}
            </p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-lilac"><div className="h-full rounded-full bg-danfo transition-[width] duration-300" style={{ width: `${pct}%` }} /></div>
            <p className="mt-2 text-right text-sm tabular-nums text-ink-mute">{pct}%</p>
            <Button variant="ghost" className="mt-3 w-full" onClick={close}>Cancel</Button>
          </>
        )}
        {state === 'done' && (
          <>
            <p className="mt-2 text-ink-soft">Your MP4 is saved to your downloads as <b>{fileName(project.title)}</b>.</p>
            <div className="mt-4 flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => { setState('idle'); }}>Make another</Button>
              <Button className="flex-1" onClick={close}>Done</Button>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
