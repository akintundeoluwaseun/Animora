// Premium films: designer-made ad templates (HyperFrames blocks, Apache-2.0) with every word, picture and logo
// filled from the owner's own details. No AI call is needed: each template has named slots and this file fills them.
//
//   premiumFilm({ plan, brief, assets, seed, previous }) -> { html, block }   (throws when no template fits)
//   isPremium(html), readPremium(html)
//
// The page keeps the block's own paused GSAP timeline (window.__timelines[id]) and hands it to the renderer as window.__timeline.
import { config } from '../../config.js';
import { factsOf } from '../pieces/index.js';
import { speakable } from '../voice.js';
import { VOICE_LIBRARY, isVoiceId, defaultVoice } from './voices.js';
export { VOICE_LIBRARY };
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// the sound engine that runs in the film's page, and the measured sound registry it chooses from
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SOUND_JS = readFileSync(path.join(HERE, 'browser', 'sound.js'), 'utf8');
const REG = (() => {
  try {
    const r = JSON.parse(readFileSync(path.join(HERE, '..', '..', '..', 'assets', 'sfx', 'registry.json'), 'utf8'));
    return r.sounds.filter((x) => x.ok).map((x) => ({ key: x.key, role: x.role, useful: x.useful, intensity: x.intensity, transient: x.transient, tone: x.tone, attack: x.attack }));
  } catch { return []; }
})();
export const SOUND_REGISTRY = REG;
import notificationCascade, { meta as mNotif } from './blocks/notification-cascade.js';
import messageThread, { meta as mThread } from './blocks/message-thread-reveal.js';
import notesReveal, { meta as mNotes } from './blocks/notes-reveal.js';
import aiChat, { meta as mChat } from './blocks/ai-chat-reveal.js';
import shareSheet, { meta as mShare } from './blocks/share-sheet-carousel.js';
import ctc1, { meta as mC1 } from './blocks/carousel-text-circle-1.js';
import ctc2, { meta as mC2 } from './blocks/carousel-text-circle-2.js';
import ctc3, { meta as mC3 } from './blocks/carousel-text-circle-3.js';
import ctc4, { meta as mC4 } from './blocks/carousel-text-circle-4.js';
import ctc5, { meta as mC5 } from './blocks/carousel-text-circle-5.js';
import specsList, { meta as mSpecs } from './blocks/mk-specs-list.js';
import logoOutro, { meta as mOutro } from './blocks/logo-outro.js';
import weightWave, { meta as mWave } from './blocks/weight-wave.js';

export const PREMIUM_ASPECTS = ['9:16', '16:9'];
const MARK = 'ANIMORA_PREMIUM';
// background music chosen in the editor: the preview and the renderer both read window.ADFLASH_DATA.music
const MUSIC_HOOK = `(function(){var a=(window.${MARK}.audio||{});if(a.music)window.ADFLASH_DATA={music:{url:a.music,offset:+a.musicOffset||0,gain:+a.musicGain||0}};})();`;

const clean = (s, n = 80) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const lower1 = (s) => { s = clean(s); return s ? s[0].toLowerCase() + s.slice(1) : s; };
const mulberry = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const hash = (s) => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };

