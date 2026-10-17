// The full screen you see while your MP4 is being made (no bar at the top of the page).
// It shows the progress, says plainly when it is paused, and gives Try again / Save again at the end.
import { useNavigate } from 'react-router-dom';
import { canRetry, cancelExport, dismissExport, fileName, minimizeExport, retryExport, saveAgain, useExportJob } from '../lib/exportJob.js';

const left = (s) => (s >= 60 ? `about ${Math.round(s / 60)} min left` : `about ${Math.max(1, Math.round(s))} s left`);

export default function ExportScreen() {
  const job = useExportJob();
  const go = useNavigate();
  if (job.status === 'idle' || (job.status === 'working' && job.minimized)) return null;
  const p = job.progress || { stage: 'Getting ready', done: 0, total: 1 };
  const pct = Math.round((p.done / Math.max(1, p.total)) * 100);
  const paused = job.status === 'working' && p.stage === 'Paused';

  let heading, line;
  if (job.status === 'working') {
    if (paused) { heading = 'Paused'; line = "Phones stop making videos while Animora is in the background. It carries on from here now you're back."; }
    else if (p.stage === 'Recording') { heading = `${pct}%`; line = p.eta != null ? `Recording your video · ${left(p.eta)}` : 'Recording your video'; }
    else if (p.stage === 'Adding sound') { heading = '99%'; line = 'Adding the music and sound effects'; }
    else { heading = '0%'; line = 'Getting your video ready'; }
  } else if (job.status === 'done') { heading = 'Saved'; line = `${fileName(job.title)} is in your downloads.`; }
  else if (job.status === 'failed') { heading = "It didn't finish"; line = job.error; }
  else { heading = 'It stopped'; line = 'The page was closed before your video was made. Start it again and keep Animora open on screen.'; }

  const close = () => dismissExport();
  const again = () => { if (canRetry()) retryExport(); else { close(); if (job.projectId) go(`/p/${job.projectId}/studio`); } };

  return (
    <div className="export-screen fixed inset-0 z-[80] flex flex-col bg-[#0B0A12] text-white" role="dialog" aria-modal="true" aria-label="Making your MP4">
      <div className="mx-auto flex w-full max-w-[460px] flex-1 flex-col justify-center px-6 py-10">
        <div className="flex items-center gap-3">
          <img src="/animora-mark.png" alt="" className="size-9" />
          <div className="min-w-0">
            <p className="text-sm text-white/60">Making your MP4</p>
            <p className="truncate font-semibold">{job.title}</p>
          </div>
        </div>

        <p className={`mt-14 text-[64px] font-bold leading-none tracking-tight tabular-nums ${job.status === 'failed' || job.status === 'interrupted' ? 'text-[40px]' : ''}`}>{heading}</p>
        <p className="mt-4 min-h-[3em] text-white/75" aria-live="polite">{line}</p>

        {job.status === 'working' && (
          <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
            <div className={`h-full rounded-full transition-[width] duration-500 ${paused ? 'bg-white/40' : 'bg-danfo'}`} style={{ width: `${Math.max(2, pct)}%` }} />
          </div>
        )}
        {job.status === 'working' && !paused && <p className="mt-4 text-sm text-white/50">Keep this screen open. The progress also shows in your notifications.</p>}

        <div className="mt-10 flex flex-col gap-2">
          {job.status === 'working' && <>
            <button className="h-12 rounded-full border border-white/20 font-semibold hover:bg-white/5" onClick={() => minimizeExport(true)}>Hide this screen</button>
            <button className="h-12 rounded-full font-semibold text-white/60 hover:text-white" onClick={cancelExport}>Cancel download</button>
          </>}
          {job.status === 'done' && <>
            <button className="h-12 rounded-full bg-danfo font-semibold hover:bg-danfo-deep" onClick={close}>Done</button>
            <button className="h-12 rounded-full font-semibold text-white/70 hover:text-white" onClick={saveAgain}>Save it again</button>
          </>}
          {(job.status === 'failed' || job.status === 'interrupted') && <>
            <button className="h-12 rounded-full bg-danfo font-semibold hover:bg-danfo-deep" onClick={again}>Try again</button>
            <button className="h-12 rounded-full font-semibold text-white/60 hover:text-white" onClick={close}>Close</button>
          </>}
        </div>
      </div>
    </div>
  );
}
