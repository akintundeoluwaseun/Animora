// Premium films: designer-made ad templates (HyperFrames blocks, Apache-2.0) with every word, picture and logo
// filled from the owner's own details. No AI call is needed: each template has named slots and this file fills them.
//
//   premiumFilm({ plan, brief, assets, seed, previous }) -> { html, block }   (throws when no template fits)
//   isPremium(html), readPremium(html)
//
// The page keeps the block's own paused GSAP timeline (window.__timelines[id]) and hands it to the renderer as window.__timeline.
import { config } from '../../config.js';
import { factsOf } from '../pieces/index.js';
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
    meta: mNotif, sound: 'ping', html: notificationCascade, fits: () => true,
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
    meta: mThread, sound: 'pop-soft', html: messageThread, fits: (f) => f.photos.length >= 1,
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
    meta: mNotes, sound: 'tick', html: notesReveal, fits: (f) => f.features.length + f.products.length >= 2,
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
    meta: mChat, sound: 'pop-soft', html: aiChat, fits: (f) => f.features.length + f.products.length >= 1,
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
    meta: mShare, sound: 'swipe', html: shareSheet, fits: (f) => f.photos.length >= 2,
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
for (const [id, [html, meta]] of Object.entries(CAROUSELS)) BLOCKS[id] = { meta, html, wide: true, sound: 'swish' };
BLOCKS['mk-specs-list'] = { meta: mSpecs, html: specsList, wide: true, sound: 'tick' };
BLOCKS['logo-outro'] = { meta: mOutro, html: logoOutro, wide: true, sound: 'pop-soft' };
BLOCKS['weight-wave'] = { meta: mWave, html: weightWave, wide: true, sound: 'swish' };

export const PREMIUM_BLOCKS = Object.keys(BLOCKS).filter((k) => !BLOCKS[k].wide);

// Dead air: wherever nothing on screen starts or moves for more than MAX seconds, the film fast-forwards through it,
// so the viewer never waits on a still frame. The closing card keeps a short hold so it can be read.
const REMAP_FN = `function remap(tl,cap,endHold){var D=Math.min(tl.duration(),cap||1e9),iv=[];tl.getChildren(true,true,false).forEach(function(c){var d=c.duration?c.duration():0;if(c.getChildren&&d>0)return;if(!(d>0))d=0.06;var st=c.startTime(),p=c.parent;while(p&&p!==tl){st+=p.startTime();p=p.parent;}if(st<D)iv.push([st,Math.min(D,st+d),d>D*0.45]);});
// slow background drifts don't count as action, unless they are the whole scene (a kinetic headline is one long move)
var shortOnes=iv.filter(function(r){return !r[2];}),cov=0;shortOnes.forEach(function(r){cov+=r[1]-r[0];});if(cov>D*0.3)iv=shortOnes;iv.sort(function(a,b){return a[0]-b[0];});
var U=[];iv.forEach(function(r){var l=U[U.length-1];if(l&&r[0]<=l[1]+0.05){if(r[1]>l[1])l[1]=r[1];}else U.push([r[0],r[1]]);});
var MAX=1.2,END=endHold==null?2.2:endHold,K=[[0,0]],o=0,pos=0;
U.forEach(function(r){var idle=r[0]-pos;o+=Math.min(idle,pos===0?0.5:MAX);K.push([o,r[0]]);o+=r[1]-r[0];K.push([o,r[1]]);pos=r[1];});
o+=Math.min(D-pos,END);K.push([o,D]);
return {D:K[K.length-1][0],f:function(t){if(t<=0)return 0;for(var j=1;j<K.length;j++){if(t<=K[j][0]){var a=K[j-1],b=K[j];return a[1]+(b[1]-a[1])*((t-a[0])/((b[0]-a[0])||1));}}return K[K.length-1][1];},g:function(x){for(var j=1;j<K.length;j++){if(x<=K[j][1]){var a=K[j-1],b=K[j];return a[0]+(b[0]-a[0])*((x-a[1])/((b[1]-a[1])||1));}}return K[K.length-1][0];}};}
function wrap(tl,m){return {_t:0,seek:function(t){this._t=+t||0;var x=m.f(this._t);tl.seek(x,false);if(window.__clipSync)window.__clipSync(x);return this;},time:function(){return this._t;},duration:function(){return m.D;},pause:function(){return this;},paused:function(){return true;},play:function(){return this;},repeat:function(){return 0;},progress:function(){return this._t/m.D;}};}`;
const SFX_FN = `function cues(tl,SND){var ts=[];tl.getChildren(true,true,false).forEach(function(c){var v=c.vars||{},a=v.autoAlpha!=null?v.autoAlpha:v.opacity;if(a==null||+a<0.5)return;var st=c.startTime(),p=c.parent;while(p&&p!==tl){st+=p.startTime();p=p.parent;}if(st>0.25)ts.push(st);});ts.sort(function(a,b){return a-b;});var out=[],last=-9,d=tl.duration();ts.forEach(function(t){if(t-last>=0.45&&t<d-0.3&&out.length<24){out.push({t:+t.toFixed(3),k:SND,v:0.55});last=t;}});if(out.length){var e=out[out.length-1];if(e.t>d*0.55){e.k='shimmer';e.v=0.7;}}return out;}`;

