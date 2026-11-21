# App intro videos: the quality standard

How Animora must animate an app or software product (from the owner's reference briefs).
The engine follows this in `server/ai/motion/browser/story.js` (scene `walk`) and `server/ai/story/index.js`.

## Always
- Use the uploaded screenshots and logo as the real assets. Never redesign the interface or invent fake UI or unreadable text.
- Real device mockups: a phone for tall screenshots, a browser window on a laptop for wide ones. Tilt them in 3D, with soft shadows.
- Smooth, intentional easing. Every move has a reason. Slow for product shots, quicker for reveals.
- Restrained particles and light (a sweep, a soft glow). No random spinning, no explosions, no slideshow feel.
- Show the product being used: a finger (phone) or mouse pointer (desktop) moves, taps or clicks, and the camera leans in on the tap.
- Lift the important panels or cards out of the screen with depth and shadow, then settle them back.
- Change screens like the real platform (iOS-style push), never as a hard cut between unrelated slides.
- When both desktop and phone screenshots exist, finish with both devices together.
- End on the original logo and app name, clean and stable.

## Sequence (default)
1. Opening: dark or soft background, restrained particles; the logo turns in with a light sweep and a glow, then the name ("Introducing ...").
2. The device turns around to face the viewer; the camera moves closer.
3. Step by step through the screenshots in upload order: pointer glides, taps, camera leans in, a panel lifts, tall pages scroll; caption + "Step n of N".
4. Desktop + phone together (when both are available).
5. Logo, name and call to action.

## Looks (the five reference directions)
- Cinematic SaaS launch: dark, cinematic lighting, smooth camera, particles and light streaks kept subtle.
- Futuristic tech reveal: neon lines and grid, faster pushes, short light flashes, still readable.
- Minimal luxury: soft studio light, lots of empty space, slow precise moves, no neon.
- High-energy showcase: snappy overshoots, quick wipes and match cuts, brief pauses so the product reads.
- Epic logo transformation: the logo is the source of the motion and carries into the interface.
