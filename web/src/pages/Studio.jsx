import { announceKind } from '../components/Shell.jsx';
import { publicMessage } from '../lib/errors.js';
// Page 2: live preview + edit by prompt + code view.
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, ASPECTS, duration, shrinkImage } from '../lib.jsx';
import { Alert, Button, Modal, PageLoader, Spinner, Steps } from '../components/ui.jsx';
import MicButton from '../components/MicButton.jsx';
import { FullView, LivePreview } from '../components/Preview.jsx';
import VoicePanel from '../components/VoicePanel.jsx';
import DownloadVideo from '../components/DownloadVideo.jsx';
import FlyerDownload from '../components/FlyerDownload.jsx';
import BuyCredits from '../components/BuyCredits.jsx';
import { enablePush } from '../lib/notify.js';
import { KindBadge } from './Dashboard.jsx';

const SUGGESTIONS = ['Start by zooming into my logo', 'Make the text bigger', 'Use calmer, premium transitions', 'Make the price stand out more'];
const FLYER_SUGGESTIONS = ['Try a different layout', 'Make the headline shorter', 'Show the prices bigger', 'Use darker colours'];
// While the server makes the video: what it's doing now, and that it's safe to leave.
function Generating({ message, startedAt, pushOn, flyer }) {
  const what = flyer ? 'flyer' : 'video';
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const secs = startedAt ? Math.max(0, Math.round((now - new Date(startedAt).getTime()) / 1000)) : 0;
  return (
    <div className="grid min-h-[60vh] place-items-center px-4 text-center">
      <div className="max-w-sm">
        <div className="stage mx-auto grid size-28 place-items-center !rounded-[2rem]">
          <img src="/animora-mark.png" width="56" height="56" alt="" className="animate-pulse" />
        </div>
        <p className="mt-6 text-2xl font-bold tracking-[-0.03em]" aria-live="polite">{message || `Making your ${what}`}…</p>
        <p className="mt-2 tabular-nums text-ink-mute">{secs >= 60 ? `${Math.floor(secs / 60)} min ${secs % 60} s` : `${secs} s`}</p>
        <div className="mx-auto mt-5 h-1 w-48 overflow-hidden rounded-full bg-lilac"><div className="gen-sweep h-full w-1/3 rounded-full bg-danfo" /></div>
        <p className="mt-6 text-sm leading-relaxed text-ink-soft">
          {pushOn ? `You can close Animora. We'll send a notification to this device when your ${what} is ready.` : `You can leave this page; your ${what} keeps being made. Allow notifications to get told when it is ready.`}
        </p>
      </div>
    </div>
  );
}

// After the person watches to the end (or the flyer is ready): happy with it, or tell the AI what to change.
function Feedback({ open, project, onClose, onUpdate, onHappy }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const flyer = project.kind === 'flyer';
  const chips = flyer ? ['Make the headline bigger', 'Try a different layout', 'Use my photos more'] : ['Make it slower and calmer', 'Make the text bigger', 'Show my logo more', 'Change the ending'];
  const send = async () => {
    const msg = text.trim(); if (!msg || busy) return;
    setBusy(true); setError('');
    try { const r = await api(`/projects/${project.id}/edit`, { method: 'POST', body: { instruction: msg } }); onUpdate(r.project); setText(''); onClose(); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={() => !busy && onClose()} label="How is it?">
      {busy ? (
        <div className="py-8 text-center"><Spinner className="mx-auto size-8" /><p className="mt-3 font-semibold">Changing your {flyer ? 'flyer' : 'video'}…</p><p className="mt-1 text-sm text-ink-mute">Animora is working on your change. This takes about 20 to 60 seconds.</p></div>
      ) : (
        <>
          <h2 className="text-xl font-bold">How is it?</h2>
          <p className="mt-1 text-sm text-ink-soft">Not quite right? Tell Animora what to change, in your own words. Say everything at once; it does all of it in one go.</p>
          <div className="mt-4 flex items-start gap-2">
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} autoFocus aria-label="What should change?"
              placeholder={flyer ? 'e.g. "Put the prices in big circles and use my second photo"' : 'e.g. "Slow down the start, make the logo bigger, and end with my phone number"'}
              className="min-w-0 flex-1 resize-none rounded-[12px] border border-ink/15 bg-white px-3 py-2.5 text-[15px] text-ink outline-none focus:border-ink/40" />
            <MicButton onText={(t) => setText((x) => `${x ? `${x.trim()} ` : ''}${t}`)} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {chips.map((c) => <button key={c} type="button" className="chip press !px-3 !py-1.5 !text-xs" onClick={() => setText((x) => (x ? `${x.trim()}. ${c}` : c))}>{c}</button>)}
          </div>
          {error && <p className="mt-3 text-sm text-alert" role="alert">{publicMessage(error)}</p>}
          <div className="mt-5 flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={onHappy}>{flyer ? 'Looks good' : 'Looks good, make the MP4'}</Button>
            <Button className="flex-1" onClick={send} disabled={!text.trim()}>Make the change</Button>
          </div>
        </>
      )}
    </Modal>
  );
}

