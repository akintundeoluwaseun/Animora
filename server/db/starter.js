// The starter styles (owned by the demo creator) and the 2 demo ads.
// Each style has: rules for Gemini, a theme for the built-in motion engine (server/ai/themes.js), and an
// example plan (rendered to a preview video by scripts/build-demo-assets.js).
//
// Styles are synced into the database on every start (server/db/seed.js -> syncStarterStyles), so adding a
// style here makes it appear in the app after a restart.

// Rules every style shares, so Gemini never lets two scenes overlap.
const SHARED = `
MOTION LANGUAGE (pro After Effects ad style, all styles):
- Fast beats: every scene is 2-3 beats of ~1-2s, each showing ONE short idea (a punch word, a line, a price, a list, the CTA). Nothing sits still.
- Shots to use (pick by content, never the same shot twice in a row): giant punch word zooming at the camera with echo outlines; kinetic stacks of big/small lines sliding in with blur; text typed inside a selection box with handles and a cursor; brand mark popping then sliding up as the name rises; app-style notification morphing out of the logo; chips orbiting the title in a ring; price rolling like an odometer inside a drawing progress ring; a dot that morphs into a pill then a UI card holding the offer; tilted pill stacks for menus; a scroll-wheel list that ticks through items; flow cards joined by glowing light lines; icon tile grids; a split screen with a colour panel and an icon in a white circle; a product photo flying in in 3D over a giant outlined word; a phone mockup showing the menu; a 3D stat slab; and a final lockup (logo, divider, name, details) with a cursor that clicks the call-to-action button.
- Cuts: the outgoing beat leaves, the incoming arrives: motion-blur whips (directional SVG blur), zoom-throughs, collapse into a dot then burst out, a glowing line that draws across and leads into the next beat, two-tone colour wipes, white flash cuts. ONE beat on screen at a time.
- The key word of each line is highlighted (accent colour or a marker bar sweeping behind it).`;


const PREMIUM = `
PREMIUM DIRECTION (Apple-style launch ad):
- Small, clean type with lots of empty space (headlines 56-110px at 1080 wide, never giant). Sentences build word by word with a soft blur-focus; the key word's letters drop into place in the accent colour. Single words can replace each other in the centre ("Introducing" / "Kemi" / "Cakes").
- UI pieces that morph: an app icon opening into a widget card with a progress bar and folding back; watch-style widget tiles that split apart with filling rings; a glowing card over an isometric platform that flips flat into a stat tile; a logo with a ticker list whose active line glows; buttons stacking upward; a chat where the message is typed, sent and answered; a collage ring of photos around a short line.
- Cuts: blur-focus dissolves, a camera dive into the key word, a thick curved ribbon that swoops across the frame, collapse into a dot. The whole frame drifts and tilts very slowly.`;

const ex = (title, business, colors, scenes, duration = 20) => ({
  title, aspect_ratio: '9:16', duration_seconds: duration, business, style: { colors }, scenes,
});

