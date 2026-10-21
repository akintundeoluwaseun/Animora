// Builds the Animora Motion Library gallery: one page, hundreds of live demos spelled from the pieces and atoms.
import fs from 'fs';
const R = (f) => fs.readFileSync(f, 'utf8');
const js = ['server/ai/motion/browser/pieces.js', 'server/ai/motion/browser/atoms.js', 'server/ai/motion/browser/pieces2.js', 'server/ai/motion/browser/premium.js', 'server/ai/motion/browser/signature.js'].map(R).join('\n;\n');
const b64 = (f, t) => `data:${t};base64,` + fs.readFileSync(f).toString('base64');
const IMG = Object.fromEntries(['coffee', 'moto', 'rocket', 'cat', 'astro'].map((k) => [k, b64(`mt/lib/${k}.jpg`, 'image/jpeg')]));
const SFX = Object.fromEntries(['chime', 'click', 'pop', 'tick', 'whoosh'].map((k) => [k, b64(`mt/lib/${k}.mp3`, 'audio/mpeg')]));
const LOCAL = process.argv.includes('--local');

const FONTS = [
  ['Playfair Display', 700, 'DM Sans'], ['Space Grotesk', 700, 'Inter'], ['Anton', 400, 'Inter', true], ['Baloo 2', 800, 'Baloo 2'], ['Poppins', 800, 'Poppins'],
  ['Fredoka', 700, 'Nunito'], ['Montserrat', 800, 'Montserrat'], ['Archivo Black', 400, 'Inter'], ['DM Serif Display', 400, 'DM Sans'], ['Oswald', 700, 'Inter', true],
  ['Righteous', 400, 'Nunito'], ['Cinzel', 700, 'Inter', true], ['Bungee', 400, 'Inter', true], ['Figtree', 800, 'Figtree'], ['Syne', 800, 'Inter'], ['Fraunces', 700, 'DM Sans'],
  ['Bricolage Grotesque', 800, 'Inter'], ['Unbounded', 700, 'Inter'], ['Orbitron', 800, 'Inter'], ['Luckiest Guy', 400, 'Nunito'],
];
const PAL = [
  ['Ember', '#E8530E', '#FFC93C', '#15100C', '#FFF3EA'], ['Lagoon', '#0FA3A3', '#FFD166', '#06191B', '#EAF8F7'], ['Royal', '#5B4BFF', '#19D3A2', '#0B0A1A', '#F1F0F8'], ['Saffron', '#F4A300', '#E63946', '#16110A', '#FFF8E8'],
  ['Midnight', '#7C5CFF', '#FF5FA2', '#0A0814', '#F4F1FF'], ['Jade', '#1F8A4C', '#FFB703', '#08140E', '#EEF7F1'], ['Coral', '#FF5A5F', '#FFC2B4', '#1A0D0E', '#FFF1EF'], ['Cobalt', '#1F6FEB', '#7CC4FF', '#06101F', '#EEF4FD'],
  ['Gold', '#D4A24C', '#F3E6CF', '#140F0B', '#F7F0E4'], ['Neon', '#FF2E88', '#21E6FF', '#0A0614', '#FFF0F7'], ['Citrus', '#FFE11A', '#FF3B30', '#0F0F0F', '#FFFBE0'], ['Plum', '#8E3B8C', '#F7B2C4', '#140A13', '#FBF0F7'],
  ['Mint', '#22C3A6', '#5B4BFF', '#07161A', '#ECFAF6'], ['Copper', '#C2662D', '#2EC4B6', '#130C08', '#FBF1EA'], ['Indigo', '#3D3BF3', '#FF9F1C', '#090921', '#EFEFFF'], ['Sunset', '#FF6B35', '#7B2CBF', '#140A10', '#FFF2EC'],
  ['Glacier', '#3EC1F3', '#0B2E6B', '#061220', '#ECF8FE'], ['Cocoa', '#9C6644', '#E6CCB2', '#120D09', '#F8F1EA'], ['Kente', '#E07A1F', '#1F8A3B', '#1B120B', '#FBF2E7'], ['Rose', '#E83E8C', '#FFD6E7', '#170A11', '#FFF0F6'],
  ['Forest', '#2D6A4F', '#B7E4C7', '#08130E', '#EEF6F1'], ['Lava', '#E5383B', '#FFBA08', '#130909', '#FFF0EE'], ['Ocean', '#0077B6', '#90E0EF', '#03111C', '#EAF6FC'], ['Lime', '#84CC16', '#0F172A', '#0B1206', '#F4FBE7'],
];
const BIZ = [
  { name: 'Kofi House', mono: 'K', kicker: 'Lekki · Since 2019', headline: 'Coffee that|wakes up Lekki', key: 'Lekki', sub: 'Fresh roast, pastries and fast Wi-Fi from 7am.', words: ['Fresh', 'Hot', 'Fast'], lead: 'Your coffee,', price: '₦2,500', old: '₦3,500', label: 'Today only', note: 'Any large latte', phone: '0803 555 1234', place: 'Admiralty Way, Lekki', hours: 'Open 7am – 9pm daily', quote: 'Best latte on the island. I come here every single morning.', qname: 'Tolu A.', qrole: 'Regular since 2021', items: ['Roasted this week', 'Hot in 5 minutes', 'Free fast Wi-Fi', 'Pastries till noon'], stat: [4.9, '★', 'average from 2,300 reviews'], date: 'Sat 14 Dec', img: 'coffee', cta: 'Order on WhatsApp' },
  { name: 'Swift Dispatch', mono: 'SD', kicker: 'Same-day delivery', headline: 'Anywhere in Lagos|before 6pm', key: 'Lagos', sub: 'Book a rider in 30 seconds. Track it live.', words: ['Fast', 'Safe', 'Tracked'], lead: 'Delivered', price: '₦1,500', old: '₦2,500', label: 'From', note: 'Within the mainland', phone: '0901 222 3344', place: 'Ikeja, Lagos', hours: 'Riders out 7am – 8pm', quote: 'My parcel got to Ajah in 90 minutes. Unreal.', qname: 'Chidi O.', qrole: 'Online seller', items: ['Pick-up in 30 min', 'Live tracking', 'Insured parcels', 'Pay on delivery'], stat: [12000, '+', 'deliveries this month'], date: 'Every day', img: 'moto', cta: 'Book a rider' },
  { name: 'KudiPay', mono: 'K', kicker: 'Banking, simplified', headline: 'Money moves|at light speed', key: 'speed', sub: 'Free transfers. Instant alerts. Zero wahala.', words: ['Instant', 'Free', 'Secure'], lead: 'Transfers that are', price: '₦0', old: '₦50', label: 'Transfer fee', note: 'To any bank, any time', phone: '0700 123 4000', place: 'Victoria Island, Lagos', hours: 'Support 24/7', quote: 'I moved my whole business to KudiPay. Never looked back.', qname: 'Ngozi E.', qrole: 'Shop owner, Aba', items: ['Free transfers', 'Pay bills in seconds', 'Save at 12% a year', 'Cards that just work'], stat: [12, '%', 'interest a year on savings'], date: 'Launching 1 Nov', img: 'astro', cta: 'Download the app' },
  { name: 'Launchpad Academy', mono: 'LA', kicker: 'Tech careers', headline: 'From zero|to developer', key: 'developer', sub: '16 weeks. Real projects. A job at the end.', words: ['Code', 'Design', 'Data'], lead: 'Learn', price: '₦250,000', old: '₦400,000', label: 'Early bird', note: 'Pay in 3 parts', phone: '0812 345 6789', place: 'Yaba, Lagos', hours: 'Classes start Jan 6', quote: 'I got hired two weeks after demo day.', qname: 'Kunle B.', qrole: 'Frontend developer', items: ['Live mentors', 'Real client projects', 'Job placement', 'Laptop loan'], stat: [87, '%', 'of graduates hired in 3 months'], date: 'Mon 6 Jan', img: 'rocket', cta: 'Apply now' },
  { name: 'Paws & Purr', mono: 'PP', kicker: 'Pet care, Abuja', headline: 'Happy pets,|happy homes', key: 'pets', sub: 'Grooming, food and vet visits in one place.', words: ['Groomed', 'Fed', 'Loved'], lead: 'Keep them', price: '₦8,000', old: '₦12,000', label: 'Full groom', note: 'Bath, cut and nails', phone: '0809 111 2222', place: 'Wuse 2, Abuja', hours: 'Mon – Sat, 9am – 6pm', quote: 'They treat my cat like royalty.', qname: 'Aisha M.', qrole: 'Cat mum', items: ['Gentle grooming', 'Premium pet food', 'Vet on call', 'Home pick-up'], stat: [3500, '+', 'happy pets this year'], date: 'Sat 7 Dec', img: 'cat', cta: 'Book a groom' },
  { name: 'Mama Put Kitchen', mono: 'MP', kicker: 'Home cooking', headline: 'Taste of|real home cooking', key: 'home', sub: 'Jollof, ofada and pepper soup, made fresh daily.', words: ['Hot', 'Fresh', 'Spicy'], lead: 'Food that is', price: '₦3,500', old: '₦5,000', label: 'Combo', note: 'Rice, protein and drink', phone: '0803 777 8888', place: 'Surulere, Lagos', hours: 'Open till 10pm', quote: 'The ofada sauce tastes like my grandma made it.', qname: 'Emeka N.', qrole: 'Customer since 2018', items: ['Cooked fresh daily', 'Home delivery', 'Party trays', 'Open till 10pm'], stat: [50000, '+', 'plates served'], date: 'Every Friday', img: 'coffee', cta: 'Order now' },
  { name: 'Drip Lagos', mono: 'DL', kicker: 'Streetwear', headline: 'New drop|lands Friday', key: 'Friday', sub: 'Limited pieces. First come, first served.', words: ['Bold', 'Fresh', 'Limited'], lead: 'Stay', price: '₦18,000', old: '₦30,000', label: 'Hoodies', note: 'This weekend only', phone: '0901 234 5678', place: 'Lekki Phase 1', hours: 'Online 24/7', quote: 'Every piece sells out. Set your alarm.', qname: '@kemi.styles', qrole: 'Stylist', items: ['Limited runs', 'Free delivery', 'Easy returns', 'Members early access'], stat: [48, 'h', 'to sell out the last drop'], date: 'Fri 20 Dec', img: 'moto', cta: 'Shop the drop' },
  { name: 'Glow Studio', mono: 'GS', kicker: 'Bridal & beauty', headline: 'Bridal glam|that lasts', key: 'glam', sub: 'Makeup, gele and lashes for your big day.', words: ['Flawless', 'Radiant', 'Lasting'], lead: 'Look', price: '₦45,000', old: '₦60,000', label: 'Bridal package', note: 'Trial included', phone: '0816 333 4455', place: 'GRA, Port Harcourt', hours: 'By appointment', quote: 'My makeup survived 12 hours of dancing.', qname: 'Funmi O.', qrole: 'Bride, March 2024', items: ['Home service', 'Long-lasting finish', 'Trial session', 'Gele included'], stat: [600, '+', 'brides glammed'], date: 'Book for 2025', img: 'cat', cta: 'Book now' },
  { name: 'Prime Homes', mono: 'PH', kicker: 'Verified listings', headline: 'Find your|next home', key: 'home', sub: 'Every title checked. Every agent verified.', words: ['Verified', 'Ready', 'Yours'], lead: 'Homes that are', price: '₦4.5m', old: '₦6m', label: '2-bed, Lekki', note: 'Per year', phone: '0817 555 0000', place: 'Ikoyi, Lagos', hours: 'Inspections daily', quote: 'No fake agents, no stories. Moved in within a week.', qname: 'Seyi A.', qrole: 'Tenant', items: ['Verified titles', 'Virtual tours', 'No hidden fees', 'Agents you can trust'], stat: [1200, '+', 'homes listed'], date: 'Open house Sat', img: 'astro', cta: 'Book an inspection' },
  { name: 'Iron Gym', mono: 'IG', kicker: 'Wuse 2, Abuja', headline: 'No excuses|this December', key: 'December', sub: 'Train with certified coaches, 24/7.', words: ['Stronger', 'Faster', 'Fitter'], lead: 'Get', price: '₦15,000', old: '₦25,000', label: 'Monthly', note: 'First week free', phone: '0811 234 5678', place: 'Wuse 2, Abuja', hours: 'Open 24/7', quote: 'Lost 12kg in 3 months with coach Dayo.', qname: 'Bisi K.', qrole: 'Member', items: ['24/7 access', 'Personal coach', 'Free first week', 'Sauna & steam'], stat: [12, 'kg', 'average lost in 90 days'], date: 'Mon 2 Dec', img: 'rocket', cta: 'Join today' },
  { name: 'Afro Fest', mono: 'AF', kicker: 'Live in Lagos', headline: 'The biggest|party of the year', key: 'party', sub: 'Top DJs, live band and free small chops.', words: ['Loud', 'Live', 'Lit'], lead: 'Night is', price: '₦5,000', old: '₦10,000', label: 'Early bird', note: 'Gate ₦10,000', phone: '0812 000 7788', place: 'Eko Hotel, VI', hours: 'Doors open 6pm', quote: 'Last year was madness. Already got my ticket.', qname: 'Dami F.', qrole: 'Party goer', items: ['Top DJs', 'Live band', 'VIP tables', 'Free small chops'], stat: [10000, '+', 'people last year'], date: 'Sat 21 Dec', img: 'rocket', cta: 'Get tickets' },
  { name: 'Green Basket', mono: 'GB', kicker: 'Farm to door', headline: 'Farm fresh|to your door', key: 'fresh', sub: 'Vegetables picked this morning, delivered today.', words: ['Fresh', 'Organic', 'Local'], lead: 'Veggies,', price: '₦6,500', old: '₦9,000', label: 'Weekly box', note: 'Feeds a family of 4', phone: '0705 123 4567', place: 'Ibadan', hours: 'Deliveries Tue & Fri', quote: 'The tomatoes actually taste like tomatoes.', qname: 'Ronke S.', qrole: 'Subscriber', items: ['Picked this morning', 'Same-day delivery', 'Organic farms', 'Fair prices'], stat: [40, '+', 'partner farms'], date: 'Every Tuesday', img: 'coffee', cta: 'Order a box' },
  { name: 'ByteFix', mono: 'B', kicker: 'Repairs in 1 hour', headline: 'Your tech,|fixed fast', key: 'fast', sub: 'Phones, laptops and networks, same day.', words: ['Fixed', 'Fast', 'Guaranteed'], lead: 'Get it', price: '₦9,000', old: '₦15,000', label: 'Screen repair', note: '90-day warranty', phone: '0810 999 0000', place: 'Computer Village, Ikeja', hours: 'Mon – Sat', quote: 'Fixed my MacBook in 40 minutes.', qname: 'Ife J.', qrole: 'Designer', items: ['Screen repair', 'Data recovery', 'Same-day fixes', 'Office networks'], stat: [98, '%', 'fixed on the first visit'], date: 'Walk in today', img: 'astro', cta: 'Chat with us' },
  { name: 'Tiny Toes', mono: 'TT', kicker: 'Kids store', headline: 'Back to school|deals', key: 'school', sub: 'Bags, shoes and uniforms for every class.', words: ['Cute', 'Comfy', 'Cheap'], lead: 'Kids look', price: '₦12,500', old: '₦18,000', label: 'Bag + shoes', note: 'All sizes', phone: '0803 121 2121', place: 'Gbagada, Lagos', hours: 'Open daily 9am – 7pm', quote: 'My twins love their new school bags.', qname: 'Mrs Okafor', qrole: 'Mum of 3', items: ['All sizes', 'Free name tags', 'Easy exchanges', 'Delivery in Lagos'], stat: [5000, '+', 'happy kids'], date: 'Till 10 Jan', img: 'cat', cta: 'Shop now' },
  { name: 'Royal Events', mono: 'RE', kicker: 'Weddings & parties', headline: 'Your day,|done royally', key: 'royally', sub: 'Planning, decor and catering under one roof.', words: ['Elegant', 'Seamless', 'Royal'], lead: 'Celebrate', price: '₦1.2m', old: '₦1.8m', label: 'Full package', note: 'Up to 300 guests', phone: '0802 444 5566', place: 'Ikoyi, Lagos', hours: 'Consultations Mon – Fri', quote: 'Every guest asked who planned our wedding.', qname: 'Tobi & Ada', qrole: 'Married June 2024', items: ['Full planning', 'Decor & lights', 'Catering', 'Day-of coordinator'], stat: [350, '+', 'weddings planned'], date: 'Fully booked May', img: 'coffee', cta: 'Book a consult' },
  { name: 'Sky Travels', mono: 'ST', kicker: 'Holidays & visas', headline: 'Dubai in|December', key: 'Dubai', sub: 'Flights, hotel and visa from one booking.', words: ['Sun', 'Shop', 'Relax'], lead: 'Go', price: '₦1.6m', old: '₦2.1m', label: '5 nights', note: 'Flight + hotel + visa', phone: '0909 777 6655', place: 'Allen Avenue, Ikeja', hours: 'Mon – Sat', quote: 'Visa approved in 4 days. Smoothest trip ever.', qname: 'Bola T.', qrole: 'Traveller', items: ['Visa support', 'Flight + hotel', 'Pay small small', 'Airport pick-up'], stat: [98, '%', 'visa approval rate'], date: 'Departs 20 Dec', img: 'rocket', cta: 'Book my trip' },
];
const ENTERS = ['bars', 'extrude', 'echo', 'chroma', 'slit', 'tilt', 'mirror', 'magnet', 'ink', 'domino', 'ribbon', 'rise', 'flip', 'drop', 'zoom', 'skew', 'type', 'scramble', 'wave', 'elastic', 'focus', 'spin', 'scatter', 'glitch', 'curtain', 'swing', 'track', 'sweep', 'punch', 'pop'];
const LAYOUTS = ['center', 'left', 'lower', 'top', 'right', 'panel', 'band', 'giant', 'stagger', 'ruled'];
const EMPHS = ['marker', 'underline', 'circle', 'color', 'outline', 'gradient', 'glow', 'sticker', 'box', 'sparkle', 'strike'];
const BGS = ['mesh', 'grid', 'spot', 'dots', 'rays', 'plain', 'stripes', 'waves', 'rings', 'bokeh', 'shapes', 'scan', 'halftone', 'sweep', 'aurora', 'topo'];
const CAMS = ['push', 'drift', 'tilt', 'pull'];
const TRANS = ['x-panels', 'x-circles', 'x-glitch', 'x-whip', 'x-liquid', 'x-zoom', 'x-iris', 'x-slice', 'x-cube', 'x-push', 'x-cover', 'x-doors', 'x-diagonal', 'x-blinds', 'x-flash', 'x-stretch', 'x-swing'];
const PIECES = ['open-shapes', 'open-light', 'text-stack', 'end-glass', 'open-depth', 'open-sweep', 'open-split', 'text-cascade', 'text-slot', 'text-marquee', 'photo-depth', 'photo-pop', 'photo-split', 'photo-phone', 'photo-cinema', 'info-price', 'info-checks', 'info-stat', 'info-quote', 'info-tiles', 'info-countdown', 'info-location', 'info-compare', 'end-particles', 'end-press', 'end-draw'];
const FAMILY = { open: 'Openers', text: 'Text', photo: 'Photo', info: 'Info', end: 'Endings' };

