import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, naira, nairaExact, useAuth } from '../lib.jsx';
import { Button } from '../components/ui.jsx';

function Feature({ children, off }) {
  return (
    <li className={`flex gap-3 ${off ? 'text-ink-mute' : ''}`}>
      <span aria-hidden="true" className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-xs font-bold ${off ? 'bg-lilac' : 'bg-money text-white'}`}>{off ? '–' : '✓'}</span>
      <span>{children}</span>
    </li>
  );
}

export default function Pricing() {
  const { user } = useAuth();
  const [p, setP] = useState(null);
  useEffect(() => { api('/pricing').then((r) => setP(r.pricing)).catch(() => {}); }, []);
  if (!p) return null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="max-w-2xl text-4xl font-extrabold sm:text-5xl">Start free. Go Pro when ads slow you down.</h1>
      <p className="mt-4 max-w-2xl text-lg text-ink-soft">Every plan uses the same AI and the same video engine. The difference is ads, length and how many videos you make.</p>

      <div className="mt-10 grid gap-5 md:grid-cols-2">
        <section className="surface p-7">
          <h2 className="text-2xl font-extrabold">Free</h2>
          <p className="mt-3 font-display text-5xl font-extrabold">{naira(0)}</p>
          <p className="mt-1 text-ink-soft">Watch a {p.adSeconds}-second ad before each video.</p>
          <ul className="mt-6 space-y-3">
            <Feature>Unlimited videos, one short ad each</Feature>
            <Feature>Videos up to {p.freeMaxSeconds} seconds</Feature>
            <Feature>AI chat planning, live preview and edits</Feature>
            <Feature>HD MP4 for WhatsApp, Instagram, TikTok</Feature>
            <Feature off>1–5 minute videos</Feature>
          </ul>
          <Button as={Link} to={user ? '/new/video' : '/signup'} variant="outline" size="lg" className="mt-8 w-full">{user ? 'Make a video' : 'Start free'}</Button>
        </section>

        <section className="stage p-7">
          <h2 className="text-2xl font-extrabold">Pro</h2>
          <p className="mt-3 font-display text-5xl font-extrabold">{naira(p.proPriceNgn)}<span className="text-xl font-bold text-white/60"> / month</span></p>
          <p className="mt-1 text-white/70">That's about {naira(Math.round(p.proPriceNgn / p.proVideosPerMonth))} per video.</p>
          <ul className="mt-6 space-y-3">
            <Feature>{p.proVideosPerMonth} ad-free videos every month</Feature>
            <Feature>Videos from 15 seconds up to {p.proMaxSeconds / 60} minutes</Feature>
            <Feature>After {p.proVideosPerMonth}, keep going with a short ad per video</Feature>
            <Feature>Everything in Free</Feature>
            <Feature>Pay from your Access wallet</Feature>
          </ul>
          {user?.plan === 'pro'
            ? <p className="mt-8 rounded-full bg-white/10 py-3.5 text-center font-semibold">You're on Pro</p>
            : <Button as={Link} to={user ? '/checkout' : '/signup'} size="lg" className="mt-8 w-full">Go Pro</Button>}
        </section>
      </div>

    </div>
  );
}