export const STARTER_STYLES = [
  {
    slug: 'naija-bold', name: 'Naija Bold', category: 'Food & promos',
    description: 'Loud, joyful and fast. Chunky letters that pop and slam in, spinning sunbursts, glowing blobs, prices that count up with a shockwave. Perfect for food, fashion drops and promos.',
    font: 'Poppins',
    palette: { theme: 'bold', primary: '#E8530E', secondary: '#FFC93C', background: '#1B0F08', text: '#FFF6E9' },
    rules: `- Dark warm background: soft primary/secondary colour glows drifting, a slow spinning sunburst and floating confetti shapes for the whole video.
- Headlines: Poppins 900, 100-130px, chunky 3D drop shadow in a darker primary. Letters pop in (scale 0 -> 1, random tilt, back.out(2.4)) or whole words SLAM in from scale 3 with a camera shake.
- Prices: secondary-colour pill with a 3D shadow, spinning sunburst behind it, counts up from 0 with a ring shockwave.
- Lists: rounded glass rows with a secondary border that whip in from alternating sides.
- Cuts: see the motion language below (style favourites are listed in its theme).
- Call to action: big primary pill with the phone number, a ring shockwave, pulsing and a light sweep.${SHARED}`,
    example: ex('Mama Put Deluxe - Lunch Special', { name: 'Mama Put Deluxe', category: 'restaurant', location: 'Ikeja, Lagos', phone: '0803 555 0101' },
      { primary: '#E8530E', secondary: '#FFC93C', background: '#1B0F08', text: '#FFF6E9' }, [
        { id: 1, start: 0, end: 3.5, purpose: 'hook', on_screen_text: ['Hungry? Lunch is ready!'] },
        { id: 2, start: 3.5, end: 7.5, purpose: 'brand', on_screen_text: ['Mama Put Deluxe', 'Home-style food in Ikeja'] },
        { id: 3, start: 7.5, end: 11.5, purpose: 'offer', on_screen_text: ['Party Jollof + Chicken', '₦2,500'] },
        { id: 4, start: 11.5, end: 15.5, purpose: 'menu', on_screen_text: ['Amala & Ewedu ₦1,800', 'Fried Rice ₦2,200', 'Chapman ₦900'] },
        { id: 5, start: 15.5, end: 20, purpose: 'cta', on_screen_text: ['Order on WhatsApp', '0803 555 0101', 'Allen Avenue, Ikeja'] },
      ]),
  },
  {
    slug: 'gold-luxe', name: 'Gold Luxe', category: 'Premium',
    description: 'Elegant and premium. Italic serif headlines that rise letter by letter, a thin gold frame, twinkling sparkles and silky shutter transitions. For hotels, salons, jewellery, real estate and events.',
    font: 'Playfair Display',
    palette: { theme: 'luxe', primary: '#C9A227', secondary: '#F3E3B3', background: '#0E0B08', text: '#F8F1E4' },
    rules: `- Near-black background with a soft radial glow, a thin gold rounded frame inset from the edges, two short gold rules that draw in, a diagonal light sweep across the whole video and slow twinkling sparkles.
- Headlines: Playfair Display italic 700, 90-110px; letters rise from below or flip in, calm power4.out easing. Supporting text: small uppercase Montserrat with 8px letter-spacing in the secondary colour.
- Motion is graceful, never bouncy: no camera shake.
- Prices between two thin gold lines, in gold, with a gold ring ripple. Lists are rows separated by thin gold underlines.
- Cuts: see the motion language below (style favourites are listed in its theme).
- Call to action: outlined gold pill (4px border), no fill, with a soft light sweep.${SHARED}`,
    example: ex('The Ivory Suites - Weekend Escape', { name: 'The Ivory Suites', category: 'boutique hotel', location: 'Ado Ekiti', phone: '0812 300 4455' },
      { primary: '#C9A227', secondary: '#F3E3B3', background: '#0E0B08', text: '#F8F1E4' }, [
        { id: 1, start: 0, end: 4, purpose: 'hook', on_screen_text: ['Your weekend escape', 'Ado Ekiti'] },
        { id: 2, start: 4, end: 8, purpose: 'brand', on_screen_text: ['The Ivory Suites', 'Boutique hotel & lounge'] },
        { id: 3, start: 8, end: 12, purpose: 'offer', on_screen_text: ['Deluxe Room per night', '₦45,000', 'Breakfast included'] },
        { id: 4, start: 12, end: 15.5, purpose: 'detail', on_screen_text: ['Pool · Spa · Fine dining'] },
        { id: 5, start: 15.5, end: 20, purpose: 'cta', on_screen_text: ['Book your stay', '0812 300 4455', 'theivorysuites.ng'] },
      ]),
  },
  {
    slug: 'clean-pro', name: 'Clean Pro', category: 'Business',
    description: 'Bright, modern and trustworthy. A white rounded card on a drifting dot grid, crisp wipes, elastic letters and blind transitions. For schools, clinics, tech, finance and services.',
    font: 'DM Sans',
    palette: { theme: 'clean', primary: '#1F6FEB', secondary: '#16C784', background: '#F5F7FB', text: '#0B1B33' },
    rules: `- Light background with a faint dotted grid drifting slowly, rotating dashed orbit rings, a solid primary bar on the left edge, and a large white rounded card (radius 56px) with a soft shadow.
- Headlines: DM Sans 800, 90-100px, dark navy; the last word in the primary colour. Words wipe in from the left, or letters stretch up elastically.
- Prices in a green rounded pill with white text and a soft ring ripple. List rows are pale primary-tinted rounded rectangles that slide in from alternating sides.
- Cuts: see the motion language below (style favourites are listed in its theme).
- Call to action: green pill button with white text and a light sweep.${SHARED}`,
    example: ex('Brightway Academy - Admissions Open', { name: 'Brightway Academy', category: 'school', location: 'Akure', phone: '0705 220 1188' },
      { primary: '#1F6FEB', secondary: '#16C784', background: '#F5F7FB', text: '#0B1B33' }, [
        { id: 1, start: 0, end: 4, purpose: 'hook', on_screen_text: ['Admissions now open!', '2026/2027 session'] },
        { id: 2, start: 4, end: 8, purpose: 'brand', on_screen_text: ['Brightway Academy', 'Nursery · Primary · Secondary'] },
        { id: 3, start: 8, end: 12.5, purpose: 'menu', on_screen_text: ['Creche ₦85,000', 'Primary ₦120,000', 'JSS ₦150,000', 'SSS ₦165,000'] },
        { id: 4, start: 12.5, end: 16, purpose: 'detail', on_screen_text: ['Coding club · Science labs · School bus'] },
        { id: 5, start: 16, end: 20, purpose: 'cta', on_screen_text: ['Book a school visit', '0705 220 1188', 'Oba Adesida Road, Akure'] },
      ]),
  },
  {
    slug: 'neon-nights', name: 'Neon Nights', category: 'Nightlife & tech',
    description: 'Glowing neon signs, a retro-future grid floor, scanlines and glitchy RGB-split letters. For clubs, lounges, gaming, gadgets and parties.',
    font: 'Orbitron',
    palette: { theme: 'neon', primary: '#FF2E88', secondary: '#00E5FF', background: '#07021A', text: '#F7F2FF' },
    rules: `- Very dark purple background, a neon grid floor moving towards the viewer, a striped neon sun, scanlines and floating particles.
- Headlines: Orbitron 900 uppercase, 90-100px, white text with a strong pink neon glow (layered text-shadows); the last word glows cyan.
- Letters glitch in (RGB split + jittering steps), flip in, or type on. Camera shakes on big moments.
- Prices in a cyan neon outline box with an inner glow. Lists are pink neon outlined rows. Button: pink neon pill.
- Cuts: see the motion language below (style favourites are listed in its theme).${SHARED}`,
    example: ex('Club Nova - Friday Night', { name: 'Club Nova', category: 'lounge', location: 'Lekki, Lagos', phone: '0909 777 2020' },
      { primary: '#FF2E88', secondary: '#00E5FF', background: '#07021A', text: '#F7F2FF' }, [
        { id: 1, start: 0, end: 3.5, purpose: 'hook', on_screen_text: ['This Friday we go crazy'] },
        { id: 2, start: 3.5, end: 7.5, purpose: 'brand', on_screen_text: ['Club Nova', 'DJ Spinall live · 10PM'] },
        { id: 3, start: 7.5, end: 11.5, purpose: 'offer', on_screen_text: ['Early bird ticket', '₦5,000'] },
        { id: 4, start: 11.5, end: 15.5, purpose: 'menu', on_screen_text: ['Regular ₦10,000', 'VIP table ₦150,000', 'Bottle + shisha ₦60,000'] },
        { id: 5, start: 15.5, end: 20, purpose: 'cta', on_screen_text: ['Book your table', '0909 777 2020', 'Admiralty Way, Lekki'] },
      ]),
  },
  {
    slug: 'street-hype', name: 'Street Hype', category: 'Fashion',
    description: 'Streetwear drop energy: huge condensed type that slams in, acid-lime highlights, scrolling outlined brand names and hazard tape. For fashion, sneakers, thrift and merch.',
    font: 'Anton',
    palette: { theme: 'street', primary: '#C6FF00', secondary: '#FFFFFF', background: '#0A0A0A', text: '#FFFFFF' },
    rules: `- Black background with the brand name repeated in huge outlined letters scrolling in opposite directions, two diagonal hazard-tape bands moving, and small floating shapes.
- Headlines: Anton uppercase, 130-160px, white; the last word sits on an acid-lime highlight box with black text.
- Words SLAM in from scale 3 with a hard camera shake, or zoom from huge, or stretch up.
- Prices on a tilted lime block with black text. List rows are white rounded bars, black text, price on a lime chip. Button: lime, black uppercase text.
- Cuts: see the motion language below (style favourites are listed in its theme).${SHARED}`,
    example: ex('DRIP Lagos - New Drop', { name: 'DRIP Lagos', category: 'streetwear', location: 'Yaba, Lagos', phone: '0816 404 9090' },
      { primary: '#C6FF00', secondary: '#FFFFFF', background: '#0A0A0A', text: '#FFFFFF' }, [
        { id: 1, start: 0, end: 3.5, purpose: 'hook', on_screen_text: ['New drop is here'] },
        { id: 2, start: 3.5, end: 7.5, purpose: 'brand', on_screen_text: ['DRIP Lagos', 'Limited pieces only'] },
        { id: 3, start: 7.5, end: 11.5, purpose: 'offer', on_screen_text: ['Oversized hoodie', '₦18,500'] },
        { id: 4, start: 11.5, end: 15.5, purpose: 'menu', on_screen_text: ['Graphic tee ₦9,000', 'Cargo pants ₦15,000', 'Bucket hat ₦6,500'] },
        { id: 5, start: 15.5, end: 20, purpose: 'cta', on_screen_text: ['Cop yours now', '0816 404 9090', 'Free delivery in Lagos'] },
      ]),
  },
  {
    slug: 'owambe-party', name: 'Owambe Party', category: 'Events',
    description: 'Pure celebration: confetti rain, spinning gold sunbursts, sparkles and letters that scatter in from everywhere. For parties, weddings, aso-ebi, event planners and birthday cakes.',
    font: 'Baloo 2',
    palette: { theme: 'owambe', primary: '#FF3EA5', secondary: '#FFC83D', background: '#2A0845', text: '#FFF7FB' },
    rules: `- Deep purple background with a pink glow, a slowly spinning gold sunburst, falling confetti in pink/gold/white and twinkling sparkles for the whole video.
- Headlines: Baloo 2 800, 110-130px, with a pink 3D shadow; the last word in gold. Letters pop or scatter in from all over the frame, or stretch up elastically.
- Prices in a gold gradient pill with a pink shadow and a spinning gold burst behind. Lists: glass rows with pink borders.
- Cuts: see the motion language below (style favourites are listed in its theme).
- Photos: circles with a gold + pink double ring. Button: pink-to-gold gradient pill.${SHARED}`,
    example: ex('Royal Touch Events - Owambe Package', { name: 'Royal Touch Events', category: 'event planner', location: 'Ibadan', phone: '0805 321 7788' },
      { primary: '#FF3EA5', secondary: '#FFC83D', background: '#2A0845', text: '#FFF7FB' }, [
        { id: 1, start: 0, end: 3.5, purpose: 'hook', on_screen_text: ['Planning an owambe?'] },
        { id: 2, start: 3.5, end: 7.5, purpose: 'brand', on_screen_text: ['Royal Touch Events', 'Decor · Catering · Small chops'] },
        { id: 3, start: 7.5, end: 11.5, purpose: 'offer', on_screen_text: ['Full party package', '₦350,000'] },
        { id: 4, start: 11.5, end: 15.5, purpose: 'menu', on_screen_text: ['Small chops (100) ₦85,000', 'Hall decor ₦150,000', 'DJ + MC ₦120,000'] },
        { id: 5, start: 15.5, end: 20, purpose: 'cta', on_screen_text: ['Book your date', '0805 321 7788', 'Ring Road, Ibadan'] },
      ]),
  },
  {
    slug: 'fresh-market', name: 'Fresh Market', category: 'Food & promos',
    description: 'Fresh, juicy and bouncy. Cream background, floating bubbles, sticker-style tilted prices and letters that pop like fruit. For groceries, juice bars, bakeries, farms and supermarkets.',
    font: 'Fredoka',
    palette: { theme: 'market', primary: '#18A558', secondary: '#FF5A36', background: '#FFF6E5', text: '#1E2A1E' },
    rules: `- Warm cream background with soft green/orange glows, floating glossy bubbles and small shapes drifting up.
- Headlines: Fredoka 700, 110-120px, dark green-black; the last word in tomato orange. Letters pop with a bounce, stretch, or scatter in.
- Prices: tilted tomato sticker pill with a 3D shadow and a faint sunburst. List rows: white rounded cards with soft shadows, prices in green.
- Photos: circles with a thick white border.
- Cuts: see the motion language below (style favourites are listed in its theme).
- Button: green pill with a 3D shadow.${SHARED}`,
    example: ex('Greenbasket - Weekend Market', { name: 'Greenbasket', category: 'grocery', location: 'Akure', phone: '0703 118 5566' },
      { primary: '#18A558', secondary: '#FF5A36', background: '#FFF6E5', text: '#1E2A1E' }, [
        { id: 1, start: 0, end: 3.5, purpose: 'hook', on_screen_text: ['Fresh food, fair price'] },
        { id: 2, start: 3.5, end: 7.5, purpose: 'brand', on_screen_text: ['Greenbasket', 'Farm to your kitchen'] },
        { id: 3, start: 7.5, end: 11.5, purpose: 'offer', on_screen_text: ['Big basket of tomatoes', '₦7,500'] },
        { id: 4, start: 11.5, end: 15.5, purpose: 'menu', on_screen_text: ['Yam tuber ₦3,000', 'Plantain bunch ₦4,500', 'Crate of eggs ₦5,800'] },
        { id: 5, start: 15.5, end: 20, purpose: 'cta', on_screen_text: ['Order on WhatsApp', '0703 118 5566', 'Delivery across Akure'] },
      ]),
  },
  {
    slug: 'tech-pulse', name: 'Tech Pulse', category: 'Nightlife & tech',
    description: 'Sleek and futuristic: glowing blue-to-mint gradients, rotating orbit rings, a moving grid and letters that flip and type on. For fintech, apps, gadgets, ISPs and online courses.',
    font: 'Space Grotesk',
    palette: { theme: 'tech', primary: '#3D7BFF', secondary: '#2CF6B3', background: '#050B1F', text: '#EAF2FF' },
    rules: `- Deep navy background with a blue glow, a drifting dot grid, two rotating dashed orbit rings and small floating particles.
- Headlines: Space Grotesk 700, 100-110px; the last word filled with a blue-to-mint gradient. Letters flip in (3D rotationX), type on, wipe in or glitch in.
- Prices in a glass card with a mint border. Lists: glass rows with blue borders, mint prices.
- Button: blue-to-mint gradient pill with dark text.
- Cuts: see the motion language below (style favourites are listed in its theme).${SHARED}`,
    example: ex('PayLite - Send money free', { name: 'PayLite', category: 'fintech app', location: 'Nigeria', phone: '0700 729 5483' },
      { primary: '#3D7BFF', secondary: '#2CF6B3', background: '#050B1F', text: '#EAF2FF' }, [
        { id: 1, start: 0, end: 3.5, purpose: 'hook', on_screen_text: ['Transfers in 3 seconds'] },
        { id: 2, start: 3.5, end: 7.5, purpose: 'brand', on_screen_text: ['PayLite', 'The wallet that just works'] },
        { id: 3, start: 7.5, end: 11.5, purpose: 'offer', on_screen_text: ['Sign-up bonus', '₦1,000'] },
        { id: 4, start: 11.5, end: 15.5, purpose: 'detail', on_screen_text: ['Free transfers · Airtime · Bills'] },
        { id: 5, start: 15.5, end: 20, purpose: 'cta', on_screen_text: ['Download PayLite', '0700 729 5483', 'On Play Store & App Store'] },
      ]),
  },
  {
    slug: 'glory-light', name: 'Glory Light', category: 'Events',
    description: 'Majestic and uplifting: sweeping light beams, gold sparkles and stately Roman capitals rising into view. For churches, crusades, conferences, concerts and graduations.',
    font: 'Cinzel',
    palette: { theme: 'glory', primary: '#F5C542', secondary: '#FFFFFF', background: '#0A1033', text: '#FFFFFF' },
    rules: `- Deep royal navy background, three golden light beams slowly sweeping from the top, twinkling sparkles and drifting particles.
- Headlines: Cinzel 900 uppercase, 90-100px, white with a soft gold glow; the last word in gold. Letters rise, flip or zoom in, majestic not silly.
- Supporting text: uppercase Montserrat, wide letter-spacing.
- Details between thin gold lines. Button: solid gold pill with navy text and a gold glow.
- Cuts: see the motion language below (style favourites are listed in its theme).${SHARED}`,
    example: ex('Grace Assembly - Night of Glory', { name: 'Grace Assembly', category: 'church', location: 'Ado Ekiti', phone: '0806 222 3434' },
      { primary: '#F5C542', secondary: '#FFFFFF', background: '#0A1033', text: '#FFFFFF' }, [
        { id: 1, start: 0, end: 4, purpose: 'hook', on_screen_text: ['A night of glory'] },
        { id: 2, start: 4, end: 8, purpose: 'brand', on_screen_text: ['Grace Assembly', 'Praise · Worship · Miracles'] },
        { id: 3, start: 8, end: 12, purpose: 'detail', on_screen_text: ['Friday 31st October', '9PM till dawn'] },
        { id: 4, start: 12, end: 15.5, purpose: 'detail', on_screen_text: ['Come expecting a miracle'] },
        { id: 5, start: 15.5, end: 20, purpose: 'cta', on_screen_text: ['Everyone is welcome', '0806 222 3434', 'Opopogbooro, Ado Ekiti'] },
      ]),
  },
  {
    slug: 'beauty-bloom', name: 'Beauty Bloom', category: 'Beauty',
    description: 'Soft, glowing and feminine: blush tones, drifting petals, elegant serif type with italic highlights and arched photo frames. For salons, lashes, nails, skincare and boutiques.',
    font: 'DM Serif Display',
    palette: { theme: 'bloom', primary: '#E2557C', secondary: '#F6A5BC', background: '#FFEFF3', text: '#4A1838' },
    rules: `- Blush background with soft rose glows, drifting petal shapes and twinkling sparkles.
- Headlines: DM Serif Display, 100-115px, plum text; the last word in rose italic. Letters rise, stretch or flip in; words wipe in.
- Prices: rose pill with white text and a petal burst behind. List rows: white rounded rows with a pink border.
- Photos: arch frames (round top) with a white border and a rosy shadow.
- Cuts: see the motion language below (style favourites are listed in its theme).${SHARED}`,
    example: ex('Lush Lashes - Glow Up', { name: 'Lush Lashes Studio', category: 'beauty salon', location: 'Wuse 2, Abuja', phone: '0813 650 2299' },
      { primary: '#E2557C', secondary: '#F6A5BC', background: '#FFEFF3', text: '#4A1838' }, [
        { id: 1, start: 0, end: 3.5, purpose: 'hook', on_screen_text: ['Ready for your glow up?'] },
        { id: 2, start: 3.5, end: 7.5, purpose: 'brand', on_screen_text: ['Lush Lashes Studio', 'Lashes · Brows · Nails'] },
        { id: 3, start: 7.5, end: 11.5, purpose: 'offer', on_screen_text: ['Classic lash set', '₦15,000'] },
        { id: 4, start: 11.5, end: 15.5, purpose: 'menu', on_screen_text: ['Volume set ₦25,000', 'Brow lamination ₦12,000', 'Gel nails ₦8,000'] },
        { id: 5, start: 15.5, end: 20, purpose: 'cta', on_screen_text: ['Book your slot', '0813 650 2299', 'Wuse 2, Abuja'] },
      ]),
  },
  {
    slug: 'retro-pop', name: 'Retro Pop', category: 'Food & promos',
    description: 'Comic-book madness: thick black outlines, offset shadows, halftone dots, red sunbursts and letters that slam like a POW! For fast food, sales, toys, games and anything loud.',
    font: 'Bungee',
    palette: { theme: 'retro', primary: '#FF3B3B', secondary: '#2D5BFF', background: '#FFE45E', text: '#111111' },
    rules: `- Bright yellow background with red halftone dots in the corners, a spinning red sunburst and floating stars.
- Headlines: Bungee uppercase, 100-110px, white letters with a thick black stroke and a hard black offset shadow; the last word red.
- Words SLAM in with a camera shake, letters pop, or the whole line zooms from huge.
- Prices: tilted blue block, thick black border, hard black offset shadow. Lists: white rows with black borders and offset shadows. Button: red with black border.
- Cuts: see the motion language below (style favourites are listed in its theme).${SHARED}`,
    example: ex('Burger Bros - Combo Madness', { name: 'Burger Bros', category: 'fast food', location: 'Surulere, Lagos', phone: '0817 222 6655' },
      { primary: '#FF3B3B', secondary: '#2D5BFF', background: '#FFE45E', text: '#111111' }, [
        { id: 1, start: 0, end: 3.5, purpose: 'hook', on_screen_text: ['Big hunger? Big burger!'] },
        { id: 2, start: 3.5, end: 7.5, purpose: 'brand', on_screen_text: ['Burger Bros', 'Smash burgers in Surulere'] },
        { id: 3, start: 7.5, end: 11.5, purpose: 'offer', on_screen_text: ['Double smash combo', '₦6,500'] },
        { id: 4, start: 11.5, end: 15.5, purpose: 'menu', on_screen_text: ['Chicken burger ₦4,500', 'Loaded fries ₦3,000', 'Milkshake ₦2,500'] },
        { id: 5, start: 15.5, end: 20, purpose: 'cta', on_screen_text: ['Order now', '0817 222 6655', 'Adeniran Ogunsanya, Surulere'] },
      ]),
  },
  {
    slug: 'sports-blitz', name: 'Sports Blitz', category: 'Sports & fitness',
    description: 'Maximum adrenaline: italic slanted type, red slashes, speed lines shooting past, hard shakes and diagonal sweeps. For gyms, football viewing centres, sports gear and fitness coaches.',
    font: 'Oswald',
    palette: { theme: 'blitz', primary: '#FF1E1E', secondary: '#FFFFFF', background: '#0B0B0F', text: '#FFFFFF' },
    rules: `- Near-black background with diagonal red slashes drifting, white speed lines shooting across and a red glow.
- Headlines: Oswald 700 italic uppercase, 120-140px, skewed -8deg with a red offset shadow; the last word in red.
- Words slam in with heavy camera shakes, letters scatter in, or the line zooms from huge.
- Prices on a red skewed block. List rows: dark with a thick red left bar. Button: red, skewed, uppercase.
- Cuts: see the motion language below (style favourites are listed in its theme).${SHARED}`,
    example: ex('Iron Zone Gym - New Year Body', { name: 'Iron Zone Gym', category: 'gym', location: 'Gwarinpa, Abuja', phone: '0802 999 1212' },
      { primary: '#FF1E1E', secondary: '#FFFFFF', background: '#0B0B0F', text: '#FFFFFF' }, [
        { id: 1, start: 0, end: 3.5, purpose: 'hook', on_screen_text: ['No excuses this year'] },
        { id: 2, start: 3.5, end: 7.5, purpose: 'brand', on_screen_text: ['Iron Zone Gym', 'Train like a champion'] },
        { id: 3, start: 7.5, end: 11.5, purpose: 'offer', on_screen_text: ['Monthly membership', '₦20,000'] },
        { id: 4, start: 11.5, end: 15.5, purpose: 'menu', on_screen_text: ['Personal trainer ₦50,000', 'Boxing class ₦15,000', 'Day pass ₦3,000'] },
        { id: 5, start: 15.5, end: 20, purpose: 'cta', on_screen_text: ['Start today', '0802 999 1212', '3rd Avenue, Gwarinpa'] },
      ]),
  },
  {
    slug: 'prime-estate', name: 'Prime Estate', category: 'Premium',
    description: 'Confident and architectural: navy and champagne, blueprint grid lines, rotating orbit rings and clean wipes. For real estate, interior design, car dealers and construction.',
    font: 'Montserrat',
    palette: { theme: 'prime', primary: '#E8C27A', secondary: '#7FB7BE', background: '#0F1E2E', text: '#F4F7FA' },
    rules: `- Navy background with a soft glow, a fine blueprint grid drifting, two rotating dashed rings and a slow light sweep.
- Headlines: Montserrat 800, 90-100px; the last word champagne. Words wipe in, letters rise or flip.
- Supporting text: uppercase, wide letter-spacing, in the secondary colour.
- Prices in a champagne outlined rounded box. Lists: rows with champagne underlines. Button: champagne pill with navy text.
- Cuts: see the motion language below (style favourites are listed in its theme).${SHARED}`,
    example: ex('Crestview Homes - Own Your Home', { name: 'Crestview Homes', category: 'real estate', location: 'Ajah, Lagos', phone: '0814 600 7070' },
      { primary: '#E8C27A', secondary: '#7FB7BE', background: '#0F1E2E', text: '#F4F7FA' }, [
        { id: 1, start: 0, end: 4, purpose: 'hook', on_screen_text: ['Stop paying rent'] },
        { id: 2, start: 4, end: 8, purpose: 'brand', on_screen_text: ['Crestview Homes', 'Ajah · Lagos'] },
        { id: 3, start: 8, end: 12, purpose: 'offer', on_screen_text: ['3-bedroom terrace from', '₦45,000,000'] },
        { id: 4, start: 12, end: 15.5, purpose: 'detail', on_screen_text: ['C of O · 24/7 power · Gated estate'] },
        { id: 5, start: 15.5, end: 20, purpose: 'cta', on_screen_text: ['Book an inspection', '0814 600 7070', 'Flexible payment plans'] },
      ]),
  },
  {
    slug: 'kiddies-fun', name: 'Kiddies Fun', category: 'Kids & schools',
    description: 'Playful and bouncy: candy colours, bubbles and confetti, wobbly cartoon letters with double shadows and spinning transitions. For creches, toy shops, kids parties and lesson centres.',
    font: 'Luckiest Guy',
    palette: { theme: 'kids', primary: '#FF8A00', secondary: '#8E44FF', background: '#E7F6FF', text: '#1D1A4F' },
    rules: `- Light sky background with glossy bubbles floating up, falling confetti and small shapes.
- Headlines: Luckiest Guy, 110-120px, orange letters with a purple double shadow; the last word purple with an orange shadow.
- Letters pop, stretch elastically or scatter in. Lots of bounce and camera shakes on big moments.
- Prices: purple tilted circle-pill with a white border and 3D shadow. Lists: white rows with purple borders. Button: orange pill with a white border.
- Photos: circles with a white + orange ring.
- Cuts: see the motion language below (style favourites are listed in its theme).${SHARED}`,
    example: ex('Little Stars Creche - Enrol Now', { name: 'Little Stars Creche', category: 'creche', location: 'Ado Ekiti', phone: '0810 555 8899' },
      { primary: '#FF8A00', secondary: '#8E44FF', background: '#E7F6FF', text: '#1D1A4F' }, [
        { id: 1, start: 0, end: 3.5, purpose: 'hook', on_screen_text: ['Where little stars shine'] },
        { id: 2, start: 3.5, end: 7.5, purpose: 'brand', on_screen_text: ['Little Stars Creche', 'Play · Learn · Grow'] },
        { id: 3, start: 7.5, end: 11.5, purpose: 'offer', on_screen_text: ['Term fee from', '₦60,000'] },
        { id: 4, start: 11.5, end: 15.5, purpose: 'detail', on_screen_text: ['Safe playground · Hot meals · CCTV'] },
        { id: 5, start: 15.5, end: 20, purpose: 'cta', on_screen_text: ['Enrol your child', '0810 555 8899', 'Ajilosun, Ado Ekiti'] },
      ]),
  },
  {
    slug: 'mono-editorial', name: 'Mono Editorial', category: 'Business',
    description: 'Magazine-cover cool: off-white paper, giant tight black type, one hot orange accent, outlined words scrolling behind and sharp shutter cuts. For brands, agencies, studios and creators.',
    font: 'Archivo Black',
    palette: { theme: 'mono', primary: '#FF4D00', secondary: '#111111', background: '#F2EFE8', text: '#111111' },
    rules: `- Off-white paper background with a faint grain, the brand name in huge outlined letters scrolling behind, and two thin black rules that draw in at top and bottom.
- Headlines: Archivo Black uppercase, 115-130px, tight letter-spacing, black; the last word orange. Letters rise, words wipe, or type on.
- Prices on a black rounded block with white text. Lists: rows between thin black rules. Button: black pill with an orange dot.
- Photos: rounded, black-and-white.
- Cuts: see the motion language below (style favourites are listed in its theme).${SHARED}`,
    example: ex('Studio Ade - Brand Shoots', { name: 'Studio Ade', category: 'photography studio', location: 'Ikoyi, Lagos', phone: '0818 300 1100' },
      { primary: '#FF4D00', secondary: '#111111', background: '#F2EFE8', text: '#111111' }, [
        { id: 1, start: 0, end: 3.5, purpose: 'hook', on_screen_text: ['Your brand deserves better'] },
        { id: 2, start: 3.5, end: 7.5, purpose: 'brand', on_screen_text: ['Studio Ade', 'Photo · Video · Content'] },
        { id: 3, start: 7.5, end: 11.5, purpose: 'offer', on_screen_text: ['Half-day brand shoot', '₦120,000'] },
        { id: 4, start: 11.5, end: 15.5, purpose: 'menu', on_screen_text: ['Headshots ₦35,000', 'Product shoot ₦60,000', 'Reels package ₦90,000'] },
        { id: 5, start: 15.5, end: 20, purpose: 'cta', on_screen_text: ['Book a session', '0818 300 1100', 'Ikoyi, Lagos'] },
      ]),
  },
  {
    slug: 'afro-vibes', name: 'Afro Vibes', category: 'Fashion',
    description: 'Proudly African: moving kente-inspired bands, gold, red and green, rhythmic letters and bold bursts. For Ankara and aso-oke fashion, African restaurants, culture events and music.',
    font: 'Righteous',
    palette: { theme: 'afro', primary: '#F2A900', secondary: '#D62828', background: '#1C1007', text: '#FFF4E0' },
    rules: `- Dark earth background with a warm glow, kente-inspired geometric bands (gold, red, green) moving along the top and bottom edges, a slow red sunburst and floating shapes.
- Headlines: Righteous, 110-120px, with a red 3D shadow; the last word in gold. Letters pop, words slam, letters stretch or scatter in.
- Prices: gold pill wrapped in red and green rings. Lists: glass rows with gold borders. Button: gold pill.
- Cuts: see the motion language below (style favourites are listed in its theme).${SHARED}`,
    example: ex('Adire House - Ankara Collection', { name: 'Adire House', category: 'African fashion', location: 'Abeokuta', phone: '0807 432 1010' },
      { primary: '#F2A900', secondary: '#D62828', background: '#1C1007', text: '#FFF4E0' }, [
        { id: 1, start: 0, end: 3.5, purpose: 'hook', on_screen_text: ['Wear your culture proud'] },
        { id: 2, start: 3.5, end: 7.5, purpose: 'brand', on_screen_text: ['Adire House', 'Handmade in Abeokuta'] },
        { id: 3, start: 7.5, end: 11.5, purpose: 'offer', on_screen_text: ['Adire two-piece set', '₦28,000'] },
        { id: 4, start: 11.5, end: 15.5, purpose: 'menu', on_screen_text: ['Ankara dress ₦22,000', 'Aso-oke cap ₦8,000', 'Kaftan ₦25,000'] },
        { id: 5, start: 15.5, end: 20, purpose: 'cta', on_screen_text: ['Shop the collection', '0807 432 1010', 'Itoku Market, Abeokuta'] },
      ]),
  },
  {
    slug: 'ocean-breeze', name: 'Ocean Breeze', category: 'Travel & leisure',
    description: 'Cool and refreshing: rolling waves, rising bubbles, sunny yellow accents and letters that float up. For travel agents, beach resorts, pools, drinks, laundry and water brands.',
    font: 'Nunito',
    palette: { theme: 'ocean', primary: '#0096C7', secondary: '#FFB703', background: '#E6FAFF', text: '#023047' },
    rules: `- Pale aqua background with soft blue/yellow glows, two layered waves rolling along the bottom and glossy bubbles floating up.
- Headlines: Nunito 900, 105-115px, deep navy; the last word ocean blue. Letters rise, pop or flip; words wipe in.
- Prices: sunny yellow pill with navy text. Lists: white frosted rounded rows. Button: ocean-blue pill.
- Cuts: see the motion language below (style favourites are listed in its theme).${SHARED}`,
    example: ex('Tarkwa Bay Getaways - Beach Day', { name: 'Tarkwa Bay Getaways', category: 'travel & beach trips', location: 'Lagos', phone: '0811 246 8080' },
      { primary: '#0096C7', secondary: '#FFB703', background: '#E6FAFF', text: '#023047' }, [
        { id: 1, start: 0, end: 3.5, purpose: 'hook', on_screen_text: ['Escape the Lagos traffic'] },
        { id: 2, start: 3.5, end: 7.5, purpose: 'brand', on_screen_text: ['Tarkwa Bay Getaways', 'Beach trips every weekend'] },
        { id: 3, start: 7.5, end: 11.5, purpose: 'offer', on_screen_text: ['Boat ride + beach hut', '₦25,000'] },
        { id: 4, start: 11.5, end: 15.5, purpose: 'menu', on_screen_text: ['Jet ski (30 min) ₦20,000', 'Grilled fish platter ₦12,000', 'Group of 5 ₦110,000'] },
        { id: 5, start: 15.5, end: 20, purpose: 'cta', on_screen_text: ['Book this weekend', '0811 246 8080', 'Leaving from Ikoyi jetty'] },
      ]),
  },

  {
    slug: 'studio-white', name: 'Studio White', category: 'Premium launch',
    description: 'A premium launch-ad feel: white space, small crisp type that builds word by word, app icons that open into widget cards, and smooth dives between shots. For brands that want to look expensive.',
    font: 'Inter',
    palette: { theme: 'apple', primary: '#0071E3', secondary: '#FF375F', background: '#FFFFFF', text: '#1D1D1F' },
    rules: `- Pure white background with one very soft blue glow drifting. Text in near-black Inter 600-700, the key word in blue.
- Words replace each other in the centre for the hook, then full sentences build word by word.
- Prices on a glowing card that flips flat into a stat tile; menus as stacked rounded buttons; the CTA is a chat that sends and replies, then a clean logo lockup.${PREMIUM}${SHARED}`,
    example: ex('Kemi Cakes - Birthday cakes', { name: 'Kemi Cakes', category: 'bakery', location: 'Ado Ekiti', phone: '0806 123 4567' },
      { primary: '#0071E3', secondary: '#FF375F', background: '#FFFFFF', text: '#1D1D1F' }, [
        { id: 1, start: 0, end: 3.5, purpose: 'hook', on_screen_text: ['Introducing birthday cakes'] },
        { id: 2, start: 3.5, end: 7, purpose: 'brand', on_screen_text: ['Kemi Cakes', 'Baked fresh every morning'] },
        { id: 3, start: 7, end: 11, purpose: 'menu', on_screen_text: ['Cupcakes ₦4,500', 'Cake parfait ₦3,000', 'Wedding cakes ₦150,000'] },
        { id: 4, start: 11, end: 14.5, purpose: 'offer', on_screen_text: ['Birthday cakes from ₦15,000', 'Free delivery in Ado'] },
        { id: 5, start: 14.5, end: 20, purpose: 'cta', on_screen_text: ['I want a cake for Saturday!', 'Sure! Call 0806 123 4567'] },
      ]),
  },
  {
    slug: 'midnight-glow', name: 'Midnight Glow', category: 'Premium launch',
    description: 'Deep navy with electric-blue glow: soft focus-pull text, a logo with a glowing ticker list, cards linked by light lines and a calm cinematic close. For software, startups and serious services.',
    font: 'Inter',
    palette: { theme: 'midnight', primary: '#1E9BFF', secondary: '#6FE3FF', background: '#040A17', text: '#EAF2FF' },
    rules: `- Deep navy background, faint blue light streaks drifting, a cool glow behind the centre. Text in white Inter 600; key words glow in electric blue.
- The brand mark sits on the left with a caret and a list that ticks upward, the active line glowing. Feature cards connect with glowing light lines that pulse.
- Glass-like dark cards with blue borders and glow. Calm, confident pacing.${PREMIUM}${SHARED}`,
    example: ex('LedgerPro - Accounting software', { name: 'LedgerPro', category: 'software', location: 'Lagos', phone: '0809 555 0101' },
      { primary: '#1E9BFF', secondary: '#6FE3FF', background: '#040A17', text: '#EAF2FF' }, [
        { id: 1, start: 0, end: 3.5, purpose: 'hook', on_screen_text: ['Accounting at machine speed'] },
        { id: 2, start: 3.5, end: 7, purpose: 'brand', on_screen_text: ['LedgerPro', 'Built for Nigerian businesses'] },
        { id: 3, start: 7, end: 11.5, purpose: 'menu', on_screen_text: ['Invoices', 'Payroll', 'Inventory', 'Tax reports'] },
        { id: 4, start: 11.5, end: 15, purpose: 'detail', on_screen_text: ['Record · Review · Export'] },
        { id: 5, start: 15, end: 20, purpose: 'cta', on_screen_text: ['Start your free trial', '0809 555 0101', 'ledgerpro.ng'] },
      ]),
  },
  {
    slug: 'fintech-blue', name: 'Fintech Blue', category: 'Premium launch',
    description: 'A modern bank-ad look: a glowing card on a 3D platform, a bold blue ribbon swooping between shots, stacked action buttons and tilting sentences. For fintech, POS, banks and savings apps.',
    font: 'Figtree',
    palette: { theme: 'fintech', primary: '#1A2CFF', secondary: '#12A8FF', background: '#F4F6FB', text: '#0A0F2C' },
    rules: `- Soft light-grey background with a faint blue glow. Text in deep navy Figtree 700; key words in electric blue.
- A blue card floating over a glowing isometric platform that flips flat into a stat tile ("10M+ users"). A thick blue ribbon swoops across the frame between shots.
- Actions as stacked blue buttons rising one above the other ("Save smart", "Receive fast", "Send money").${PREMIUM}${SHARED}`,
    example: ex('Velopay - Banking made easy', { name: 'Velopay', category: 'fintech app', location: 'Nigeria', phone: '0700 835 6729' },
      { primary: '#1A2CFF', secondary: '#12A8FF', background: '#F4F6FB', text: '#0A0F2C' }, [
        { id: 1, start: 0, end: 3.5, purpose: 'hook', on_screen_text: ['Get your virtual card today'] },
        { id: 2, start: 3.5, end: 7, purpose: 'stat', on_screen_text: ['2M+ happy users'] },
        { id: 3, start: 7, end: 10.5, purpose: 'detail', on_screen_text: ['Experience the ease of modern banking'] },
        { id: 4, start: 10.5, end: 14.5, purpose: 'menu', on_screen_text: ['Save smart', 'Receive fast', 'Send money'] },
        { id: 5, start: 14.5, end: 20, purpose: 'cta', on_screen_text: ['Open an account in 2 minutes', 'Velopay', 'Download free'] },
      ]),
  },
  {
    slug: 'health-pulse', name: 'Health Pulse', category: 'Premium launch',
    description: 'Soft, caring and premium: a heart icon that opens into a health widget, watch-style tiles with filling rings, a photo collage ring and gentle pink glows. For clinics, pharmacies, gyms and wellness.',
    font: 'Inter',
    palette: { theme: 'pulse', primary: '#FF2D55', secondary: '#FF9F0A', background: '#F2F2F5', text: '#1C1C1E' },
    rules: `- Light grey-white background with a soft pink glow drifting. Text in dark Inter 700; key words in health pink, letters dropping into place.
- An app icon (heart) opens into a widget card with a filling progress bar and folds back. Watch-style dark tiles with pink rings that fill.
- Photo collage ring around a short question. Calm, caring pacing; the CTA is a friendly chat.${PREMIUM}${SHARED}`,
    example: ex('CarePoint Clinic - Health checks', { name: 'CarePoint Clinic', category: 'clinic', location: 'Akure', phone: '0813 400 2211' },
      { primary: '#FF2D55', secondary: '#FF9F0A', background: '#F2F2F5', text: '#1C1C1E' }, [
        { id: 1, start: 0, end: 3.5, purpose: 'hook', on_screen_text: ['Your body is constantly changing.'] },
        { id: 2, start: 3.5, end: 7, purpose: 'brand', on_screen_text: ['CarePoint Clinic', 'Full health checks'] },
        { id: 3, start: 7, end: 11, purpose: 'detail', on_screen_text: ['Heart · Blood sugar · Eyes'] },
        { id: 4, start: 11, end: 14.5, purpose: 'offer', on_screen_text: ['Full check-up ₦25,000', 'Results the same day'] },
        { id: 5, start: 14.5, end: 20, purpose: 'cta', on_screen_text: ['Book my check-up', 'We have a slot at 10am!'] },
      ]),
  },
  {
    slug: 'graphite-pro', name: 'Graphite Pro', category: 'Premium launch',
    description: 'Dark graphite and sharp blue: words snapping in one at a time, a rolling price counter, a ticker list and a dive into the key word between shots. For gadgets, phones, laptops and premium shops.',
    font: 'Inter',
    palette: { theme: 'graphite', primary: '#2997FF', secondary: '#BF5AF2', background: '#161617', text: '#F5F5F7' },
    rules: `- Graphite-black background with a faint grid and a cool glow. Text in light Inter 700; key words in bright blue.
- The hook replaces one word at a time in the centre, then the camera dives into the key word to reach the next shot.
- Prices roll like an odometer inside a drawing ring; products tick through a list beside the logo; a phone shows the menu.${PREMIUM}${SHARED}`,
    example: ex('Gadget Hub - New phones in stock', { name: 'Gadget Hub', category: 'gadget store', location: 'Ado Ekiti', phone: '0903 777 1200' },
      { primary: '#2997FF', secondary: '#BF5AF2', background: '#161617', text: '#F5F5F7' }, [
        { id: 1, start: 0, end: 3.5, purpose: 'hook', on_screen_text: ['All new phones. In stock.'] },
        { id: 2, start: 3.5, end: 7, purpose: 'brand', on_screen_text: ['Gadget Hub', 'Original · Warranty · Delivery'] },
        { id: 3, start: 7, end: 11, purpose: 'menu', on_screen_text: ['iPhone 15', 'Galaxy S24', 'Pixel 8', 'Redmi Note 13'] },
        { id: 4, start: 11, end: 14.5, purpose: 'offer', on_screen_text: ['Pay small small from ₦85,000', 'Zero interest for 3 months'] },
        { id: 5, start: 14.5, end: 20, purpose: 'cta', on_screen_text: ['Visit us today', '0903 777 1200', 'Fajuyi Road, Ado Ekiti'] },
      ]),
  },
];

