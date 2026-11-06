import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const KEY = 'animora-admin-key';
const read = () => { try { return sessionStorage.getItem(KEY) || ''; } catch { return ''; } };
const naira = (n) => `₦${Math.round(n).toLocaleString('en-NG')}`;
const ago = (t) => { const s = (Date.now() - new Date(t).getTime()) / 1000; return s < 90 ? 'just now' : s < 5400 ? `${Math.round(s / 60)} min ago` : s < 129600 ? `${Math.round(s / 3600)} h ago` : `${Math.round(s / 86400)} d ago`; };

function Card({ label, value, sub, tone }) {
  return (
    <div className="min-w-0 rounded-[14px] border border-ink/10 bg-white p-3 sm:p-4">
      <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-mute">{label}</p>
      <p className={`mt-1.5 text-[22px] font-bold leading-none sm:text-[28px] tracking-tight tabular-nums ${tone || ''}`}>{value}</p>
      {sub && <p className="mt-1.5 text-[13px] text-ink-soft">{sub}</p>}
    </div>
  );
}

// 30 days as bars, one colour per series. No library: plain SVG.
function Bars({ title, series, colour }) {
  const max = Math.max(1, ...series.map((x) => x.n)), total = series.reduce((a, x) => a + x.n, 0), w = 600, h = 120, bw = w / series.length;
  return (
    <div className="min-w-0 rounded-[14px] border border-ink/10 bg-white p-3 sm:p-4">
      <div className="flex items-baseline justify-between"><p className="text-[14px] font-semibold">{title}</p><p className="text-[13px] text-ink-soft tabular-nums">{total} in 30 days</p></div>
      <svg viewBox={`0 0 ${w} ${h + 18}`} className="mt-3 w-full" role="img" aria-label={`${title}, last 30 days`}>
        {series.map((x, i) => { const bh = Math.max(x.n ? 3 : 0, (x.n / max) * h); return <rect key={x.day} x={i * bw + 2} y={h - bh} width={bw - 4} height={bh} rx="3" fill={colour} opacity={x.n ? 1 : 0.15}><title>{`${x.day}: ${x.n}`}</title></rect>; })}
        <line x1="0" y1={h + 0.5} x2={w} y2={h + 0.5} stroke="currentColor" opacity=".15" />
        <text x="0" y={h + 14} fontSize="11" fill="currentColor" opacity=".55">{series[0]?.day.slice(5)}</text>
        <text x={w} y={h + 14} fontSize="11" textAnchor="end" fill="currentColor" opacity=".55">{series[series.length - 1]?.day.slice(5)}</text>
      </svg>
    </div>
  );
}

function List({ title, rows, empty }) {
  return (
    <div className="min-w-0 rounded-[14px] border border-ink/10 bg-white p-3 sm:p-4">
      <p className="text-[14px] font-semibold">{title}</p>
      {rows.length ? <ul className="mt-2 divide-y divide-ink/8">{rows.map(([a, b], i) => <li key={i} className="flex items-baseline justify-between gap-3 py-2 text-[14px]"><span className="min-w-0 break-words">{a}</span><span className="shrink-0 text-ink-soft tabular-nums">{b}</span></li>)}</ul> : <p className="mt-2 text-[14px] text-ink-mute">{empty}</p>}
    </div>
  );
}

