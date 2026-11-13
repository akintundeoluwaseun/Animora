// Creative direction: read what the piece is ABOUT and decide how it should feel, before anything is drawn.
// One decision (the "direction") feeds the visual style, the film's storytelling angle and the flyer's composition,
// so a perfume, a church night and a school notice are never the same piece in different colours.
import { MEMORIAL } from './closing.js';

// id -> how to recognise it, which visual styles suit it (ranked), which film angles suit it, which flyer layouts suit it
export const DIRECTIONS = [
  { id: 'memorial', re: MEMORIAL, styles: ['mono-editorial', 'graphite-pro', 'prime-estate'], angles: ['calm'], layouts: ['invite'],
    concept: 'Dignified and quiet: few words, long holds, no decoration.' },
  { id: 'faith', re: /church|ministry|fellowship|worship|christian|mosque|islam|prayer|gospel|crusade|revival|assembly|thanksgiving service|choir/i, styles: ['glory-light', 'gold-luxe', 'ocean-breeze', 'prime-estate'], angles: ['calm', 'story', 'photos'], layouts: ['invite', 'poster', 'event'],
    concept: 'Reverent and warm: light and rest, time and place clear, nothing loud.' },
  { id: 'luxury', avoid: ['search','notif','toggles','swap','chat','receipt','phone','button','countdown','ring','stat'], re: /luxur|perfume|fragrance|\boud\b|jewel|watch(?:es)?\b|couture|bespoke|premium|high.?end|designer|diamond|signature collection|haute/i, styles: ['gold-luxe'], alts: ['graphite-pro', 'mono-editorial', 'studio-white'], angles: ['calm', 'clean', 'story'], layouts: ['poster', 'photo', 'invite'],
    concept: 'Restraint: dark stage, one serif voice, space around the product, almost no copy.' },
  { id: 'wedding', re: /wedding|engagement|bridal|traditional marriage|white wedding|save the date/i, styles: ['gold-luxe', 'beauty-bloom', 'glory-light', 'mono-editorial'], angles: ['calm', 'story', 'photos'], layouts: ['invite', 'photo', 'poster'],
    concept: 'Romantic and unhurried: serif type, soft light, their photos first.' },
  { id: 'birthday', re: /birthday|b-?day|anniversary|celebrat|owambe|milestone/i, styles: ['owambe-party', 'retro-pop', 'neon-nights', 'fresh-market'], angles: ['loud', 'photos', 'type'], layouts: ['poster', 'photo', 'collage', 'event'],
    concept: 'Joyful and personal: big friendly type, their photo, one burst of colour.' },
  { id: 'music', re: /concert|festival|\bdj\b|album|\bgig\b|live band|nightlife|night club|\bclub\b|afrobeat|amapiano|rave|comedy night|karaoke|listening party/i, styles: ['neon-nights', 'street-hype', 'sports-blitz', 'owambe-party'], angles: ['loud', 'type'], layouts: ['poster', 'diagonal', 'photo', 'event'],
    concept: 'Loud and kinetic: condensed type, hard contrast, the artist or crowd big.' },
  { id: 'corporate', avoid: ['notif','chat','receipt','search','swap','countdown'], re: /corporate|summit|conference|expo\b|seminar|forum|symposium|webinar|\bagm\b|investor|networking|leadership|masterclass|workshop|business event|b2b|tech event|hackathon/i, styles: ['clean-pro', 'graphite-pro', 'fintech-blue', 'mono-editorial'], angles: ['clean', 'type', 'story'], layouts: ['event', 'blocks', 'services', 'poster'],
    concept: 'Clear and credible: grid, one accent, sans type, details easy to scan.' },
  { id: 'realestate', avoid: ['notif','chat','search','swap','toggles','receipt'], re: /real ?estate|property|apartment|duplex|\bland\b|estate|house for|housing|rent(?:al)?s?\b|for sale|lease|mortgage/i, styles: ['prime-estate', 'graphite-pro', 'gold-luxe'], angles: ['photos', 'clean', 'calm'], layouts: ['photo', 'diagonal', 'services', 'poster'],
    concept: 'Aspirational and factual: the building first, price and place readable at a glance.' },
  { id: 'restaurant', avoid: ['toggles','swap','chat','phone'], re: /restaurant|kitchen|\bcafe\b|eatery|bukka|buka|canteen|grill|suya|catering|\bbar\b|lounge|food|meal|menu|chop|bistro|pizza|burger/i, styles: ['naija-bold', 'retro-pop', 'fresh-market'], angles: ['photos', 'loud', 'story'], layouts: ['menu', 'photo', 'price', 'collage'],
    concept: 'Appetite first: warm colour, the food big, the offer and how to order obvious.' },
  { id: 'bakery', re: /bak(?:ery|ing|er)|cakes?\b|pastr|dessert|cupcake|ice ?cream|confection/i, styles: ['fresh-market', 'beauty-bloom', 'retro-pop'], angles: ['photos', 'type', 'clean'], layouts: ['photo', 'price', 'collage', 'poster'],
    concept: 'Sweet and light: soft colour, rounded type, the product close up.' },
  { id: 'education', avoid: ['notif','chat','receipt','search','swap','toggles'], re: /school|college|universit|academy|nursery|tutorial|lesson|admission|resum(?:es|ption)|exam|graduat|convocation|scholarship|class(?:es)?\b/i, styles: ['clean-pro', 'ocean-breeze', 'studio-white', 'kiddies-fun'], angles: ['clean', 'type', 'story'], layouts: ['blocks', 'event', 'poster'],
    concept: 'Trustworthy and clear: light stage, plain type, dates impossible to miss.' },
  { id: 'kids', re: /kid|children|toddler|baby|playground|daycare/i, styles: ['kiddies-fun', 'fresh-market', 'ocean-breeze'], angles: ['loud', 'photos'], layouts: ['poster', 'photo', 'collage'], concept: 'Playful and bright.' },
  { id: 'sports', re: /sport|football|gym|fitness|training|marathon|tournament|match day/i, styles: ['sports-blitz', 'street-hype', 'neon-nights'], angles: ['loud', 'type'], layouts: ['diagonal', 'poster', 'photo'], concept: 'Fast and strong.' },
  { id: 'fashion', avoid: ['toggles','swap','chat','phone'], re: /fashion|cloth|wear|boutique|ankara|thrift|sneaker|shoes?\b|tailor/i, styles: ['street-hype', 'mono-editorial', 'afro-vibes', 'gold-luxe'], angles: ['photos', 'type', 'loud'], layouts: ['photo', 'collage', 'diagonal', 'poster'], concept: 'Editorial: the look first, type as a caption.' },
  { id: 'beauty', avoid: ['toggles','swap','chat','phone','search'], re: /beauty|salon|hair|\bspa\b|makeup|skincare|lash|nails?\b|barber/i, styles: ['beauty-bloom', 'gold-luxe', 'studio-white'], angles: ['calm', 'photos', 'clean'], layouts: ['photo', 'collage', 'poster'], concept: 'Soft and polished.' },
  { id: 'tech', re: /tech|software|\bapp\b|saas|startup|digital|\bai\b|developer|fintech|crypto|data/i, styles: ['midnight-glow', 'tech-pulse', 'fintech-blue'], angles: ['clean', 'type', 'loud'], layouts: ['poster', 'services', 'blocks'], concept: 'Precise and modern.' },
  { id: 'health', re: /health|clinic|hospital|pharmacy|dental|wellness|doctor|medical/i, styles: ['health-pulse', 'ocean-breeze', 'clean-pro'], angles: ['clean', 'calm', 'story'], layouts: ['services', 'blocks', 'poster'], concept: 'Calm and reassuring.' },
  { id: 'announcement', re: /announc|notice|resum|holiday|closure|update|reminder|new hours|opening hours/i, styles: ['studio-white', 'clean-pro', 'mono-editorial', 'midnight-glow'], angles: ['type', 'clean', 'calm'], layouts: ['blocks', 'poster', 'event'], concept: 'Plain and direct: the one thing to know, big.' },
];
const GENERIC = { id: 'general', styles: ['studio-white', 'clean-pro', 'mono-editorial', 'ocean-breeze', 'midnight-glow'], angles: ['type', 'photos', 'clean', 'calm', 'story', 'loud'], layouts: [], concept: 'Clear and simple.' };

export function directionOf(brief = {}) {
  const t = `${brief.category || ''} ${brief.name || ''} ${brief.headline || ''} ${(brief.features || []).join(' ')}`;
  const cat = `${brief.category || ''} ${brief.name || ''}`;
  // the category and name decide first (a "Corporate event" is not a church night because it has "service" in a bullet), the full text breaks ties
  return DIRECTIONS.find((d) => d.re.test(cat)) || DIRECTIONS.find((d) => d.re.test(t)) || GENERIC;
}