/** One template as a page: its slots, the slot binder, and (standalone) the hand-off of its timeline to the renderer. */
function blockPage(block, vars, { standalone = true, data = null } = {}) {
  const b = BLOCKS[block]; if (!b) throw new Error(`Unknown premium template ${block}`);
  let html = b.html.replace(/__PREMIUM_BASE__/g, config.publicBaseUrl);
  if (PATCH[block]) html = PATCH[block](html);
  const json = JSON.stringify(data || { block, vars }).replace(/</g, '\\u003c');
  const head = standalone
    ? `<script>window.${MARK}=${json};window.__hyperframes={getVariables:function(){return window.${MARK}.vars;}};window.__sfx=[];window.__timelines=window.__timelines||{};</script>`
    : `<script>window.__timelines=window.__timelines||{};window.__slots=${JSON.stringify(vars).replace(/</g, '\\u003c')};window.__hyperframes={getVariables:function(){return window.__slots;}};</script>`;
  const V = standalone ? `window.${MARK}.vars` : 'window.__slots';
  // the declarative slots HyperFrames' own runtime would fill: data-var-src (pictures), data-var-text (words) and --{slot} CSS values
  const bind = `<script>(function(){var v=${V},S={img:1,video:1,audio:1,source:1};document.querySelectorAll('[data-var-src]').forEach(function(el){var x=v[el.getAttribute('data-var-src')];if(x&&typeof x==='object')x=x.url;if(typeof x==='string'&&x&&S[el.tagName.toLowerCase()]&&!/^javascript:/i.test(x))el.setAttribute('src',x);});document.querySelectorAll('[data-var-text]').forEach(function(el){var x=v[el.getAttribute('data-var-text')];if(x==null||typeof x==='object')return;var t=null;for(var i=0;i<el.childNodes.length;i++)if(el.childNodes[i].nodeType===3){t=el.childNodes[i];break;}if(el.children.length===0)el.textContent=String(x);else if(t)t.nodeValue=String(x);});var C=[].map.call(document.querySelectorAll('.clip[data-start]'),function(el){var a=0,e=el;while(e&&e.getAttribute){var x=parseFloat(e.getAttribute('data-start'));if(!isNaN(x)&&e!==document.body)a+=(e===el||e.classList.contains('clip'))?x:0;e=e.parentElement;}var d=parseFloat(el.getAttribute('data-duration'));return {el:el,a:a,b:isNaN(d)?1e9:a+d};});window.__clipSync=function(t){C.forEach(function(c){c.el.style.visibility=(t>=c.a-1e-4&&t<c.b)?'':'hidden';});};var r=document.querySelector('[data-composition-id]');if(r)Object.keys(v).forEach(function(k){var x=v[k];if(typeof x==='string'||typeof x==='number')r.style.setProperty('--'+k,String(x).replace(/[;{}<>\\r\\n]/g,''));});})();</script>`;
  const tail = standalone ? bind + `<script>(function(){var id=${JSON.stringify(block)},n=0;
// sound effects: a soft hit each time something new appears (one per half second at most), a shimmer on the closing card
${SFX_FN}
${REMAP_FN}
(function wait(){var t=window.__timelines&&window.__timelines[id];if(t){t.pause(0);var m=remap(t);try{window.__sfx=cues(t,${JSON.stringify(b.sound || 'pop-soft')}).map(function(e){return {t:+m.g(e.t).toFixed(3),k:e.k,v:e.v};});}catch(e){window.__sfx=[];}t.seek(0,false);window.__timeline=wrap(t,m);return;}if(++n<400)setTimeout(wait,25);})();})();</script>` : bind;
  return html.replace(/<head>/i, `<head>${head}`).replace(/<body([^>]*)>/i, `<body$1><div id="stage" style="position:absolute;left:0;top:0;width:${b.meta.width}px;height:${b.meta.height}px;overflow:hidden">`)
    .replace(/<\/body>/i, `</div>${tail}</body>`);
}