const meta = { FONTS, PAL, BIZ, ENTERS, LAYOUTS, EMPHS, BGS, CAMS, TRANS, PIECES };
const fams = [...new Set(FONTS.flatMap((f) => [f[0], f[2]]))];
const fontUrl = 'https://fonts.googleapis.com/css2?' + fams.map((f) => `family=${f.replace(/ /g, '+')}:wght@400;500;600;700;800`).join('&').replace(/(Anton|Archivo\+Black|Righteous|Bungee|Luckiest\+Guy|DM\+Serif\+Display):wght@400;500;600;700;800/g, '$1') + '&display=swap';

const page = `<title>Animora Motion Library</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${fontUrl.replace(/&/g, '&amp;')}">
<style>
/* One dark studio wall of monitors: a dense grid of live 9:16 screens, filter chips on top, a big player on tap. */
:root { --bg:#0B0B0F; --panel:#15151C; --line:#262631; --fg:#F2F1F6; --mute:#9A98A8; --accent:#FF6A3D; --accent2:#7C5CFF; --display:'Bricolage Grotesque','Syne','Inter',system-ui,sans-serif; --ui:'Inter',system-ui,sans-serif; color-scheme:dark; }
* { box-sizing:border-box; }
[hidden] { display:none !important; }
body { margin:0; background:var(--bg); color:var(--fg); font-family:var(--ui); -webkit-font-smoothing:antialiased; }
.wrap { padding-left:max(16px, env(safe-area-inset-left, 0px)); padding-right:max(16px, env(safe-area-inset-right, 0px)); padding-block:28px 60px; max-width:1500px; margin:0 auto; }
header.top { display:flex; flex-wrap:wrap; align-items:flex-end; justify-content:space-between; gap:16px 28px; }
h1 { font-family:var(--display); font-weight:800; font-size:clamp(30px, 5vw, 56px); line-height:.95; letter-spacing:-.035em; margin:0; text-wrap:balance; }
h1 em { font-style:normal; color:var(--accent); }
.lede { color:var(--mute); max-width:62ch; line-height:1.5; margin:10px 0 0; font-size:15px; }
.count { font-variant-numeric:tabular-nums; font-family:var(--display); font-size:clamp(40px, 6vw, 72px); font-weight:800; letter-spacing:-.04em; line-height:.9; text-align:right; }
.count small { display:block; font-family:var(--ui); font-size:12px; font-weight:600; letter-spacing:.14em; text-transform:uppercase; color:var(--mute); margin-top:6px; }
.bar { position:sticky; top:env(safe-area-inset-top, 0px); z-index:20; background:color-mix(in srgb, var(--bg) 88%, transparent); backdrop-filter:blur(14px); margin:22px 0 18px; padding:12px 0; border-bottom:1px solid var(--line); display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
body::before { content:""; position:fixed; inset:0 0 auto; height:env(safe-area-inset-top, 0px); z-index:30; background:var(--bg); }
.chip { appearance:none; border:1px solid var(--line); background:var(--panel); color:var(--fg); font:600 13px/1 var(--ui); padding:9px 13px; border-radius:999px; cursor:pointer; }
.chip[aria-pressed="true"] { background:var(--fg); color:var(--bg); border-color:var(--fg); }
.chip:focus-visible, .card:focus-visible, button:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
.chip b { font-variant-numeric:tabular-nums; opacity:.55; margin-left:5px; font-weight:600; }
.spacer { flex:1; }
.sound { border-color:color-mix(in srgb, var(--accent) 55%, var(--line)); }
.grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(150px, 1fr)); gap:14px; grid-auto-flow:dense; align-items:start; }
@media (min-width:900px) { .grid { grid-template-columns:repeat(auto-fill, minmax(180px, 1fr)); } }
.studio { display:grid; grid-template-columns:minmax(0, 1fr) minmax(280px, 380px); gap:22px; margin:26px 0 8px; padding:18px; border:1px solid var(--line); border-radius:18px; background:linear-gradient(180deg, #121219, #0E0E13); }
.studio h2 { grid-column:1 / -1; margin:0; font-family:var(--display); font-size:clamp(22px, 3vw, 30px); letter-spacing:-.03em; display:flex; align-items:baseline; gap:12px; flex-wrap:wrap; }
.studio h2 small { font:500 13px var(--ui); color:var(--mute); letter-spacing:0; }
.sview { display:flex; align-items:center; justify-content:center; min-height:360px; background:#060608; border-radius:14px; padding:12px; }
.sstage { position:relative; overflow:hidden; border-radius:10px; background:#000; height:min(64vh, 620px); max-width:100%; }
.sstage.land { height:auto; width:100%; }
.sform { display:flex; flex-direction:column; gap:12px; min-width:0; }
.sform label, .sform .lbl { display:flex; flex-direction:column; gap:6px; font:600 11.5px var(--ui); letter-spacing:.1em; text-transform:uppercase; color:var(--mute); }
.sform input, .sform select { font:500 14px var(--ui); color:var(--fg); background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:10px 12px; min-width:0; width:100%; }
.seg { display:flex; flex-wrap:wrap; gap:6px; }
.seg button { appearance:none; flex:1 1 auto; border:1px solid var(--line); background:var(--panel); color:var(--fg); font:600 13px var(--ui); padding:8px 10px; border-radius:9px; cursor:pointer; text-transform:none; letter-spacing:0; }
.seg button[aria-pressed="true"] { background:var(--fg); color:var(--bg); border-color:var(--fg); }
.tgrid { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:6px; }
.tgrid button { text-align:left; padding:9px 10px; }
.tgrid button small { display:block; font:500 11px var(--ui); opacity:.6; margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.sw { display:flex; flex-wrap:wrap; gap:6px; }
.sw button { width:30px; height:30px; border-radius:50%; border:2px solid transparent; cursor:pointer; padding:0; }
.sw button[aria-pressed="true"] { border-color:var(--fg); box-shadow:0 0 0 2px var(--bg) inset; }
.sw button.def { width:auto; padding:0 10px; border-radius:999px; background:var(--panel); color:var(--fg); font:600 12px var(--ui); border-color:var(--line); }
.sw button.def[aria-pressed="true"] { border-color:var(--fg); }
.two { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
.sbar { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
.sbar .scrub { flex:1; min-width:120px; accent-color:var(--accent); }
.note { font-size:12px; color:var(--mute); line-height:1.5; margin:0; }
@media (max-width:860px) { .studio { grid-template-columns:1fr; padding:14px; } .studio > div:first-of-type { position:sticky; top:0; z-index:6; background:#0E0E13; padding-bottom:8px; } .sview { min-height:0; } .sstage { height:40vh; } }
.card.wide { grid-column:span 2; }
.card { position:relative; display:flex; flex-direction:column; gap:7px; cursor:pointer; min-width:0; border:0; padding:0; background:none; color:inherit; text-align:left; }
.screen { position:relative; width:100%; aspect-ratio:9/16; max-width:100%; border-radius:12px; overflow:hidden; background:#000; box-shadow:0 0 0 1px var(--line); }
.screen .poster { position:absolute; inset:0; display:grid; place-items:center; color:#3a3946; font:700 11px var(--ui); letter-spacing:.2em; text-transform:uppercase; }
.scaler { position:absolute; left:0; top:0; transform-origin:0 0; }
.meta { display:flex; flex-direction:column; gap:2px; min-width:0; }
.meta b { font-size:13px; font-weight:700; letter-spacing:-.01em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.meta span { font-size:11px; color:var(--mute); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.num { position:absolute; left:8px; top:8px; z-index:2; font:700 10px var(--ui); letter-spacing:.06em; padding:3px 6px; border-radius:6px; background:rgba(0,0,0,.55); color:#fff; font-variant-numeric:tabular-nums; }
.player { position:fixed; inset:0; z-index:50; background:rgba(5,5,8,.92); display:flex; align-items:center; justify-content:center; gap:28px; padding:max(16px, env(safe-area-inset-top, 0px)) max(16px, env(safe-area-inset-right, 0px)) max(16px, env(safe-area-inset-bottom, 0px)) max(16px, env(safe-area-inset-left, 0px)); flex-wrap:wrap; }
.player .big.land { height:auto; width:min(92vw, 1100px); }
.player .big { position:relative; height:min(78vh, 760px); aspect-ratio:9/16; max-width:100%; border-radius:18px; overflow:hidden; background:#000; box-shadow:0 30px 80px rgba(0,0,0,.6); }
.player aside { width:min(320px, 100%); display:flex; flex-direction:column; gap:12px; }
.player h2 { font-family:var(--display); font-size:34px; line-height:1; letter-spacing:-.03em; margin:0; }
.player dl { margin:0; display:grid; grid-template-columns:auto 1fr; gap:6px 14px; font-size:13px; }
.player dt { color:var(--mute); } .player dd { margin:0; font-weight:600; }
.row { display:flex; gap:8px; flex-wrap:wrap; }
.btn { appearance:none; border:0; border-radius:999px; padding:11px 16px; font:700 14px var(--ui); cursor:pointer; background:var(--fg); color:var(--bg); }
.btn.ghost { background:var(--panel); color:var(--fg); border:1px solid var(--line); }
.foot { color:var(--mute); font-size:12.5px; margin-top:26px; line-height:1.6; max-width:80ch; }
@media (max-width:640px) { .player { align-content:center; } .player .big { height:62vh; } .player aside { width:100%; } }
@media (prefers-reduced-motion: reduce) { .card .screen { animation:none; } }
</style>
<div class="wrap">
  <header class="top">
    <div>
      <h1>Animora <em>Motion</em> Library</h1>
      <p class="lede">Every screen below is live and built from the same parts the video maker uses. It opens with eight signature templates (kinetic type, luxury product, HUD, liquid chrome, sports hype, Swiss editorial, music visualizer and cinematic logo) that work at 9:16, 16:9 and 1:1 and 6, 15 or 30 seconds. Under them are 27 scene pieces, 30 text entrances, 10 layouts, 11 highlight styles, 9 shape accents, 16 backgrounds, 18 transitions, 24 colour sets and 20 font pairs. Tap any screen to play it big with sound.</p>
    </div>
    <div class="count" id="count">0<small>live demos</small></div>
  </header>
  <section class="studio" id="studio" aria-label="Template studio">
    <h2>Template studio <small>Pick a signature template, type your words, and it rebuilds live. Each Shuffle gives a different cut.</small></h2>
    <div>
      <div class="sview"><div class="sstage" id="sStage"></div></div>
      <div class="sbar" style="margin-top:10px"><button class="btn" id="sPlay" type="button">Pause</button><input class="scrub" id="sScrub" type="range" min="0" max="1000" value="0" aria-label="Scrub"><button class="btn ghost" id="sShuffle" type="button">Shuffle</button><button class="btn ghost" id="sCopy" type="button">Copy brief</button></div>
    </div>
    <div class="sform">
      <div class="lbl" role="group" aria-label="Template">Template<div class="seg tgrid" id="sTpl"></div></div>
      <div class="two"><label>Brand<input id="sBrand" value="Kofi House"></label><label>Call to action<input id="sCta" value="Order on WhatsApp"></label></div>
      <label>Headline (use | for a new line)<input id="sHead" value="Coffee that|wakes up Lekki"></label>
      <label>Supporting line<input id="sSub" value="Fresh roast from 7am"></label>
      <div class="lbl" role="group" aria-label="Length">Length<div class="seg" id="sDur"></div></div>
      <div class="lbl" role="group" aria-label="Size">Size<div class="seg" id="sAsp"></div></div>
      <div class="lbl" role="group" aria-label="Colours">Colours<div class="sw" id="sPal"></div></div>
      <div class="lbl" role="group" aria-label="Motion">Motion<div class="seg" id="sInt"></div></div>
      <div class="two"><label>Sound<select id="sSnd"><option value="">Template default</option><option value="beat">Beat-synced</option><option value="cinematic">Cinematic</option><option value="ambient">Ambient</option><option value="none">None</option></select></label>
      <label>Quality<select id="sQ"><option value="preview">Fast preview</option><option value="premium" selected>Premium</option><option value="max">Maximum detail</option></select></label></div>
      <div class="lbl" role="group" aria-label="Photo">Photo<div class="seg" id="sImg"></div></div>
      <p class="note">Sound uses Animora's own soft library. The visualizer moves to a fixed beat (a set tempo), not to analysis of a song.</p>
    </div>
  </section>
  <nav class="bar" aria-label="Filter demos" id="bar"></nav>
  <main class="grid" id="grid"></main>
  <p class="foot">Sounds come from Animora's own library (whoosh, pop, tick, chime, click), kept soft. Photos are sample pictures; the video maker uses each business's own photos. Every demo is built from a seed, so the same business gets the same video and Regenerate gives a new one.</p>
</div>
<div class="player" id="player" hidden role="dialog" aria-modal="true" aria-label="Demo player">
  <div class="big" id="big"></div>
  <aside>
    <h2 id="pTitle"></h2>
    <dl id="pMeta"></dl>
    <div class="row"><button class="btn" id="pSound" type="button">Sound on</button><button class="btn ghost" id="pReplay" type="button">Replay</button><button class="btn ghost" id="pNext" type="button">Next</button><button class="btn ghost" id="pClose" type="button">Close</button></div>
  </aside>
</div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
<script>${js.replace(/<\/script/g, '<\\/script')}</script>
<script>
const M = ${JSON.stringify(meta)};
const IMG = ${JSON.stringify(IMG)};
const SFX = ${JSON.stringify(SFX)};
const FAMILY = ${JSON.stringify(FAMILY)};
const LBL = { bars: 'Bar Reveal', extrude: '3D Extrude', echo: 'Echo Stack', chroma: 'Chroma Slam', slit: 'Slit Reveal', tilt: '3D Tilt', type: 'Typewriter', focus: 'Focus Pull', track: 'Tracking', sweep: 'Light Reveal', curtain: 'Curtain' };
const cap = (s) => LBL[s] || (s.charAt(0).toUpperCase() + s.slice(1));
const lumH = (h) => { const n = parseInt(h.slice(1), 16); const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const safeKind = (kind, pi) => (kind === 'light' && lumH(M.PAL[pi % 24][1]) > 0.4 ? 'dark' : kind);
const look = (pi, fi, dark) => { const p = M.PAL[pi % M.PAL.length], f = M.FONTS[fi % M.FONTS.length]; const q = (x) => "'" + x + "', 'Inter', system-ui, sans-serif"; return { display: q(f[0]), dw: f[1], ui: q(f[2]), upper: !!f[3], A: p[1], A2: p[2], bg: p[3], bgLight: p[4], dark }; };
function dataFor(piece, b) {
  const img = IMG[b.img];
  const [lead, w2] = b.headline.split('|');
  return ({
    'open-depth': { headline: b.headline, words: b.items, sub: b.name },
    'open-sweep': { headline: b.name, sub: b.kicker },
    'open-split': { headline: (b.words[0] + '|' + b.words[1]), sub: b.name },
    'text-cascade': { headline: b.headline, key: b.key, sub: b.sub },
    'text-slot': { lead: b.lead, words: b.words },
    'text-marquee': { words: b.words.map((w) => w.toUpperCase()), brand: b.name },
    'photo-depth': { img, tag: b.kicker, headline: b.sub.split('.')[0] },
    'photo-pop': { img, focus: '50% 55%', callouts: [b.items[0], b.items[1], b.label + ' ' + b.price] },
    'photo-split': { img, headline: b.headline.replace('|', ' ') },
    'photo-phone': { img, headline: b.headline.replace('|', ' '), title: b.name, subtitle: b.kicker, price: b.price, cta: b.cta.split(' ')[0] },
    'photo-cinema': { img, kicker: b.kicker, headline: b.headline.replace('|', ' ') },
    'info-price': { label: b.label, old: b.old, price: b.price, note: b.note },
    'info-checks': { headline: 'Why people choose ' + b.name, items: b.items },
    'info-stat': { value: String(b.stat[0]), suffix: b.stat[1], label: b.stat[2] },
    'info-quote': { quote: b.quote, name: b.qname, role: b.qrole },
    'info-tiles': { headline: b.name + ' gives you', items: b.items },
    'info-countdown': { kicker: 'Starts in', date: b.date },
    'info-location': { kicker: 'Find us', place: b.place, hours: b.hours },
    'info-compare': { headline: 'Pay less with ' + b.name, them: 'Others', themPrice: b.old, us: b.name, usPrice: b.price, ratio: 0.62, save: 'Best price in town' },
    'end-particles': { mono: b.mono, name: b.name, tagline: b.place },
    'end-press': { headline: b.sub.split('.')[0] + '.', cta: b.cta, phone: b.phone, where: b.name + ' · ' + b.place },
    'end-draw': { mono: b.mono, name: b.name, tagline: b.kicker },
    'open-shapes': { headline: b.name, sub: b.kicker },
    'open-light': { headline: b.name, sub: b.kicker },
    'text-stack': { word: b.words[0], tag: b.name },
    'end-glass': { name: b.name, line: b.sub.split('.')[0], cta: b.cta, phone: b.phone },
  })[piece] || {};
}
const titleData = (b, o) => ({ kicker: b.kicker, headline: b.headline, key: b.key, sub: b.sub, opts: o });
// ---- the demo list: title styles, scene pieces, transitions
const DEMOS = [];
const kinds = ['dark', 'light', 'brand'];
for (let i = 0; i < 600; i++) {          // 600 text styles: entrance x layout x highlight x background x colours x fonts
  const o = { enter: M.ENTERS[i % M.ENTERS.length], layout: M.LAYOUTS[(Math.floor(i / M.ENTERS.length) + i * 3) % 10], emph: M.EMPHS[(i * 7 + Math.floor(i / 11)) % 11] };
  const b = M.BIZ[(i * 3) % M.BIZ.length], pi = (i * 11 + 3) % 24, fi = (i * 7 + 1) % 20, kind = safeKind(kinds[(i * 2 + Math.floor(i / 3)) % 3], pi);
  DEMOS.push({ fam: 'Text styles', name: M.PAL[pi][0] + ' ' + cap(o.enter), tags: [o.enter, o.layout, o.emph, M.BGS[(i * 3 + 1) % 16]], biz: b.name, font: M.FONTS[fi][0],
    cfg: { seed: 1000 + i, look: look(pi, fi, kind !== 'light'), bg: M.BGS[(i * 3 + 1) % 16], cam: M.CAMS[i % 4], scenes: [{ piece: 'title', kind, data: titleData(b, o) }] } });
}
M.PIECES.forEach((p, k) => {             // every scene piece in 5 different looks
  for (let j = 0; j < 12; j++) {
    const i = k * 12 + j, b = M.BIZ[(k * 5 + j * 3) % M.BIZ.length], pi = (k * 7 + j * 5) % 24, fi = (k * 3 + j * 4) % 20;
    const kind = ['photo-depth', 'photo-cinema', 'open-light', 'end-glass'].includes(p) ? 'dark' : p === 'info-price' ? 'brand' : safeKind(kinds[(k + j) % 3], pi);
    DEMOS.push({ fam: FAMILY[p.split('-')[0]], name: M.PAL[pi][0] + ' ' + P_LABEL(p), tags: [P_LABEL(p).toLowerCase(), 'variation ' + (j + 1), M.BGS[(i * 5) % 16]], biz: b.name, font: M.FONTS[fi][0],
      cfg: { seed: 5000 + i * 17, look: look(pi, fi, kind !== 'light'), bg: M.BGS[(i * 5) % 16], scenes: [{ piece: p, kind, data: dataFor(p, b) }] } });
  }
});
M.TRANS.forEach((t, k) => {              // every transition, 5 times, between two scenes of one ad
  for (let j = 0; j < 5; j++) {
    const i = k * 4 + j, b = M.BIZ[(k * 3 + j * 5) % M.BIZ.length], pi = (k * 5 + j * 7 + 2) % 24, fi = (k * 2 + j * 5 + 3) % 20;
    const kA = safeKind(kinds[(k + j) % 3], pi), kB = safeKind(kinds[(k + j + 1) % 3], pi);
    DEMOS.push({ fam: 'Transitions', name: M.PAL[pi][0] + ' ' + window.PIECES[t].label, tags: [window.PIECES[t].label.toLowerCase(), 'variation ' + (j + 1)], biz: b.name, font: M.FONTS[fi][0],
      cfg: { seed: 9000 + i * 13, look: look(pi, fi, true), scenes: [{ piece: 'title', kind: kA, data: titleData(b, { enter: M.ENTERS[(i * 3) % 25], layout: 'center', emph: M.EMPHS[i % 11] }) }, { piece: j % 2 ? 'info-price' : 'text-slot', kind: kB, trans: t, data: dataFor(j % 2 ? 'info-price' : 'text-slot', b) }] } });
  }
});
for (let i = 0; i < 40; i++) {           // 40 full mini-ads: five pieces each, chosen and joined by the seed
  const b = M.BIZ[i % M.BIZ.length], pi = (i * 5 + 1) % 24, fi = (i * 9 + 2) % 20, r = mulberry(777 + i * 31);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const plan = [pick(['open-depth', 'open-sweep', 'open-split', 'open-shapes', 'open-light', 'title']), pick(['photo-depth', 'photo-pop', 'photo-phone', 'photo-cinema', 'photo-split']), pick(['info-price', 'info-stat', 'info-compare']), pick(['info-quote', 'info-tiles', 'info-checks', 'text-slot', 'info-location']), pick(['end-press', 'end-particles', 'end-draw', 'end-glass'])];
  DEMOS.push({ fam: 'Full ads', name: b.name, tags: plan.map(P_LABEL), biz: b.name, font: M.FONTS[fi][0],
    cfg: { seed: 20000 + i * 101, energy: pick(['calm', 'medium', 'high']), look: look(pi, fi, true), scenes: plan.map((p, k) => ({ piece: p, kind: p === 'info-price' ? 'brand' : ['photo-depth', 'photo-cinema', 'open-light', 'end-glass'].includes(p) ? 'dark' : safeKind(kinds[Math.floor(r() * 3)], pi), data: p === 'title' ? titleData(b, {}) : dataFor(p, b) })) } });
}
const TPL = Object.keys(window.SIGNATURE_TEMPLATES), ASP = ['9:16', '9:16', '1:1', '16:9'], INT = ['elegant', 'aggressive', 'mechanical', 'fluid'];
const tplFields = (b) => ({ brand: b.name, headline: b.headline, sub: b.sub.split('.')[0], cta: b.cta, points: b.items, words: b.words, img: IMG[b.img], mono: b.mono, date: b.date, place: b.place, contact: b.phone });
TPL.forEach((tp, k) => {                 // the eight signature templates, 14 takes each (businesses, sizes, lengths, moods, colours)
  for (let j = 0; j < 14; j++) {
    const b = M.BIZ[(k * 5 + j * 3) % M.BIZ.length], aspect = ASP[j % 4], duration = [15, 6, 30][j % 3], intensity = j < 4 ? undefined : INT[(j + k) % 4], pal = j % 2 ? M.PAL[(k * 7 + j * 5) % 24] : null;
    const T = window.SIGNATURE_TEMPLATES[tp];
    DEMOS.push({ fam: 'Templates', tpl: true, aspect, name: T.label.split(' — ')[0].replace('Audio-Reactive ', ''), tags: [aspect, duration + 's', intensity || T.intensity, pal ? pal[0] : 'house colours'], biz: b.name, font: T.look.display,
      cfg: { template: tp, seed: 40000 + k * 211 + j * 17, duration, aspect, intensity, colors: pal ? { A: pal[1], A2: pal[2] } : undefined, fields: tplFields(b) } });
  }
});
DEMOS.sort((a, b) => (b.fam === 'Templates') - (a.fam === 'Templates'));
function mulberry(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function P_LABEL(p) { return (window.PIECES[p] && window.PIECES[p].label) || p; }

// ---- grid
const grid = document.getElementById('grid'), bar = document.getElementById('bar');
const fams = ['All', 'Templates', 'Full ads', 'Text styles', 'Openers', 'Text', 'Photo', 'Info', 'Endings', 'Transitions'];
let filter = 'Templates';
document.getElementById('count').firstChild.nodeValue = DEMOS.length;
fams.forEach((f) => { const n = f === 'All' ? DEMOS.length : DEMOS.filter((d) => d.fam === f).length; if (!n) return; const c = document.createElement('button'); c.className = 'chip'; c.type = 'button'; c.innerHTML = f + '<b>' + n + '</b>'; c.setAttribute('aria-pressed', f === filter); c.onclick = () => { filter = f; [...bar.querySelectorAll('.chip[data-f]')].forEach((x) => x.setAttribute('aria-pressed', x.dataset.f === f)); render(); }; c.dataset.f = f; bar.appendChild(c); });
const sp = document.createElement('span'); sp.className = 'spacer'; bar.appendChild(sp);
const soundBtn = document.createElement('button'); soundBtn.className = 'chip sound'; soundBtn.type = 'button'; soundBtn.textContent = 'Sound: off'; bar.appendChild(soundBtn);
let soundOn = false;
soundBtn.onclick = () => { soundOn = !soundOn; soundBtn.textContent = 'Sound: ' + (soundOn ? 'on' : 'off'); if (soundOn) unlock(); };
const io = new IntersectionObserver((es) => es.forEach((e) => { const c = e.target; if (e.isIntersecting) mount(c); else unmount(c); }), { rootMargin: '120px 0px' });
function render() {
  [...grid.children].forEach((c) => { io.unobserve(c); unmount(c); });
  grid.innerHTML = '';
  DEMOS.forEach((d, i) => { if (filter !== 'All' && d.fam !== filter) return;
    const c = document.createElement('button'); c.className = 'card'; c.type = 'button'; c.dataset.i = i; c.setAttribute('aria-label', 'Play ' + d.name);
    if (d.aspect === '16:9') c.classList.add('wide');
    c.innerHTML = '<div class="screen"' + (d.aspect ? ' style="aspect-ratio:' + d.aspect.replace(':', '/') + '"' : '') + '><span class="num">' + String(i + 1).padStart(3, '0') + '</span><div class="poster">' + d.fam + '</div></div><div class="meta"><b>' + d.name + '</b><span>' + d.tags.slice(0, 3).join(' · ') + '</span></div>';
    c.onclick = () => openPlayer(i);
    grid.appendChild(c); io.observe(c); });
}
// ---- building a live screen
const DIM = { '9:16': [1080, 1920], '16:9': [1920, 1080], '1:1': [1080, 1080] };
function build(host, d, loop) {
  const [W, H] = DIM[d.aspect || '9:16'];
  const scaler = document.createElement('div'); scaler.className = 'scaler'; const st = document.createElement('div'); scaler.appendChild(st); host.appendChild(scaler);
  const fit = () => { const s = Math.min(host.clientWidth / W, host.clientHeight / H); scaler.style.transform = 'translate(' + (host.clientWidth - W * s) / 2 + 'px,' + (host.clientHeight - H * s) / 2 + 'px) scale(' + s + ')'; }; fit();
  let res = null;
  try { res = d.tpl ? window.TEMPLATE_FILM(Object.assign({ W, H, noGlobal: true }, d.cfg), st) : window.PIECE_SEQUENCE(Object.assign({ W, H, noGlobal: true }, d.cfg), st); } catch (e) { console.error(d.name, e); return null; }
  const tl = res.tl; if (loop) { tl.eventCallback('onComplete', () => { gsap.delayedCall(0.6, () => tl.restart()); }); }
  tl.play(0);
  return { scaler, tl, sfx: res.sfx, fit };
}
function mount(c) { if (c._live) return; const d = DEMOS[+c.dataset.i]; const s = c.querySelector('.screen'); s.querySelector('.poster').hidden = true; c._live = build(s, d, true); }
function unmount(c) { if (!c._live) return; c._live.tl.kill(); c._live.scaler.remove(); c._live = null; const p = c.querySelector('.poster'); if (p) p.hidden = false; }
// ---- sound (Animora's own library, soft)
let AC = null; const BUF = {};
function unlock() { if (!AC) { AC = new (window.AudioContext || window.webkitAudioContext)(); Object.entries(SFX).forEach(([k, u]) => { fetch(u).then((r) => r.arrayBuffer()).then((ab) => AC.decodeAudioData(ab)).then((b) => { BUF[k] = b; }).catch(() => {}); }); } if (AC.state !== 'running') AC.resume().catch(() => {}); }
function play(k, v) { if (!AC || !BUF[k]) return; const s = AC.createBufferSource(), g = AC.createGain(); g.gain.value = Math.min(0.9, v); s.buffer = BUF[k]; s.connect(g).connect(AC.destination); s.start(); }
// ---- big player
const player = document.getElementById('player'), big = document.getElementById('big');
let cur = null, curI = 0, lastT = 0;
function openPlayer(i) {
  curI = i; const d = DEMOS[i]; if (cur) { cur.tl.kill(); cur.scaler.remove(); }
  player.hidden = false; big.style.aspectRatio = (d.aspect || '9:16').replace(':', '/'); big.classList.toggle('land', d.aspect === '16:9'); document.getElementById('pTitle').textContent = d.name;
  document.getElementById('pMeta').innerHTML = [['Kind', d.fam], ['Made from', d.tags.join(', ')], ...(d.tpl ? [['Best for', window.SIGNATURE_TEMPLATES[d.cfg.template].best]] : []), ['Example', d.biz], ['Display font', String(d.font).split("'")[1] || d.font], ['Number', String(i + 1).padStart(3, '0') + ' of ' + DEMOS.length]].map(([a, b]) => '<dt>' + a + '</dt><dd>' + b + '</dd>').join('');
  requestAnimationFrame(() => { cur = build(big, d, true); lastT = 0; });
  document.getElementById('pSound').textContent = soundOn ? 'Sound off' : 'Sound on';
}
gsap.ticker.add(() => { if (!cur || player.hidden) return; const t = cur.tl.time(); if (soundOn && t > lastT && t - lastT < 0.3) cur.sfx.forEach((x) => { if (x.t > lastT && x.t <= t) play(x.k, x.v); }); lastT = t; });
document.getElementById('pClose').onclick = () => { player.hidden = true; if (cur) { cur.tl.kill(); cur.scaler.remove(); cur = null; } };
document.getElementById('pReplay').onclick = () => { if (cur) { cur.tl.restart(); lastT = 0; } };
document.getElementById('pNext').onclick = () => { let n = curI; do { n = (n + 1) % DEMOS.length; } while (filter !== 'All' && DEMOS[n].fam !== filter); openPlayer(n); };
document.getElementById('pSound').onclick = (e) => { soundOn = !soundOn; soundBtn.textContent = 'Sound: ' + (soundOn ? 'on' : 'off'); e.target.textContent = soundOn ? 'Sound off' : 'Sound on'; if (soundOn) unlock(); };
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !player.hidden) document.getElementById('pClose').click(); });
window.addEventListener('resize', () => { [...grid.children].forEach((c) => c._live && c._live.fit()); if (cur) cur.fit(); });
const fontsReady = Promise.race([Promise.all(${JSON.stringify(fams)}.flatMap((f) => ['400', '700', '800'].map((w) => document.fonts.load(w + ' 60px "' + f + '"').catch(() => {})))), new Promise((r) => setTimeout(r, 3500))]);
fontsReady.then(() => { render(); rebuild(); });

// ---- template studio
const S = { template: 'type-reactor', duration: 15, aspect: '9:16', pal: -1, intensity: '', seed: 7, img: 'coffee' };
const sStage = document.getElementById('sStage'); let sLive = null, sLast = 0, sPaused = false;
const segs = (id, items, key, label) => { const box = document.getElementById(id); box.innerHTML = ''; items.forEach(([v, t, sub]) => { const b = document.createElement('button'); b.type = 'button'; b.innerHTML = t + (sub ? '<small>' + sub + '</small>' : ''); b.setAttribute('aria-pressed', String(S[key] === v)); b.onclick = () => { S[key] = v; [...box.children].forEach((x) => x.setAttribute('aria-pressed', String(x === b))); rebuild(); }; box.appendChild(b); }); };
segs('sTpl', Object.entries(window.SIGNATURE_TEMPLATES).map(([k, t]) => [k, t.label.split(' — ').pop().replace('Audio-Reactive Music ', '').replace(' & Tech Intro', '').replace(' & Abstract Morphing', '').replace('Luxury 3D Product Commercial', 'Luxury Product'), t.best.split(',')[0]]), 'template');
segs('sDur', [[6, '6s'], [15, '15s'], [30, '30s']], 'duration');
segs('sAsp', [['9:16', 'Story 9:16'], ['16:9', 'Wide 16:9'], ['1:1', 'Square 1:1']], 'aspect');
segs('sInt', [['', 'Template default'], ['elegant', 'Elegant'], ['aggressive', 'Aggressive'], ['mechanical', 'Mechanical'], ['fluid', 'Fluid']], 'intensity');
segs('sImg', [['coffee', 'Coffee'], ['moto', 'Rider'], ['cat', 'Cat'], ['rocket', 'Rocket'], ['', 'No photo']], 'img');
(() => { const box = document.getElementById('sPal'); const d = document.createElement('button'); d.type = 'button'; d.className = 'def'; d.textContent = 'House'; d.setAttribute('aria-pressed', 'true'); box.appendChild(d);
  const all = [d]; d.onclick = () => { S.pal = -1; all.forEach((x) => x.setAttribute('aria-pressed', String(x === d))); rebuild(); };
  M.PAL.slice(0, 16).forEach((p, i) => { const b = document.createElement('button'); b.type = 'button'; b.title = p[0]; b.setAttribute('aria-label', p[0]); b.style.background = 'linear-gradient(135deg,' + p[1] + ' 50%,' + p[2] + ' 50%)'; b.setAttribute('aria-pressed', 'false'); b.onclick = () => { S.pal = i; all.forEach((x) => x.setAttribute('aria-pressed', String(x === b))); rebuild(); }; all.push(b); box.appendChild(b); }); })();
function studioCfg() {
  const v = (id) => document.getElementById(id).value.trim(), p = S.pal >= 0 ? M.PAL[S.pal] : null;
  return { template: S.template, duration: S.duration, aspect: S.aspect, seed: S.seed, intensity: S.intensity || undefined, sound: v('sSnd') || undefined, quality: v('sQ'), colors: p ? { A: p[1], A2: p[2] } : undefined,
    fields: { brand: v('sBrand') || 'Your brand', headline: v('sHead') || v('sBrand') || 'Your headline', sub: v('sSub'), cta: v('sCta'), points: [v('sSub'), 'Made fresh daily', 'Fast delivery'].filter(Boolean), words: ['Fresh', 'Bold', 'Now'], img: S.img ? IMG[S.img] : '', mono: (v('sBrand') || 'A').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase(), date: 'Sat 14 Dec', place: 'Lekki, Lagos', contact: '0803 555 1234' } };
}
let rbT = 0;
function rebuild() { clearTimeout(rbT); rbT = setTimeout(() => {
  if (sLive) { sLive.tl.kill(); sLive.scaler.remove(); sLive = null; }
  sStage.style.aspectRatio = S.aspect.replace(':', '/'); sStage.classList.toggle('land', S.aspect === '16:9');
  requestAnimationFrame(() => { sLive = build(sStage, { tpl: true, aspect: S.aspect, cfg: studioCfg(), name: 'studio' }, true); sLast = 0; if (sLive && sPaused) sLive.tl.pause(); });
}, 180); }
['sBrand', 'sHead', 'sSub', 'sCta'].forEach((id) => document.getElementById(id).addEventListener('input', rebuild));
['sSnd', 'sQ'].forEach((id) => document.getElementById(id).addEventListener('change', rebuild));
document.getElementById('sShuffle').onclick = () => { S.seed = Math.floor(Math.random() * 1e6); rebuild(); };
document.getElementById('sPlay').onclick = (e) => { if (!sLive) return; sPaused = !sPaused; sPaused ? sLive.tl.pause() : sLive.tl.play(); e.target.textContent = sPaused ? 'Play' : 'Pause'; };
const scrub = document.getElementById('sScrub');
scrub.addEventListener('input', () => { if (!sLive) return; sLive.tl.pause(); sPaused = true; document.getElementById('sPlay').textContent = 'Play'; sLive.tl.seek(sLive.tl.duration() * scrub.value / 1000, false); });
document.getElementById('sCopy').onclick = async (e) => { const c = studioCfg(); delete c.fields.img; const txt = JSON.stringify(c, null, 2); try { await navigator.clipboard.writeText(txt); e.target.textContent = 'Copied'; } catch (_) { e.target.textContent = 'Copy failed'; } setTimeout(() => { e.target.textContent = 'Copy brief'; }, 1500); };
gsap.ticker.add(() => { if (!sLive) return; const t = sLive.tl.time(); if (!sPaused && document.activeElement !== scrub) scrub.value = Math.round(1000 * t / Math.max(0.1, sLive.tl.duration())); if (soundOn && player.hidden && t > sLast && t - sLast < 0.3) sLive.sfx.forEach((x) => { if (x.t > sLast && x.t <= t) play(x.k, x.v); }); sLast = t; });
window.addEventListener('resize', () => sLive && sLive.fit());

window.__DEMOS = DEMOS;
</script>
`;
fs.writeFileSync(LOCAL ? 'mt/library-local.html' : 'mt/animora-motion-library.html', LOCAL ? `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${page}</body></html>` : page);
console.log('bytes', page.length);
