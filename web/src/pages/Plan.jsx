// Page 1: the guided question flow. One question at a time, like a chat with a director:
// pick an option (or several), or type your own answer. Every answer is saved once, so nothing is asked twice.
// Pictures can be uploaded or pasted (Ctrl+V) anywhere on the page, up to 5. Special instructions come last.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ASPECTS, duration, shrinkImage } from '../lib.jsx';
import { Alert, Button, PageLoader, Spinner, Steps } from '../components/ui.jsx';
import { StylePicker } from './Dashboard.jsx';

const MAX_PICS = 5;

const CATEGORIES = ['Food & drinks', 'Fashion & clothing', 'Beauty & salon', 'Tech & software', 'Finance & payments', 'Health & fitness', 'Real estate', 'Events & parties', 'School & training', 'Shop & retail', 'Services'];
const GOALS = ['Promote a sale or offer', 'Launch something new', 'Get more orders or bookings', 'Make people know my brand', 'Announce an event'];
const CTAS = ['Order on WhatsApp', 'Call now', 'Visit our website', 'Visit our store', 'Download the app', 'Book now', 'DM us on Instagram'];
const ASPECT_OPTS = [
  { v: '9:16', l: 'Portrait 9:16', d: 'WhatsApp Status · TikTok · Reels' },
  { v: '16:9', l: 'Landscape 16:9', d: 'YouTube · TV · websites' },
  { v: '1:1', l: 'Square 1:1', d: 'Instagram & Facebook feed' },
];
const FOUND_LABEL = { name: 'business name', category: 'business type', goals: 'goal', headlines: 'message', features: 'selling points', products: 'products', ctas: 'call to action', contact: 'contact', aspect: 'format', duration: 'length', voiceover: 'voice-over choice', sound: 'sound choice' };
const EXTRA_CHIPS = ['Zoom into my logo at the start', 'Make the price really big', 'Keep it calm and premium', 'Make it loud and energetic', 'Show my photos more'];

// The questions, in order. `show` hides a question that doesn't apply; `optional` adds a Skip button.
const QUESTIONS = [
  { id: 'mode', type: 'single', options: [
    { v: 'steps', l: 'Ask me one question at a time' },
    { v: 'paste', l: "I'll paste everything at once", d: "Write or paste all your details. I'll only ask what's missing." },
  ], ask: () => "Hi! I'm your Animora director. Let's make your ad. Should I ask you questions one by one, or will you paste all your details at once?" },
  { id: 'paste', type: 'long', show: (b) => b.mode === 'paste', ask: () => 'Paste or type everything about your business and the ad: name, what you sell, your message, prices, contact, where you\'ll post it, how long, anything special.', placeholder: 'e.g. My business is Oluwaseun Computers in Ado Ekiti. We sell and repair laptops. HP EliteBook ₦250,000, Dell ₦300,000. Call or WhatsApp 0807 691 1614. Landscape for YouTube, about 30 seconds, calm and premium.' },
  { id: 'name', type: 'text', ask: () => "What's your business name?", placeholder: 'e.g. Kemi Cakes' },
  { id: 'category', type: 'single', options: CATEGORIES, typed: true, ask: (b) => `Nice! What does ${b.name} do?`, placeholder: 'Or type it, e.g. "laptop repairs"' },
  { id: 'goal', type: 'multi', max: 6, options: GOALS, typed: true, ask: () => "What's the goal of this ad? Pick one or more.", placeholder: 'Or type your own goal' },
  { id: 'headline', type: 'multi', max: 8, suggest: 'headline', typed: true, ask: () => "What's the main message? Pick as many as you like (up to 8), or type your own. More messages make a longer video.", placeholder: 'Add your own message' },
  { id: 'features', type: 'multi', max: 8, suggest: 'features', typed: true, optional: true, ask: (b) => `What makes ${b.name} stand out? Pick as many as you like (up to 8).`, placeholder: 'Add your own' },
  { id: 'products', type: 'long', optional: true, ask: () => 'Any products, services or prices to show? One per line.', placeholder: 'Jollof rice ₦2,500\nFried rice ₦2,800\nSmall chops ₦1,500' },
  { id: 'cta', type: 'multi', max: 5, options: CTAS, typed: true, ask: () => 'What should people do after watching? Pick one or more.', placeholder: 'Or type your own, e.g. "Send us a DM"' },
  { id: 'contact', type: 'text', optional: true, ask: () => 'Your phone number, website or address for the end of the video?', placeholder: '0803 123 4567 · www.yoursite.com · 12 Allen Ave, Ikeja' },
  { id: 'aspect', type: 'single', options: ASPECT_OPTS, ask: () => 'Where will you post it?' },
  { id: 'duration', type: 'single', options: [15, 20, 30, 45, 60], ask: () => "How long should it be? If you picked a lot, I'll make it longer so everything fits." },
  { id: 'pictures', type: 'upload', optional: true, ask: () => `Add your logo and product photos if you have them (up to ${MAX_PICS}). Both are optional. You can also paste a picture with Ctrl+V.` },
  { id: 'colors', type: 'colors', ask: () => 'Which colours should the video use?' },
  { id: 'style', type: 'style', ask: () => 'Pick a look for your video, or let me choose one that fits.' },
  { id: 'voiceover', type: 'single', options: [{ v: 'yes', l: 'Yes, write me a script', d: 'For ElevenLabs, CapCut and other voice apps' }, { v: 'no', l: 'No, just on-screen text' }], ask: () => 'Do you want a narration script for a voice-over app?' },
  { id: 'sound', type: 'sound', ask: () => 'What sound should the video have?' },
  { id: 'extra', type: 'long', optional: true, chips: EXTRA_CHIPS, ask: () => 'Last one: any other special instructions? Anything goes. You can paste pictures here too.', placeholder: 'e.g. "Start by zooming into the logo of the chatbot, then show the app screen"', done: true },
];