const size = (b) => (b >= 1e9 ? `${(b / 1e9).toFixed(2)} GB` : b >= 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.round(b / 1e3)} KB`);

// What is using the database space, and one button that deletes the leftovers and gives the space back.
function Storage({ adminKey }) {
  const [st, setSt] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const call = useCallback(async (method) => {
    const res = await fetch(method === 'POST' ? '/api/admin/storage/clean' : '/api/admin/storage', { method, headers: { 'x-admin-key': adminKey } });
    if (!res.ok) throw new Error('Could not read the storage.');
    return res.json();
  }, [adminKey]);
  useEffect(() => { call('GET').then(setSt).catch((e) => setMsg(e.message)); }, [call]);
  const clean = async () => {
    setBusy(true); setMsg('');
    try { const j = await call('POST'); setSt(j); setMsg(j.before > j.total ? `Freed ${size(j.before - j.total)}.` : 'Already clean.'); }
    catch (e) { setMsg(e.message); } finally { setBusy(false); }
  };
  return (
    <section className="mt-5 rounded-[14px] border border-ink/10 bg-white p-4" aria-label="Storage">
      <div className="flex flex-wrap items-center gap-3">
        <div><p className="text-[14px] font-semibold">Database space</p><p className="text-[13px] text-ink-mute">MP4s are deleted 5 minutes after they are made. People can make them again for free.</p></div>
        <p className="text-[26px] font-bold tabular-nums tracking-tight sm:ml-auto">{st ? size(st.total) : '…'}</p>
        <button onClick={clean} disabled={busy} className="press h-10 w-full rounded-full bg-ink px-4 text-[14px] font-semibold text-white disabled:opacity-50 sm:w-auto">{busy ? 'Cleaning…' : 'Free up space now'}</button>
      </div>
      {msg && <p className="mt-2 text-[13px] font-semibold text-money" role="status">{msg}</p>}
      {st && (
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <div><p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-mute">Stored files</p>
            <ul className="mt-1 divide-y divide-ink/8 text-[14px]">{st.files.length ? st.files.map((f) => <li key={f.name} className="flex justify-between gap-3 py-1.5"><span>{f.name} <span className="text-ink-mute">· {f.n}</span></span><b className="tabular-nums">{size(f.bytes)}</b></li>) : <li className="py-1.5 text-ink-mute">None.</li>}</ul></div>
          <div><p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-mute">Tables</p>
            <ul className="mt-1 divide-y divide-ink/8 text-[14px]">{st.tables.slice(0, 6).map((t) => <li key={t.name} className="flex justify-between gap-3 py-1.5"><span>{t.name}</span><b className="tabular-nums">{size(t.bytes)}</b></li>)}</ul></div>
        </div>
      )}
    </section>
  );
}

export default function Admin() {
  const [key, setKey] = useState(read());
  const [typed, setTyped] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (k) => {
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/admin/stats', { headers: { 'x-admin-key': k } });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(res.status === 404 ? 'The admin dashboard is off. Add ADMIN_KEY in your Vercel settings, then redeploy.' : res.status === 403 ? 'That key is not right.' : 'Could not load the numbers. Try again.');
      setData(j); try { sessionStorage.setItem(KEY, k); } catch { /* fine */ } setKey(k);
    } catch (e) { setError(e.message); setData(null); if (read()) { try { sessionStorage.removeItem(KEY); } catch { /* fine */ } } } finally { setBusy(false); }
  }, []);
  useEffect(() => { const k = read(); if (k) load(k); }, [load]);
  useEffect(() => { if (!key || !data) return undefined; const t = setInterval(() => load(key), 60000); return () => clearInterval(t); }, [key, data, load]);

  if (!data) {
    return (
      <main className="mx-auto max-w-[420px] px-5 py-16">
        <h1 className="text-[26px] font-bold tracking-tight">Owner dashboard</h1>
        <p className="mt-2 text-[15px] text-ink-soft">Private. Enter your admin key to see how Animora is doing.</p>
        <form className="mt-6 flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); if (typed.trim()) load(typed.trim()); }}>
          <input type="password" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" placeholder="Admin key" aria-label="Admin key" className="h-12 rounded-[12px] border border-ink/15 bg-white px-4 text-[16px] outline-none focus:border-ink/40" />
          <button type="submit" disabled={busy || !typed.trim()} className="press h-12 rounded-[12px] bg-ink font-semibold text-white disabled:opacity-50">{busy ? 'Checking…' : 'Open dashboard'}</button>
        </form>
        {error && <p className="mt-4 text-[14px] text-alert" role="alert">{error}</p>}
        <Link to="/videos" className="mt-8 inline-block text-[14px] font-semibold text-ink-soft hover:text-ink">← Back to Animora</Link>
      </main>
    );
  }

  const { users, projects, renders, money } = data;
  const okRate = renders.done + renders.failed ? Math.round((renders.done / (renders.done + renders.failed)) * 100) : 100;
  return (
    <main className="mx-auto w-full max-w-[1100px] overflow-x-hidden px-4 py-5 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-center gap-3">
        <div><h1 className="text-[22px] font-bold tracking-tight sm:text-[26px]">Owner dashboard</h1><p className="text-[13px] text-ink-mute">Updated {ago(data.at)}. Refreshes every minute.</p></div>
        <div className="flex w-full gap-2 sm:ml-auto sm:w-auto">
          <button onClick={() => load(key)} disabled={busy} className="press h-10 flex-1 rounded-full border border-ink/15 px-4 text-[14px] font-semibold sm:flex-none">{busy ? 'Refreshing…' : 'Refresh'}</button>
          <button onClick={() => { try { sessionStorage.removeItem(KEY); } catch { /* fine */ } setKey(''); setData(null); setTyped(''); }} className="press h-10 flex-1 rounded-full border border-ink/15 px-4 text-[14px] font-semibold sm:flex-none">Lock</button>
        </div>
      </header>

      <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Totals">
        <Card label="People" value={users.total} sub={`${users.week} new this week · ${users.pro} on Pro`} />
        <Card label="Videos & flyers" value={projects.designed} sub={`${projects.videos} videos · ${projects.flyers} flyers started`} />
        <Card label="MP4s made" value={renders.done} sub={`${renders.today} today · ${okRate}% worked`} tone={okRate < 80 ? 'text-alert' : ''} />
        <Card label="Money in" value={naira(money.revenue)} sub={`${naira(money.month)} in 30 days · ${money.paid} payments`} tone="text-money" />
      </section>

      <section className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Now">
        <Card label="Made today" value={projects.today} sub="new videos and flyers" />
        <Card label="This week" value={projects.week} sub="new videos and flyers" />
        <Card label="Rendering now" value={renders.busy} sub="queued or in progress" />
        <Card label="Failed MP4s" value={renders.failed} sub="all time" tone={renders.failed ? 'text-alert' : ''} />
      </section>

      <section className="mt-5 grid gap-3 md:grid-cols-2" aria-label="Last 30 days">
        <Bars title="New people" series={data.daily.users} colour="#5546FF" />
        <Bars title="MP4s finished" series={data.daily.renders} colour="#0E9F6E" />
        <Bars title="Videos started" series={data.daily.videos} colour="#4F46E5" />
        <Bars title="Flyers started" series={data.daily.flyers} colour="#F2691B" />
      </section>

      <section className="mt-5 grid gap-3 lg:grid-cols-3" aria-label="Details">
        <List title="Most used styles" rows={data.styles.map((x) => [x.name, x.n])} empty="Nothing yet." />
        <List title="Sizes people pick" rows={data.aspects.map((x) => [x.name, x.n])} empty="Nothing yet." />
        <List title="Why MP4s failed (30 days)" rows={data.failures.map((x) => [x.msg, x.n])} empty="No failures. 🎉" />
      </section>

      <Storage adminKey={key} />

      <section className="mt-5 rounded-[14px] border border-ink/10 bg-white p-4" aria-label="Latest">
        <p className="text-[14px] font-semibold">Latest made</p>
        {data.recent.length ? (
          <>
            <ul className="mt-2 divide-y divide-ink/8 sm:hidden">{data.recent.map((x, i) => <li key={i} className="py-2.5"><p className="break-words text-[14px] font-medium">{x.title}</p><p className="mt-0.5 text-[13px] text-ink-soft">{x.kind === 'flyer' ? 'Flyer' : `Video${x.duration_seconds ? ` ${x.duration_seconds}s` : ''}`} · {x.aspect_ratio} · {ago(x.created_at)}</p></li>)}</ul>
            <div className="mt-2 hidden overflow-x-auto sm:block"><table className="w-full text-left text-[14px]">
              <thead className="text-[12px] uppercase tracking-[0.08em] text-ink-mute"><tr><th className="py-2 pr-3 font-semibold">Name</th><th className="py-2 pr-3 font-semibold">Type</th><th className="py-2 pr-3 font-semibold">Size</th><th className="py-2 text-right font-semibold">When</th></tr></thead>
              <tbody className="divide-y divide-ink/8">{data.recent.map((x, i) => <tr key={i}><td className="max-w-[320px] truncate py-2 pr-3">{x.title}</td><td className="py-2 pr-3">{x.kind === 'flyer' ? 'Flyer' : `Video${x.duration_seconds ? ` ${x.duration_seconds}s` : ''}`}</td><td className="py-2 pr-3 tabular-nums">{x.aspect_ratio}</td><td className="py-2 text-right text-ink-soft">{ago(x.created_at)}</td></tr>)}</tbody>
            </table></div>
          </>
        ) : <p className="mt-2 text-[14px] text-ink-mute">Nothing made yet.</p>}
      </section>
    </main>
  );
}
