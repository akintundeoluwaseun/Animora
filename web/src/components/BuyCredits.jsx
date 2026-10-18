// Buy a pack of videos with Paystack (card, bank transfer, USSD). No sign-in: the videos go to this device's
// account (and every device linked to it). Paystack sends the buyer back to /videos?paid=<reference>.
import { useState } from 'react';
import { api, useAuth, naira } from '../lib.jsx';
import { Button, Modal } from './ui.jsx';

export function creditsLeft(user) {
  const c = user?.credits;
  if (!c?.enabled || c.unlimited) return null;
  return c.left ?? 0;
}

export default function BuyCredits({ open, onClose, reason }) {
  const { user } = useAuth();
  const c = user?.credits || {};
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pay = async () => {
    setBusy(true); setError('');
    try {
      const { url } = await api('/credits/checkout', { method: 'POST', body: { email } });
      window.location.href = url;
    } catch (e) { setError(e.message); setBusy(false); }
  };
  return (
    <Modal open={open} onClose={() => !busy && onClose()} label="Buy videos">
      <div className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-[14px] bg-danfo text-white" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
        </span>
        <div>
          <h2 className="text-xl font-bold">{reason || 'Get more videos'}</h2>
          <p className="mt-1 text-sm text-ink-soft">No account needed. Pay once and make {c.packSize || 5} more videos or flyers on this device and the devices you've linked.</p>
        </div>
      </div>
      <div className="mt-5 flex items-end justify-between rounded-[16px] border-2 border-danfo bg-danfo/5 p-4">
        <div>
          <p className="font-bold text-ink">{c.packSize || 5} videos</p>
          <p className="text-sm text-ink-soft">Videos or flyers, with your logo, edits included</p>
        </div>
        <p className="text-2xl font-extrabold tracking-[-0.03em] text-ink">{naira(c.packPriceNgn || 4000)}</p>
      </div>
      <label className="mt-4 block text-sm font-semibold text-ink" htmlFor="buy-email">Email for your receipt <span className="font-normal text-ink-mute">(optional)</span></label>
      <input id="buy-email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
        className="mt-1.5 w-full rounded-[10px] border border-ink/15 bg-white px-3 py-2.5 text-ink outline-none focus:border-ink/40" />
      {error && <p className="mt-3 text-sm text-alert" role="alert">{error}</p>}
      <div className="mt-5 flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={onClose} disabled={busy}>Not now</Button>
        <Button className="flex-1" onClick={pay} loading={busy}>Pay {naira(c.packPriceNgn || 4000)}</Button>
      </div>
      <p className="mt-3 text-center text-xs text-ink-mute">Secure payment by Paystack: card, bank transfer or USSD.</p>
    </Modal>
  );
}