const label = (q, v, b, styles) => {
  if (v == null || v === '' || (Array.isArray(v) && !v.length)) return 'Skipped';
  if (q.id === 'mode') return v === 'paste' ? "I'll paste everything at once" : 'One question at a time';
  if (q.id === 'paste') return 'My details (pasted)';
  if (q.id === 'aspect') return ASPECT_OPTS.find((o) => o.v === v)?.l || v;
  if (q.id === 'duration') return `${v} seconds`;
  if (q.id === 'voiceover') return v === true || v === 'yes' ? 'Yes, write me a script' : 'No script';
  if (q.id === 'sound') return { all: 'Soft music and sound effects', sfx: 'Only sound effects', none: 'No sound', own: 'My own music' }[v] || v;
  if (q.id === 'style') return b.styleAuto ? 'Let Animora choose' : styles?.find((s) => s.id === v)?.name || 'Chosen';
  if (q.id === 'colors') return v === 'style' ? "The style's colours" : v === 'logo' ? 'Matched to my logo' : 'My own colours';
  if (q.id === 'pictures') return `${v} picture${v === 1 ? '' : 's'}`;
  return Array.isArray(v) ? v.join(', ') : String(v);
};

// answers live in the brief under the question id (with a few special cases)
function valueOf(q, b, pics) {
  if (q.show && !q.show(b)) return 'hidden';
  if (q.id === 'paste') return b.pasted ? true : undefined;
  if (q.id === 'headline') return b.headlines || (b.headline ? [b.headline] : undefined);
  if (q.id === 'goal') return b.goals || (b.goal ? [b.goal] : undefined);
  if (q.id === 'cta') return b.ctas || (b.cta ? [b.cta] : undefined);
  if (q.id === 'style') return b.styleAuto ? 'auto' : b.styleId;
  if (q.id === 'colors') return b.colorMode;
  if (q.id === 'pictures') return b.picturesDone ? pics : undefined;
  if (q.id === 'voiceover') return b.voiceover === undefined ? undefined : b.voiceover ? 'yes' : 'no';
  if (q.id === 'sound') return b.sound;
  return b[q.id];
}

