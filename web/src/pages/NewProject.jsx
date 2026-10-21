// /new/video and /new/flyer: the one way into a new project. Creates it, then opens its first question.
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib.jsx';
import { Alert, Spinner } from '../components/ui.jsx';
import { announceKind } from '../components/Shell.jsx';

export default function NewProject() {
  const { kind: raw } = useParams();
  const kind = raw === 'flyer' ? 'flyer' : 'video';
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    announceKind(kind);
    api('/projects', { method: 'POST', body: { title: kind === 'flyer' ? 'New flyer' : 'New video', kind } })
      .then(({ project }) => navigate(`/p/${project.id}/plan`, { replace: true }))
      .catch((e) => { started.current = false; setError(e.message); });
  }, [kind]); // eslint-disable-line react-hooks/exhaustive-deps
  const flyer = kind === 'flyer';
  return (
    <div className="mx-auto grid min-h-[60vh] max-w-md place-items-center px-6 text-center">
      {error ? (
        <div className="w-full">
          <Alert>{error}</Alert>
          <Link to={flyer ? '/flyers' : '/videos'} className="mt-4 inline-block font-semibold underline">Back to my {flyer ? 'flyers' : 'videos'}</Link>
        </div>
      ) : (
        <div>
          <span className={`mx-auto grid size-14 place-items-center rounded-2xl text-white ${flyer ? 'bg-flyer' : 'bg-video'}`}><Spinner className="size-7" /></span>
          <p className="mt-4 text-lg font-semibold">Starting your {flyer ? 'flyer' : 'video ad'}…</p>
        </div>
      )}
    </div>
  );
}
