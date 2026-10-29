// Styles: every look, playing. Picking one starts a new video in it.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib.jsx';
import { Alert, PageLoader } from '../components/ui.jsx';
import { StylePicker } from './Dashboard.jsx';

export default function Styles() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const start = async (st) => {
    setBusy(true);
    try { const { project } = await api('/projects', { method: 'POST', body: { styleId: st.id, title: 'New video' } }); navigate(`/p/${project.id}/plan`); }
    catch (e) { setError(e.message); setBusy(false); }
  };
  return (
    <div className="mx-auto max-w-[1180px] px-6 py-10 sm:px-10">
      <h1 className="text-4xl font-bold tracking-[-0.045em]">Styles</h1>
      <p className="mt-2 max-w-[60ch] text-ink-soft">Pick a style to start a video in that look. Every shot is still planned new for your business.</p>
      <div className="mt-8"><Alert>{error}</Alert>{busy ? <PageLoader /> : <StylePicker onPick={start} />}</div>
    </div>
  );
}
