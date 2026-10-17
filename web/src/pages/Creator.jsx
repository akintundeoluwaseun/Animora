// Creator dashboard: styles, times used, royalties (30%), bank account and payouts.
import { useEffect, useState } from 'react';
import { api, ago, naira, nairaExact } from '../lib.jsx';
import { Alert, Button, Field, inputCls, Modal, PageLoader } from '../components/ui.jsx';

function Earnings({ daily }) {
  // Last 30 days, one bar per day.
  const days = [...Array(30)].map((_, i) => {
    const d = new Date(Date.now() - (29 - i) * 864e5).toISOString().slice(0, 10);
    const row = daily.find((x) => x.day === d);
    return { d, amount: Number(row?.amount || 0), videos: row?.videos || 0 };
  });
  const max = Math.max(1, ...days.map((x) => x.amount));
  return (
    <div>
      <div className="flex h-36 items-end gap-[3px]" role="img" aria-label="Royalties per day for the last 30 days">
        {days.map((x) => (
          <div key={x.d} className="group relative flex-1">
            <div className={`w-full rounded-t ${x.amount ? 'bg-money' : 'bg-lilac-deep'}`} style={{ height: `${Math.max(3, (x.amount / max) * 136)}px` }} />
            {x.amount > 0 && (
              <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink px-2 py-1 text-xs text-white group-hover:block">
                {new Date(x.d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}: {nairaExact(x.amount)} · {x.videos} video{x.videos > 1 ? 's' : ''}
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs text-ink-mute"><span>30 days ago</span><span>Today</span></div>
    </div>
  );
}

function BankForm({ user, onSaved }) {
  const [banks, setBanks] = useState([]);
  const [bankCode, setBankCode] = useState('');
  const [acct, setAcct] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { api('/banks').then((r) => setBanks(r.banks)); }, []);
  const save = async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    try { const r = await api('/creator/bank', { method: 'POST', body: { bankCode, accountNumber: acct } }); onSaved(r.user); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={save} className="space-y-3">
      <Alert>{error}</Alert>
      <Field label="Bank">
        <select className={inputCls} value={bankCode} onChange={(e) => setBankCode(e.target.value)} required>
          <option value="">Choose your bank</option>
          {banks.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
        </select>
      </Field>
      <Field label="Account number"><input className={inputCls} inputMode="numeric" maxLength={10} required value={acct} onChange={(e) => setAcct(e.target.value.replace(/\D/g, ''))} /></Field>
      <Button type="submit" variant="dark" loading={busy} disabled={!bankCode || acct.length !== 10}>Verify and save</Button>
      {user?.bank && <p className="text-sm text-ink-mute">Current: {user.bank.accountName} · {user.bank.bankName.split('|')[0]} · {user.bank.accountNumber}</p>}
    </form>
  );
}

const THEMES = [['bold', 'Bold & energetic'], ['luxe', 'Elegant & premium'], ['clean', 'Clean & modern']];

function NewStyle({ open, onClose, onCreated }) {
  const [f, setF] = useState({ name: '', description: '', rules: '', theme: 'bold', font: 'Poppins', primary: '#E8530E', secondary: '#FFC93C', background: '#1B0F08', baseCode: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async (e) => {
    e.preventDefault(); setBusy(true); setError(null);
    try {
      const { style } = await api('/creator/styles', { method: 'POST', body: {
        name: f.name, description: f.description, rules: f.rules, theme: f.theme, font: f.font, baseCode: f.baseCode.trim() || undefined,
        palette: { primary: f.primary, secondary: f.secondary, background: f.background },
      } });
      onCreated(style); onClose();
    } catch (err) { setError(err.data?.problems ? [err.message, ...err.data.problems] : [err.message]); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} label="Upload a style" wide>
      <h2 className="text-2xl font-extrabold">Upload a style</h2>
      <p className="mt-1 text-ink-soft">Describe your look so the AI can animate in it. Businesses pick styles when they start a video.</p>
      <form onSubmit={save} className="mt-5 grid gap-4 sm:grid-cols-2">
        {error && <div className="sm:col-span-2"><Alert>{error.map((x) => <div key={x}>{x}</div>)}</Alert></div>}
        <Field label="Style name"><input className={inputCls} required maxLength={60} value={f.name} onChange={set('name')} placeholder="e.g. Afro Neon" /></Field>
        <Field label="Base look">
          <select className={inputCls} value={f.theme} onChange={set('theme')}>{THEMES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </Field>
        <div className="sm:col-span-2"><Field label="Short description" hint="What it looks like and who it's for"><input className={inputCls} maxLength={300} value={f.description} onChange={set('description')} /></Field></div>
        <div className="grid grid-cols-3 gap-3 sm:col-span-2">
          {[['primary', 'Main colour'], ['secondary', 'Accent'], ['background', 'Background']].map(([k, l]) => (
            <Field key={k} label={l}><input type="color" className="h-12 w-full cursor-pointer rounded-2xl border border-ink/12 bg-white p-1" value={f[k]} onChange={set(k)} /></Field>
          ))}
        </div>
        <div className="sm:col-span-2">
          <Field label="Style rules for the AI" hint="Typography, layout, how things move in and out, decorations. Be specific.">
            <textarea className={`${inputCls} h-36 py-3`} required value={f.rules} onChange={set('rules')}
              placeholder={'- Headlines: Anton, 110px, uppercase, neon glow\n- Entrances: slide up 80px with expo.out, stagger 0.1s\n- Background: dark purple with moving diagonal stripes'} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Example code (optional)" hint="A complete HTML file in this style using a paused GSAP timeline on window.__timeline. It's checked before saving.">
            <textarea className={`${inputCls} h-28 py-3 font-mono text-xs`} value={f.baseCode} onChange={set('baseCode')} spellCheck={false} />
          </Field>
        </div>
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit" loading={busy}>Publish style</Button>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function Creator() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [bankOpen, setBankOpen] = useState(false);
  const [styleOpen, setStyleOpen] = useState(false);
  const [paying, setPaying] = useState(false);

  const load = () => api('/creator/dashboard').then(setData).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const withdraw = async () => {
    setPaying(true); setError(''); setMsg('');
    try { const r = await api('/creator/payouts', { method: 'POST' }); setMsg(`${naira(r.payout.amount_ngn)} sent to your bank account. Reference ${r.payout.reference}.`); load(); }
    catch (e) { setError(e.message); } finally { setPaying(false); }
  };
  const toggle = async (s) => { await api(`/creator/styles/${s.id}`, { method: 'PATCH', body: { status: s.status === 'live' ? 'hidden' : 'live' } }); load(); };

  if (!data) return error ? <div className="mx-auto max-w-xl p-8"><Alert>{error}</Alert></div> : <PageLoader />;
  const t = data.totals;
  const pending = Number(t.pending);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold sm:text-4xl">Creator dashboard</h1>
          <p className="mt-1 text-ink-soft">You earn {data.sharePercent}% of the revenue from every video made with your styles.</p>
        </div>
        <Button onClick={() => setStyleOpen(true)}>Upload a style</Button>
      </div>
      <div className="mt-4 space-y-2"><Alert onClose={() => setError('')}>{error}</Alert>{msg && <Alert kind="success" onClose={() => setMsg('')}>{msg}</Alert>}</div>

      <section className="mt-6 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="surface p-6">
          <div className="flex flex-wrap gap-x-10 gap-y-4">
            <div><p className="text-sm text-ink-soft">Total earned</p><p className="font-display text-4xl font-extrabold text-money">{nairaExact(t.total)}</p></div>
            <div><p className="text-sm text-ink-soft">Videos made with your styles</p><p className="font-display text-4xl font-extrabold">{t.videos}</p></div>
            <div><p className="text-sm text-ink-soft">Paid out</p><p className="font-display text-4xl font-extrabold">{nairaExact(t.paid)}</p></div>
          </div>
          <div className="mt-6"><Earnings daily={data.daily} /></div>
        </div>

        <div className="stage p-6">
          <p className="text-white/70">Ready to withdraw</p>
          <p className="font-display text-5xl font-extrabold">{nairaExact(pending)}</p>
          {data.user.bank
            ? <p className="mt-3 text-sm text-white/70">To {data.user.bank.accountName} · {data.user.bank.bankName.split('|')[0]} ····{data.user.bank.accountNumber.slice(-4)} <button onClick={() => setBankOpen(true)} className="ml-1 underline">Change</button></p>
            : <p className="mt-3 text-sm text-white/70">Add your bank account to get paid.</p>}
          <div className="mt-5 flex flex-wrap gap-2">
            {data.user.bank
              ? <Button onClick={withdraw} loading={paying} disabled={pending < data.minPayoutNgn}>Withdraw {nairaExact(pending)}</Button>
              : <Button onClick={() => setBankOpen(true)}>Add bank account</Button>}
          </div>
          {data.user.bank && pending < data.minPayoutNgn && <p className="mt-2 text-xs text-white/60">Minimum withdrawal is {naira(data.minPayoutNgn)}.</p>}
          <p className="mt-5 text-xs text-white/50">Payouts are sent by bank transfer through Access Bank.</p>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-extrabold">Your styles</h2>
        {data.styles.length === 0 ? <p className="mt-3 text-ink-soft">No styles yet. Upload your first one to start earning.</p> : (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.styles.map((s) => (
              <li key={s.id} className="surface flex gap-4 p-4">
                <div className="h-28 w-20 shrink-0 overflow-hidden rounded-xl" style={{ background: s.palette?.background || '#1B1446' }}>
                  {s.preview_url && <video src={s.preview_url} poster={s.poster_url} muted loop autoPlay playsInline className="size-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{s.name}</p>
                  <p className="text-sm text-ink-mute">{s.status === 'live' ? 'Live' : 'Hidden'} · since {new Date(s.created_at).toLocaleDateString('en-NG', { month: 'short', year: 'numeric' })}</p>
                  <p className="mt-2 text-sm"><strong>{s.times_used}</strong> videos · <strong className="text-money">{nairaExact(s.earned)}</strong> earned</p>
                  <button onClick={() => toggle(s)} className="mt-2 text-sm font-semibold text-ink-soft underline">{s.status === 'live' ? 'Hide from businesses' : 'Make live'}</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10 grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="text-2xl font-extrabold">Recent royalties</h2>
          {data.recent.length === 0 ? <p className="mt-3 text-ink-soft">When businesses use your styles, each video shows up here.</p> : (
            <ul className="surface mt-4 divide-y divide-lilac overflow-hidden">
              {data.recent.map((r, i) => (
                <li key={i} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div><p className="font-semibold">{r.style_name}</p><p className="text-ink-mute">{r.paid_via === 'pro' ? 'Pro video' : 'Ad-supported video'} · {ago(r.created_at)}</p></div>
                  <div className="text-right"><p className="font-bold text-money">+{nairaExact(r.amount)}</p><p className="text-xs text-ink-mute">{r.status === 'paid' ? 'Paid' : 'Pending'}</p></div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h2 className="text-2xl font-extrabold">Payouts</h2>
          {data.payouts.length === 0 ? <p className="mt-3 text-ink-soft">No withdrawals yet.</p> : (
            <ul className="surface mt-4 divide-y divide-lilac overflow-hidden">
              {data.payouts.map((p) => (
                <li key={p.reference} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div><p className="font-semibold">{p.bank_name} ····{String(p.account_number).slice(-4)}</p><p className="text-ink-mute">{p.reference} · {ago(p.created_at)}</p></div>
                  <div className="text-right"><p className="font-bold">{nairaExact(p.amount_ngn)}</p><p className={`text-xs ${p.status === 'paid' ? 'text-money' : p.status === 'failed' ? 'text-alert' : 'text-ink-mute'}`}>{p.status}</p></div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <Modal open={bankOpen} onClose={() => setBankOpen(false)} label="Bank account">
        <h2 className="mb-4 text-2xl font-extrabold">Where should we pay you?</h2>
        <BankForm user={data.user} onSaved={() => { setBankOpen(false); load(); }} />
      </Modal>
      <NewStyle open={styleOpen} onClose={() => setStyleOpen(false)} onCreated={() => load()} />
    </div>
  );
}
