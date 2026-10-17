// Vercel build: build the website, then copy the static files the serverless API can't serve itself.
import { cpSync, mkdirSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
execSync('npm run build', { stdio: 'inherit' });
const out = 'web/dist';
const copy = (from, to) => { if (existsSync(from)) { mkdirSync(path.dirname(to), { recursive: true }); cpSync(from, to, { recursive: true }); console.log(`copied ${from} -> ${to}`); } };
copy('assets/styles', `${out}/demo/styles`);
copy('assets/ads', `${out}/demo/ads`);
copy('assets/sfx', `${out}/sfx`);
copy('assets/music', `${out}/music`);
copy(path.dirname(require.resolve('gsap/dist/gsap.min.js')), `${out}/vendor/gsap`);
