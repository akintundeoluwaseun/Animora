// Runs the API server (with auto-restart) and the Vite dev server together.
import { spawn } from 'node:child_process';
const run = (name, args) => {
  const p = spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
  const tag = (d) => d.toString().split('\n').filter(Boolean).map((l) => `[${name}] ${l}`).join('\n') + '\n';
  p.stdout.on('data', (d) => process.stdout.write(tag(d)));
  p.stderr.on('data', (d) => process.stderr.write(tag(d)));
  p.on('exit', (code) => { console.log(`[${name}] exited (${code})`); process.exit(code ?? 0); });
  return p;
};
const procs = [
  run('api', ['--watch-path=server', 'server/index.js']),
  run('web', ['node_modules/vite/bin/vite.js', '--config', 'web/vite.config.js']),
];
process.on('SIGINT', () => { procs.forEach((p) => p.kill()); process.exit(0); });
console.log('\n  Open http://localhost:5173 (website with hot reload). API on http://localhost:3000\n');
