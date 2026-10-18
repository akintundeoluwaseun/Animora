// Page 3: watch an ad if needed, render with our engine, then download.
import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api, ASPECTS, clock, duration, naira, useAuth, usePolling } from '../lib.jsx';
import { Alert, Button, Modal, PageLoader, Spinner, Steps } from '../components/ui.jsx';
import { VideoPhone } from '../components/Preview.jsx';

function AdGate({ open, projectId, onDone, onCancel }) {
  const [ad, setAd] = useState(null);
  const [left, setLeft] = useState(null);
  const [error, setError] = useState('');
  const [muted, setMuted] = useState(true);
  const [busy, setBusy] = useState(false);
  const videoRef = useRef(null);
  const startedAt = useRef(0);

  useEffect(() => {
    if (!open) return undefined;
    setAd(null); setError(''); setLeft(null);
    api('/ads/start', { method: 'POST', body: { projectId } }).then((r) => {
      setAd(r); startedAt.current = Date.now(); setLeft(r.ad.durationSeconds);
    }).catch((e) => setError(e.message));
    return undefined;
  }, [open, projectId]);

  useEffect(() => {
    if (!ad) return undefined;
    const t = setInterval(() => {
      const l = Math.max(0, Math.ceil(ad.ad.durationSeconds - (Date.now() - startedAt.current) / 1000));
      setLeft(l);
    }, 250);
    return () => clearInterval(t);
  }, [ad]);

  const finish = async () => {
    setBusy(true); setError('');
    try { await api(`/ads/${ad.adViewId}/complete`, { method: 'POST' }); onDone(ad.adViewId); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={left === 0 ? finish : onCancel} label="Sponsored video">
      <div className="mb-3 flex items-center justify-between text-sm">
        <span className="font-semibold">Sponsored · {ad?.ad.advertiser || '…'}</span>
        <span className="tabular-nums text-ink-mute">{left === null ? '' : left > 0 ? `Your video unlocks in ${left}s` : 'Unlocked'}</span>
      </div>
      <Alert>{error}</Alert>
      <div className="relative mx-auto aspect-[9/16] max-h-[60vh] overflow-hidden rounded-3xl bg-ink">
        {ad && <video ref={videoRef} src={ad.ad.videoUrl} poster={ad.ad.posterUrl || undefined} className="size-full object-cover" autoPlay muted={muted} playsInline loop />}
        {!ad && !error && <div className="grid size-full place-items-center text-white/60"><Spinner /></div>}
        {ad && <button onClick={() => setMuted(!muted)} className="absolute bottom-3 right-3 rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white">{muted ? 'Tap for sound' : 'Mute'}</button>}
      </div>
      <p className="mt-3 text-center text-sm text-ink-soft">Ads keep Animora free. Pro members skip ads for 30 videos a month.</p>
      <div className="mt-4 flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={onCancel}>Cancel</Button>
        <Button className="flex-1" disabled={left !== 0} loading={busy} onClick={finish}>{left === 0 ? 'Start my video' : `Wait ${left ?? ''}s`}</Button>
      </div>
    </Modal>
  );
}

function Progress({ render, onCancel }) {
  const pct = Number(render.progress) || 0;
  const queued = render.status === 'queued';
  const [since] = useState(() => Date.now());
  const [, tick] = useState(0);
  useEffect(() => { if (!queued) return undefined; const t = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(t); }, [queued]);
  const waited = Math.round((Date.now() - since) / 1000);
  return (
    <div className="surface mx-auto max-w-lg p-6 text-center sm:p-8">
      <p className="font-display text-7xl font-extrabold tabular-nums" aria-live="polite">{queued ? '…' : `${Math.round(pct)}%`}</p>
      <p className="mt-2 font-semibold">{queued ? (render.queuePosition ? `In the queue · ${render.queuePosition} video${render.queuePosition > 1 ? 's' : ''} ahead of yours` : `Starting the video server · ${waited} s`) : pct >= 98 ? 'Finishing and saving your MP4…' : 'Rendering your video frame by frame'}</p>
      <div className="mt-6 h-3 overflow-hidden rounded-full bg-lilac" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-danfo transition-[width] duration-700" style={{ width: `${queued ? Math.min(12, 2 + waited / 4) : pct}%` }} />
      </div>
      {queued && <p className="mt-3 text-sm text-ink-soft">A computer on GitHub is getting ready. This usually takes 20 to 40 seconds, then recording starts.</p>}
      {!queued && (
        <p className="mt-3 text-sm tabular-nums text-ink-soft">
          Frame {render.framesDone.toLocaleString()} of {render.totalFrames.toLocaleString()}
          {render.etaSeconds > 0 && ` · about ${clock(render.etaSeconds)} left`}
        </p>
      )}
      <p className="mt-6 text-sm text-ink-mute">You can close Animora. It keeps going, and you get a notification when your MP4 is ready.</p>
      <button onClick={onCancel} className="mt-3 text-sm font-semibold text-alert hover:underline">Cancel render</button>
    </div>
  );
}

// Fetch the whole MP4. Videos made online come back in 4 MB ranges, so ask for each part in turn.
async function fetchVideo(url, onProgress = () => {}) {
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

async function downloadVideo(render, title, onProgress) {
  const blob = await fetchVideo(render.videoUrl, onProgress);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${String(title || 'animora-video').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').replace(/-{2,}/g, '-') || 'animora-video'}.mp4`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function DownloadButton({ render, title }) {
  const [pct, setPct] = useState(null);
  return (
    <Button size="lg" loading={pct != null} onClick={async () => { setPct(0); try { await downloadVideo(render, title, setPct); } finally { setPct(null); } }}>
      {pct != null ? `Saving ${Math.round(pct * 100)}%` : 'Download MP4'}
    </Button>
  );
}

async function shareVideo(render, title) {
  try {
    const blob = await fetchVideo(render.videoUrl);
    const file = new File([blob], `${title || 'animora-video'}.mp4`, { type: 'video/mp4' });
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title }); return true; }
  } catch { /* fall through */ }
  return false;
}

