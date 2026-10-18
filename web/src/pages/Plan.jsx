// Page 1: the guided question flow. One question at a time, like a chat with a director:
// pick an option (or several), or type your own answer. Every answer is saved once, so nothing is asked twice.
// Pictures can be uploaded or pasted (Ctrl+V) anywhere on the page, up to 10. Special instructions come last.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ASPECTS, duration, shrinkImage, imageLook } from '../lib.jsx';
import { Alert, Button, PageLoader, Spinner, Steps } from '../components/ui.jsx';
import MicButton from '../components/MicButton.jsx';
import { StylePicker } from './Dashboard.jsx';

const MAX_PICS = 10;

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

// How long the answers need: an opening, one shot per message, about two selling points or products per shot,
// extra actions, and the ending. About 4 seconds a shot (with its move in and out). Too long feels slow and repeats; too short flashes by.
const listOf = (v) => (Array.isArray(v) ? v : String(v || '').split('\n')).map((x) => String(x).trim()).filter(Boolean);
export function fitSeconds(b = {}) {
  const shots = 2 + Math.max(1, listOf(b.headlines || b.headline).length) + Math.ceil(listOf(b.features).length / 2)
    + Math.ceil(listOf(b.products).length / 2) + Math.max(0, listOf(b.ctas || b.cta).length - 1)
    + (b.pasteText ? Math.min(4, Math.floor(String(b.pasteText).length / 450)) : 0);
  return Math.max(20, Math.min(120, Math.round((shots * 4) / 5) * 5));
}
export function lengthWarning(b, v) {
  const rec = fitSeconds(b), sec = Number(v);
  if (!sec) return null;
  if (sec >= rec * 1.6 && sec - rec >= 15) return { rec, text: `Your details fill about ${rec} seconds. At ${sec} seconds the AI has to stretch them, so the video can feel slow and repeat itself. Add more messages, selling points or products, or choose ${rec} seconds.` };
  if (sec <= rec * 0.7 && rec - sec >= 10) return { rec, text: `That's a lot for ${sec} seconds: everything will flash by too fast to read. ${rec} seconds fits your details, or remove some of them.` };
  return null;
}

