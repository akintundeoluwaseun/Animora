const BIRTHDAY_RE = /\b(?:birthday|b-?day)\b/i;
const FAMILY_RE = /\b(?:my|our|his|her|their)\s+(?:brother|sister|mum|mom|mother|dad|father|friend|partner|husband|wife|son|daughter|cousin|uncle|aunt|grandma|grandmother|grandpa|grandfather|child|parent|sibling)\b/i;
const TURNING_RE = /\b(?:turning|turns|turned|celebrating)\s+(?:the\s+)?(?:\d{1,2}(?:st|nd|rd|th)?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty)\b/i;

const values = (value) => Array.isArray(value) ? value : value == null ? [] : [value];

/**
 * Recognize a personal birthday even in legacy projects whose kind/category was saved incorrectly.
 * Avoid treating a business's birthday-cake sale as a personal greeting unless personal intent is explicit.
 */
export function isPersonalBirthdayBrief(brief = {}, plan = {}) {
  const scenes = (plan.scenes || []).flatMap((scene) => [
    ...values(scene?.on_screen_text), scene?.voiceover,
  ]);
  const text = [
    brief.category, brief.name, brief.goal, brief.headline, ...values(brief.headlines),
    brief.pasteText, brief.extra, plan.title, plan.business?.category, plan.business?.name, ...scenes,
  ].filter(Boolean).join(' ');
  if (!BIRTHDAY_RE.test(text)) return false;

  const category = String(brief.category || '').trim();
  const explicitCategory = /^(?:personal\s+)?birthday(?:\s+(?:greeting|video|film))?$/i.test(category);
  const personalDetails = !!(brief.relationship || brief.milestone || brief.personalMessage || (brief.memories || []).length);
  const familyContext = FAMILY_RE.test(text);
  const ageContext = TURNING_RE.test(text) && BIRTHDAY_RE.test(text);
  const greetingContext = /\b(?:happy\s+birthday|birthday\s+(?:video|film|greeting|message|wishes?)\s+(?:for|to)\s+(?:my|our|his|her|their)\b)/i.test(text);

  return brief.kind === 'personal' || explicitCategory || personalDetails || familyContext || ageContext || greetingContext;
}

/** Birthday projects may render only photos explicitly selected in the birthday brief; old logos/products stay out. */
export function birthdayPhotoAssets(assets = [], brief = {}) {
  const selected = new Set(values(brief.personalPhotoIds).map(String));
  if (!selected.size) return [];
  return assets.filter((asset) => asset.kind === 'image'
    && asset.role !== 'logo'
    && !/logo/i.test(asset.name || '')
    && selected.has(String(asset.id)));
}

/** Tell regeneration whether an apparently birthday project still contains a stale commercial plan. */
export function needsBirthdayPlanRepair(brief = {}, plan = {}, repairedBrief = {}) {
  const business = plan.business || {};
  const sceneCopy = (plan.scenes || []).flatMap((scene) => [
    ...values(scene?.on_screen_text), scene?.voiceover,
  ]).filter(Boolean).join(' ');
  const commercialPlan = !/birthday|celebration|personal/i.test(business.category || '')
    || (!!business.name && !!repairedBrief.name && business.name.trim().toLowerCase() !== repairedBrief.name.trim().toLowerCase())
    || !!(business.phone || business.contact || business.address || business.location || business.handle || business.website)
    || !!(business.products?.length || business.features?.length || plan.products?.length || plan.features?.length)
    || /\b(?:contact us|call now|order now|book now|visit our|shop now|download the app|prices from|buy now)\b/i.test(`${plan.cta || ''} ${sceneCopy}`);
  const commercialBrief = brief.kind !== 'personal' || !/^birthday$/i.test(brief.category || '')
    || !!(brief.contact || brief.cta || brief.payment || brief.products?.length || brief.features?.length);
  return commercialPlan || commercialBrief;
}