export default function Render() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const { refresh } = useAuth();
  const [project, setProject] = useState(null);
  const [check, setCheck] = useState(null);
  const [render, setRender] = useState(null);
  const [script, setScript] = useState(null);
  const [scriptError, setScriptError] = useState('');
  const [adOpen, setAdOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [canShare, setCanShare] = useState(true);

  const loadRender = async (rid) => { const r = await api(`/renders/${rid}`); setRender(r.render); return r.render; };

  useEffect(() => {
    api(`/projects/${id}/voiceover`)
      .then((r) => setScript(r.formats))
      .catch((e) => setScriptError(e.message));
    (async () => {
      try {
        const [p, c, list] = await Promise.all([api(`/projects/${id}`), api(`/projects/${id}/render-check`), api('/renders')]);
        setProject(p.project); setCheck(c);
        // the last MP4 of this video, unless the video was edited after it was made (then make a new one)
        const last = list.renders.find((x) => x.projectId === id);
        const rid = params.get('r') || (last && (!last.stale || ['queued', 'rendering'].includes(last.status)) ? last.id : null);
        if (rid) await loadRender(rid);
        else if (params.get('new') && c.ok !== false && !c.needsAd) autoStart.current = true;
      } catch (e) { setError(e.message); }
    })();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const active = render && ['queued', 'rendering'].includes(render.status);
  const autoStart = useRef(false);
  useEffect(() => { if (autoStart.current && check && !render && !busy) { autoStart.current = false; start(); } });   // "Generate Video" in the editor starts straight away
  usePolling(async () => {
    const r = await loadRender(render.id).catch(() => null);
    if (r?.status === 'done') refresh();
  }, 1500, active);

  const start = async (adViewId) => {
    setBusy(true); setError(''); setAdOpen(false);
    try {
      const r = await api(`/projects/${id}/renders`, { method: 'POST', body: { adViewId } });
      setRender(r.render); setParams({ r: r.render.id }, { replace: true }); refresh();
    } catch (e) {
      if (e.data?.code === 'AD_REQUIRED') setAdOpen(true); else setError(e.message);
    } finally { setBusy(false); }
  };
  const begin = () => (check?.needsAd ? setAdOpen(true) : start());
  const retry = () => (render?.paidVia === 'ad' ? start(render.adViewId) : begin());

  const cancel = async () => {
    if (!confirm('Cancel this render? You get your video credit back.')) return;
    try { setRender((await api(`/renders/${render.id}/cancel`, { method: 'POST' })).render); refresh(); } catch (e) { setError(e.message); }
  };

  const downloadScript = () => {
    if (!script?.plain) return;
    const href = URL.createObjectURL(new Blob([script.plain], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = href;
    a.download = `${project.title || 'narration-script'}.txt`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(href), 1000);
  };

  if (!project || !check) return error ? <div className="mx-auto max-w-xl p-8"><Alert>{error}</Alert></div> : <PageLoader />;
  const user = check.user;
  const tooLong = check.ok === false;

  return (
    <div className="mx-auto max-w-6xl px-4 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="truncate text-xl font-extrabold sm:text-2xl">{project.title}</h1>
        <Steps current="render" projectId={id} hasPlan={!!project.plan} hasCode={!!project.code} />
      </div>
      {error && <div className="mt-4"><Alert onClose={() => setError('')}>{error}</Alert></div>}

      <div className="mt-8">
        {render?.status === 'done' ? (
          <div className={`grid items-start gap-10 ${render.aspectRatio === '16:9' ? 'lg:grid-cols-[680px_1fr]' : 'md:grid-cols-[400px_1fr]'}`}>
            <div className="stage px-6 py-8"><VideoPhone src={render.videoUrl} poster={render.thumbnailUrl} aspect={render.aspectRatio} maxWidth={320} /><div className="stage-floor" /></div>
            <div className="md:pt-6">
              <p className="text-sm font-semibold text-money">Your video is ready</p>
              <h2 className="mt-1 text-3xl font-extrabold">Download and post it</h2>
              <p className="mt-2 text-ink-soft">{duration(render.durationSeconds)} · {ASPECTS[render.aspectRatio]?.w}×{ASPECTS[render.aspectRatio]?.h} MP4 · {(render.fileSize / 1e6).toFixed(1)} MB · plays on every phone.</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <DownloadButton render={render} title={project.title} />
                {project.plan?.voiceover?.enabled && (script
                  ? <Button variant="outline" size="lg" onClick={downloadScript}>Download narration script</Button>
                  : <Button as={Link} to={`/p/${id}/studio`} variant="outline" size="lg">Open narration script</Button>)}
                {canShare && <Button variant="outline" size="lg" onClick={async () => setCanShare(await shareVideo(render, project.title))}>Share to WhatsApp</Button>}
              </div>
              {scriptError && <p className="mt-2 text-sm text-alert">Could not load the narration script: {scriptError}</p>}
              {!canShare && <p className="mt-2 text-sm text-ink-mute">Sharing isn't supported on this device. Download the MP4, then post it from your gallery.</p>}
              <div className="mt-10 flex flex-wrap gap-3 border-t border-ink/10 pt-6">
                <Button as={Link} to={`/p/${id}/studio`} variant="ghost">Edit and render again</Button>
                <Button as={Link} to="/videos?new=1" variant="ghost">Make another video</Button>
              </div>
            </div>
          </div>
        ) : active ? (
          <Progress render={render} onCancel={cancel} />
        ) : (
          <div className="mx-auto max-w-lg">
            {render?.status === 'failed' && <div className="mb-4"><Alert>{render.error} Your video credit was returned.</Alert></div>}
            <div className="surface p-6 sm:p-8">
              <h2 className="text-2xl font-extrabold">Make your MP4</h2>
              <dl className="mt-5 space-y-3 text-[15px]">
                <div className="flex justify-between"><dt className="text-ink-soft">Length</dt><dd className="font-semibold">{duration(project.durationSeconds)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-ink-soft">Audio</dt><dd className="text-right font-semibold">{project.sfx === false ? 'None (sound is off)' : 'Included, as in the preview'}</dd></div>
                {project.plan?.voiceover?.enabled && <div className="flex justify-between gap-3"><dt className="text-ink-soft">Narration</dt><dd className="text-right font-semibold"><Link to={`/p/${id}/studio`} className="underline">Script for ElevenLabs or another generator</Link></dd></div>}
                <div className="flex justify-between"><dt className="text-ink-soft">Format</dt><dd className="font-semibold">{ASPECTS[project.aspectRatio]?.label} · {project.aspectRatio}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-soft">Frames</dt><dd className="font-semibold tabular-nums">{(project.durationSeconds * 30).toLocaleString()} at 30 fps</dd></div>
              </dl>

              <div className="mt-6 rounded-2xl bg-lilac p-4 text-sm">
                {tooLong ? <p className="text-alert">{check.error}</p>
                  : check.needsAd
                    ? <p>{user.plan === 'pro' ? `You've used all your Pro videos this month. ` : ''}Watch a 15-second ad to unlock this video. <Link to="/checkout" className="font-semibold underline">Go Pro</Link> to skip ads.</p>
                    : user.testMode ? <p>Test mode: no ad, no limit. Your video starts rendering straight away.</p>
                    : <p>Ad-free · uses 1 of your Pro videos ({user.proVideosRemaining} left this month).</p>}
              </div>
              {tooLong
                ? <Button as={Link} to="/checkout" size="lg" className="mt-5 w-full">Upgrade to Pro — {naira(5000)}/month</Button>
                : <Button size="lg" className="mt-5 w-full" onClick={render?.status === 'failed' ? retry : begin} loading={busy}>{check.needsAd ? 'Watch ad & Generate Video' : 'Generate Video'}</Button>}
            </div>
          </div>
        )}
      </div>
      <AdGate open={adOpen} projectId={id} onDone={(viewId) => start(viewId)} onCancel={() => setAdOpen(false)} />
    </div>
  );
}
