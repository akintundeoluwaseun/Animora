// Pro subscription checkout: pay N5,000 from an Access wallet (Access Bank WaaS debitWallet).
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, naira, useAuth } from '../lib.jsx';
import { Alert, Button, Field, inputCls, Spinner } from '../components/ui.jsx';

export default function Checkout() {
  const { user, setUser } = useAuth();
  const [pricing, setPricing] = useState(null);
  const [provider, setProvider] = useState('sandbox');
  const [wallet, setWallet] = useState('');
  const [state, setState] = useState('form'); // form | paying | pending | success
  const [error, setError] = useState('');
  const [reference, setReference] = useState('');

  useEffect(() => { api('/pricing').then((r) => { setPricing(r.pricing); setProvider(r.paymentProvider); }); }, []);

  // Bank says PENDING: keep checking until it settles.
  useEffect(() => {
    if (state !== 'pending') return undefined;
    const t = setInterval(async () => {
      const r = await api(`/billing/payments/${reference}`).catch(() => null);
      if (r?.payment.status === 'success') { setUser(r.user); setState('success'); }
      if (r?.payment.status === 'failed') { setError('The bank could not complete the payment.'); setState('form'); }
    }, 3000);
    return () => clearInterval(t);
  }, [state, reference, setUser]);

  const pay = async (e) => {
    e.preventDefault();
    setState('paying'); setError('');
    try {
      const r = await api('/billing/subscribe', { method: 'POST', body: { walletAccountNo: wallet } });
      setReference(r.reference);
      if (r.status === 'SUCCESS') { setUser(r.user); setState('success'); }
      else if (r.status === 'PENDING') setState('pending');
      else { setError(r.message || 'Payment failed. Check the number and your balance.'); setState('form'); }
    } catch (err) { setError(err.message); setState('form'); }
  };

  if (!pricing || !user) return null;

  if (state === 'success') {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-full bg-money text-3xl text-white" aria-hidden="true">✓</div>
        <h1 className="mt-6 text-3xl font-extrabold">You're on Pro</h1>
        <p className="mt-2 text-ink-soft">{pricing.proVideosPerMonth} ad-free videos up to {pricing.proMaxSeconds / 60} minutes, until {new Date(user.planRenewsAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })}.</p>
        <p className="mt-1 text-sm text-ink-mute">Reference {reference}</p>
        <Button as={Link} to="/new/video" size="lg" className="mt-8">Make a video</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-4xl gap-8 px-4 py-12 md:grid-cols-[1fr_1.1fr]">
      <section className="stage p-7">
        <p className="text-white/60">Animora Pro · monthly</p>
        <p className="mt-2 font-display text-5xl font-extrabold">{naira(pricing.proPriceNgn)}</p>
        <ul className="mt-6 space-y-2 text-white/85">
          <li>• {pricing.proVideosPerMonth} ad-free videos a month</li>
          <li>• Videos up to {pricing.proMaxSeconds / 60} minutes</li>
          <li>• Keep creating with ads after {pricing.proVideosPerMonth}</li>
        </ul>
        {user.plan === 'pro' && <p className="mt-6 rounded-2xl bg-white/10 p-3 text-sm">You're already on Pro. Paying now adds 30 days to your plan.</p>}
      </section>

      <section>
        <h1 className="text-3xl font-extrabold">Pay with your Access wallet</h1>
        <p className="mt-2 text-ink-soft">We'll debit {naira(pricing.proPriceNgn)} from your Access Bank wallet. Your plan starts as soon as the bank confirms.</p>
        <form onSubmit={pay} className="mt-6 space-y-4">
          <Alert>{error}</Alert>
          <Field label="Wallet / account number" hint="10 digits">
            <input className={`${inputCls} tracking-widest`} inputMode="numeric" maxLength={10} required value={wallet}
              onChange={(e) => setWallet(e.target.value.replace(/\D/g, ''))} placeholder="0123456789" autoComplete="off" />
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={state === 'paying'} disabled={wallet.length !== 10}>Pay {naira(pricing.proPriceNgn)}</Button>
          {state === 'pending' && <p className="flex items-center gap-2 text-sm text-ink-soft"><Spinner className="size-4" />Waiting for the bank to confirm…</p>}
        </form>
        {provider === 'sandbox' && (
          <div className="mt-6"><Alert kind="info"><strong>Test payment.</strong> No real money moves. Any 10-digit number works; numbers ending in 0 show a failed payment.</Alert></div>
        )}
      </section>
    </div>
  );
}
