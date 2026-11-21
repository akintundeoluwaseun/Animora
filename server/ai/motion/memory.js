// Creative memory: what Animora's recent films were like (opening, ending, composition, transitions, look, arrangement),
// newest first, so the next film steers away from the same combination. It lives in this process; callers that have
// a database can pass in the signatures of recent stored films instead (see loadRecentSignatures in routes/projects.js),
// which also covers other server processes.
const RING = [];
export const remember = (sig) => { if (sig && sig.opening) { RING.unshift(sig); RING.length = Math.min(RING.length, 12); } };
export const recall = () => RING.slice();
export const forget = () => { RING.length = 0; };