/** The owner's name as a clean wordmark, for templates that show a logo when no logo was uploaded. */
function wordmark(name, color) {
  const t = clean(name, 28).replace(/[<&>"]/g, '');
  const w = Math.max(120, Math.round(t.length * 34));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="72" viewBox="0 0 ${w} 72"><text x="${w / 2}" y="52" text-anchor="middle" font-family="Helvetica Neue,Arial,sans-serif" font-weight="800" font-size="52" letter-spacing="-1" fill="${color}">${t}</text></svg>`;
  return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
}

/** What the business sells, in a few plain words ("food", "laptop repairs"), for lines like "where do you get your ___?" */
function thing(f) {
  const c = clean(f.category, 40).toLowerCase();
  if (/food|restaurant|kitchen|meal|chop|cater|bukka|eatery|jollof|suya/.test(c)) return 'food';
  if (/cake|bake|pastr|bread/.test(c)) return 'cakes';
  if (/hair|salon|wig|barb/.test(c)) return 'hair';
  if (/fashion|cloth|wear|boutique|tailor|ankara/.test(c)) return 'clothes';
  if (/beauty|skin|makeup|cosmetic|spa|nail/.test(c)) return 'skincare';
  if (/phone|laptop|gadget|repair|computer|tech/.test(c)) return /repair/.test(c) ? 'repairs' : 'gadgets';
  if (/real estate|property|apartment|house|home/.test(c)) return 'apartments';
  if (/event|party|concert|wedding/.test(c)) return 'events';
  if (/school|class|course|lesson|tutor|train/.test(c)) return 'classes';
  if (/gym|fitness|workout/.test(c)) return 'workouts';
  if (/car|auto|vehicle/.test(c)) return 'cars';
  return c && c.split(/\s+/).length <= 3 ? c : 'this';
}
const cityOf = (f) => (String(f.place || '').match(/\b(lagos|abuja|ibadan|ado[- ]?ekiti|akure|port harcourt|kano|enugu|benin|ilorin|osogbo|abeokuta|ikeja|lekki|yaba|ikoyi|surulere|ajah)\b/i) || [])[0] || '';
const contactLine = (f) => f.link || f.phone || f.place || f.cta;
const halves = (t) => { const w = clean(t, 60).split(' '); if (w.length < 2) return [w[0] || '', '']; const k = Math.ceil(w.length / 2); return [w.slice(0, k).join(' '), w.slice(k).join(' ')]; };
const labelValue = (t) => { const w = clean(t, 30).split(' '); return [w[0] || '', w.slice(1).join(' ') || '']; };

/** Every line the business gave us that can be shown as a short point (features, products with prices, the offer). */
function points(f) {
  const out = [...f.features, ...f.products.map((p) => (p.price ? `${p.title} · ${p.price}` : p.title)), f.offer, f.when ? `On ${f.when}` : '', f.place ? `Find us: ${f.place}` : ''].map((x) => clean(x, 60)).filter(Boolean);
  return [...new Set(out)];
}

// Small changes to templates whose words were written into their code, so they read slots like the others.
const PATCH = {
  // its rows come from a slot, and it gets the soft pastel stage it was designed to sit on (it is an overlay on its own)
  'mk-specs-list': (h) => h.replace(/rows: \[[\s\S]*?\],\n/, 'rows: (window.__hyperframes && window.__hyperframes.getVariables().rows) || [],\n')
    .replace(/lineWidth: \d+/, 'lineWidth: 980').replace(/rowGap: \d+/, 'rowGap: 60')
    .replace('font-size: 46px;', 'font-size: 66px;').replace('font-size: 40px;', 'font-size: 54px;')
    .replace('background: transparent; /* overlays footage or mk-background */', 'background: radial-gradient(60% 70% at 22% 28%, #fbd9ec 0%, rgba(251,217,236,0) 70%), radial-gradient(55% 65% at 80% 72%, #cff3e8 0%, rgba(207,243,232,0) 70%), #f6f6f7;'),
  'logo-outro': (h) => h
    .replace(/<svg viewBox="0 0 160 240"[\s\S]*?<\/svg>/, '<img class="logo-piece logo-tl" data-var-src="logo" alt="" style="display:block;max-width:640px;max-height:300px;width:auto;height:auto;object-fit:contain" />')
    .replace(/<div class="tagline">[^<]*<\/div>/, '<div class="tagline" data-var-text="tagline"></div>')
    .replace(/<span class="url-text">[^<]*<\/span>/, '<span class="url-text" data-var-text="url"></span>')
    .replace(/const pieceArray = \[[^\]]*\];/, 'const pieceArray = [pieces.tl];')
    .replace(/(\.url-text \{\s*font-size: )18px;(\s*color: )#666;/, (m, a, b) => `${a}30px;${b}#d6d6de;`).replace('padding: 8px 24px;', 'padding: 12px 34px;'),
};

// ---- one filler per template: business details -> that template's slots ----
const FRIENDS = ['Tolu', 'Amaka', 'Chidi', 'Zainab', 'Bisi', 'Ifeoma', 'Kemi', 'Tunde'];
const BLOCKS = {
  'notification-cascade': {
    meta: mNotif, sfx: { appear: 'ding' }, html: notificationCascade, fits: () => true,
    fill(f, r) {
      const p = points(f), head = f.heads[0] || f.sub || f.cta;
      const [top, acc] = halves(head);
      return {
        appName: clean(f.name, 24), notifTitle: clean(f.name, 30),
        message1: p[0] || clean(head, 48), message2: p[1] || clean(f.sub || f.category, 48), message3: p[2] || `${f.cta}${f.phone ? ` · ${f.phone}` : ''}`, message4: p[3] || clean(f.cta, 48),
        headlineTop: top.toUpperCase(), headlineAccent: (acc || f.name).toUpperCase(),
        footerText: clean(contactLine(f), 40), brandLogo: f.logo || wordmark(f.name, '#ffffff'),
      };
    },
  },
  'message-thread-reveal': {
    meta: mThread, sfx: {}, html: messageThread, fits: (f) => f.photos.length >= 1,
    fill(f, r) {
      const t = thing(f), p = points(f), friend = FRIENDS[Math.floor(r() * FRIENDS.length)];
      const ec = (f.features.length ? f.features : p).slice(0, 3).map((x) => { const [a, b] = labelValue(x); return b ? `${a}|${b}` : `${a}|`; });
      while (ec.length < 3) ec.push(['Fast|service', 'Fair|prices', 'Real|quality'][ec.length]);
      return {
        contactName: friend,
        questionMessage: t === 'this' ? `where did u get this from??` : `where do u get your ${t} from??`,
        teaserMessage: 'wait look 👀', cardImage: f.photos[0], cardTitle: clean(`${f.name} | ${f.heads[0] || f.sub || f.category}`, 70),
        cardDomain: clean(f.link || f.place || f.category || f.name, 40),
        reactionMessage: t === 'food' || t === 'cakes' ? 'OMG this looks so good' : 'OMG this is so nice', reactionEmoji: '😍😍😍',
        benefitMessage: lower1(p[0] || f.sub || 'quality is top notch'), discoveryMessage: 'where did u find them',
        sourceMessage: f.link ? `on ${f.link}` : f.place ? `they're in ${cityOf(f) || 'town'}` : 'on instagram',
        workflowMessage: lower1(p[1] || `${f.name} does it right`), ownershipMessage: lower1(f.offer || p[2] || 'and the prices are fair'),
        installMessage: f.whatsapp || f.phone ? 'messaging them rn' : 'ordering rn', thanksMessage: 'ty bestie 💚',
        brandLogo: f.logo || wordmark(f.name, '#111111'), ecProof: clean(f.offer || (cityOf(f) ? `Loved in ${cityOf(f)}` : f.category) || f.name, 30),
        ecFeature1: ec[0], ecFeature2: ec[1], ecFeature3: ec[2], ecCta: clean(f.cta, 26),
      };
    },
  },
  'notes-reveal': {
    meta: mNotes, sfx: { appear: 'tick' }, html: notesReveal, fits: (f) => f.features.length + f.products.length >= 2,
    fill(f) {
      const t = thing(f), p = points(f), head = f.heads[0] || f.sub || f.name;
      const words = clean(head, 40).toUpperCase().split(' ');
      const checks = p.slice(0, 3).map(labelValue);
      while (checks.length < 3) checks.push([['CALL', 'NOW'], ['VISIT', 'TODAY'], ['SAVE', 'MORE']][checks.length]);
      return {
        titleL1: 'Things nobody told me', titleL2: t === 'this' ? `about ${clean(f.category || 'this', 24).toLowerCase()}.` : `about ${t}.`,
        noteLine1: t === 'this' ? 'i kept settling for less' : `i kept settling for bad ${t}`, noteLine2: 'paying too much', noteLine3: 'and getting too little.',
        noteLine4: `then i found ${clean(f.name, 30)}`, noteLine5: lower1(p[0] || f.sub || head), noteLine6: `${lower1(p[1] || 'the difference is real')} —`, noteLine7: clean(head, 40),
        cardTop: words.length > 2 ? words.slice(0, Math.ceil(words.length / 2)).join(' ') : 'THE POWER', cardMid: words.length > 2 ? '' : 'OF',
        cardBottom: words.length > 2 ? words.slice(Math.ceil(words.length / 2)).join(' ') : clean(f.name, 20).toUpperCase(),
        check1Label: checks[0][0].toUpperCase(), check1Value: checks[0][1].toUpperCase(), check2Label: checks[1][0].toUpperCase(), check2Value: checks[1][1].toUpperCase(),
        check3Label: checks[2][0].toUpperCase(), check3Value: checks[2][1].toUpperCase(),
        brandLogo: f.logo || wordmark(f.name, '#111111'), brandDomain: clean(contactLine(f), 40),
      };
    },
  },
  'ai-chat-reveal': {
    meta: mChat, sfx: {}, html: aiChat, fits: (f) => f.features.length + f.products.length >= 1,
    fill(f) {
      const t = thing(f), p = points(f), city = cityOf(f), head = f.heads[0] || f.sub || f.name;
      const bullets = p.slice(0, 3); while (bullets.length < 3) bullets.push([f.cta, f.place && `In ${f.place}`, f.phone && `Call ${f.phone}`].filter(Boolean)[bullets.length] || clean(f.category || f.name, 40));
      return {
        botName: 'Assistant', userMessage: t === 'this' ? `Who does the best ${clean(f.category || 'service', 30).toLowerCase()}${city ? ` in ${city}` : ''}?` : `Where can I get great ${t}${city ? ` in ${city}` : ''}?`,
        answer1: clean(`Try ${f.name}. ${f.sub || head}`, 120), answer2: clean(f.offer ? `Right now: ${f.offer}.` : `People keep coming back.`, 60), answer3: 'What you get:',
        bullet1: bullets[0], bullet2: bullets[1], bullet3: bullets[2],
        ecHeadline: halves(head).filter(Boolean).join('|'), ecSub: clean(f.sub || f.category || head, 80), ecCta: clean(f.cta, 24),
        ecFooter: clean(contactLine(f), 40).toUpperCase(), brandLogo: f.logo || wordmark(f.name, '#ffffff'),
      };
    },
  },
  'share-sheet-carousel': {
    meta: mShare, sfx: {}, html: shareSheet, fits: (f) => f.photos.length >= 2,
    fill(f) {
      const ph = f.photos; const pick = (i) => ph[i % ph.length];
      return {
        shareTitle: 'Share', senderName: clean(f.name, 24), itemLabel: thing(f) === 'this' ? 'something new' : `new ${thing(f)}`,
        stripText: clean([f.heads[0] || f.sub, f.cta].filter(Boolean).join(' · '), 60).toUpperCase(), acceptLabel: 'Accept', declineLabel: 'Decline',
        slideImage1: pick(0), slideImage2: pick(1), slideImage3: pick(2), slideImage4: pick(3), brandLogo: f.logo || wordmark(f.name, '#111111'),
      };
    },
  },
};
// Landscape scenes: joined into one film (see filmHtml). They are never used alone for tall videos.
const CAROUSELS = { 'carousel-text-circle-1': [ctc1, mC1], 'carousel-text-circle-2': [ctc2, mC2], 'carousel-text-circle-3': [ctc3, mC3], 'carousel-text-circle-4': [ctc4, mC4], 'carousel-text-circle-5': [ctc5, mC5] };
for (const [id, [html, meta]] of Object.entries(CAROUSELS)) BLOCKS[id] = { meta, html, wide: true, sfx: {} };
BLOCKS['mk-specs-list'] = { meta: mSpecs, html: specsList, wide: true, sfx: { appear: 'tick' } };
BLOCKS['logo-outro'] = { meta: mOutro, html: logoOutro, wide: true, sfx: {} };
BLOCKS['weight-wave'] = { meta: mWave, html: weightWave, wide: true, sfx: {} };

export const PREMIUM_BLOCKS = Object.keys(BLOCKS).filter((k) => !BLOCKS[k].wide);

// Dead air: wherever nothing on screen starts or moves for more than MAX seconds, the film fast-forwards through it,
// so the viewer never waits on a still frame. The closing card keeps a short hold so it can be read.
const REMAP_FN = `function remap(tl,cap,endHold){var D=Math.min(tl.duration(),cap||1e9),iv=[];tl.getChildren(true,true,false).forEach(function(c){var d=c.duration?c.duration():0;if(c.getChildren&&d>0)return;var tg=c.targets?c.targets():[],vv=c.vars||{};if((!tg.length||!tg[0]||!tg[0].nodeType)&&!vv.onUpdate&&!vv.onStart&&!vv.onComplete)return;if(!(d>0))d=0.06;var st=c.startTime(),p=c.parent;while(p&&p!==tl){st+=p.startTime();p=p.parent;}if(st<D)iv.push([st,Math.min(D,st+d),d>D*0.45]);});
// slow background drifts don't count as action, unless they are the whole scene (a kinetic headline is one long move)
var shortOnes=iv.filter(function(r){return !r[2];}),cov=0;shortOnes.forEach(function(r){cov+=r[1]-r[0];});if(cov>D*0.3)iv=shortOnes;iv.sort(function(a,b){return a[0]-b[0];});
var U=[];iv.forEach(function(r){var l=U[U.length-1];if(l&&r[0]<=l[1]+0.05){if(r[1]>l[1])l[1]=r[1];}else U.push([r[0],r[1]]);});
var MAX=1.2,END=endHold==null?2.2:endHold,K=[[0,0]],o=0,pos=0;
U.forEach(function(r){var idle=r[0]-pos;o+=Math.min(idle,pos===0?0.5:MAX);K.push([o,r[0]]);o+=r[1]-r[0];K.push([o,r[1]]);pos=r[1];});
o+=Math.min(D-pos,END);K.push([o,D]);
return {D:K[K.length-1][0],f:function(t){if(t<=0)return 0;for(var j=1;j<K.length;j++){if(t<=K[j][0]){var a=K[j-1],b=K[j];return a[1]+(b[1]-a[1])*((t-a[0])/((b[0]-a[0])||1));}}return K[K.length-1][1];},g:function(x){for(var j=1;j<K.length;j++){if(x<=K[j][1]){var a=K[j-1],b=K[j];return a[0]+(b[0]-a[0])*((x-a[1])/((b[1]-a[1])||1));}}return K[K.length-1][0];}};}
function wrap(tl,m){return {_t:0,seek:function(t){this._t=+t||0;var x=m.f(this._t);tl.seek(x,false);if(window.__clipSync)window.__clipSync(x);return this;},time:function(){return this._t;},duration:function(){return m.D;},pause:function(){return this;},paused:function(){return true;},play:function(){return this;},repeat:function(){return 0;},progress:function(){return this._t/m.D;}};}`;
// Spoken captions: when the film has a voice, every spoken line is also on screen as big motion text, word by word,
// in the same moment the voice says it. The page plans the timing itself (so the preview shows it); the render server
// replaces the estimate with the voice's exact timing (window.__captions) before recording.
const CAPS_FN = `function estLen(text){var parts=String(text||'').split(/(?<=[.!?])\\s+/),L=0;parts.forEach(function(p,k){L+=Math.max(0.5,p.split(/\\s+/).filter(Boolean).length/2.55)+(k<parts.length-1?0.34:0);});return L;}
// slow a scene down (never more than 1.6x) so a spoken line fits it; motion keeps moving instead of freezing
function scaleM(m,k){var f=m.f,g=m.g;return {D:m.D*k,f:function(t){return f(t/k);},g:function(x){return g(x)*k;}};}
function stretch(m,need){if(!(need>m.D))return m;var k=Math.min(1.6,need/m.D),f=m.f,g=m.g;return {D:m.D*k,f:function(t){return f(t/k);},g:function(x){return g(x)*k;}};}
function capsPlan(lines,sfx,D,AT){var hits=(sfx||[]).map(function(e){return e.t;}).sort(function(a,b){return a-b;}),imp=null;(sfx||[]).forEach(function(e){if(imp==null&&/impact/.test(e.k))imp=e.t;});
 var n=lines.length,last=Math.max(1.5,Math.min(D-3.2,imp!=null?imp:D-3.2)),out=[],end=0;
 lines.forEach(function(text,i){var want=AT&&AT[i]!=null?AT[i]:i===0?0.4:i===n-1?last:0.4+i*(last-0.4)/(n-1);if(!AT&&i>0&&i<n-1){var near=hits.filter(function(t){return t>=want-0.2&&t<=want+0.8;})[0];if(near!=null)want=near;}
  var parts=text.split(/(?<=[.!?])\\s+/),len=0,seg=[];parts.forEach(function(p,k){var w=p.split(/\\s+/).filter(Boolean),d=Math.max(0.5,w.length/2.55);seg.push({p:p,a:len,d:d});len+=d+(k<parts.length-1?0.34:0);});
  if(i===n-1&&!AT)want=Math.min(want,D-0.35-len);var st=Math.max(want,end+0.3);end=st+len;
  var words=[];seg.forEach(function(sg){var ws=sg.p.split(/\\s+/).filter(Boolean),tot=0;ws.forEach(function(w){tot+=w.length+2;});var acc=0;ws.forEach(function(w){words.push({w:w,t:+(st+sg.a+sg.d*acc/tot).toFixed(3)});acc+=w.length+2;});});
  out.push({t0:+st.toFixed(3),t1:+end.toFixed(3),words:words});});return out;}
function capsLayer(host,plan,wide){var box=document.createElement('div'),cur=-1,spans=[];box.setAttribute('style','position:absolute;left:6%;right:6%;'+(wide?'bottom:7%;':'bottom:13%;')+'z-index:9999;display:flex;justify-content:center;pointer-events:none');
 var inner=document.createElement('div');inner.setAttribute('style','max-width:100%;text-align:center;font:800 '+(wide?'60px':'66px')+'/1.18 Inter,"Helvetica Neue",Arial,sans-serif;letter-spacing:-0.01em;color:#fff;padding:18px 30px 22px;border-radius:28px;background:rgba(8,8,12,.62);box-shadow:0 18px 50px rgba(0,0,0,.28);opacity:0;text-wrap:balance');box.appendChild(inner);host.appendChild(box);
 return function(t){var k=-1;for(var i=0;i<plan.length;i++){if(t>=plan[i].t0-0.08&&t<plan[i].t1+0.45){k=i;break;}}
  if(k!==cur){cur=k;inner.innerHTML='';spans=[];if(k>=0)plan[k].words.forEach(function(x){var s=document.createElement('span');s.textContent=x.w+' ';s.style.display='inline-block';s.style.whiteSpace='pre';inner.appendChild(s);spans.push(s);});}
  if(k<0){inner.style.opacity='0';return;}var L=plan[k],fin=Math.min(1,Math.max(0,(L.t1+0.45-t)/0.25)),fi=Math.min(1,Math.max(0,(t-L.t0+0.08)/0.16));inner.style.opacity=String(Math.min(fin,fi));inner.style.transform='translateY('+((1-fi)*18).toFixed(1)+'px)';
  L.words.forEach(function(x,j){var s=spans[j],p=Math.min(1,Math.max(0,(t-x.t+0.04)/0.14)),now=t>=x.t-0.04&&(j===L.words.length-1||t<L.words[j+1].t-0.04);s.style.opacity=String(0.18+0.82*p);s.style.transform='translateY('+((1-p)*14).toFixed(1)+'px) scale('+(0.86+0.14*p).toFixed(3)+')';s.style.color=now?'#FFD84D':'#fff';});};}`;
// Sound design comes from the film's own timeline: browser/sound.js reads every visual event and picks a fitting,
// measured sound for it (see assets/sfx/registry.json). cues() keeps the old call shape for the page code below.
const SFX_FN = SOUND_JS + `
var REG=${JSON.stringify(REG)};
function audioOpts(){var a=(window.${MARK}||{}).audio||{};return {seed:a.seed||'animora',overrides:a};}`;

/** One template as a page: its slots, the slot binder, and (standalone) the hand-off of its timeline to the renderer. */
function blockPage(block, vars, { standalone = true, data = null } = {}) {
  const b = BLOCKS[block]; if (!b) throw new Error(`Unknown premium template ${block}`);
  let html = b.html.replace(/__PREMIUM_BASE__/g, config.publicBaseUrl);
  if (PATCH[block]) html = PATCH[block](html);
  const json = JSON.stringify(data || { block, vars }).replace(/</g, '\\u003c');
  const head = standalone
    ? `<script>window.${MARK}=${json};${MUSIC_HOOK}window.__hyperframes={getVariables:function(){return window.${MARK}.vars;}};window.__sfx=[];window.__timelines=window.__timelines||{};</script>`
    : `<script>window.__timelines=window.__timelines||{};window.__slots=${JSON.stringify(vars).replace(/</g, '\\u003c')};window.__hyperframes={getVariables:function(){return window.__slots;}};</script>`;
  const V = standalone ? `window.${MARK}.vars` : 'window.__slots';
  // the declarative slots HyperFrames' own runtime would fill: data-var-src (pictures), data-var-text (words) and --{slot} CSS values
  const bind = `<script>(function(){var v=${V},S={img:1,video:1,audio:1,source:1};document.querySelectorAll('[data-var-src]').forEach(function(el){var x=v[el.getAttribute('data-var-src')];if(x&&typeof x==='object')x=x.url;if(typeof x==='string'&&x&&S[el.tagName.toLowerCase()]&&!/^javascript:/i.test(x))el.setAttribute('src',x);});document.querySelectorAll('[data-var-text]').forEach(function(el){var x=v[el.getAttribute('data-var-text')];if(x==null||typeof x==='object')return;var t=null;for(var i=0;i<el.childNodes.length;i++)if(el.childNodes[i].nodeType===3){t=el.childNodes[i];break;}if(el.children.length===0)el.textContent=String(x);else if(t)t.nodeValue=String(x);});var C=[].map.call(document.querySelectorAll('.clip[data-start]'),function(el){var a=0,e=el;while(e&&e.getAttribute){var x=parseFloat(e.getAttribute('data-start'));if(!isNaN(x)&&e!==document.body)a+=(e===el||e.classList.contains('clip'))?x:0;e=e.parentElement;}var d=parseFloat(el.getAttribute('data-duration'));return {el:el,a:a,b:isNaN(d)?1e9:a+d};});window.__clipSync=function(t){C.forEach(function(c){c.el.style.visibility=(t>=c.a-1e-4&&t<c.b)?'':'hidden';});};var r=document.querySelector('[data-composition-id]');if(r)Object.keys(v).forEach(function(k){var x=v[k];if(typeof x==='string'||typeof x==='number')r.style.setProperty('--'+k,String(x).replace(/[;{}<>\\r\\n]/g,''));});})();</script>`;
  const tail = standalone ? bind + `<script>(function(){var id=${JSON.stringify(block)},n=0;
// sound effects: a soft hit each time something new appears (one per half second at most), a shimmer on the closing card
${SFX_FN}
${REMAP_FN}
${CAPS_FN}
(function wait(){var t=window.__timelines&&window.__timelines[id];if(t){t.pause(0);var m=remap(t),V=(window.${MARK}||{}).voice,hasV=!!(V&&V.lines&&V.lines.length);
// with a voice, the film runs a little slower when needed so every spoken line fits
if(hasV){var need=1.8;V.lines.forEach(function(l){need+=estLen(l)+0.5;});m=stretch(m,need);}
try{var evs=AnimoraSound.remapEvents(AnimoraSound.events(t),m.g,0,'');window.__soundEvents=evs;window.__sfx=AnimoraSound.choose(evs,REG,${JSON.stringify(b.sfx || {})},audioOpts());}catch(e){console.error(e);window.__sfx=[];}t.seek(0,false);var W=wrap(t,m);if(hasV&&V.captions!==false){var plan=window.__captions||capsPlan(V.show||V.lines,window.__sfx,m.D);window.__capPlan=plan;var sync=capsLayer(document.getElementById('stage')||document.body,plan,innerWidth>innerHeight),sk=W.seek;W.seek=function(x){sk.call(W,x);sync(W._t);return W;};}window.__timeline=W;return;}if(++n<400)setTimeout(wait,25);})();})();</script>` : bind;
  return html.replace(/<head>/i, `<head>${head}`).replace(/<body([^>]*)>/i, `<body$1><div id="stage" style="position:absolute;left:0;top:0;width:${b.meta.width}px;height:${b.meta.height}px;overflow:hidden">`)
    .replace(/<\/body>/i, `</div>${tail}</body>`);
}

/** The page the renderer and the preview play for one tall template. */
export function premiumHtml({ block, vars, voice = null, audio = null }) { return blockPage(block, vars, { data: { block, vars, ...(voice ? { voice } : {}), ...(audio ? { audio } : {}) } }); }

/**
 * Several templates played one after another (landscape films). Each scene runs in its own frame so their styles and
 * scripts never clash; one master clock seeks every scene, cross-fading 0.4 s between them.
 */
const XF = 0.4;
export function filmHtml({ film, W = 1920, H = 1080, voice = null, audio = null, target = 0 }) {
  // scene lengths are worked out in the page, after the dead air in each scene has been taken out
  const scenes = film.map((s) => ({ cap: Number(s.dur) || BLOCKS[s.block].meta.duration, id: s.block, snd: BLOCKS[s.block].sfx || {} }));
  const docs = film.map((s) => blockPage(s.block, s.vars, { standalone: false }));
  const data = JSON.stringify({ film, ...(voice ? { voice } : {}), ...(audio ? { audio } : {}), ...(target ? { target, W, H } : {}) }).replace(/</g, '\\u003c');
  const docsJson = JSON.stringify(docs).replace(/</g, '\\u003c').replace(/[\u2028\u2029]/g, '');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Animora</title>
<script>window.${MARK}=${data};${MUSIC_HOOK}window.__hyperframes=null;</script>
<style>html,body{margin:0;background:#000;overflow:hidden}#stage{position:absolute;left:0;top:0;width:${W}px;height:${H}px;overflow:hidden;background:#000}#stage iframe{position:absolute;left:0;top:0;width:${W}px;height:${H}px;border:0;opacity:0}</style></head>
<body><div id="stage"></div>
<script>(function(){
var SC=${JSON.stringify(scenes)},DOCS=${docsJson},D=0,XF=${XF},stage=document.getElementById('stage'),frames=[];
${SFX_FN}
${REMAP_FN}
${CAPS_FN}
SC.forEach(function(s,i){var f=document.createElement('iframe');f.setAttribute('scrolling','no');f.style.zIndex=String(i+1);stage.appendChild(f);frames.push(f);f.srcdoc=DOCS[i];});
function child(i){try{var w=frames[i].contentWindow;return w&&w.__timelines&&w.__timelines[SC[i].id];}catch(e){return null;}}
function apply(t){SC.forEach(function(s,i){var lt=t-s.start,o=0;if(lt>=0&&lt<=s.dur){o=1;if(i&&lt<XF)o=lt/XF;}
  // the last scene holds its final frame; earlier scenes stay underneath until the next one has faded in
  if(i===SC.length-1&&lt>s.dur)o=1;if(i<SC.length-1&&lt>s.dur&&t<SC[i+1].start+XF)o=1;
  frames[i].style.opacity=String(o);frames[i].style.visibility=o>0?'visible':'hidden';var c=child(i);if(c){var x=s.m.f(Math.max(0,Math.min(s.dur,lt)));c.seek(x,false);var w=frames[i].contentWindow;if(w.__clipSync)w.__clipSync(x);}});}
var T={_t:0,seek:function(t){this._t=+t||0;apply(this._t);return this;},time:function(){return this._t;},duration:function(){return D;},pause:function(){return this;},paused:function(){return true;},play:function(){return this;},repeat:function(){return 0;},progress:function(){return this._t/D;}};
var n=0;(function wait(){var ok=SC.every(function(s,i){return !!child(i);});
  if(ok){var docsReady=frames.map(function(f){var d=f.contentDocument;return Promise.race([Promise.all([d.fonts?d.fonts.ready:null].concat([].map.call(d.images,function(im){return im.complete?null:new Promise(function(r){im.onload=im.onerror=r;});}))),new Promise(function(r){setTimeout(r,8000);})]);});
    Promise.all(docsReady).then(function(){var sfx=[],allEv=[],at=0;
      // the length the owner chose: scenes are slowed (at most 1.3x) or quickened (at most 0.85x) together to land on it
      var TG=+((window.${MARK}||{}).target)||0,KF=1;if(TG){var tot=0;SC.forEach(function(s,i){tot+=remap(child(i),s.cap,i===SC.length-1?2.2:1.1).D;});tot-=XF*(SC.length-1);if(tot>0)KF=Math.max(0.85,Math.min(1.3,TG/tot));}
      SC.forEach(function(s,i){var c=child(i);c.pause(0);s.m=remap(c,s.cap,i===SC.length-1?2.2:1.1);if(KF!==1)s.m=scaleM(s.m,KF);var VV=(window.${MARK}||{}).voice;if(VV&&VV.scenes&&VV.lines[i])s.m=stretch(s.m,estLen(VV.lines[i])+(i===SC.length-1?1.6:0.9));s.dur=s.m.D;s.start=i?at-XF:0;at=s.start+s.dur;
        try{var ev=AnimoraSound.events(c).filter(function(e){return e.t<=s.cap*1000;});if(i<SC.length-1)ev.forEach(function(e){e.final=false;});ev.forEach(function(e){e.P=s.snd;});allEv=allEv.concat(AnimoraSound.remapEvents(ev,s.m.g,Math.round(s.start*1000),'s'+i+':'));}catch(e){console.error(e);}
        if(i)allEv.push({kind:'scene',t:Math.round(s.start*1000),dur:Math.round(XF*1000),key:'scene',id:'scene@'+i+'#1',info:{area:1}});});
      // the ending lands: if the last scene has no closing reveal of its own, its first appearance becomes it
      var lastId='s'+(SC.length-1)+':';if(!allEv.some(function(e){return e.final&&e.id.indexOf(lastId)===0;})){var f0=allEv.filter(function(e){return e.id.indexOf(lastId)===0&&(e.kind==='appear'||e.kind==='slam');})[0];if(f0)f0.final=true;}
      allEv.sort(function(a,b){return a.t-b.t;});window.__soundEvents=allEv;try{sfx=AnimoraSound.choose(allEv,REG,{},audioOpts());}catch(e){console.error(e);sfx=[];}
      D=at;sfx=sfx.filter(function(e){return e.t<D-0.2;}).sort(function(a,b){return a.t-b.t;});window.__sfx=sfx;var V=(window.${MARK}||{}).voice;if(V&&V.lines&&V.lines.length&&V.captions!==false){var plan=window.__captions||capsPlan(V.show||V.lines,sfx,D,V.scenes?SC.map(function(x,i){return x.start+(i?0.35:0.4);}):null);window.__capPlan=plan;var sync=capsLayer(stage,plan,true),sk=T.seek;T.seek=function(x){sk.call(T,x);sync(T._t);return T;};}apply(0);T.seek(0);window.__timeline=T;});return;}
  if(++n<600)setTimeout(wait,25);})();
})();</script></body></html>`;
}

export const isPremium = (html) => String(html || '').includes(`window.${MARK}=`);
export function readPremium(html) {
  const m = String(html || '').match(new RegExp(`window\\.${MARK}=(\\{.*?\\});(?:\\(function\\(\\)\\{var a=|window\\.__hyperframes)`));
  try { return m ? JSON.parse(m[1]) : null; } catch { return null; }
}

/** A landscape film for this business: photos in a carousel (or a big kinetic headline), the key points, then the logo. */
function wideFilm(f, r) {
  const film = [], head = f.heads[0] || f.sub || f.name;
  if (f.photos.length) {
    const ids = Object.keys(CAROUSELS); const id = ids[Math.floor(r() * ids.length)];
    const vars = { line1: clean(head, 40), line2: clean(f.heads[0] ? f.name : (f.category || f.name), 40) };
    for (let i = 0; i < 12; i++) vars[`image${i + 1}`] = f.photos[i % f.photos.length];
    film.push({ block: id, vars, dur: 5.6 });
  } else {
    film.push({ block: 'weight-wave', vars: { text: clean(head, 34).toUpperCase() }, dur: 5 });
  }
  const p = points(f).slice(0, 4);
  if (p.length >= 2) film.push({ block: 'mk-specs-list', vars: { rows: p.map((x) => { const m = x.split(' · '); return m.length > 1 ? { label: clean(m[0], 30), value: clean(m.slice(1).join(' · '), 30) } : { label: clean(x, 40), value: '' }; }) } });
  if (f.photos.length && (f.sub || f.heads[1])) film.push({ block: 'weight-wave', vars: { text: clean(f.heads[1] || f.sub, 34).toUpperCase() }, dur: 4.6 });
  film.push({ block: 'logo-outro', vars: { logo: f.logo || wordmark(f.name, '#ffffff'), tagline: clean(f.sub || head, 60), url: clean(contactLine(f), 40) } });
  return film;
}

/**
 * The narration for a premium film: a few short spoken lines from the owner's own details (no AI), read by the free
 * Kokoro voice on the render server. The line breaks become real pauses; the last line lands on the film's ending.
 */
export function voiceScript(f, gender, voiceId) {
  const end = (t) => { t = clean(t, 120).replace(/[|]/g, ' '); return /[.!?]$/.test(t) ? t : `${t}.`; };
  const lines = [];
  const head = f.heads[0] || f.sub; if (head) lines.push(end(head));
  const pts = [...f.features, ...f.products.map((p) => (p.price ? `${p.title}, ${p.price}` : p.title))].slice(0, 2);
  if (pts.length) lines.push(pts.map(end).join(' '));
  if (f.offer) lines.push(end(f.offer));
  // the phone number stays on screen: read aloud it takes longer than the ending lasts
  lines.push(end([f.name, f.cta].filter(Boolean).join('. ')));
  // what is said (numbers and prices in words) and what is shown on screen (as the owner wrote it)
  const keep = lines.slice(0, 4);
  return { voice: isVoiceId(voiceId) ? voiceId : defaultVoice(gender), lines: keep.map(speakable), show: keep };
}
const wantsVoice = (brief) => [true, 'yes', 'female', 'male'].includes(brief?.voiceover);


/** Landscape films say exactly what each scene shows, as each scene starts (one line per scene). */
function filmVoice(film, f, gender, voiceId) {
  const end = (t) => { t = clean(String(t || '').replace(/[|]/g, ' '), 120); return !t ? '' : /[.!?]$/.test(t) ? t : `${t}.`; };
  const cap = (t) => { t = clean(t, 120).toLowerCase(); return t.charAt(0).toUpperCase() + t.slice(1); };
  const show = film.map((s) => {
    const v = s.vars || {};
    if (s.block.startsWith('carousel')) return [end(v.line1), end(v.line2)].filter(Boolean).join(' ');
    if (s.block === 'mk-specs-list') return (v.rows || []).slice(0, 2).map((r) => end(r.value ? `${r.label}, ${r.value}` : r.label)).join(' ');
    if (s.block === 'weight-wave') return end(cap(v.text));
    if (s.block === 'logo-outro') return [end(v.tagline), end(f.cta)].filter(Boolean).join(' ');
    return '';
  });
  return { voice: isVoiceId(voiceId) ? voiceId : defaultVoice(gender), lines: show.map(speakable), show, scenes: true };
}

/** Pick a template that fits this business (a different one on Regenerate) and fill it. */
// Music by default: "Music + sound effects" is the default answer, so a film gets a CC0 library song unless the owner chose
// effects only, their own music or no sound. Only songs with a checked beat grid are picked, so the MP4 can start the song
// where its beats meet the film's big moments (server/engine/sfx.js). The editor can change or remove it.
const BEAT_SONGS = (() => {
  try {
    const beats = JSON.parse(readFileSync(new URL('../../../assets/music/beats.json', import.meta.url), 'utf8'));
    const lib = JSON.parse(readFileSync(new URL('../../../assets/music/library.json', import.meta.url), 'utf8')).tracks || {};
    // library songs whose beat grid sits on the kick drum, with their mood
    return Object.entries(lib).map(([id, t]) => ({ file: `${id}.mp3`, mood: t.mood || '' })).filter((t) => { const b = beats[t.file]; return b?.ok && b.kickErrorMs <= 75 && b.beats?.length >= 8; });
  } catch { return []; }
})();
const MOODS_FOR = { scifi: ['synthwave', 'scifi', 'upbeat'], glass: ['chill', 'upbeat', 'lofi'], dreamy: ['chill', 'lofi'], soft: ['chill', 'lofi', 'upbeat'],
  rubber: ['upbeat', 'funk'], zen: ['lofi', 'chill'], studio: ['lofi', 'chill', 'hiphop'], cinematic: ['calm', 'intro', 'synthwave'] };
// The family of small interface sounds (taps, ticks, prices, the closing chime): one uisfx pack per film, chosen to suit the business.
export const SOUND_PACKS = ['soft', 'glass', 'studio', 'zen', 'dreamy', 'cinematic', 'rubber', 'scifi'];
const PACK_FOR = [
  [/fintech|bank|pay|loan|insur|crypto|software|app\b|tech|saas|gadget|phone|laptop|repair|electronic/i, ['scifi', 'glass']],
  [/luxury|jewel|real estate|property|hotel|car\b|cars\b|automobile|interior/i, ['glass', 'cinematic']],
  [/beauty|salon|spa|hair|nail|skin|fashion|boutique|wellness|yoga|bridal|makeup/i, ['dreamy', 'soft']],
  [/food|restaurant|cafe|coffee|bakery|cake|snack|drink|kids|toy|party|event|game/i, ['rubber', 'soft']],
  [/school|tutor|book|church|ministry|consult|law|clinic|health|hospital|pharmac/i, ['zen', 'studio']],
  [/film|music|studio|photo|media|creative|design|agency/i, ['studio', 'cinematic']],
];
function defaultPack(brief, r) {
  const text = [brief?.category, brief?.name, brief?.goal].filter(Boolean).join(' ');
  const hit = PACK_FOR.find(([re]) => re.test(text));
  const pool = hit ? hit[1] : ['soft', 'glass', 'studio'];
  return pool[Math.floor(r() * pool.length)];
}
function defaultMusic(brief, r) {
  if (brief?.sound === 'none' || brief?.soundStyle === 'none') return null;
  const pack = defaultPack(brief, r);
  if (['sfx', 'own'].includes(brief?.sound)) return { pack };
  const want = MOODS_FOR[pack] || ['upbeat', 'chill'], fit = BEAT_SONGS.filter((t) => want.includes(t.mood)), pool = fit.length ? fit : BEAT_SONGS;
  return pool.length ? { music: `/music/${pool[Math.floor(r() * pool.length)].file}`, musicOffset: 0, pack } : { pack };
}

// Tall films: designer templates played one after another until the film is as long as the owner asked for.
// LEN: each template's length once its still moments are trimmed (measured); END: when its own closing card starts.
// A template that isn't last is cut before its closing card, so only the final scene ends on the brand.
const LEN = { 'notification-cascade': 12.7, 'message-thread-reveal': 20.7, 'notes-reveal': 21.6, 'ai-chat-reveal': 9.1, 'share-sheet-carousel': 7.2 };
const END = { 'notification-cascade': 9.89, 'message-thread-reveal': 23.25, 'notes-reveal': 21.35, 'ai-chat-reveal': 15.8 };
function tallFilm(f, r, T, prev) {
  const fit = PREMIUM_BLOCKS.filter((k) => BLOCKS[k].fits(f) && LEN[k]);
  if (!fit.length) return null;
  const est = (k, last) => (last || !END[k] ? LEN[k] : LEN[k] * (END[k] / BLOCKS[k].meta.duration));
  const prevFirst = (prev?.film?.[0]?.block) || prev?.block;
  const seqs = [];
  const grow = (seq) => { if (seq.length) seqs.push(seq); if (seq.length < 3) fit.forEach((k) => { if (!seq.includes(k)) grow([...seq, k]); }); };
  grow([]);
  let best = null;
  for (const seq of seqs) {
    if (!END[seq[seq.length - 1]]) continue;                 // the last scene must end on a brand card
    const e = seq.reduce((n, k, i) => n + est(k, i === seq.length - 1), 0) - 0.4 * (seq.length - 1);
    const reach = Math.min(Math.max(T / e, 0.85), 1.3) * e;   // what the page can stretch or quicken it to
    const score = Math.abs(reach - T) / T + (seq.length - 1) * 0.06 + (seq[0] === prevFirst ? 0.2 : 0) + r() * 0.05;
    if (!best || score < best.score) best = { seq, score, reach };
  }
  // too short even when slowed down: the Story engine makes it at the exact length instead
  if (!best || best.reach < T * 0.8) throw new Error(`No premium templates long enough for ${T}s`);
  return best.seq.map((k, i) => ({ block: k, dur: i === best.seq.length - 1 || !END[k] ? BLOCKS[k].meta.duration : END[k] }));
}

export function premiumFilm({ plan = {}, brief = {}, assets = [], salt = '', previous = null }) {
  const aspect = plan.aspect_ratio || '9:16';
  if (!PREMIUM_ASPECTS.includes(aspect)) throw new Error('No premium template for this size yet');
  const f = factsOf(plan, brief, assets);
  const r = mulberry(hash(`${f.name}|${salt}`));
  const voice = wantsVoice(brief) ? voiceScript(f, brief.voiceGender || brief.voiceover, brief.voiceId) : null;
  // keep the song the owner already has (Regenerate changes the pictures and moves, not the music they picked)
  const kept = readPremium(previous)?.audio, fresh = defaultMusic(brief, mulberry(hash(`${f.name}|music|${salt}`)));
  const audio = kept && (kept.music || kept.pack) ? { ...(fresh || {}), ...kept } : fresh;
  if (aspect === '16:9') {
    const film = wideFilm(f, r), T = Number(plan.duration_seconds) || 0;
    const est = 0.6 * film.reduce((n, s) => n + (Number(s.dur) || BLOCKS[s.block].meta.duration), 0);   // measured: still moments trimmed, ~60% remains
    if (T && est * 1.3 < T * 0.8) throw new Error(`Landscape templates too short for ${T}s`);   // the Story engine makes it at the exact length
    const fv = voice ? filmVoice(film, f, brief.voiceGender || brief.voiceover, brief.voiceId) : null;
    return { html: filmHtml({ film, voice: fv, audio, target: T }), block: film.map((s) => s.block).join('+') };
  }
  const tall = tallFilm(f, r, Number(plan.duration_seconds) || 20, readPremium(previous));
  if (tall) {
    const film = tall.map((b) => ({ ...b, vars: BLOCKS[b.block].fill(f, r) }));
    // the voice reads the business's own lines across the whole film (tall templates have no per-scene script)
    return { html: filmHtml({ film, W: 1080, H: 1920, voice, audio, target: Number(plan.duration_seconds) || 0 }), block: film.map((s) => s.block).join('+') };
  }
  const prev = readPremium(previous)?.block;
  let options = PREMIUM_BLOCKS.filter((k) => BLOCKS[k].fits(f));
  if (options.length > 1 && prev) options = options.filter((k) => k !== prev);
  if (!options.length) throw new Error('No premium template fits these details');
  const block = options[Math.floor(r() * options.length)];
  const vars = BLOCKS[block].fill(f, r);
  return { html: premiumHtml({ block, vars, voice, audio }), block, duration: BLOCKS[block].meta.duration };
}

/**
 * Plain-words change to a premium film: the AI (when on) rewrites only the words in the slots; pictures and the logo stay.
 * Returns { html, summary } or null when nothing changed.
 */
export async function premiumEdit({ html, instruction, useAi }) {
  const d = readPremium(html); if (!d) return null;
  const isText = (k, v) => typeof v === 'string' && !/^(data:|https?:|\/)/.test(v) && !/image|logo/i.test(k);
  // a film's slots are named "<scene>.<slot>" so the AI can change any scene's words
  const scenes = d.film || [{ block: d.block, vars: d.vars }];
  const words = {};
  scenes.forEach((s, i) => Object.entries(s.vars).forEach(([k, v]) => {
    if (isText(k, v)) words[`${i}.${k}`] = v;
    if (k === 'rows' && Array.isArray(v)) v.forEach((row, j) => { words[`${i}.rows.${j}.label`] = row.label; if (row.value) words[`${i}.rows.${j}.value`] = row.value; });
  }));
  if (!useAi) return null;
  const { geminiGenerate } = await import('../../engine/gemini.js');
  const { text } = await geminiGenerate({
    system: 'You edit the words of a short video ad for a small business. The words are JSON slots (slot name -> text). Change only what the owner asks for, keep every slot name, keep each text about as long as it was (these sit in fixed places on screen), and never invent prices, phone numbers, addresses or claims. A "|" inside a text is a line break; keep it where it makes sense. Return JSON: { "slots": { only the slots you changed }, "summary": "one short friendly sentence of what you changed" }.',
    messages: [{ role: 'user', text: `SLOTS: ${JSON.stringify(words)}\n\nCHANGE: ${instruction}` }],
    temperature: 0.4, maxOutputTokens: 3000, json: true, timeoutMs: 45000, thinking: 'low',
  });
  const o = JSON.parse(String(text).match(/\{[\s\S]*\}/)[0]);
  const next = scenes.map((s) => ({ ...s, vars: JSON.parse(JSON.stringify(s.vars)) }));
  let changed = 0;
  for (const [key, v] of Object.entries(o.slots || {})) {
    if (!(key in words) || typeof v !== 'string' || !v.trim()) continue;
    const [i, k, j, part] = key.split('.'); const sc = next[+i]; if (!sc) continue;
    const val = clean(v, Math.max(20, String(words[key]).length * 2));
    if (k === 'rows') { if (sc.vars.rows?.[+j]) { sc.vars.rows[+j][part] = val; changed++; } } else { sc.vars[k] = val; changed++; }
  }
  if (!changed) return null;
  const out = d.film ? filmHtml({ film: next, voice: d.voice, audio: d.audio, W: d.W || 1920, H: d.H || 1080, target: d.target || 0 }) : premiumHtml({ block: next[0].block, vars: next[0].vars, voice: d.voice, audio: d.audio });
  return { html: out, summary: clean(o.summary, 200) || 'Done! Check the video.' };
}

/**
 * Sound settings changed in the editor: effects volume, density, muted or swapped effects (by visual-event id), a fresh
 * pick of effects (seed), background music (+ its beat-aligned start), the voice and the captions. The film itself is
 * untouched; the page is rebuilt with the new settings. Returns the new page or null if this isn't a premium film.
 * voiceScript(): when a voice is switched on for a film that had none, the spoken lines come from `brief` details.
 */
export function premiumWithAudio(html, patch = {}, { brief = null, plan = {}, assets = [] } = {}) {
  const d = readPremium(html); if (!d) return null;
  const audio = { ...(d.audio || {}) };
  if (typeof patch.sfxGain === 'number') audio.sfxGain = Math.max(-30, Math.min(6, patch.sfxGain));
  if (['low', 'normal', 'high'].includes(patch.density)) audio.density = patch.density;
  if (Array.isArray(patch.mute)) audio.mute = [...new Set(patch.mute.map(String))].slice(0, 200);
  if (patch.swap && typeof patch.swap === 'object') audio.swap = Object.fromEntries(Object.entries(patch.swap).filter(([k, v]) => typeof v === 'string' && REG.some((r) => r.key === v)).slice(0, 200));
  if (patch.reshuffle) { audio.seed = `s${Date.now().toString(36)}`; delete audio.swap; }
  if ('music' in patch) { if (patch.music && /^\/music\/[\w-]+\.mp3$/.test(patch.music)) { audio.music = patch.music; audio.musicOffset = Math.max(0, Number(patch.musicOffset) || 0); } else { delete audio.music; delete audio.musicOffset; } }
  if (typeof patch.musicGain === 'number') audio.musicGain = Math.max(-20, Math.min(6, patch.musicGain));
  if ('pack' in patch) { if (SOUND_PACKS.includes(patch.pack)) { audio.pack = patch.pack; delete audio.swap; } else delete audio.pack; }
  let voice = d.voice ? { ...d.voice } : null;
  if (patch.voiceOn === false) voice = null;
  if (patch.voiceOn === true && !voice) {
    const f = factsOf(plan, brief || {}, assets);
    voice = d.film && (d.W || 1920) > (d.H || 1080) ? filmVoice(d.film, f, 'female', patch.voice) : voiceScript(f, 'female', patch.voice);
  }
  if (voice && isVoiceId(patch.voice)) voice.voice = patch.voice;
  if (voice && typeof patch.captions === 'boolean') voice.captions = patch.captions;
  return d.film ? filmHtml({ film: d.film, voice, audio, W: d.W || 1920, H: d.H || 1080, target: d.target || 0 }) : premiumHtml({ block: d.block, vars: d.vars, voice, audio });
}

/** For tests: a tiny template made of your own HTML and GSAP code, run through the same page code as real templates. */
export function registerTestBlock(id, { body, script, width = 1080, height = 1920, sfx = {}, gsapSrc }) {
  BLOCKS[id] = {
    meta: { id, title: id, width, height, duration: 0 }, sfx, wide: true,
    html: `<!doctype html><html><head><meta charset="utf-8"><script src="${gsapSrc}"></script><style>html,body{margin:0;background:#fff}</style></head><body><div data-composition-id="${id}" style="position:relative;width:${width}px;height:${height}px">${body}</div><script>window.__timelines=window.__timelines||{};(function(){var tl=gsap.timeline({paused:true});${script};window.__timelines[${JSON.stringify(id)}]=tl;})();</script></body></html>`,
  };
}