/** The page the renderer and the preview play for one tall template. */
export function premiumHtml({ block, vars }) { return blockPage(block, vars); }

/**
 * Several templates played one after another (landscape films). Each scene runs in its own frame so their styles and
 * scripts never clash; one master clock seeks every scene, cross-fading 0.4 s between them.
 */
const XF = 0.4;
export function filmHtml({ film, W = 1920, H = 1080 }) {
  // scene lengths are worked out in the page, after the dead air in each scene has been taken out
  const scenes = film.map((s) => ({ cap: Number(s.dur) || BLOCKS[s.block].meta.duration, id: s.block, snd: BLOCKS[s.block].sound || 'pop-soft' }));
  const docs = film.map((s) => blockPage(s.block, s.vars, { standalone: false }));
  const data = JSON.stringify({ film }).replace(/</g, '\\u003c');
  const docsJson = JSON.stringify(docs).replace(/</g, '\\u003c').replace(/[\u2028\u2029]/g, '');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Animora</title>
<script>window.${MARK}=${data};window.__hyperframes=null;</script>
<style>html,body{margin:0;background:#000;overflow:hidden}#stage{position:absolute;left:0;top:0;width:${W}px;height:${H}px;overflow:hidden;background:#000}#stage iframe{position:absolute;left:0;top:0;width:${W}px;height:${H}px;border:0;opacity:0}</style></head>
<body><div id="stage"></div>
<script>(function(){
var SC=${JSON.stringify(scenes)},DOCS=${docsJson},D=0,XF=${XF},stage=document.getElementById('stage'),frames=[];
${SFX_FN}
${REMAP_FN}
SC.forEach(function(s,i){var f=document.createElement('iframe');f.setAttribute('scrolling','no');f.style.zIndex=String(i+1);stage.appendChild(f);frames.push(f);f.srcdoc=DOCS[i];});
function child(i){try{var w=frames[i].contentWindow;return w&&w.__timelines&&w.__timelines[SC[i].id];}catch(e){return null;}}
function apply(t){SC.forEach(function(s,i){var lt=t-s.start,o=0;if(lt>=0&&lt<=s.dur){o=1;if(i&&lt<XF)o=lt/XF;}
  // the last scene holds its final frame; earlier scenes stay underneath until the next one has faded in
  if(i===SC.length-1&&lt>s.dur)o=1;if(i<SC.length-1&&lt>s.dur&&t<SC[i+1].start+XF)o=1;
  frames[i].style.opacity=String(o);frames[i].style.visibility=o>0?'visible':'hidden';var c=child(i);if(c){var x=s.m.f(Math.max(0,Math.min(s.dur,lt)));c.seek(x,false);var w=frames[i].contentWindow;if(w.__clipSync)w.__clipSync(x);}});}
var T={_t:0,seek:function(t){this._t=+t||0;apply(this._t);return this;},time:function(){return this._t;},duration:function(){return D;},pause:function(){return this;},paused:function(){return true;},play:function(){return this;},repeat:function(){return 0;},progress:function(){return this._t/D;}};
var n=0;(function wait(){var ok=SC.every(function(s,i){return !!child(i);});
  if(ok){var docsReady=frames.map(function(f){var d=f.contentDocument;return Promise.race([Promise.all([d.fonts?d.fonts.ready:null].concat([].map.call(d.images,function(im){return im.complete?null:new Promise(function(r){im.onload=im.onerror=r;});}))),new Promise(function(r){setTimeout(r,8000);})]);});
    Promise.all(docsReady).then(function(){var sfx=[],at=0;
      SC.forEach(function(s,i){var c=child(i);c.pause(0);s.m=remap(c,s.cap,i===SC.length-1?2.2:1.1);s.dur=s.m.D;s.start=i?at-XF:0;at=s.start+s.dur;
        try{cues(c,s.snd).forEach(function(e){if(e.t>s.cap)return;var tt=s.m.g(e.t)+s.start;sfx.push({t:+tt.toFixed(3),k:e.k==='shimmer'&&i<SC.length-1?s.snd:e.k,v:e.v});});}catch(e){}
        if(i)sfx.push({t:+(s.start).toFixed(3),k:'trans-soft-1',v:0.5});});
      D=at;sfx=sfx.filter(function(e){return e.t<D-0.2;}).sort(function(a,b){return a.t-b.t;});window.__sfx=sfx;apply(0);window.__timeline=T;});return;}
  if(++n<600)setTimeout(wait,25);})();
})();</script></body></html>`;
}

export const isPremium = (html) => String(html || '').includes(`window.${MARK}=`);
export function readPremium(html) {
  const m = String(html || '').match(new RegExp(`window\\.${MARK}=(\\{.*?\\});window\\.__hyperframes`));
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
  const p = points(f).slice(0, 5);
  if (p.length >= 2) film.push({ block: 'mk-specs-list', vars: { rows: p.map((x) => { const m = x.split(' · '); return m.length > 1 ? { label: clean(m[0], 30), value: clean(m.slice(1).join(' · '), 30) } : { label: clean(x, 40), value: '' }; }) } });
  if (f.photos.length && (f.sub || f.heads[1])) film.push({ block: 'weight-wave', vars: { text: clean(f.heads[1] || f.sub, 34).toUpperCase() }, dur: 4.6 });
  film.push({ block: 'logo-outro', vars: { logo: f.logo || wordmark(f.name, '#ffffff'), tagline: clean(f.sub || head, 60), url: clean(contactLine(f), 40) } });
  return film;
}

/** Pick a template that fits this business (a different one on Regenerate) and fill it. */
export function premiumFilm({ plan = {}, brief = {}, assets = [], salt = '', previous = null }) {
  const aspect = plan.aspect_ratio || '9:16';
  if (!PREMIUM_ASPECTS.includes(aspect)) throw new Error('No premium template for this size yet');
  const f = factsOf(plan, brief, assets);
  const r = mulberry(hash(`${f.name}|${salt}`));
  if (aspect === '16:9') { const film = wideFilm(f, r); return { html: filmHtml({ film }), block: film.map((s) => s.block).join('+') }; }
  const prev = readPremium(previous)?.block;
  let options = PREMIUM_BLOCKS.filter((k) => BLOCKS[k].fits(f));
  if (options.length > 1 && prev) options = options.filter((k) => k !== prev);
  if (!options.length) throw new Error('No premium template fits these details');
  const block = options[Math.floor(r() * options.length)];
  const vars = BLOCKS[block].fill(f, r);
  return { html: premiumHtml({ block, vars }), block, duration: BLOCKS[block].meta.duration };
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
  const out = d.film ? filmHtml({ film: next }) : premiumHtml({ block: next[0].block, vars: next[0].vars });
  return { html: out, summary: clean(o.summary, 200) || 'Done! Check the video.' };
}