export const DEMO_ADS = [
  {
    file: 'swiftpay', advertiser: 'SwiftPay Wallet (demo sponsor)', title: 'Send money in seconds', revenue: 40, theme: 'tech',
    plan: {
      title: 'SwiftPay', aspect_ratio: '9:16', duration_seconds: 15,
      style: { colors: { primary: '#5B2EFF', secondary: '#2CF6B3', background: '#0B0626', text: '#F4F1FF' } },
      scenes: [
        { id: 1, start: 0, end: 3.5, purpose: 'hook', on_screen_text: ['Send money in seconds'] },
        { id: 2, start: 3.5, end: 7.5, purpose: 'brand', on_screen_text: ['SwiftPay Wallet', 'Zero fees on your first 10 transfers'] },
        { id: 3, start: 7.5, end: 11, purpose: 'offer', on_screen_text: ['Airtime cashback', '₦500'] },
        { id: 4, start: 11, end: 15, purpose: 'cta', on_screen_text: ['Download SwiftPay', 'Demo sponsor ad'] },
      ],
    },
  },
  {
    file: 'adflash-pro', advertiser: 'Animora', title: 'Go Pro: 30 ad-free videos', revenue: 25, theme: 'bold',
    plan: {
      title: 'Animora Pro', aspect_ratio: '9:16', duration_seconds: 15,
      style: { colors: { primary: '#FF3D6E', secondary: '#FFD23F', background: '#120A1F', text: '#FFFFFF' } },
      scenes: [
        { id: 1, start: 0, end: 3.5, purpose: 'hook', on_screen_text: ['Tired of ads?'] },
        { id: 2, start: 3.5, end: 7.5, purpose: 'brand', on_screen_text: ['Animora Pro', '30 ad-free videos every month'] },
        { id: 3, start: 7.5, end: 11, purpose: 'offer', on_screen_text: ['Only per month', '₦5,000'] },
        { id: 4, start: 11, end: 15, purpose: 'cta', on_screen_text: ['Upgrade today', '1–5 minute videos included'] },
      ],
    },
  },
];
