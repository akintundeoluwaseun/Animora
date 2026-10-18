// Home: what Animora is, one real video, how it works. Nothing else.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, naira, DEVELOPER } from '../lib.jsx';
import { Button } from '../components/ui.jsx';

const STEPS = [
  ['Answer a few questions', 'Your business name, what you sell, your message and your pictures. One question at a time.'],
  ['The AI directs the shots', 'Every ad gets its own concept, moves and transitions. No two videos come out the same.'],
  ['Download the MP4', 'Watch the preview, change anything in plain words, then download it for WhatsApp, TikTok or YouTube.'],
];

export default function Home() {
  const [styles, setStyles] = useState([]);
  const [pricing, setPricing] = useState(null);
  useEffect(() => {
    api('/styles').then((r) => setStyles(r.styles)).catch(() => {});
    api('/pricing').then((r) => setPricing(r.pricing)).catch(() => {});
  }, []);
  const reel = ['studio-white', 'naija-bold', 'midnight-glow', 'owambe-party', 'fintech-blue', 'neon-nights'].map((k) => styles.find((s) => s.slug === k)).filter((s) => s?.preview_url);
  const [hero, ...more] = reel;
  const [playing, setPlaying] = useState(null);

  return (
    <div>
      <section className="bg-[#0B0A12] text-white">
        <div className="mx-auto grid max-w-[1180px] items-center gap-12 px-6 py-16 sm:px-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:py-24">
          <div>
            <h1 className="max-w-[14ch] text-[2.75rem] font-bold leading-[1] tracking-[-0.045em] sm:text-[4.25rem]">Motion-design video ads for your business.</h1>
            <p className="mt-6 max-w-[46ch] text-lg leading-relaxed text-white/65">
              Tell Animora about your business. Its AI director plans every shot, and you download a finished MP4 in a few minutes.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Button as={Link} to="/videos?new=1" size="lg">Make a video</Button>
              <Button as={Link} to="/styles" variant="glass" size="lg">Browse styles</Button>
            </div>
          </div>
          <figure className="mx-auto w-full max-w-[380px]" aria-label="Frames from videos made with Animora">
            <div className="ring-stage" aria-hidden="true">
              <div className="ring-spin" style={{ '--n': Math.max(reel.length, 1) }}>
                {reel.map((s, i) => (
                  <div key={s.id} className="ring-card" style={{ '--i': i }}>
                    <img src={s.poster_url} alt="" loading="eager" decoding="async" />
                  </div>
                ))}
              </div>
              <div className="ring-floor" />
            </div>
            <figcaption className="mt-2 text-center text-sm text-white/45">{reel.length ? `${reel.length} of the ${styles.length} looks, all made with Animora` : '\u00a0'}</figcaption>
          </figure>
        </div>
      </section>

      <section className="mx-auto max-w-[1180px] px-6 py-16 sm:px-10 lg:py-20" aria-labelledby="how">
        <h2 id="how" className="text-3xl font-bold tracking-[-0.04em] sm:text-4xl">How it works</h2>
        <ol className="mt-10 grid gap-10 md:grid-cols-3">
          {STEPS.map(([title, text], i) => (
            <li key={title} className="border-t border-ink/12 pt-6">
              <span className="text-sm font-semibold tabular-nums text-ink-mute">{i + 1}</span>
              <h3 className="mt-3 text-xl font-semibold tracking-[-0.02em]">{title}</h3>
              <p className="mt-2 leading-relaxed text-ink-soft">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      {more.length > 0 && (
        <section className="mx-auto max-w-[1180px] px-6 pb-16 sm:px-10" aria-labelledby="looks">
          <div className="flex items-end justify-between gap-4">
            <h2 id="looks" className="text-3xl font-bold tracking-[-0.04em] sm:text-4xl">A few of the looks</h2>
            <Link to="/styles" className="font-semibold text-ink-soft hover:text-ink">All {styles.length} styles</Link>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {more.map((s) => (
              <div key={s.id}>
                <button type="button" className="group relative block aspect-[9/16] w-full overflow-hidden rounded-xl bg-ink" onClick={() => setPlaying(playing === s.id ? null : s.id)} aria-label={playing === s.id ? `Stop the ${s.name} video` : `Play the ${s.name} video`}>
                  {playing === s.id
                    ? <video src={s.preview_url} poster={s.poster_url} className="absolute inset-0 size-full object-cover" muted autoPlay loop playsInline />
                    : <>
                        <img src={s.poster_url} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />
                        <span className="absolute bottom-2 left-2 grid size-9 place-items-center rounded-full bg-black/55 text-white transition-transform group-hover:scale-110" aria-hidden="true">
                          <svg viewBox="0 0 24 24" className="ml-0.5 size-4" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                        </span>
                      </>}
                </button>
                <p className="mt-2 text-sm font-medium">{s.name}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="border-t border-ink/10">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-6 px-6 py-12 sm:px-10">
          <p className="max-w-[40ch] text-lg text-ink-soft">Free with a short ad before each video, or {naira(pricing?.proPriceNgn || 5000)} a month for {pricing?.proVideosPerMonth || 30} ad-free videos.</p>
          <div className="flex gap-3">
            <Button as={Link} to="/pricing" variant="outline">See pricing</Button>
            <Button as={Link} to="/videos?new=1" variant="dark">Make a video</Button>
          </div>
        </div>
      </section>
      <section className="border-t border-ink/10">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-4 px-6 py-8 sm:px-10">
          <p className="text-ink-soft">Developed by <a href={DEVELOPER.website} target="_blank" rel="noopener" className="font-semibold text-ink hover:underline">{DEVELOPER.name}</a> · websites, software and apps.</p>
          <div className="flex flex-wrap gap-3">
            <Button as="a" href={DEVELOPER.whatsapp} target="_blank" rel="noopener" variant="outline">WhatsApp {DEVELOPER.phone}</Button>
            <Button as="a" href={DEVELOPER.website} target="_blank" rel="noopener" variant="ghost">Visit website</Button>
          </div>
        </div>
      </section>
    </div>
  );
}
