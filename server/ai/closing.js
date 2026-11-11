// What a video ends on. A shop advert can say "Visit our store"; a birthday, a wedding or a tribute never should.
// Used by the brief, the Pieces engine and the question flow so every part agrees.
const PERSONAL = /birthday|b-?day|anniversary|wedding|engagement|bridal|tribute|memorial|in memory|funeral|graduat|congrat|baby|naming|thank ?you|valentine|christmas|easter|eid|ramadan|new year|mother|father|mum|mom|dad|brother|sister|friend|love|celebrat|proposal|retire|promotion|farewell|welcome home/i;
// shop-style calls to action
export const SALES_CTA = /\b(visit|call|whats\s?app|order|buy|shop|store|website|web\s?site|dm\b|download|book(?:\s+now)?|contact|follow|subscribe|click|sign\s?up|get yours|our number)\b/i;
const PHONE = /(\+?\d[\d\s-]{7,}\d)/, SITE = /https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|ng|app|io|co|org|net|store|shop|site|online)\b/i;

/** 'business' | 'cause' | 'social' (birthdays, weddings, events, tributes, announcements: nothing is being sold) */
export function videoGroup(b = {}) {
  const c = `${b.category || ''} ${b.name || ''}`;
  if (b.kind === 'cause') return 'cause';
  if (b.kind === 'business') return 'business';
  if (b.kind === 'personal' || b.kind === 'event' || b.kind === 'announcement') return 'social';
  if (PERSONAL.test(c) && !/planner|studio|shop|store|boutique|bakery|cakes?\b|catering|rentals?|hire|photograph|decor|designer|salon|services?\b/i.test(c)) return 'social';
  return 'business';
}

/** The closing line to use when nobody wrote one. */
export function closingLine(b = {}) {
  const c = `${b.category || ''} ${b.name || ''}`.toLowerCase(), g = videoGroup(b);
  if (g === 'cause') return 'Donate today';
  if (g === 'business') return 'Order now';
  if (/birthday|b-?day/.test(c)) return 'Happy birthday!';
  if (/anniversary/.test(c)) return 'Happy anniversary!';
  if (/wedding|engagement|bridal/.test(c)) return 'See you there';
  if (/graduat/.test(c)) return 'Congratulations!';
  if (/tribute|memorial|in memory|funeral/.test(c)) return 'Forever in our hearts';
  if (b.kind === 'event' || b.kind === 'announcement') return 'You are invited';
  return 'With love';
}

/** Drop shop-style calls to action that do not belong: never on personal videos, and on events only when the contact they point to was given. */
export function fitCtas(b = {}) {
  const list = [].concat(b.ctas || (b.cta ? [b.cta] : [])).filter(Boolean);
  if (videoGroup(b) !== 'social') return list;
  const contact = String(b.contact || '');
  const personal = b.kind === 'personal' || PERSONAL.test(`${b.category || ''} ${b.name || ''}`);
  return list.filter((x) => {
    if (!SALES_CTA.test(x)) return true;
    if (personal && b.kind !== 'event') return false;
    if (/call|whats\s?app|number|dm\b/i.test(x)) return PHONE.test(contact);
    if (/website|web\s?site|click|sign\s?up/i.test(x)) return SITE.test(contact);
    if (/store|visit|shop/i.test(x)) return !!contact.replace(PHONE, '').replace(SITE, '').trim();
    return false;
  });
}

/** The options offered for "What should people do after watching?" */
export function ctaOptions(b = {}) {
  const c = `${b.category || ''} ${b.name || ''}`.toLowerCase(), g = videoGroup(b);
  if (g === 'business') return null;   // the shop list stays
  if (g === 'cause') return null;
  if (/birthday|b-?day/.test(c)) return ['Happy birthday!', 'Many happy returns', 'Cheers to you', 'Love you', 'Celebrate with us'];
  if (/anniversary/.test(c)) return ['Happy anniversary!', 'Here is to many more', 'Love you', 'Celebrate with us'];
  if (/wedding|engagement|bridal/.test(c)) return ['See you there', 'Save the date', 'RSVP', 'Join us', 'Celebrate with us'];
  if (/graduat/.test(c)) return ['Congratulations!', 'So proud of you', 'Celebrate with us'];
  if (/tribute|memorial|in memory|funeral/.test(c)) return ['Forever in our hearts', 'Rest in peace', 'Gone but not forgotten'];
  if (b.kind === 'event' || b.kind === 'announcement' || /church|ministry|conference|programme|program|service|concert|party/.test(c)) return ['Join us', 'You are invited', 'Save the date', 'RSVP', 'See you there'];
  return ['Thank you', 'With love', 'Share this', 'Celebrate with us'];
}
