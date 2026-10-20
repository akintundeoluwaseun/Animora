// Animora Motion: the premium video engine (Apple-style product films) for every video size.
//   data  = { W, H, seed, brand, logo, font, accent, beats:[{ type, dur, bg, out, ...props }] }
//   html  = motionHtml(data)         one self-contained page with a paused window.__timeline and window.__sfx
//   plan  = composeMotion(...)       rule-based storyboard (always works)
//   AI    = directMotion(...)        Gemini directs; falls back to composeMotion
export { motionHtml, isMotion, readMotion, MOTION_FONTS } from './page.js';
export { composeMotion, MOTION_WANTS, MOTION_TYPES, BEAT_MIN, BEAT_MAX } from './compose.js';
export { directMotion, motionEdit, motionOfflineEdit, sanitizeBeats, BEAT_GUIDE, SIZES as MOTION_SIZES } from './director.js';
export const MOTION_ASPECTS = ['9:16', '1:1', '16:9', '4:5'];