// Pull two strong colours from the logo (most common saturated colours).
async function logoColors(url) {
  const img = new Image(); img.crossOrigin = 'anonymous'; img.src = url;
  await img.decode();
  const c = document.createElement('canvas'); const S = 64; c.width = S; c.height = S;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0, S, S);
  const d = g.getImageData(0, 0, S, S).data, bins = new Map();
  for (let i = 0; i < d.length; i += 4) {
    const [r, gg, bb, a] = [d[i], d[i + 1], d[i + 2], d[i + 3]];
    if (a < 200) continue;
    const mx = Math.max(r, gg, bb), mn = Math.min(r, gg, bb);
    if (mx - mn < 40 || mx < 50 || mn > 230) continue; // skip greys, black, white
    const k = `${r >> 5},${gg >> 5},${bb >> 5}`;
    const e = bins.get(k) || { n: 0, r: 0, g: 0, b: 0 }; e.n++; e.r += r; e.g += gg; e.b += bb; bins.set(k, e);
  }
  const top = [...bins.values()].sort((a, b) => b.n - a.n).map((e) => '#' + [e.r, e.g, e.b].map((v) => Math.round(v / e.n).toString(16).padStart(2, '0')).join(''));
  if (!top.length) return null;
  return { primary: top[0], secondary: top.find((x) => x !== top[0]) || top[0] };
}

function Bubble({ who, children, onEdit }) {
  return (
    <div className={`flex ${who === 'me' ? 'justify-end' : 'justify-start'}`}>
      <div className={`group relative max-w-[85%] whitespace-pre-wrap px-4 py-3 text-[15px] leading-relaxed ${who === 'me' ? 'bubble-user' : 'bubble-ai'}`}>
        {children}
        {onEdit && <button onClick={onEdit} className="ml-3 text-xs font-semibold underline opacity-70 hover:opacity-100">Change</button>}
      </div>
    </div>
  );
}

function Chip({ active, onClick, children, sub }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={!!active} className="chip press !h-auto !py-2.5 text-left">
      <span>{children}{sub && <span className="block text-xs font-normal opacity-70">{sub}</span>}</span>
    </button>
  );
}