// The questions, in order. `show` hides a question that doesn't apply; `optional` adds a Skip button.
const QUESTIONS = [
  { id: 'mode', type: 'single', options: [
    { v: 'steps', l: 'Ask me one question at a time' },
    { v: 'paste', l: "I'll paste everything at once", d: "Write or paste all your details. I'll only ask what's missing." },
  ], ask: () => "Hi! I'm your Animora director. Let's make your ad. Should I ask you questions one by one, or will you paste all your details at once?" },
  { id: 'paste', type: 'long', show: (b) => b.mode === 'paste', ask: () => 'Paste or type everything about your business and the ad: name, what you sell, your message, prices, contact, where you\'ll post it, how long, anything special.', placeholder: 'e.g. My business is Oluwaseun Computers in Ado Ekiti. We sell and repair laptops. HP EliteBook ₦250,000, Dell ₦300,000. Call or WhatsApp 0807 691 1614. Landscape for YouTube, about 30 seconds, calm and premium.' },
  { id: 'name', type: 'text', ask: () => "What's your business name?", placeholder: 'e.g. Kemi Cakes' },
  { id: 'category', type: 'single', options: CATEGORIES, typed: true, ask: (b) => `Nice! What does ${b.name} do?`, placeholder: 'Or type it, e.g. "laptop repairs"' },
  { id: 'goal', type: 'multi', max: 6, options: GOALS, typed: true, ask: () => "What's the goal of this ad?", placeholder: 'Or type your own goal' },
  { id: 'headline', type: 'multi', max: 8, suggest: 'headline', typed: true, ask: () => "What's the main message of your ad?", hint: 'Pick as many as you like, or type your own. More messages make a longer video.', placeholder: 'Add your own message' },
  { id: 'features', type: 'multi', max: 8, suggest: 'features', typed: true, optional: true, ask: (b) => `What makes ${b.name} stand out?`, hint: 'Pick as many as you like, or type your own.', placeholder: 'Add your own' },
  { id: 'products', type: 'long', optional: true, ask: () => 'Any products, services or prices to show? One per line.', placeholder: 'Jollof rice ₦2,500\nFried rice ₦2,800\nSmall chops ₦1,500' },
  { id: 'cta', type: 'multi', max: 5, options: CTAS, typed: true, ask: () => 'What should people do after watching?', placeholder: 'Or type your own, e.g. "Send us a DM"' },
  { id: 'contact', type: 'text', optional: true, ask: () => 'Your phone number, website or address for the end of the video?', placeholder: '0803 123 4567 · www.yoursite.com · 12 Allen Ave, Ikeja' },
  { id: 'aspect', type: 'single', options: ASPECT_OPTS, ask: () => 'Where will you post it?' },
  { id: 'duration', type: 'single', options: [15, 20, 25, 30, 45, 60], ask: (b) => `How long should it be? Your details fit about ${fitSeconds(b)} seconds.` },
  { id: 'pictures', type: 'upload', optional: true, ask: () => `Add your logo and product photos if you have them (up to ${MAX_PICS}). Both are optional. You can also paste a picture with Ctrl+V.` },
  { id: 'colors', type: 'colors', ask: () => 'Which colours should the video use?' },
  { id: 'style', type: 'style', ask: () => 'Pick a look for your video, or let me choose one that fits.' },
  { id: 'voiceover', type: 'single', options: [{ v: 'yes', l: 'Yes, write me a script', d: 'For ElevenLabs, CapCut and other voice apps' }, { v: 'no', l: 'No, just on-screen text' }], ask: () => 'Do you want a narration script for a voice-over app?' },
  { id: 'sound', type: 'sound', ask: () => 'What sound should the video have?' },
  { id: 'extra', type: 'long', optional: true, chips: EXTRA_CHIPS, ask: () => 'Last one: any other special instructions? Anything goes. You can paste pictures here too.', placeholder: 'e.g. "Start by zooming into the logo of the chatbot, then show the app screen"', done: true },
];
// Flyers: the same questions minus length, narration and sound, with flyer wording and print sizes.
const FLYER_ASPECTS = [
  { v: '4:5', l: 'Post 4:5', d: 'Instagram & Facebook feed' },
  { v: '9:16', l: 'Story 9:16', d: 'WhatsApp Status · Instagram Story' },
  { v: '1:1', l: 'Square 1:1', d: 'Any feed, WhatsApp chats' },
  { v: 'A4', l: 'A4 print', d: 'Printed flyers and posters (PDF)' },
];
const FLYER_TEXT = {
  paste: () => 'Paste or type everything about your business and the flyer: name, what you sell, your message, prices, contact, anything special.',
  goal: () => "What's the goal of this flyer?",
  headline: () => "What's the main message of your flyer?",
  cta: () => 'What should people do after seeing the flyer?',
  contact: () => 'Your phone number, website or address for the flyer?',
  aspect: () => 'Where will you use it?',
  pictures: () => `Add your logo and product photos if you have them (up to ${MAX_PICS}). Photos make flyers look much better.`,
  colors: () => 'Which colours should the flyer use?',
  style: () => 'Pick a look for your flyer, or let me choose one that fits.',
  extra: () => 'Last one: anything special for the flyer? Anything goes.',
};
const FLYER_QUESTIONS = QUESTIONS.filter((x) => !['duration', 'voiceover', 'sound'].includes(x.id)).map((x) => ({
  ...x,
  ...(FLYER_TEXT[x.id] ? { ask: FLYER_TEXT[x.id] } : {}),
  ...(x.id === 'aspect' ? { options: FLYER_ASPECTS } : {}),
  ...(x.id === 'headline' ? { hint: 'One to three messages work best on a flyer.' } : {}),
  ...(x.id === 'extra' ? { placeholder: 'e.g. "Put the prices in big circles" or "Make it look like a Christmas sale"' } : {}),
}));


