// Narration script: copy-ready text for external text-to-speech tools. MP4 exports stay silent.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib.jsx';
import { Alert, Button, Spinner } from './ui.jsx';

function CopyBox({ label, text, filename }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };
  const download = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <section>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{label}</p>
        <div className="flex gap-1">
          <button onClick={copy} className="chip press !px-3 !py-1 !text-xs">{copied ? 'Copied ✓' : 'Copy'}</button>
          <button onClick={download} className="chip press !px-3 !py-1 !text-xs">Download .txt</button>
        </div>
      </div>
      <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-xl bg-[#14102E] p-3 font-mono text-xs leading-relaxed text-[#E8E4FF]">{text}</pre>
    </section>
  );
}

export default function VoicePanel({ project }) {
  const [data, setData] = useState(null);
  const [format, setFormat] = useState('plain');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api(`/projects/${project.id}/voiceover`)
      .then((result) => { if (active) setData(result); })
      .catch((e) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [project.id, project.plan]);

  if (!data) return error
    ? <div className="p-4"><Alert>{error}</Alert></div>
    : <div className="grid h-full place-items-center text-ink-mute"><Spinner /></div>;

  const script = data.formats;
  if (!script) {
    return (
      <div className="h-full overflow-y-auto p-4">
        <h3 className="text-lg font-bold">No narration script in this plan</h3>
        <p className="mt-1 text-ink-soft">Ask for a narration script in the planning chat to get ready-to-paste text for ElevenLabs or another voice generator. Your video export will remain silent.</p>
        <Button as={Link} to={`/p/${project.id}/plan`} variant="dark" size="sm" className="mt-4">Back to the chat</Button>
        {error && <div className="mt-3"><Alert>{error}</Alert></div>}
      </div>
    );
  }

  const choices = [
    ['plain', 'Plain text (ElevenLabs)'],
    ['timed', 'Timed by scene'],
    ['ssml', 'SSML with pauses'],
  ];
  return (
    <div className="h-full space-y-5 overflow-y-auto p-4">
      <div>
        <h3 className="font-bold">Narration script</h3>
        <p className="mt-1 text-sm text-ink-soft">{script.words} words · about {script.estimatedSpeech}s spoken · {project.durationSeconds}s video · voice direction: {script.style}</p>
        <p className="mt-2 rounded-2xl bg-lilac px-3.5 py-2.5 text-sm">The MP4 contains no audio. Copy or download this script and use it with ElevenLabs, CapCut, Google AI Studio, or another audio generator.</p>
      </div>
      <ol className="space-y-1.5">
        {script.scenes.map((scene) => (
          <li key={scene.id} className="flex gap-3 rounded-2xl bg-lilac px-3.5 py-2.5 text-sm">
            <span className="w-20 shrink-0 tabular-nums text-ink-mute">{scene.start}–{scene.end}s</span>
            <span>{scene.text}</span>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        {choices.map(([key, label]) => (
          <button key={key} onClick={() => setFormat(key)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${format === key ? 'bg-ink text-white' : 'bg-lilac hover:bg-lilac-deep'}`}>{label}</button>
        ))}
      </div>
      <CopyBox label={choices.find(([key]) => key === format)?.[1]} text={script[format]} filename={`${project.title || 'narration-script'}-${format}.txt`} />
      {error && <Alert>{error}</Alert>}
    </div>
  );
}
