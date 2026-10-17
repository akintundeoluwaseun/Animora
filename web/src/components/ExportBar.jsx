// The bar at the top of every page while a video is being made (and after it finishes or stops).
import { Link } from 'react-router-dom';
import { cancelExport, dismissExport, saveAgain, useExportJob } from '../lib/exportJob.js';

const mmss = (s) => (s >= 60 ? `${Math.floor(s / 60)} min ${Math.round(s % 60)} s` : `${Math.max(1, Math.round(s))} s`);

export default function ExportBar() {
  const job = useExportJob();
  // while recording, progress shows on the Download button and in the phone's notifications (no bar)
  if (job.status === 'idle' || job.status === 'working') return null;
  const pct = job.progress ? Math.round((job.progress.done / Math.max(1, job.progress.total)) * 100) : 0;
  const tone = job.status === 'failed' || job.status === 'interrupted' ? 'bg-alert' : job.status === 'done' ? 'bg-money' : 'bg-danfo';
  return (
    <div className="export-bar sticky top-0 z-50 border-b border-white/10 bg-[#0B0A12] text-white" role="status" aria-live="polite">
      <div className="mx-auto flex max-w-[1180px] items-center gap-3 px-4 py-2.5 text-sm">
        <span className={`size-2 shrink-0 rounded-full ${tone} ${job.status === 'working' ? 'animate-pulse' : ''}`} aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">
          {job.status === 'working' && <>Making <b>{job.title}</b>{' '}{job.progress?.stage === 'Recording' ? `· ${pct}%${job.progress.eta != null ? ` · about ${mmss(job.progress.eta)} left` : ''}` : `· ${job.progress?.stage || 'Starting'}…`} · keep this tab open</>}
          {job.status === 'done' && <><b>{job.title}</b> is ready. It's in your downloads.</>}
          {job.status === 'failed' && <>Your video didn't finish: {job.error}</>}
          {job.status === 'interrupted' && <>Making <b>{job.title}</b> stopped because the page was closed. Start it again.</>}
        </span>
        {job.status === 'working' && <button className="font-semibold text-white/70 hover:text-white" onClick={cancelExport}>Cancel</button>}
        {job.status === 'done' && <button className="font-semibold hover:underline" onClick={saveAgain}>Save again</button>}
        {(job.status === 'failed' || job.status === 'interrupted') && job.projectId && <Link className="font-semibold hover:underline" to={`/p/${job.projectId}/studio`} onClick={dismissExport}>Try again</Link>}
        {job.status !== 'working' && <button className="text-white/60 hover:text-white" onClick={dismissExport} aria-label="Close">✕</button>}
      </div>
      {job.status === 'working' && <div className="h-0.5 bg-white/10"><div className="h-full bg-danfo transition-[width] duration-300" style={{ width: `${pct}%` }} /></div>}
    </div>
  );
}
