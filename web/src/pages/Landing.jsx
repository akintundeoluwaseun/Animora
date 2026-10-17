import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, naira, useAuth } from '../lib.jsx';
import { Button } from '../components/ui.jsx';
import { VideoPhone } from '../components/Preview.jsx';
import { StyleCard } from './Dashboard.jsx';

export default function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [styles, setStyles] = useState([]);
  const [pricing, setPricing] = useState(null);
  useEffect(() => {
    api('/styles').then((r) => setStyles(r.styles)).catch(() => {});
    api('/pricing').then((r) => setPricing(r.pricing)).catch(() => {});
  }, []);
  const hero = styles.find((s) => s.slug === 'naija-bold') || styles[0];
  const start = user ? '/dashboard?new=1' : '/signup';

  return (
    <div>
      {/* Hero: the conversation and the result, side by side */}
      <div className="mx-auto max-w-6xl px-4 pt-6">
      <section className="stage grid items-center gap-12 px-6 pb-14 pt-10 sm:px-10 md:grid-cols-[1.1fr_1fr] md:pt-14">
        <div>
          <h1 className="text-[2.6rem] font-extrabold leading-[1.02] text-white sm:text-6xl">
            Your business deserves a video ad, not just a photo.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-white/75">
            Tell Animora about your shop in a chat. Watch your ad come alive, change anything in plain words,
            then download an MP4 for WhatsApp Status, Instagram and TikTok.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button as={Link} to={start} size="lg">Make my first video</Button>
            <Button as={Link} to="/pricing" variant="glass" size="lg">See pricing</Button>
          </div>
          <p className="mt-4 text-sm text-white/55">Free with a 15-second ad per video. Pro is {naira(pricing?.proPriceNgn || 5000)}/month for 30 ad-free videos.</p>
        </div>

        <div className="relative mx-auto w-full max-w-[420px]">
          <div className="relative z-10 mx-auto w-[64%]">
            {hero?.preview_url
              ? <VideoPhone src={hero.preview_url} poster={hero.poster_url} autoPlay loop muted controls={false} maxWidth={300} />
              : <div className="phone"><div className="phone-screen aspect-[9/16] bg-ink" /></div>}
          </div>
          <div className="absolute left-0 top-[12%] z-20 max-w-[58%] space-y-2 text-sm" aria-hidden="true">
            <div className="bubble-user px-4 py-2.5 shadow-lg">Lunch special for my restaurant. Jollof + chicken ₦2,500</div>
            <div className="bubble-ai px-4 py-2.5 shadow-lg">Lovely! Where will you post it, and what colours?</div>
          </div>
          <div className="absolute bottom-[10%] right-0 z-20 rounded-2xl bg-white px-4 py-3 text-sm text-ink shadow-xl" aria-hidden="true">
            <p className="font-bold">mama-put-lunch.mp4</p>
            <p className="text-ink-mute">20s · 1080×1920 · ready</p>
          </div>
        </div>
        <div className="stage-floor" />
      </section>
      </div>

      {/* How it works: a real 3-step sequence */}
      <section>
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="max-w-xl text-3xl font-extrabold sm:text-4xl">From a chat to an MP4 in three steps</h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              ['Plan it by chatting', 'Say what you sell, your prices, your phone number and colours. Upload your logo and product photos. The AI suggests the scenes.'],
              ['Watch and tweak', 'Your ad plays instantly. Say "make the price bigger" or "change the background to green" and it updates.'],
              ['Download your video', 'Our own engine turns it into a smooth MP4, 15 seconds to 5 minutes, ready to post anywhere.'],
            ].map(([t, d], i) => (
              <li key={t} className="surface p-6">
                <span className="grid size-10 place-items-center rounded-full bg-danfo text-white font-display text-lg font-extrabold">{i + 1}</span>
                <h3 className="mt-4 text-xl font-bold">{t}</h3>
                <p className="mt-2 text-ink-soft">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Styles made by creators */}
      <section id="creators" className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-10 md:grid-cols-[1fr_1.6fr] md:items-start">
          <div>
            <h2 className="text-3xl font-extrabold sm:text-4xl">Styles made by Nigerian motion designers</h2>
            <p className="mt-4 text-ink-soft">
              Every style is designed by a creator. When a business makes a video with your style, you earn
              {' '}<strong className="text-money">{pricing?.creatorSharePercent ?? 30}% of what that video earns</strong>, every single time.
              No more chasing one-off client gigs.
            </p>
            <Button as={Link} to="/signup?role=creator" variant="dark" className="mt-6">Sell your style</Button>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {styles.slice(0, 6).map((s) => <StyleCard key={s.id} s={s} onPick={() => navigate(start)} />)}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4">
        <div className="stage flex flex-col items-start gap-6 px-8 py-12 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-3xl font-extrabold text-white">Post a video today, not a plain photo.</h2>
            <p className="mt-2 text-white/70">Restaurants, salons, schools, hotels, fashion — if you sell it, Animora can show it.</p>
          </div>
          <Button as={Link} to={start} size="lg">Start free</Button>
        </div>
      </section>
      <footer className="mx-auto max-w-6xl px-4 py-8 text-sm text-ink-mute">
        Animora · Motion video ads made by chatting with AI. Rendered by our own engine.
      </footer>
    </div>
  );
}