const label = (q, v, b, styles) => {
  if (v == null || v === '' || (Array.isArray(v) && !v.length)) return 'Skipped';
  if (q.id === 'mode') return v === 'paste' ? "I'll paste everything at once" : 'One question at a time';
  if (q.id === 'paste') return 'My details (pasted)';
  if (q.id === 'aspect') return ASPECT_OPTS.find((o) => o.v === v)?.l || v;
  if (q.id === 'duration') return `${v} seconds`;
  if (q.id === 'voiceover') return v === true || v === 'yes' ? 'Yes, write me a script' : 'No script';
  if (q.id === 'sound') return { all: 'Sound effects', sfx: 'Sound effects', none: 'No sound', own: 'My own music' }[v] || v;
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

// The conversation: Animora's questions sit on the left with its mark; your answers are light chips on the right.
function Bubble({ who, children, onEdit, current }) {
  if (who === 'me') {
    return (
      <div className="flex justify-end">
        <button type="button" onClick={onEdit || undefined} disabled={!onEdit} aria-label={onEdit ? `Change answer: ${typeof children === 'string' ? children : ''}` : undefined}
          className="answer-chip group max-w-[85%] whitespace-pre-wrap text-left">
          <span>{children}</span>
          {onEdit && <svg className="ml-2 inline size-3.5 shrink-0 opacity-40 group-hover:opacity-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>}
        </button>
      </div>
    );
  }
  return (
    <div className={`flex items-start gap-3 ${current ? 'ask-current' : ''}`}>
      <img src="/animora-mark.png" alt="" className={`mt-0.5 shrink-0 ${current ? 'size-8' : 'size-6 opacity-70'}`} />
      <p className={`min-w-0 whitespace-pre-wrap ${current ? 'text-[19px] font-semibold leading-snug tracking-[-0.015em] text-ink sm:text-[21px]' : 'pt-0.5 text-[14px] leading-relaxed text-ink-mute'}`}>{children}</p>
    </div>
  );
}

function Chip({ active, onClick, children, sub, multi }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={!!active} className="option press">
      {multi && <span className="option-check" aria-hidden="true">{active && <svg viewBox="0 0 16 16" className="size-3"><path d="M3.5 8.5 6.5 11.5 12.5 4.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>}</span>}
      <span className="min-w-0">{children}{sub && <span className="mt-0.5 block text-[13px] font-normal leading-snug text-ink-mute">{sub}</span>}</span>
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
  const [reading, setReading] = useState(false);   // reading a pasted description
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [lenWarn, setLenWarn] = useState(null);   // { v, rec, text } while the person decides
  const endRef = useRef(null);
  const logoRef = useRef(null);
  const photoRef = useRef(null);
  const musicRef = useRef(null);

  const pics = (project?.assets || []).filter((a) => a.kind === 'image');
  const logo = pics.find((a) => a.role === 'logo');
  const QS = project?.kind === 'flyer' ? FLYER_QUESTIONS : QUESTIONS;
  const visible = QS;
  const what = project?.kind === 'flyer' ? 'flyer' : 'video';
  const q = visible[step];

  // load project + styles, resume at the first unanswered question
  useEffect(() => {
    (async () => {
      try {
        const r = await api(`/projects/${id}`);
        setProject(r.project); if (r.limits) setLimits(r.limits);
        const brief = r.project.brief || {};
        bRef.current = brief; setB(brief);
        const { styles: st } = await api('/styles'); setStyles(st);
        const imgs = (r.project.assets || []).filter((a) => a.kind === 'image').length;
        const LIST = r.project.kind === 'flyer' ? FLYER_QUESTIONS : QUESTIONS;
        const first = LIST.findIndex((qq) => { const v = valueOf(qq, brief, imgs); return v === undefined && !(qq.optional && brief[`${qq.id}Skipped`]); });
        setStep(brief.done && r.project.plan ? LIST.length : first < 0 ? LIST.length : first);
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

  // Saving is instant on screen; the server copy is updated in the background, one request at a time
  // (so answers never wait on the network, and quick taps can't overwrite each other).
  const bRef = useRef(b);
  const saving = useRef(Promise.resolve());
  const save = (patch) => {
    const next = { ...bRef.current, ...patch };
    bRef.current = next; setB(next);
    saving.current = saving.current.then(() => api(`/projects/${id}/brief`, { method: 'PATCH', body: { brief: patch } })
      .then((r) => setProject((p) => ({ ...p, ...r.project, assets: r.project.assets || p.assets })))
      .catch((e) => setError(e.message)));
    return next;
  };
  const saved = () => saving.current;

  const advance = (next) => {
    if (editing) { setEditing(false); const brief = next; const f = QS.findIndex((qq) => valueOf(qq, brief, pics.length) === undefined && !(qq.optional && brief[`${qq.id}Skipped`])); setStep(f < 0 ? QS.length : f); return; }
    const f = QS.findIndex((qq) => valueOf(qq, next, pics.length) === undefined && !(qq.optional && next[`${qq.id}Skipped`]));
    setStep(f < 0 ? QS.length : f);
  };

  const answer = async (value, extra = {}) => {
    if (!q || reading) return;
    setError('');
    let patch;
    if (q.id === 'paste') {
      setReading(true);
      try {
        await saved();
        const r = await api(`/projects/${id}/brief/parse`, { method: 'POST', body: { text: value } });
        setProject((p) => ({ ...p, ...r.project, assets: r.project.assets || p.assets }));
        bRef.current = { ...(r.project.brief || {}) };
        const next = save({ pasted: true });
        if (r.aiError) setError(`The AI couldn't read all of it (${r.aiError.slice(0, 90)}). I picked up what I could and will ask about the rest.`);
        setToast(r.found?.length ? `Got it. I found your ${r.found.map((k) => FOUND_LABEL[k] || k).join(', ')}.` : "Got it. I'll ask about the rest."); setTimeout(() => setToast(''), 5000);
        advance(next);
      } catch (e) { setError(e.message); } finally { setReading(false); }
      return;
    }
    if (q.id === 'voiceover') patch = { voiceover: value === 'yes' };

    else if (q.id === 'duration') patch = { duration: Number(value) };
    else if (q.id === 'headline') patch = { headlines: value, headline: value[0] };
    else if (q.id === 'goal') patch = { goals: value, goal: value.join(' + ') };
    else if (q.id === 'cta') patch = { ctas: value, cta: value[0] };
    else patch = { [q.id]: value };
    const next = save({ ...patch, ...extra, [`${q.id}Skipped`]: false });
    advance(next);
  };
  const skip = () => { const next = save({ [`${q.id}Skipped`]: true, ...(q.id === 'pictures' ? { picturesDone: true } : {}) }); advance(next); };

  const upload = async (files, role) => {
    setError('');
    const room = MAX_PICS - pics.length;
    if (room <= 0) { setError(`You can add up to ${MAX_PICS} pictures. Remove one to add another.`); return; }
    if (files.length > room) setError(`Only ${room} more picture${room === 1 ? '' : 's'} can be added (up to ${MAX_PICS}).`);
    setUploading(true);
    try {
      for (const f of files.slice(0, room)) {
        const form = new FormData();
        const small = await shrinkImage(f);
        form.append('file', small);
        if (role) form.append('role', role);
        const look = await imageLook(small);
        if (look.alpha !== undefined) form.append('alpha', String(look.alpha));
        if (look.light !== undefined && look.light !== null) form.append('light', String(look.light));
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
  const finish = async (value) => { const next = save({ extra: value || '', extraSkipped: !value, done: true }); setBuilding(true); await saved(); build(next); };

  if (!project) return error ? <div className="mx-auto max-w-xl p-8"><Alert>{error}</Alert></div> : <PageLoader />;
  const answered = visible.slice(0, Math.min(step, visible.length));
  const opts = q?.suggest ? (suggestions[q.id] || []) : q?.options || [];
  const finished = step >= visible.length;

  return (
    <div className="mx-auto max-w-6xl px-0 sm:px-4 sm:py-5">
      <div className="hidden flex-wrap items-center justify-between gap-3 sm:flex">
        <h1 className="truncate text-xl font-bold tracking-[-0.03em] sm:text-2xl">{b.name || project.title}</h1>
        {project.kind !== 'flyer' && <Steps current="plan" projectId={id} hasPlan={!!project.plan} hasCode={!!project.code} />}
      </div>

      <div className="grid gap-6 sm:mt-5 lg:grid-cols-[1fr_320px]">
        <section className="chat flex h-[calc(100dvh-3.5rem)] flex-col overflow-hidden sm:h-[calc(100dvh-9.5rem)] sm:min-h-[560px]" aria-label="Questions">
          <div className="chat-progress" aria-hidden="true"><div style={{ width: `${Math.round((Math.min(step, visible.length) / visible.length) * 100)}%` }} /></div>
          <div className="flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-8 sm:py-7" aria-live="polite">
            {answered.map((qq, i) => (qq.show && !qq.show(b)) ? null : (
              <div key={qq.id} className="space-y-2">
                <Bubble who="ai">{qq.ask(b)}</Bubble>
                <Bubble who="me" onEdit={building ? null : () => { setEditing(true); setStep(i); }}>{label(qq, valueOf(qq, b, pics.length), b, styles)}</Bubble>
              </div>
            ))}

            {!finished && q && (
              <div key={q.id} className="ask-block space-y-4 pt-2">
                <Bubble who="ai" current>{q.ask(b)}</Bubble>

                {(q.type === 'single' || q.type === 'multi') && (
                  <div className={`options pl-11 ${opts.some((o) => o.d || String(o.l ?? o).length > 26) ? 'options-wide' : ''}`}>
                    {loadingSug && !opts.length && <span className="flex items-center gap-2 text-sm text-ink-mute"><Spinner className="size-4" />Writing some ideas…</span>}
                    {opts.filter((o) => q.id !== 'duration' || (o >= limits.minSeconds && o <= limits.maxSeconds)).map((o) => {
                      const v = o.v ?? o, l = o.l ?? (q.id === 'duration' ? `${o} seconds` : o);
                      const on = q.type === 'multi' ? multi.includes(v) : b[q.id] === v;
                      const best = q.id === 'duration' && v === fitSeconds(b);
                      return <Chip key={v} active={on} sub={o.d || (best ? 'Fits your details best' : undefined)} multi={q.type === 'multi'} onClick={() => {
                        if (q.id === 'duration') { const w = lengthWarning(b, v); if (w) { setLenWarn({ v, ...w }); return undefined; } setLenWarn(null); }
                        if (q.type === 'single') return answer(v);
                        setMulti((m) => (m.includes(v) ? m.filter((x) => x !== v) : m.length >= (q.max || 9) ? m : [...m, v]));
                      }}>{l}</Chip>;
                    })}
                    {q.type === 'multi' && multi.filter((v) => !opts.includes(v)).map((v) => <Chip key={v} active multi onClick={() => setMulti((m) => m.filter((x) => x !== v))}>{v}</Chip>)}
                  </div>
                )}
                {q.id === 'duration' && lenWarn && (
                  <div className="ml-11 rounded-[14px] border border-amber-300 bg-amber-50 p-4 text-[14px] leading-relaxed text-ink" role="alert">
                    <p>{lenWarn.text}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => { const v = lenWarn.rec; setLenWarn(null); answer(v); }}>Use {lenWarn.rec} seconds</Button>
                      <Button size="sm" variant="outline" onClick={() => { const v = lenWarn.v; setLenWarn(null); answer(v); }}>Keep {lenWarn.v} seconds</Button>
                    </div>
                  </div>
                )}
                {q.type === 'multi' && <p className="pl-11 text-[13px] text-ink-mute">{q.hint || 'Pick one or more, or type your own.'}</p>}
                {reading && (
                  <div className="space-y-2">
                    <Bubble who="me">My details (pasted)</Bubble>
                    <div className="flex items-center gap-3"><div className="bubble-ai typing px-4 py-3.5"><span /><span /><span /></div><span className="text-sm text-ink-mute">Reading your details…</span></div>
                  </div>
                )}

                {q.type === 'upload' && (
                  <div className="ml-11 rounded-2xl border border-dashed border-ink/20 bg-white p-4">
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
                  <div className="options options-wide pl-11">
                    <input ref={musicRef} type="file" accept="audio/*" hidden onChange={async (e) => {
                      const f = e.target.files?.[0]; if (!f) return;
                      setUploading(true); setError('');
                      try { const form = new FormData(); form.append('file', f); form.append('role', 'music'); form.append('name', 'my music'); await api(`/projects/${id}/assets`, { method: 'POST', form }); answer('own'); }
                      catch (err) { setError(err.message); } finally { setUploading(false); e.target.value = ''; }
                    }} />
                    <Chip sub="Smooth whooshes, pops and clicks timed to the motion" onClick={() => answer('sfx')}>Sound effects</Chip>
                    <Chip sub="Upload an MP3 or WAV" onClick={() => musicRef.current?.click()}>{uploading ? 'Uploading…' : 'Use my own music'}</Chip>
                    <Chip onClick={() => answer('none')}>No sound</Chip>
                  </div>
                )}

                {q.type === 'colors' && (
                  <div className="options pl-11">
                    <Chip onClick={() => answer('style', { colorMode: 'style', colors: {} })}>The style's colours</Chip>
                    {logo && <Chip onClick={async () => { try { const c = await logoColors(logo.url); answer('logo', { colorMode: 'logo', colors: c || {} }); } catch { answer('style', { colorMode: 'style', colors: {} }); } }}>Match my logo</Chip>}
                    <ColorPick onPick={(c) => answer('own', { colorMode: 'own', colors: c })} />
                  </div>
                )}

                {q.type === 'style' && (
                  <div className="sm:ml-11">
                    <Button size="sm" className="mb-3" onClick={() => answer('auto', { styleAuto: true, styleId: undefined })}>Let Animora choose for me</Button>
                    <StylePicker value={b.styleId} onPick={(s) => answer(s.id, { styleId: s.id, styleAuto: false })} />
                  </div>
                )}

                {q.chips && (
                  <div className="options pl-11">
                    {q.chips.map((c) => <Chip key={c} onClick={() => setText((t) => (t ? `${t.trim()}\n${c}` : c))}>{c}</Chip>)}
                  </div>
                )}
              </div>
            )}

            {finished && (
              <div className="space-y-3">
                <Bubble who="ai" current>{building ? (what === 'flyer' ? "Great, I have everything. Designing your flyer now…" : "Great, I have everything. I'm planning your scenes now…") : project.plan ? `Your answers are saved. Change any answer above, or make the ${what}.` : 'All set!'}</Bubble>
                {building && <div className="flex"><div className="bubble-ai typing px-4 py-3.5"><span /><span /><span /></div></div>}
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* composer: always lets you type (or say) your own answer */}
          <div className="composer">
            {error && <div className="mb-2"><Alert onClose={() => setError('')}>{error}</Alert></div>}
            {!finished && q && (
              <div className="mb-2 flex items-center justify-between px-1 text-[12.5px] text-ink-mute">
                <span>Question {step + 1} of {visible.length}</span>
                {q.optional && !q.done && <button type="button" onClick={skip} className="font-semibold text-ink-soft hover:text-ink">Skip this one</button>}
              </div>
            )}
            {!finished && q && ['text', 'long', 'single', 'multi'].includes(q.type) && (q.typed || q.type === 'text' || q.type === 'long' || q.type === 'multi') && (
              <form className="composer-box" onSubmit={(e) => {
                e.preventDefault();
                const v = text.trim();
                if (q.type === 'multi') { const all = [...multi, ...(v && !multi.includes(v) ? [v] : [])]; if (!all.length) return; return answer(all); }
                if (q.done) return finish(v);
                if (!v) return;
                answer(q.type === 'long' ? v.split('\n').map((x) => x.trim()).filter(Boolean).join(q.id === 'products' ? '\n' : ' ') : v);
              }}>
                {q.type === 'long' ? (
                  <textarea value={text} onChange={(e) => setText(e.target.value)} rows={q.id === 'paste' ? 5 : 3} placeholder={q.placeholder} aria-label="Your answer"
                    className="composer-input max-h-56 min-h-[4.5rem] resize-none py-3" />
                ) : (
                  <input value={text} onChange={(e) => setText(e.target.value)} autoFocus placeholder={q.placeholder || (q.typed ? 'Or type your own answer…' : 'Type your answer…')} aria-label="Your answer"
                    className="composer-input h-12" />
                )}
                <div className="flex shrink-0 items-center gap-1.5 self-end p-1.5">
                  <MicButton onText={(t) => setText((x) => (x.trim() ? `${x.trim()} ${t}` : t))} onError={setError} className="!size-10 !rounded-full !border-0 !bg-transparent hover:!bg-ink/5" />
                  <Button type="submit" className="!h-10 !rounded-full !px-4" loading={reading}
                    disabled={reading || (q.done ? false : q.type === 'multi' ? !multi.length && !text.trim() : !text.trim())}>
                    {q.done ? (text.trim() ? `Make my ${what}` : "No, that's all") : q.type === 'multi' ? (multi.length ? `Continue · ${multi.length + (text.trim() && !multi.includes(text.trim()) ? 1 : 0)}` : 'Continue') : q.id === 'paste' ? 'Read it' : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-label="Send"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                    )}
                  </Button>
                </div>
              </form>
            )}
            {finished && (
              <>
                {what === 'video' && !project.code && lengthWarning(b, b.duration) && (
                  <div className="mb-3 rounded-[14px] border border-amber-300 bg-amber-50 p-4 text-[14px] leading-relaxed text-ink" role="alert">
                    <p>{lengthWarning(b, b.duration).text}</p>
                    <Button size="sm" className="mt-3" onClick={() => save({ duration: lengthWarning(b, b.duration).rec })}>Use {lengthWarning(b, b.duration).rec} seconds</Button>
                  </div>
                )}
                <Button size="lg" className="w-full" loading={building} onClick={() => (project.plan && b.done ? navigate(`/p/${id}/studio${project.code ? '' : '?generate=1'}`) : build(b))}>
                  {project.plan && project.code ? `Open my ${what}` : `Make my ${what}`}
                </Button>
                {project.plan && <button onClick={() => build(b)} disabled={building} className="mt-2 w-full text-sm font-semibold text-ink-mute hover:text-ink">Plan again from my answers</button>}
              </>
            )}
          </div>
        </section>

        <aside className="hidden space-y-4 lg:block">
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
            {!b.name && <p className="mt-2 text-sm text-ink-soft">Answer the questions and I'll make the {what} for you. Paste pictures any time (up to {MAX_PICS}).</p>}
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