export default function Plan() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [styles, setStyles] = useState([]);
  const [limits, setLimits] = useState({ minSeconds: 15, maxSeconds: 60 });
  const [b, setB] = useState({});
  const [step, setStep] = useState(0);          // index of the question being asked
  const [editing, setEditing] = useState(false); // changing an earlier answer: jump back to the end afterwards
  const [text, setText] = useState('');
  const [multi, setMulti] = useState([]);
  const [suggestions, setSuggestions] = useState({});
  const [loadingSug, setLoadingSug] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const endRef = useRef(null);
  const logoRef = useRef(null);
  const photoRef = useRef(null);
  const musicRef = useRef(null);

  const pics = (project?.assets || []).filter((a) => a.kind === 'image');
  const logo = pics.find((a) => a.role === 'logo');
  const visible = useMemo(() => QUESTIONS, []);
  const q = visible[step];

  // load project + styles, resume at the first unanswered question
  useEffect(() => {
    (async () => {
      try {
        const r = await api(`/projects/${id}`);
        setProject(r.project); if (r.limits) setLimits(r.limits);
        const brief = r.project.brief || {};
        setB(brief);
        const { styles: st } = await api('/styles'); setStyles(st);
        const imgs = (r.project.assets || []).filter((a) => a.kind === 'image').length;
        const first = QUESTIONS.findIndex((qq) => { const v = valueOf(qq, brief, imgs); return v === undefined && !(qq.optional && brief[`${qq.id}Skipped`]); });
        setStep(brief.done && r.project.plan ? QUESTIONS.length : first < 0 ? QUESTIONS.length : first);
      } catch (e) { setError(e.message); }
    })();
  }, [id]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [step, uploading, suggestions, building]);
  useEffect(() => { setText(''); const cur = q?.id === 'headline' ? (b.headlines || (b.headline ? [b.headline] : [])) : q?.id === 'goal' ? (b.goals || (b.goal ? [b.goal] : [])) : q?.id === 'cta' ? (b.ctas || (b.cta ? [b.cta] : [])) : b[q?.id]; setMulti(Array.isArray(cur) ? cur : []); }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  // AI suggestions for the open questions
  useEffect(() => {
    if (!q?.suggest || suggestions[q.id]) return;
    setLoadingSug(true);
    api(`/projects/${id}/suggest`, { method: 'POST', body: { kind: q.suggest, brief: b } })
      .then((r) => setSuggestions((s) => ({ ...s, [q.id]: r.options || [] })))
      .catch(() => setSuggestions((s) => ({ ...s, [q.id]: [] })))
      .finally(() => setLoadingSug(false));
  }, [q?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // paste a picture anywhere on the page
  useEffect(() => {
    const onPaste = (e) => {
      const files = [...(e.clipboardData?.files || [])].filter((f) => f.type.startsWith('image/'));
      if (!files.length) return;
      e.preventDefault();
      upload(files.map((f, i) => new File([f], f.name && f.name !== 'image.png' ? f.name : `pasted picture ${Date.now() % 10000}${i ? `-${i}` : ''}.png`, { type: f.type })), q?.id === 'pictures' && !logo ? null : 'photo');
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  });

  const save = async (patch) => {
    const next = { ...b, ...patch };
    setB(next);
    try { const r = await api(`/projects/${id}/brief`, { method: 'PATCH', body: { brief: patch } }); setProject((p) => ({ ...p, ...r.project, assets: r.project.assets || p.assets })); }
    catch (e) { setError(e.message); }
    return next;
  };

  const advance = (next) => {
    if (editing) { setEditing(false); const brief = next; const f = QUESTIONS.findIndex((qq) => valueOf(qq, brief, pics.length) === undefined && !(qq.optional && brief[`${qq.id}Skipped`])); setStep(f < 0 ? QUESTIONS.length : f); return; }
    const f = QUESTIONS.findIndex((qq) => valueOf(qq, next, pics.length) === undefined && !(qq.optional && next[`${qq.id}Skipped`]));
    setStep(f < 0 ? QUESTIONS.length : f);
  };

  const answer = async (value, extra = {}) => {
    if (!q) return;
    setError('');
    let patch;
    if (q.id === 'paste') {
      setBuilding(true);
      try {
        const r = await api(`/projects/${id}/brief/parse`, { method: 'POST', body: { text: value } });
        const brief = { ...(r.project.brief || {}), pasted: true };
        setProject((p) => ({ ...p, ...r.project, assets: r.project.assets || p.assets }));
        const next = await save({ pasted: true });
        setB(brief);
        setToast(r.found?.length ? `Got it. I found your ${r.found.map((k) => FOUND_LABEL[k] || k).join(', ')}.` : 'Got it.'); setTimeout(() => setToast(''), 4000);
        advance({ ...next, ...brief });
      } catch (e) { setError(e.message); } finally { setBuilding(false); }
      return;
    }
    if (q.id === 'voiceover') patch = { voiceover: value === 'yes' };

    else if (q.id === 'duration') patch = { duration: Number(value) };
    else if (q.id === 'headline') patch = { headlines: value, headline: value[0] };
    else if (q.id === 'goal') patch = { goals: value, goal: value.join(' + ') };
    else if (q.id === 'cta') patch = { ctas: value, cta: value[0] };
    else patch = { [q.id]: value };
    const next = await save({ ...patch, ...extra, [`${q.id}Skipped`]: false });
    advance(next);
  };
  const skip = async () => { const next = await save({ [`${q.id}Skipped`]: true, ...(q.id === 'pictures' ? { picturesDone: true } : {}) }); advance(next); };

  const upload = async (files, role) => {
    setError('');
    const room = MAX_PICS - pics.length;
    if (room <= 0) { setError(`You can add up to ${MAX_PICS} pictures. Remove one to add another.`); return; }
    if (files.length > room) setError(`Only ${room} more picture${room === 1 ? '' : 's'} can be added (up to ${MAX_PICS}).`);
    setUploading(true);
    try {
      for (const f of files.slice(0, room)) {
        const form = new FormData();
        form.append('file', await shrinkImage(f));
        if (role) form.append('role', role);
        form.append('name', role === 'logo' ? 'logo' : f.name.replace(/\.[^.]+$/, '').slice(0, 40));
        const { asset } = await api(`/projects/${id}/assets`, { method: 'POST', form });
        setProject((p) => ({ ...p, assets: [...(p.assets || []), asset] }));
      }
      setToast(files.length > 1 ? 'Pictures added' : 'Picture added'); setTimeout(() => setToast(''), 2500);
    } catch (e) { setError(e.message); } finally { setUploading(false); [logoRef, photoRef].forEach((r) => { if (r.current) r.current.value = ''; }); }
  };
  const removePic = async (a) => {
    await api(`/projects/${id}/assets/${a.id}`, { method: 'DELETE' }).catch(() => {});
    setProject((p) => ({ ...p, assets: p.assets.filter((x) => x.id !== a.id) }));
  };

  const build = async (brief) => {
    setBuilding(true); setError('');
    try {
      const r = await api(`/projects/${id}/build`, { method: 'POST', body: { brief } });
      setProject((p) => ({ ...p, ...r.project }));
      navigate(`/p/${id}/studio?generate=1`);
    } catch (e) { setError(e.message); setBuilding(false); }
  };

  // finishing the last question builds the video
  const finish = async (value) => { const next = await save({ extra: value || '', extraSkipped: !value, done: true }); build(next); };

  if (!project) return error ? <div className="mx-auto max-w-xl p-8"><Alert>{error}</Alert></div> : <PageLoader />;
  const answered = visible.slice(0, Math.min(step, visible.length));
  const opts = q?.suggest ? (suggestions[q.id] || []) : q?.options || [];
  const finished = step >= visible.length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="truncate text-xl font-extrabold sm:text-2xl">{b.name || project.title}</h1>
        <Steps current="plan" projectId={id} hasPlan={!!project.plan} hasCode={!!project.code} />
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_340px]">
        <section className="flex h-[calc(100vh-11rem)] min-h-[520px] flex-col overflow-hidden surface" aria-label="Questions">
          <div className="h-1.5 bg-lilac"><div className="h-full rounded-r-full bg-danfo transition-all" style={{ width: `${Math.round((Math.min(step, visible.length) / visible.length) * 100)}%` }} /></div>
          <div className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-6" aria-live="polite">
            {answered.map((qq, i) => (qq.show && !qq.show(b)) ? null : (
              <div key={qq.id} className="space-y-2">
                <Bubble who="ai">{qq.ask(b)}</Bubble>
                <Bubble who="me" onEdit={building ? null : () => { setEditing(true); setStep(i); }}>{label(qq, valueOf(qq, b, pics.length), b, styles)}</Bubble>
              </div>
            ))}

            {!finished && q && (
              <div className="space-y-3">
                <Bubble who="ai">{q.ask(b)}</Bubble>

                {(q.type === 'single' || q.type === 'multi') && (
                  <div className="flex flex-wrap gap-2 pl-1">
                    {loadingSug && !opts.length && <span className="flex items-center gap-2 text-sm text-ink-mute"><Spinner className="size-4" />Writing some ideas…</span>}
                    {opts.filter((o) => q.id !== 'duration' || (o >= limits.minSeconds && o <= limits.maxSeconds)).map((o) => {
                      const v = o.v ?? o, l = o.l ?? (q.id === 'duration' ? `${o} seconds` : o);
                      const on = q.type === 'multi' ? multi.includes(v) : b[q.id] === v;
                      return <Chip key={v} active={on} sub={o.d} onClick={() => {
                        if (q.type === 'single') return answer(v);
                        setMulti((m) => (m.includes(v) ? m.filter((x) => x !== v) : m.length >= (q.max || 9) ? m : [...m, v]));
                      }}>{l}</Chip>;
                    })}
                    {q.type === 'multi' && multi.filter((v) => !opts.includes(v)).map((v) => <Chip key={v} active onClick={() => setMulti((m) => m.filter((x) => x !== v))}>{v}</Chip>)}
                  </div>
                )}

                {q.type === 'upload' && (
                  <div className="rounded-3xl border-2 border-dashed border-ink/15 bg-lilac/40 p-4">
                    <input ref={logoRef} type="file" accept="image/*" hidden onChange={(e) => upload([...e.target.files], 'logo')} />
                    <input ref={photoRef} type="file" accept="image/*" multiple hidden onChange={(e) => upload([...e.target.files], 'photo')} />
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="dark" onClick={() => logoRef.current?.click()} disabled={uploading || !!logo || pics.length >= MAX_PICS}>{logo ? 'Logo added' : 'Add logo'}</Button>
                      <Button size="sm" variant="outline" onClick={() => photoRef.current?.click()} disabled={uploading || pics.length >= MAX_PICS}>Add photos</Button>
                      <span className="self-center text-sm text-ink-mute">{pics.length}/{MAX_PICS} · or paste with Ctrl+V</span>
                    </div>
                    {pics.length > 0 && (
                      <ul className="mt-3 grid grid-cols-5 gap-2">
                        {pics.map((a) => (
                          <li key={a.id} className="relative">
                            <img src={a.url} alt={a.name} className={`aspect-square w-full rounded-xl bg-white ${a.role === 'logo' ? 'object-contain p-1' : 'object-cover'}`} />
                            <span className="mt-0.5 block truncate text-[11px] text-ink-soft">{a.role === 'logo' ? '⭐ logo' : a.name}</span>
                            <button onClick={() => removePic(a)} className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-ink/80 text-xs text-white" aria-label={`Remove ${a.name}`}>✕</button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {uploading && <p className="mt-2 flex items-center gap-2 text-sm text-ink-soft"><Spinner className="size-4" />Uploading…</p>}
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" onClick={() => (pics.length ? answer(pics.length, { picturesDone: true }) : skip())} disabled={uploading}>{pics.length ? 'Continue' : 'Continue without pictures'}</Button>
                    </div>
                  </div>
                )}

                {q.type === 'sound' && (
                  <div className="flex flex-wrap gap-2 pl-1">
                    <input ref={musicRef} type="file" accept="audio/*" hidden onChange={async (e) => {
                      const f = e.target.files?.[0]; if (!f) return;
                      setUploading(true); setError('');
                      try { const form = new FormData(); form.append('file', f); form.append('role', 'music'); form.append('name', 'my music'); await api(`/projects/${id}/assets`, { method: 'POST', form }); answer('own'); }
                      catch (err) { setError(err.message); } finally { setUploading(false); e.target.value = ''; }
                    }} />
                    <Chip sub="Calm background music with gentle effects. Cuts land on the beat." onClick={() => answer('all')}>Soft music and sound effects</Chip>
                    <Chip sub="Gentle whooshes, pops and clicks, no music" onClick={() => answer('sfx')}>Only sound effects</Chip>
                    <Chip sub="Upload an MP3 or WAV" onClick={() => musicRef.current?.click()}>{uploading ? 'Uploading…' : 'Use my own music'}</Chip>
                    <Chip onClick={() => answer('none')}>No sound</Chip>
                  </div>
                )}

                {q.type === 'colors' && (
                  <div className="flex flex-wrap gap-2 pl-1">
                    <Chip onClick={() => answer('style', { colorMode: 'style', colors: {} })}>The style's colours</Chip>
                    {logo && <Chip onClick={async () => { try { const c = await logoColors(logo.url); answer('logo', { colorMode: 'logo', colors: c || {} }); } catch { answer('style', { colorMode: 'style', colors: {} }); } }}>Match my logo</Chip>}
                    <ColorPick onPick={(c) => answer('own', { colorMode: 'own', colors: c })} />
                  </div>
                )}

                {q.type === 'style' && (
                  <div className="rounded-3xl bg-lilac/40 p-3">
                    <Button size="sm" className="mb-3" onClick={() => answer('auto', { styleAuto: true, styleId: undefined })}>Let Animora choose for me</Button>
                    <StylePicker value={b.styleId} onPick={(s) => answer(s.id, { styleId: s.id, styleAuto: false })} />
                  </div>
                )}

                {q.chips && (
                  <div className="flex flex-wrap gap-2 pl-1">
                    {q.chips.map((c) => <Chip key={c} onClick={() => setText((t) => (t ? `${t.trim()}\n${c}` : c))}>{c}</Chip>)}
                  </div>
                )}
              </div>
            )}

            {finished && (
              <div className="space-y-3">
                <Bubble who="ai">{building ? "Great, I have everything. I'm planning your scenes now…" : project.plan ? 'Your answers are saved. Change any answer above, or make the video.' : 'All set!'}</Bubble>
                {building && <div className="flex"><div className="bubble-ai typing px-4 py-3.5"><span /><span /><span /></div></div>}
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* composer: always lets you type your own answer */}
          {!finished && q && ['text', 'long', 'single', 'multi'].includes(q.type) && (q.typed || q.type === 'text' || q.type === 'long' || q.type === 'multi') && (
            <div className="border-t border-ink/8 bg-lilac/40 p-3">
              {error && <div className="mb-2"><Alert onClose={() => setError('')}>{error}</Alert></div>}
              <form className="flex items-end gap-2" onSubmit={(e) => {
                e.preventDefault();
                const v = text.trim();
                if (q.type === 'multi') { const all = [...multi, ...(v ? [v] : [])]; if (!all.length) return; return answer(all); }
                if (q.done) return finish(v);
                if (!v) return;
                answer(q.type === 'long' ? v.split('\n').map((x) => x.trim()).filter(Boolean).join(q.id === 'products' ? '\n' : ' ') : v);
              }}>
                {q.type === 'long' ? (
                  <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder={q.placeholder} aria-label="Your answer"
                    className="max-h-48 min-h-20 flex-1 resize-none rounded-[10px] border border-ink/15 bg-white px-4 py-3 text-[15px] focus:border-ink focus:outline-none" />
                ) : (
                  <input value={text} onChange={(e) => setText(e.target.value)} autoFocus placeholder={q.placeholder || (q.typed ? 'Or type your own answer…' : 'Type your answer…')} aria-label="Your answer"
                    className="h-12 flex-1 rounded-[10px] border border-ink/15 bg-white px-4 text-[15px] focus:border-ink focus:outline-none" />
                )}
                <div className="flex flex-col gap-2">
                  <Button type="submit" variant="dark" className="h-12" disabled={q.done ? false : q.type === 'multi' ? !multi.length && !text.trim() : !text.trim()}>
                    {q.done ? (text.trim() ? 'Make my video' : "No, that's all") : q.type === 'multi' ? 'Next' : 'Send'}
                  </Button>
                  {q.optional && !q.done && <button type="button" onClick={skip} className="text-sm font-semibold text-ink-mute underline">Skip</button>}
                </div>
              </form>
            </div>
          )}
          {!finished && q && !['text', 'long', 'multi'].includes(q.type) && !q.typed && (
            <div className="border-t border-ink/8 bg-lilac/40 p-3">
              {error && <div className="mb-2"><Alert onClose={() => setError('')}>{error}</Alert></div>}
              <div className="flex items-center justify-between text-sm text-ink-mute">
                <span>Question {step + 1} of {visible.length}</span>
                {q.optional && <button type="button" onClick={skip} className="font-semibold underline">Skip</button>}
              </div>
            </div>
          )}
          {finished && (
            <div className="border-t border-ink/8 bg-lilac/40 p-3">
              {error && <div className="mb-2"><Alert onClose={() => setError('')}>{error}</Alert></div>}
              <Button size="lg" className="w-full" loading={building} onClick={() => (project.plan && b.done ? navigate(`/p/${id}/studio${project.code ? '' : '?generate=1'}`) : build(b))}>
                {project.plan ? (project.code ? 'Open my video' : 'Make my video') : 'Make my video'}
              </Button>
              {project.plan && <button onClick={() => build(b)} disabled={building} className="mt-2 w-full text-sm font-semibold text-ink-mute underline">Re-plan from my answers</button>}
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <div className="surface p-5">
            <h2 className="font-bold">Your ad so far</h2>
            <dl className="mt-3 space-y-2 text-sm">
              {b.name && <div><dt className="text-ink-mute">Business</dt><dd className="font-semibold">{b.name}{b.category ? ` · ${b.category}` : ''}</dd></div>}
              {b.headline && <div><dt className="text-ink-mute">Message</dt><dd className="font-semibold">{(b.headlines || [b.headline]).join(', ')}</dd></div>}
              {b.aspect && <div><dt className="text-ink-mute">Format</dt><dd className="font-semibold">{ASPECT_OPTS.find((o) => o.v === b.aspect)?.l} · {b.duration ? duration(b.duration) : ''}</dd></div>}
              {b.colors?.primary && <div><dt className="text-ink-mute">Colours</dt><dd className="flex gap-1">{Object.values(b.colors).map((c) => <span key={c} className="size-5 rounded-full ring-1 ring-black/10" style={{ background: c }} />)}</dd></div>}
            </dl>
            {pics.length > 0 && (
              <ul className="mt-3 grid grid-cols-5 gap-1.5">
                {pics.map((a) => <li key={a.id}><img src={a.url} alt={a.name} className={`aspect-square w-full rounded-lg bg-white ${a.role === 'logo' ? 'object-contain p-0.5' : 'object-cover'}`} /></li>)}
              </ul>
            )}
            {!b.name && <p className="mt-2 text-sm text-ink-soft">Answer the questions and I'll build the plan and the video for you. Paste pictures any time (up to {MAX_PICS}).</p>}
          </div>
          {project.plan && (
            <div className="surface p-5">
              <h2 className="font-bold">Plan</h2>
              <p className="text-sm text-ink-mute">{duration(project.plan.duration_seconds)} · {ASPECTS[project.plan.aspect_ratio]?.label} · {project.plan.scenes.length} scenes</p>
              <ol className="mt-3 max-h-64 space-y-1.5 overflow-auto text-sm">
                {project.plan.scenes.map((s) => <li key={s.id} className="rounded-xl bg-lilac px-3 py-2"><span className="tabular-nums text-ink-mute">{s.start}–{s.end}s</span> {[].concat(s.on_screen_text).filter(Boolean).join(' · ')}</li>)}
              </ol>
            </div>
          )}
        </aside>
      </div>
      {toast && <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white shadow-xl" role="status">{toast}</div>}
    </div>
  );
}

function ColorPick({ onPick }) {
  const [open, setOpen] = useState(false);
  const [c, setC] = useState({ primary: '#1F6FEB', background: '#0B1B33' });
  if (!open) return <Chip onClick={() => setOpen(true)}>Pick my own</Chip>;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white px-3 py-2 ring-1 ring-ink/10">
      <label className="flex items-center gap-2 text-sm">Main <input type="color" value={c.primary} onChange={(e) => setC({ ...c, primary: e.target.value })} className="size-8 rounded" /></label>
      <label className="flex items-center gap-2 text-sm">Background <input type="color" value={c.background} onChange={(e) => setC({ ...c, background: e.target.value })} className="size-8 rounded" /></label>
      <Button size="sm" variant="dark" onClick={() => onPick(c)}>Use these</Button>
    </div>
  );
}
