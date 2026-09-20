/**
 * Regenerate the image-slot section of graphics prompts.md.
 *
 *   node gen-slot-prompts.mjs
 *
 * The slot list lives in server/src/services/mediaSlots.js, so the prompts
 * file and the running code cannot drift apart. Add a slot there, re-run this,
 * and the documentation follows.
 */
import { SLOTS, slotFilename } from './server/src/services/mediaSlots.js';
import fs from 'node:fs';

/** Per-slot scene brief. The shared style rules are appended to photographs. */
const BRIEF = {
  'home-hero': 'A wide view of a creative studio in Dar es Salaam mid-session: a diverse East African team working across disciplines — one at a colour-calibrated monitor showing brand work, another holding a printed proof, a third adjusting a light. Warm late-afternoon sun through tall windows, deep shadows. Leave the left third uncluttered for overlaid text.',
  'home-partner': 'Two East African colleagues at a shared desk reviewing brand materials together — printed logo sheets, colour swatches, a tablet showing a layout. One is pointing at something on the page. Mid-conversation, unposed.',
  'home-journey': 'A creative direction session working through a campaign concept: sketches, a moodboard and sticky notes across a wooden table, hands in frame, a laptop open to one side.',
  'home-ai': 'The same AI assistant interface visible on three devices at once — a laptop, a phone on a stand, and a wall-mounted kiosk screen — on a clean desk in a warm, softly lit workspace. Tall vertical composition.',
  'about-studio': 'The full studio space: open-plan, long shared desk, plants, printed work pinned across one wall, Dar es Salaam visible through large windows. A few people working naturally, nobody looking at the camera.',
  'about-why': 'A close, quiet moment of creative direction — one person studying a printed proof under a desk lamp, brand materials spread around them. Tall vertical composition, shallow depth of field.',
  'services-help': 'A first client meeting in progress: two people across a table, a notebook open with a rough project sketch, coffee cups, relaxed body language. The moment a brief is being explained rather than presented.',
  'equipment-hero': 'Staging, lighting rigs, speaker cabinets and LED panels prepared and organised in a warehouse before load-out. Clean, orderly, the scale of the kit visible.',
  'print-hero': 'A wide-format printer mid-run, a vivid colour banner emerging sharply in focus with the ink still wet. Industrial workshop behind, softly out of focus.',
  'division-creative': 'A designer at a colour-calibrated monitor working on a brand identity — logo variations visible on screen, printed colour swatches fanned beside the keyboard.',
  'division-digital': 'A website shown on a large monitor beside the same layout on a phone, a notebook of sketched user flows between them. Cool screen light mixing with warm room light.',
  'division-ai': 'A shopkeeper in Dar es Salaam smiling at their phone, an active chat conversation visible but not readable. Technology quietly serving a real small business.',
  'division-events': 'A corporate launch at full tilt: a large LED wall glowing behind a speaker on stage, haze in the light beams, an engaged seated audience. Shot from the rear three-quarter of the room.',
  'division-print': 'Finished large-format work ready for collection — rolled banners, roll-up stands and signage panels stacked and labelled in a workshop.',
  'payment-methods': 'Flat graphic, not a photograph: a horizontal strip on a transparent background showing the payment logos a Tanzanian business accepts — M-Pesa, Mixx by Yas, Airtel Money, a bank-transfer icon and a cash icon — evenly spaced in a single row, each in its own official brand colours. Above them, the words "You can pay by mobile money" in bold ink-black; below, the line "Retainers are invoiced before each cycle" in smaller grey. Clean, no background fill, no drop shadows.',
  'og-share': 'Flat graphic, not a photograph: ink-black #191919 background with the words "CREATIVE ENGINE" in bold uppercase geometric sans-serif, white, left of centre, and an acid-lime #ccff01 highlight block behind the word "ENGINE". A small five-node orbit mark lower left. Generous empty space, no other text.',
  'logo-mark': 'Flat vector on a transparent background, not a photograph: an abstract mark of five interlocking segments suggesting five divisions converging into one core. Ink black #191919 with a single acid-lime #ccff01 segment. Geometric, built on a strict grid, legible at 16px and on a six-metre banner. No text, no shadow, no 3D.',
};

const PHOTO_STYLE = 'Editorial commercial photography, natural light, shot on 35mm with shallow depth of field, authentic and unstaged — not stock-photo posing. Warm neutral grade with acid-lime #ccff01 appearing naturally in the scene where it can. East African setting, authentic clothing and environment. No text, no watermarks, no logos.';

const GRAPHIC_SLOTS = new Set(['og-share', 'logo-mark', 'payment-methods']);

let out = `

---

## 12. Image slots — upload a PNG, the site updates

Every image below is a **slot**. Generate it, rename the file to the exact
name in the table, upload it to the Media Library, and it goes live.

| Slot filename | Where it appears | Size |
|---|---|---|
`;

for (const [key, slot] of Object.entries(SLOTS)) {
  out += `| \`${slotFilename(key)}\` | ${slot.where} | ${slot.ratio} |\n`;
}

out += `
Filenames are case-sensitive and must match exactly. Any of \`.png\`, \`.jpg\`,
\`.webp\` or \`.avif\` works — \`.png\` is assumed below.

`;

for (const [key, slot] of Object.entries(SLOTS)) {
  out += `### \`${slotFilename(key)}\`\n\n`;
  out += `**${slot.label}** — ${slot.where}. ${slot.ratio}.\n\n`;
  out += '```\n' + BRIEF[key];
  if (!GRAPHIC_SLOTS.has(key)) out += ' ' + PHOTO_STYLE;
  out += '\n```\n\n';
}

const file = 'graphics prompts.md';
let md = fs.readFileSync(file, 'utf8');
// Replace any previously generated block rather than appending a second copy.
const marker = '\n\n---\n\n## 12. Image slots';
const idx = md.indexOf(marker);
if (idx !== -1) md = md.slice(0, idx);
fs.writeFileSync(file, md + out);
console.log(`  ${Object.keys(SLOTS).length} slot prompts written to ${file}`);
