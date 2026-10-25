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

export const PREMIUM_ASPECTS = ['9:16'];
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
export const PREMIUM_BLOCKS = Object.keys(BLOCKS);

/** The page the renderer and the preview play: the template, its slots, and the hand-off of its timeline. */
export function premiumHtml({ block, vars }) {
  const b = BLOCKS[block]; if (!b) throw new Error(`Unknown premium template ${block}`);
  const base = config.publicBaseUrl;
  const data = JSON.stringify({ block, vars }).replace(/</g, '\\u003c');
  let html = b.html.replace(/__PREMIUM_BASE__/g, base);
  const head = `<script>window.${MARK}=${data};window.__hyperframes={getVariables:function(){return window.${MARK}.vars;}};window.__sfx=[];</script>`;
  // the declarative slots HyperFrames' own runtime would fill: data-var-src (pictures), data-var-text (words) and --{slot} CSS values
  const bind = `<script>(function(){var v=window.${MARK}.vars,S={img:1,video:1,audio:1,source:1};document.querySelectorAll('[data-var-src]').forEach(function(el){var x=v[el.getAttribute('data-var-src')];if(x&&typeof x==='object')x=x.url;if(typeof x==='string'&&x&&S[el.tagName.toLowerCase()]&&!/^javascript:/i.test(x))el.setAttribute('src',x);});document.querySelectorAll('[data-var-text]').forEach(function(el){var x=v[el.getAttribute('data-var-text')];if(x==null||typeof x==='object')return;var t=null;for(var i=0;i<el.childNodes.length;i++)if(el.childNodes[i].nodeType===3){t=el.childNodes[i];break;}if(el.children.length===0)el.textContent=String(x);else if(t)t.nodeValue=String(x);});var r=document.querySelector('[data-composition-id]');if(r)Object.keys(v).forEach(function(k){var x=v[k];if(typeof x==='string'||typeof x==='number')r.style.setProperty('--'+k,String(x).replace(/[;{}<>\\r\\n]/g,''));});})();</script>`;
  const tail = bind + `<script>(function(){var id=${JSON.stringify(block)},n=0,SND=${JSON.stringify(b.sound || 'pop-soft')};
// sound effects: a soft hit each time something new appears (one per half second at most), a shimmer on the closing card
function cues(tl){var ts=[];tl.getChildren(true,true,false).forEach(function(c){var v=c.vars||{},a=v.autoAlpha!=null?v.autoAlpha:v.opacity;if(a==null||+a<0.5)return;var st=c.startTime(),p=c.parent;while(p&&p!==tl){st+=p.startTime();p=p.parent;}if(st>0.25)ts.push(st);});ts.sort(function(a,b){return a-b;});var out=[],last=-9,d=tl.duration();ts.forEach(function(t){if(t-last>=0.45&&t<d-0.3&&out.length<24){out.push({t:+t.toFixed(3),k:SND,v:0.55});last=t;}});if(out.length){var e=out[out.length-1];if(e.t>d*0.55){e.k='shimmer';e.v=0.7;}}return out;}
(function wait(){var t=window.__timelines&&window.__timelines[id];if(t){t.pause(0);try{window.__sfx=cues(t);}catch(e){window.__sfx=[];}window.__timeline=t;return;}if(++n<400)setTimeout(wait,25);})();})();</script>`;
  html = html.replace(/<head>/i, `<head>${head}`).replace(/<body([^>]*)>/i, `<body$1><div id="stage" style="position:absolute;left:0;top:0;width:${b.meta.width}px;height:${b.meta.height}px;overflow:hidden">`)
    .replace(/<\/body>/i, `</div>${tail}</body>`);
  return html;
}

export const isPremium = (html) => String(html || '').includes(`window.${MARK}=`);
export function readPremium(html) {
  const m = String(html || '').match(new RegExp(`window\\.${MARK}=(\\{.*?\\});window\\.__hyperframes`));
  try { return m ? JSON.parse(m[1]) : null; } catch { return null; }
}

/** Pick a template that fits this business (a different one on Regenerate) and fill it. */
export function premiumFilm({ plan = {}, brief = {}, assets = [], salt = '', previous = null }) {
  const aspect = plan.aspect_ratio || '9:16';
  if (!PREMIUM_ASPECTS.includes(aspect)) throw new Error('No premium template for this size yet');
  const f = factsOf(plan, brief, assets);
  const r = mulberry(hash(`${f.name}|${salt}`));
  const prev = readPremium(previous)?.block;
  let options = PREMIUM_BLOCKS.filter((k) => BLOCKS[k].fits(f));
  if (options.length > 1 && prev) options = options.filter((k) => k !== prev);
  if (!options.length) throw new Error('No premium template fits these details');
  const block = options[Math.floor(r() * options.length)];
  const vars = BLOCKS[block].fill(f, r);
  return { html: premiumHtml({ block, vars }), block, duration: BLOCKS[block].meta.duration };
}

/** Change slots by hand (used by edits): returns a new page with the same template. */
export function premiumWithVars(html, patch = {}) {
  const d = readPremium(html); if (!d) return null;
  return premiumHtml({ block: d.block, vars: { ...d.vars, ...patch } });
}

/**
 * Plain-words change to a premium film: the AI (when on) rewrites only the words in the slots; pictures and the logo stay.
 * Returns { html, summary } or null when nothing changed.
 */
export async function premiumEdit({ html, instruction, useAi }) {
  const d = readPremium(html); if (!d) return null;
  const isText = (k, v) => typeof v === 'string' && !/^(data:|https?:|\/)/.test(v) && !/Image|Logo|logo/.test(k);
  const words = Object.fromEntries(Object.entries(d.vars).filter(([k, v]) => isText(k, v)));
  if (useAi) {
    const { geminiGenerate } = await import('../../engine/gemini.js');
    const { text } = await geminiGenerate({
      system: 'You edit the words of a short video ad for a small business. The words are JSON slots (slot name -> text). Change only what the owner asks for, keep every slot name, keep each text about as long as it was (these sit in fixed places on screen), and never invent prices, phone numbers, addresses or claims. A "|" inside a text is a line break; keep it where it makes sense. Return JSON: { "slots": { only the slots you changed }, "summary": "one short friendly sentence of what you changed" }.',
      messages: [{ role: 'user', text: `SLOTS: ${JSON.stringify(words)}\n\nCHANGE: ${instruction}` }],
      temperature: 0.4, maxOutputTokens: 3000, json: true, timeoutMs: 45000, thinking: 'low',
    });
    const o = JSON.parse(String(text).match(/\{[\s\S]*\}/)[0]);
    const patch = Object.fromEntries(Object.entries(o.slots || {}).filter(([k, v]) => k in words && typeof v === 'string' && v.trim()).map(([k, v]) => [k, clean(v, Math.max(20, words[k].length * 2))]));
    if (!Object.keys(patch).length) return null;
    return { html: premiumHtml({ block: d.block, vars: { ...d.vars, ...patch } }), summary: clean(o.summary, 200) || 'Done! Check the video.' };
  }
  return null;
}
