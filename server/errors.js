// What customers see when something breaks: one plain sentence, never the technical reason
// (no Gemini, API keys, limits, GitHub, database or code details). The real reason is still logged.
export const SIMPLE_ERROR = 'Something went wrong. Please try again later.';
const TECHNICAL = /gemini|\bapi\b|api key|\bkey\b|token|quota|usage limit|\b4\d\d\b|\b5\d\d\b|github|supabase|vercel|\bsql\b|postgres|database|econn|fetch failed|timed? ?out|timeout|undefined|null|stack|json|ffmpeg|puppeteer|chrome|internal|exception|cannot read|is not a function|gh_|resource_exhausted|abort|model|server error|env\b|config/i;
export const publicMessage = (m) => (!m || TECHNICAL.test(String(m)) ? SIMPLE_ERROR : String(m));
