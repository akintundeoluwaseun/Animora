import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib.jsx';
import { Alert, Button, Field, inputCls, Logo } from '../components/ui.jsx';

function Shell({ title, sub, children, foot }) {
  return (
    <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-md content-center px-4 py-12">
      <h1 className="text-3xl font-extrabold">{title}</h1>
      <p className="mt-2 text-ink-soft">{sub}</p>
      <div className="mt-8">{children}</div>
      <p className="mt-6 text-center text-sm text-ink-soft">{foot}</p>
    </div>
  );
}

export function Login() {
  const { login, user } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const next = params.get('next') || '/videos';
  if (user) return <Navigate to={next} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try { await login(email, password); navigate(next, { replace: true }); } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  const demo = (who) => { setEmail(`${who}@adflash.ng`); setPassword('demo1234'); };

  return (
    <Shell title="Welcome back" sub="Log in to keep making video ads." foot={<>New here? <Link className="font-semibold text-ink underline" to="/signup">Create a free account</Link></>}>
      <form onSubmit={submit} className="space-y-4">
        <Alert>{error}</Alert>
        <Field label="Email"><input className={inputCls} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Password"><input className={inputCls} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        <Button type="submit" size="lg" className="w-full" loading={busy}>Log in</Button>
      </form>
      <div className="mt-6 rounded-2xl bg-lilac p-4 text-sm">
        <p className="font-semibold">Demo accounts</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {[['demo', 'Business (Free)'], ['pro', 'Business (Pro)'], ['creator', 'Creator']].map(([w, l]) => (
            <button key={w} type="button" onClick={() => demo(w)} className="rounded-full bg-white px-3 py-1.5 font-semibold hover:bg-lilac-deep">{l}</button>
          ))}
        </div>
      </div>
    </Shell>
  );
}

export function Signup() {
  const { signup, user } = useAuth();
  const [params] = useSearchParams();
  const [role, setRole] = useState(params.get('role') === 'creator' ? 'creator' : 'user');
  const [f, setF] = useState({ name: '', businessName: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to={user.role === 'creator' ? '/creator' : '/videos?new=1'} replace />;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await signup({ ...f, role }); // the redirect above takes over once the user is set
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <Shell title="Make your first video ad" sub="Free forever with a short ad before each video. No card needed."
      foot={<>Already have an account? <Link className="font-semibold text-ink underline" to="/login">Log in</Link></>}>
      <div className="mb-6 grid grid-cols-2 gap-2 rounded-2xl bg-lilac p-1.5" role="radiogroup" aria-label="Account type">
        {[['user', 'I run a business'], ['creator', "I'm a designer"]].map(([v, l]) => (
          <button key={v} type="button" role="radio" aria-checked={role === v} onClick={() => setRole(v)}
            className={`rounded-xl py-2.5 text-sm font-semibold ${role === v ? 'bg-white shadow-sm' : 'text-ink-soft'}`}>{l}</button>
        ))}
      </div>
      {role === 'creator' && <p className="-mt-2 mb-5 text-sm text-ink-soft">Upload animation styles. Every video made with your style pays you 30% of what it earns.</p>}
      <form onSubmit={submit} className="space-y-4">
        <Alert>{error}</Alert>
        <Field label="Your name"><input className={inputCls} autoComplete="name" required value={f.name} onChange={set('name')} /></Field>
        {role === 'user' && <Field label="Business name" hint="Optional"><input className={inputCls} value={f.businessName} onChange={set('businessName')} placeholder="e.g. Iya Basira's Kitchen" /></Field>}
        <Field label="Email"><input className={inputCls} type="email" autoComplete="email" required value={f.email} onChange={set('email')} /></Field>
        <Field label="Password" hint="At least 6 characters"><input className={inputCls} type="password" autoComplete="new-password" required minLength={6} value={f.password} onChange={set('password')} /></Field>
        <Button type="submit" size="lg" className="w-full" loading={busy}>Create account</Button>
      </form>
    </Shell>
  );
}

export { Logo };