function EditPanel({ project, onUpdate }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef(null);
  const history = project.editHistory || [];
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [history.length, busy]);

  const [pasting, setPasting] = useState(false);
  // paste a picture into the edit box: it is uploaded and named in the instruction so the AI can use it
  const onPaste = async (e) => {
    const f = [...(e.clipboardData?.files || [])].find((x) => x.type.startsWith('image/'));
    if (!f) return;
    e.preventDefault(); setPasting(true); setError('');
    try {
      const form = new FormData();
      const name = `pasted picture ${Date.now() % 10000}`;
      form.append('file', await shrinkImage(new File([f], `${name}.png`, { type: f.type }))); form.append('role', 'photo'); form.append('name', name);
      const { asset } = await api(`/projects/${project.id}/assets`, { method: 'POST', form });
      setText((t) => `${t ? `${t.trim()} ` : ''}(use the picture "${asset.name}")`);
    } catch (err) { setError(err.message); } finally { setPasting(false); }
  };

  const send = async (instruction) => {
    const msg = (instruction ?? text).trim();
    if (!msg || busy) return;
    setBusy(true); setError(''); setText('');
    try {
      const r = await api(`/projects/${project.id}/edit`, { method: 'POST', body: { instruction: msg } });
      onUpdate(r.project);
    } catch (e) { setError(e.message); setText(msg); } finally { setBusy(false); }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {history.length === 0 && <p className="text-ink-soft">Tell me what to change, in your own words. {project.kind === 'flyer' ? "I'll update the flyer" : "I'll update the video"} and you'll see it straight away.</p>}
        {history.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : ''}`}>
            <div className={`max-w-[88%] px-4 py-2.5 text-[15px] ${m.role === 'user' ? 'bubble-user' : 'bubble-ai'}`}>{m.text}</div>
          </div>
        ))}
        {busy && <div className="flex"><div className="bubble-ai typing px-4 py-3.5"><span /><span /><span /></div></div>}
        <div ref={endRef} />
      </div>
      <div className="border-t border-ink/8 bg-lilac/40 p-3">
        {error && <div className="mb-2"><Alert onClose={() => setError('')}>{error}</Alert></div>}
        <div className="mb-2 flex flex-wrap gap-1.5">
          {(project.kind === 'flyer' ? FLYER_SUGGESTIONS : SUGGESTIONS).map((s) => <button key={s} disabled={busy} onClick={() => send(s)} className="chip press !px-3 !py-1.5 !text-xs">{s}</button>)}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} onPaste={onPaste} placeholder={pasting ? 'Adding your picture…' : 'e.g. "Zoom into the logo first" (you can paste a picture)'} aria-label="Describe a change"
            className="h-12 flex-1 rounded-[10px] border border-ink/15 bg-white px-4 text-[15px] focus:border-ink focus:outline-none" />
          <MicButton onText={(t) => setText((x) => (x.trim() ? `${x.trim()} ${t}` : t))} onError={setError} />
          <Button type="submit" variant="dark" className="h-12" loading={busy} disabled={!text.trim()}>Apply</Button>
        </form>
      </div>
    </div>
  );
}

function CodePanel({ project, onUpdate }) {
  const [code, setCode] = useState(project.code);
  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => { setCode(project.code); }, [project.code]);
  const save = async () => {
    setBusy(true); setProblems(null); setSaved(false);
    try { const r = await api(`/projects/${project.id}/code`, { method: 'PUT', body: { html: code } }); onUpdate(r.project); setSaved(true); }
    catch (e) { setProblems(e.data?.problems || [e.message]); } finally { setBusy(false); }
  };
  return (
    <div className="flex h-full flex-col p-4">
      <p className="mb-2 text-sm text-ink-soft">The AI-written HTML/CSS/GSAP code. Edit it directly if you know code; it's checked before saving.</p>
      <textarea value={code} onChange={(e) => { setCode(e.target.value); setSaved(false); }} spellCheck={false} aria-label="Animation code"
        className="min-h-0 flex-1 resize-none rounded-2xl bg-[#14102E] p-3 font-mono text-xs leading-relaxed text-[#E8E4FF] focus:outline-none" />
      {problems && <div className="mt-2"><Alert>{problems.map((p) => <div key={p}>• {p}</div>)}</Alert></div>}
      {saved && <div className="mt-2"><Alert kind="success">Saved. The preview has been updated.</Alert></div>}
      <div className="mt-3 flex gap-2">
        <Button variant="dark" size="sm" onClick={save} loading={busy} disabled={code === project.code}>Save code</Button>
        <Button variant="ghost" size="sm" onClick={() => navigator.clipboard?.writeText(code)}>Copy</Button>
      </div>
    </div>
  );
}

// "Adjust": change the size, colours, text size and speed with a tap, instantly, without typing to the AI.
const SIZES_VIDEO = [['9:16', 'Status / TikTok'], ['1:1', 'Square'], ['4:5', 'Feed post'], ['16:9', 'YouTube']];
const SIZES_FLYER = [['4:5', 'Feed post'], ['9:16', 'Status / Story'], ['1:1', 'Square'], ['A4', 'Print A4']];
const COLOR_FIELDS = [['primary', 'Main colour'], ['secondary', 'Second colour'], ['background', 'Background'], ['text', 'Text']];
function AdjustPanel({ project, onUpdate }) {
  const flyer = project.kind === 'flyer';
  const [look, setLook] = useState(null);
  const [cols, setCols] = useState({});
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  useEffect(() => { api(`/projects/${project.id}/look`).then((l) => { setLook(l); setCols(l.colors || {}); }).catch(() => setLook({})); }, [project.id, project.code]);
  const apply = async (key, changes) => {
    setBusy(key); setErr(''); setMsg('');
    try { const r = await api(`/projects/${project.id}/adjust`, { method: 'POST', body: changes }); onUpdate(r.project); setMsg(r.summary); }
    catch (e) { setErr(e.message); } finally { setBusy(''); }
  };
  const changedCols = Object.fromEntries(Object.entries(cols).filter(([k, v]) => v && look?.colors?.[k] && v.toLowerCase() !== String(look.colors[k]).toLowerCase()));
  const chip = (on) => `press rounded-xl border px-3 py-2.5 text-left text-sm ${on ? 'border-ink bg-ink text-white' : 'border-ink/12 bg-white hover:border-ink/30'}`;
  return (
    <div className="h-full space-y-6 overflow-y-auto p-4">
      {msg && <p className="rounded-xl bg-money/10 px-3 py-2 text-sm font-semibold text-ink" role="status">{msg} Undo is under the preview.</p>}
      {err && <Alert onClose={() => setErr('')}>{err}</Alert>}
      <div>
        <h3 className="font-bold">Size</h3>
        <p className="text-sm text-ink-mute">Same design, new shape. Your words and shots stay.</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {(flyer ? SIZES_FLYER : SIZES_VIDEO).map(([v, l]) => (
            <button key={v} type="button" disabled={!!busy || project.aspectRatio === v} onClick={() => apply('size', { aspect: v })} className={chip(project.aspectRatio === v)} aria-pressed={project.aspectRatio === v}>
              <span className="block font-semibold">{busy === 'size' ? '…' : v}</span><span className="block text-xs opacity-70">{l}</span>
            </button>
          ))}
        </div>
      </div>
      {look?.themes?.length > 0 && (
        <div>
          <h3 className="font-bold">Look</h3>
          <p className="text-sm text-ink-mute">A whole new style: fonts, colours and background. Your words stay.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {look.themes.map((t) => {
              const on = look.theme === t.key;
              return (
                <button key={t.key} type="button" disabled={!!busy || on} onClick={() => apply('theme', { theme: t.key })} className={`${chip(on)} flex items-center gap-2.5`} aria-pressed={on}>
                  <span className="flex shrink-0 overflow-hidden rounded-md border border-ink/10" aria-hidden="true">
                    {[t.colors?.background, t.colors?.primary, t.colors?.secondary].map((c, i) => <i key={i} className="block h-6 w-3" style={{ background: c }} />)}
                  </span>
                  <span className="min-w-0 truncate font-semibold">{busy === 'theme' ? '…' : t.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      {!flyer && look && (
        <div>
          <h3 className="font-bold">Background music</h3>
          <p className="text-sm text-ink-mute">Plays quietly under the sound effects.</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[['none', 'None'], ['piano', 'Soft piano'], ['soft', 'Soft music']].map(([v, l]) => {
              const on = (look.music || 'none') === v;
              return <button key={v} type="button" disabled={!!busy || on} onClick={() => apply('music', { music: v })} className={chip(on)} aria-pressed={on}><span className="block text-center font-semibold">{busy === 'music' ? '…' : l}</span></button>;
            })}
          </div>
        </div>
      )}
      <div>
        <h3 className="font-bold">Colours</h3>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {COLOR_FIELDS.map(([k, l]) => (
            <label key={k} className="flex items-center gap-2 rounded-xl border border-ink/12 bg-white px-2.5 py-2 text-sm">
              <input type="color" value={cols[k] && /^#[0-9a-f]{6}$/i.test(cols[k]) ? cols[k] : '#000000'} onChange={(e) => setCols((c) => ({ ...c, [k]: e.target.value }))} className="size-8 cursor-pointer rounded-lg border-0 bg-transparent p-0" aria-label={l} />
              <span>{l}</span>
            </label>
          ))}
        </div>
        <Button size="sm" className="mt-3" disabled={!Object.keys(changedCols).length || !!busy} loading={busy === 'colors'} onClick={() => apply('colors', { colors: changedCols })}>Apply colours</Button>
      </div>
      {!flyer && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="font-bold">Text size</h3>
            <div className="mt-2 flex gap-2">
              <Button variant="outline" size="sm" disabled={!!busy} onClick={() => apply('text', { textScale: 0.88 })}>Smaller</Button>
              <Button variant="outline" size="sm" disabled={!!busy} onClick={() => apply('text', { textScale: 1.14 })}>Bigger</Button>
            </div>
          </div>
          <div>
            <h3 className="font-bold">Speed</h3>
            <div className="mt-2 flex gap-2">
              <Button variant="outline" size="sm" disabled={!!busy} onClick={() => apply('speed', { speed: 0.85 })}>Slower</Button>
              <Button variant="outline" size="sm" disabled={!!busy} onClick={() => apply('speed', { speed: 1.18 })}>Faster</Button>
            </div>
          </div>
        </div>
      )}
      <p className="text-xs text-ink-mute">For anything else (words, pictures, scenes), use the Edit tab and say it in your own words.</p>
    </div>
  );
}

export default function Studio() {
  const [full, setFull] = useState(false);   // full-screen view of the flyer / video
  const { id } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [project, setProject] = useState(null);
  useEffect(() => { if (project?.kind || project) announceKind(project.kind || 'video'); }, [project?.kind, !!project]); // eslint-disable-line react-hooks/exhaustive-deps
  const [canRender, setCanRender] = useState(true);
  useEffect(() => { api('/status').then((st) => setCanRender(st.render !== false)).catch(() => {}); }, []);
  const [tab, setTab] = useState('edit');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const started = useRef(false);
  const [askOpen, setAskOpen] = useState(false);
  const [needBuy, setNeedBuy] = useState(false);
  const asked = useRef(new Set());   // ask once per version
  const ask = (code) => { if (code && !asked.current.has(code)) { asked.current.add(code); setAskOpen(true); } };

  const [pushOn, setPushOn] = useState(() => typeof Notification !== 'undefined' && Notification.permission === 'granted');
  const poll = useRef(null);
  const watch = () => {
    clearInterval(poll.current);
    setGenerating(true);
    poll.current = setInterval(async () => {
      try {
        const r = await api(`/projects/${id}`);
        setProject(r.project);
        const g = r.project.gen;
        if (!g || g.state !== 'working') {
          clearInterval(poll.current); setGenerating(false); setParams({}, { replace: true });
          if (g?.state === 'failed') setError(g.error || "Your video didn't finish. Press Make my video to try again.");
          else if (g?.message) setNotice(g.message);
          if (r.project.plan?.voiceover?.enabled) setTab('voice');
        }
      } catch { /* network blip: keep checking */ }
    }, 2500);
  };
  useEffect(() => () => clearInterval(poll.current), []);

  const generate = async () => {
    setError(''); setNotice('');
    enablePush().then(setPushOn);
    try {
      const r = await api(`/projects/${id}/generate`, { method: 'POST' });
      setProject(r.project);
      watch();
    } catch (e) { if (e.data?.code === 'NEED_CREDITS') setNeedBuy(true); else setError(e.message); setGenerating(false); }
  };

  useEffect(() => {
    api(`/projects/${id}`).then((r) => {
      setProject(r.project);
      if (r.project.gen?.state === 'working') { started.current = true; watch(); return; }   // still being made (e.g. after closing the app)
      if (!started.current && r.project.plan && (params.get('generate') === '1' || !r.project.code)) { started.current = true; generate(); }
    }).catch((e) => setError(e.message));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // no thumbnail yet (made online without Chrome): take a still of the video in the browser and save it
  const thumbFor = useRef('');
  useEffect(() => {
    if (!project?.code || project.thumbnailUrl || generating || thumbFor.current === project.code) return;
    thumbFor.current = project.code;
    const t = setTimeout(async () => {
      try {
        const { snapshot } = await import('../lib/exportVideo.js');
        const { prepareHtml } = await import('../components/Preview.jsx');
        const blob = await snapshot({ html: prepareHtml(project.code), aspect: project.aspectRatio });
        if (!blob) return;
        const form = new FormData(); form.append('file', blob, 'thumb.jpg');
        const r = await api(`/projects/${id}/thumbnail`, { method: 'POST', form });
        setProject((p) => (p ? { ...p, thumbnailUrl: r.thumbnailUrl } : p));
      } catch { /* the thumbnail is optional */ }
    }, 2500);   // fewer server calls while the AI works
    return () => clearTimeout(t);
  }, [project?.code, project?.thumbnailUrl, generating]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (project?.kind !== 'flyer' || !project.code || generating) return undefined;
    const t = setTimeout(() => ask(project.code), 4000);
    return () => clearTimeout(t);
  }, [project?.code, generating]); // eslint-disable-line react-hooks/exhaustive-deps

  const undo = async () => { try { setProject((await api(`/projects/${id}/undo`, { method: 'POST' })).project); } catch (e) { setError(e.message); } };

  if (!project) return error ? <div className="mx-auto max-w-xl p-8"><Alert>{error}</Alert></div> : <PageLoader />;
  if (!project.plan) {
    return <div className="mx-auto max-w-xl p-8 text-center"><p className="text-ink-soft">Plan your video first.</p><Button as={Link} to={`/p/${id}/plan`} className="mt-4">Answer the questions</Button></div>;
  }
  const flyer = project.kind === 'flyer';
  if (generating) return <Generating message={project.gen?.message} startedAt={project.gen?.startedAt} pushOn={pushOn} flyer={flyer} />;
  const makeFlyer = async () => {
    setError('');
    try { enablePush().then(setPushOn); const r = await api(`/projects/${id}/flyer`, { method: 'POST', body: {} }); navigate(`/p/${r.project.id}/studio`); }
    catch (e) { if (e.data?.code === 'NEED_CREDITS') setNeedBuy(true); else setError(e.message); }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2"><KindBadge kind={project.kind} className="shrink-0" /><h1 className="truncate text-xl font-extrabold sm:text-2xl">{project.title}</h1></div>
          <p className="text-sm text-ink-mute">{flyer ? 'Flyer' : duration(project.durationSeconds)} · {ASPECTS[project.aspectRatio]?.label}</p>
        </div>
        <div className="flex items-center gap-3">
          {!flyer && <Steps current="studio" projectId={id} hasPlan hasCode={!!project.code} />}
          {project.code && <span className="hidden lg:block">{flyer ? <FlyerDownload project={project} /> : canRender ? <Button onClick={() => navigate(`/p/${id}/render?new=1`)}>{project.status === 'rendered' ? 'Render video again' : 'Generate Video'}</Button> : <DownloadVideo project={project} />}</span>}
        </div>
      </div>
      <BuyCredits open={needBuy} onClose={() => setNeedBuy(false)} reason="You've used your free videos" />
      <Feedback open={askOpen} project={project} onClose={() => setAskOpen(false)}
        onUpdate={(p) => { setProject(p); setTab('edit'); setNotice('Done. Your change is in the preview. Watch it again, or keep editing below.'); }}
        onHappy={() => { setAskOpen(false); if (!flyer && canRender) navigate(`/p/${id}/render?new=1`); }} />
      {error && <div className="mt-4"><Alert onClose={() => setError('')}>{error}</Alert></div>}
      {notice && <div className="mt-4"><Alert kind="warn" onClose={() => setNotice('')}>{publicMessage(notice)}</Alert></div>}

      {full && project.code && <FullView html={project.code} aspect={project.aspectRatio} still={flyer} onClose={() => setFull(false)} />}
      {project.code ? (
        <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
          <section aria-label="Preview" className="stage flex flex-col justify-center px-4 py-8 sm:px-8">
            <LivePreview html={project.code} aspect={project.aspectRatio} maxWidth={project.aspectRatio === '16:9' ? 320 : flyer ? 340 : 290} still={flyer}
              onEnded={() => ask(project.code)}
              sound={project.sfx !== false}
              onSoundChange={async (on) => { setProject((p) => ({ ...p, sfx: on })); try { const r = await api(`/projects/${id}`, { method: 'PATCH', body: { sfx: on } }); setProject((p) => ({ ...p, code: r.project.code, sfx: r.project.sfx })); } catch { /* keep the local choice */ } }} />
            {!flyer && <p className="mt-3 text-center text-xs text-white/55">{project.sfx !== false ? 'Sound is on. Tap play to hear it; the same sound effects go into your MP4.' : 'Sound is off for this video.'}</p>}
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Button variant="glass" size="sm" onClick={() => setFull(true)}>Full screen</Button>
              <Button variant="glass" size="sm" onClick={undo} disabled={!project.versions}>Undo</Button>
              <Button variant="glass" size="sm" onClick={() => { if (confirm(flyer ? 'Design the flyer again? You get a new layout and words (you can undo).' : 'Write the animation again from the plan? Your edits will be replaced (you can undo).')) generate(); }}>Regenerate</Button>
              {!flyer && <Button variant="glass" size="sm" onClick={makeFlyer}>Make a flyer from this</Button>}
              {flyer ? <FlyerDownload project={project} size="lg" alt="glass" className="w-full sm:ml-2 sm:w-auto lg:hidden" /> : canRender ? <Button size="lg" className="w-full sm:ml-2 sm:w-auto lg:hidden" onClick={() => navigate(`/p/${id}/render?new=1`)}>{project.status === 'rendered' ? 'Render video again' : 'Generate Video'}</Button> : <span className="w-full sm:ml-2 sm:w-auto lg:hidden"><DownloadVideo project={project} size="lg" className="w-full" /></span>}
            </div>
          </section>

          <section className="flex h-[calc(100vh-12rem)] min-h-[520px] flex-col overflow-hidden surface">
            <div className="segmented m-2" role="tablist">
              {(flyer ? [['edit', 'Edit'], ['adjust', 'Size & look']] : [['edit', 'Edit'], ['adjust', 'Size & look'], ['voice', 'Script'], ['plan', 'Scenes']]).map(([k, l]) => (
                <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                  className="press">{l}</button>
              ))}
            </div>
            <div className="min-h-0 flex-1">
              {tab === 'edit' && <EditPanel project={project} onUpdate={setProject} />}
              {tab === 'adjust' && <AdjustPanel project={project} onUpdate={setProject} />}
              {tab === 'voice' && <VoicePanel project={project} />}
              {tab === 'plan' && (
                <div className="h-full overflow-y-auto p-4">
                  <ol className="space-y-2">
                    {project.plan.scenes.map((s) => (
                      <li key={s.id} className="rounded-2xl bg-lilac p-3.5 text-sm">
                        <p className="tabular-nums text-ink-mute">{s.start}–{s.end}s · {s.purpose}</p>
                        <p className="mt-0.5 font-semibold">{[].concat(s.on_screen_text).filter(Boolean).join(' · ')}</p>
                        {s.images?.length > 0 && <p className="mt-1 text-ink-soft">🖼 {s.images.map((im) => `${im.asset} (${String(im.placement || '').split(',')[0]})`).join(', ')}</p>}
                        {s.voiceover && <p className="mt-1 italic text-ink-soft">🎙 “{s.voiceover}”</p>}
                      </li>
                    ))}
                  </ol>
                  <Button as={Link} to={`/p/${id}/plan`} variant="ghost" size="sm" className="mt-3">Change my answers</Button>
                </div>
              )}
            </div>
          </section>
        </div>
      ) : (
        <div className="mt-10 text-center"><Button onClick={generate}>{flyer ? 'Make my flyer' : 'Make my video'}</Button></div>
      )}
    </div>
  );
}
