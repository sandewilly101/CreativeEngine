# Graphics Prompts — Creative Engine

Prompts for generating every visual asset the platform needs. Feed these to
Midjourney, DALL·E, Adobe Firefly, Ideogram or Flux.

## Progress

Generated so far, in `Buchad/some of the prompted images/` (28 files). Sections
marked ✅ below are done; everything unmarked is still outstanding.

| Section | Status |
|---|---|
| 1. Core brand identity (1.1–1.4) | ✅ Complete |
| 2. Division icons (2.1–2.2) | ✅ Complete |
| 3.1 / 3.2 Hero imagery | ✅ Complete |
| 3.3 Division page headers | ⚠️ 1 of 5 — Creative & Marketing only |
| 4.1 Service card images | ⬜ Not started |
| 4.2 Package tier illustrations | ✅ Complete |
| 5. Print mockups (5.1–5.8) | ✅ Complete — all 8 |
| 6.1 Team portraits | ⬜ Not started |
| 6.2 Studio / culture photograph | ✅ Complete |
| 7. Social and marketing (7.1–7.4) | ✅ Complete |
| 8. Empty states and error pages (8.1–8.3) | ✅ Complete |
| 9. Document and proposal graphics (9.1–9.2) | ⬜ Not started |
| 11. Gaps in supplied photography (11.1–11.6) | ⬜ Not started |
| 12. Image slots (`ce-slot-*`) | ✅ 26 of 36 live |

**Still to generate**

- **3.3** — four division headers: Web & Digital, AI Business Systems,
  Events & Experiences, Print & Production
- **4.1** — service card images (per service, as needed)
- **6.1 / 11.2** — team portraits (one per person, identical lighting prompt)
- **9.1 / 9.2** — invoice letterhead and proposal cover
- **11.1** — real client work covers · **11.3** equipment detail shots ·
  **11.5** client logos · **11.6** Open Graph share image
- **12** — 11 of the 17 slots. Six are already live (see below); the rest are
  waiting on artwork that suits them.

**Slots now live**

Imported by `server/scripts/import-slot-images.mjs`, which fits each image to
its slot ratio and registers it in the Media Library. Re-run it after adding
artwork; it replaces rather than duplicates.

| Slot | Source | Rendered by |
|---|---|---|
| `ce-slot-home-hero.jpg` | artworks/Homepage hero.png | Homepage |
| `ce-slot-home-partner.jpg` | artworks/Homepage hero background.png | Homepage |
| `ce-slot-about-studio.jpg` | artworks/culture photograph.png | About |
| `ce-slot-division-creative.jpg` | artworks/Creative & Marketing.png | Creative division |
| `ce-slot-og-share.jpg` | artworks/Social cover banner.png | Share previews |
| `ce-slot-logo-mark.png` | artworks/Primary logo-no background.png (mark only) | Staged |
| `ce-slot-error-404.png` | artworks/404 page illustration.png | 404 page |
| `ce-slot-empty-state.png` | artworks/Empty state illustration.png | Every empty list |
| `ce-slot-ai-avatar.png` | artworks/AI assistant avatar.png | Chat widget |
| `ce-slot-package-tiers.jpg` | artworks/Package tier illustrations.png | Staged |
| `ce-slot-case-study-cover.jpg` | artworks/Case study cover template.png | Staged |
| `ce-slot-division-icons.png` | artworks/Division icons in division colours.png | Staged |

**Section 5 mockups are templates, not photographs.** §5 says to upload them
and "create the template in Admin → Website → Mockup templates and set the
four corner points of the artwork area". They are blank on purpose: a
customer's artwork is previewed on them. All eight are now seeded into
`mockup_templates` with their printable area recorded as corner fractions,
found by locating the largest contiguous white region and then checked by
rendering the box back over the photograph — the van and exhibition stand
needed correcting by hand where the detection ran onto a windscreen and a
side wall.

Likewise the case study cover is a **blank layout with space left for text**,
so it is held as a brand template rather than shown as finished artwork, and
the package tier sheet is **sliced into three**, one per package, as its
prompt specifies.

The **Instagram post template** is a backdrop, not a picture: §7.3 asks for an
ink ground with a lime wedge low-right and "generous empty space in the
upper-left two-thirds for headline text". It is used as the background of the
closing call-to-action on the homepage, with the copy set into the space left
for it — framing it as an image would have shown an empty template.

The **hero engine** previously drew a generic SVG for its core and five
placeholder glyphs for its nodes, while the real mark and the five division
icons sat unused. It now renders the actual artwork, falling back to the
inline SVG only where nothing is uploaded.

Beyond the slots, two importers place the rest against content rows:

| Target | Images |
|---|---|
| All 8 print products (`cover_media_id`) | the 8 mockups + primary logo |
| 10 services (`hero_media_id`) | mockups, lockup, mono variants, IG template, abstract hero, AI avatar |
| 3 portfolio case studies (created) | lockup, exhibition stand, IG template |
| 5 division cards | the icon sheet, sliced into five by pixel analysis |
| Header, footer, admin, portal, login | the real logo mark — `LogoMark` now renders the uploaded artwork and falls back to the built-in orbit SVG only when no logo is uploaded |
| Browser tab | Favicon.png, resized to 256px |

The portfolio table shipped empty, so the homepage showed no work at all. It
now leads with Creative Engine's own identity work — honest for an agency,
where inventing client names would not be.

**The logo.** Every layout drew a hardcoded SVG orbit mark, so the generated
logo sat in the Media Library unused. `LogoMark` now reads the `logo-mark`
slot, which covers the header, footer, admin, portal and login in one place.
Dark surfaces pass `onDark` and get `logo-mark-light`. The public header
passes it dynamically from the `overDark` state the nav already tracks, so the
mark switches with the text as the page scrolls over a dark section and on
inner pages, whose `PageHero` is dark by default; §7.1's profile picture
supplies it, with its navy avatar backdrop keyed out and its padding trimmed
so it matches the standard mark inline. Both marks are 192px rather than 512
— they render at 28–32px and load on every page.

The illustrations were generated on white despite the prompts asking for
transparency, so the importer keys the white out. The 404 art is additionally
lifted to off-white linework, since its near-black strokes were invisible
against the ink background of that page.

The remaining slots — `home-journey`, `home-ai`, `about-why`, `services-help`,
`equipment-hero`, `print-hero` and the four other division headers — still show
the shipped photography, which suits them better than a mockup or icon sheet
would. Generate the missing division headers (3.3) and they drop straight in.

---

## How this works

Generate a PNG, **name it exactly as the prompt says**, and upload it through
**Admin → Media Library**. The site picks it up immediately — no field to find,
no code change, nothing else to click.

```
generate  →  rename to ce-slot-home-hero.png  →  upload  →  live
```

Every slot filename starts `ce-slot-`. That prefix is reserved: an ordinary
upload will never collide with it by accident, which is the point — a slot
should only ever be filled deliberately.

**The rules**

- **PNG is fine everywhere.** JPG, WebP and AVIF also work. The platform
  generates its own thumbnails either way.
- **Re-uploading replaces.** Upload `ce-slot-home-hero.png` again and the new
  one wins. The old file stays in the library until you delete it.
- **Deleting reverts.** Remove a slot file and that position falls back to the
  photograph that ships with the platform.
- **The name is the only thing that matters.** Not the title, not the folder —
  the filename. `ce-slot-home-hero.png`, lowercase, exactly.
- Where a prompt says `[CLIENT NAME]` or similar, replace it before generating.
- Logos and icons should be vectorised afterwards (Illustrator image-trace, or
  [vectorizer.ai](https://vectorizer.ai)) so they stay crisp on large-format print.

You can check which slots are filled at any time: **Admin → Media Library →
Image slots**.

**Brand colours to keep consistent across every asset**

The identity runs on two accents that split the work: **lime fills, flame
speaks.** Lime is brilliant as a background but illegible as small text, so it
is used for fills, highlights and the logo core. Flame carries anything that
must be read.

| Role | Hex | Where it is used |
|---|---|---|
| Acid lime | `#ccff01` | Fills, highlight behind words, logo core, buttons |
| Deep lime | `#b4e300` | Hover edges |
| Flame orange | `#f74932` | Accent text, dots, marks, emphasis |
| Ink | `#191919` | Primary text, dark sections, footer |
| Off-white | `#f9f9f9` | Page surface |
| Warm grey | `#f2f0ec` | Alternate section surface |

Division accents: creative `#f74932` · digital `#2f6fed` · AI `#0f9488` ·
events `#8b46e0` · print `#d98200`.

**Typography referenced in prompts:** Plus Jakarta Sans (display, uppercase,
tight tracking), Inter Tight (headings), Inter (body and UI).

> **Note on existing photography.** Eleven curated photographs already ship
> with the platform and are registered in the Media Library — studio scenes,
> the five division images, equipment and the AI multi-channel shot. They are
> genuinely good and already carry the lime accent naturally in-scene. The
> prompts below cover what is *missing*, not what exists. Regenerate the
> supplied images only if you want a different look.

---

## 1. Core brand identity

### 1.1 Primary logo ✅

> **Generated** — `some of the prompted images/` → Primary logo.png, Primary logo-no background.png

```
Minimalist vector logo for "Creative Engine", a Tanzanian integrated creative
and technology agency. An abstract mark combining a stylised engine turbine
with a creative spark or nib, formed from five interlocking segments that
suggest five business divisions converging into one. Geometric, confident,
built on a strict grid. Ink black #191919 with a single acid-lime #ccff01
accent segment. Flat vector, no gradients, no shadows, no 3D. Clean negative
space, works at 16px and on a 6-metre banner. Set on pure white. Professional
African corporate branding, not generic startup style.
```
*Generate 2048×2048 PNG with transparency. Vectorise afterwards.*

### 1.2 Logo lockup (mark + wordtype) ✅

> **Generated** — `some of the prompted images/` → Logo lockup.png

```
Horizontal logo lockup: abstract five-segment engine-spark mark on the left,
the words "CREATIVE ENGINE" on the right in a bold geometric sans-serif
(Plus Jakarta Sans or similar), tight letter-spacing, ink black #191919. One acid-lime
#ccff01 segment in the mark provides the only colour accent. Generous
clear space around the lockup. Flat vector on white. Corporate identity
presentation style.
```
*Generate 3000×1000 PNG with transparency.*

### 1.3 Monochrome and reversed variants ✅

> **Generated** — `some of the prompted images/` → Monochrome and reversed variants.png

```
Same five-segment engine-spark logo mark, three variants side by side on a
neutral grey field: (1) solid ink black on white, (2) solid white on ink black
#191919, (3) solid black on white. Flat vector, identical geometry across all
three, no gradients. Brand guideline sheet layout.
```
*Generate 3000×1200 PNG.*

### 1.4 Favicon / app icon ✅

> **Generated** — `some of the prompted images/` → Favicon.png

```
App icon: the Creative Engine five-segment mark centred on an ink-black
#191919 rounded square, 20% corner radius. The mark is white with one
acid-lime #ccff01 segment. Bold, high contrast, instantly legible at
32×32 pixels. Flat vector, no bevel, no shadow, no texture.
```
*Generate 1024×1024 PNG.*

---

## 2. Division icons

One set, five icons, consistent weight. Each is used on division cards, the
services grid and the public navigation.

### 2.1 Full icon set (generate as one sheet for consistency) ✅

> **Generated** — `some of the prompted images/` → Full icon set.png

```
Five minimal line icons in a horizontal row on white, consistent 2px stroke
weight, rounded caps, 64×64 grid each, geometric and modern:
1. A painter's palette merged with a speech bubble (creative and marketing)
2. A browser window merged with a globe and a signal arc (web and digital)
3. A microchip with a soft conversational bubble emerging from it (AI systems)
4. A stage arch with lights and a rising spark (events and experiences)
5. A wide-format printer with a banner emerging from it (print and production)
Each icon drawn in ink black #191919 on white. Flat vector, no fill, no
shadow, no perspective. Equal visual weight and identical stroke across all five.
```
*Generate 3200×640 PNG, then slice into five 640×640 icons.*

### 2.2 Division icons in division colours (alternative set) ✅

> **Generated** — `some of the prompted images/` → Division icons in division colours.png

```
The same five line icons, each rendered in its own colour on a very pale tint
of that colour as a rounded-square background:
1. Palette + speech bubble in #f74932 on #fff1ee
2. Browser + globe in #2f6fed on #e8f0fe
3. Microchip + bubble in #0f9488 on #e4faf7
4. Stage arch + spark in #8b46e0 on #f4ecfd
5. Printer + banner in #d98200 on #fff4dd
2px stroke, rounded caps, 96×96 icon on a 160×160 rounded square. Flat vector.
```
*Generate as five separate 512×512 PNGs.*

---

## 3. Website hero imagery

> **Already supplied.** The homepage hero, the five division images and the
> "one partner" and "big idea" scenes ship with the platform and are wired in.
> Use the prompts below only if you want to replace them with something of
> your own, or need extra variants.

### 3.1 Homepage hero background ✅

> **Generated** — `some of the prompted images/` → Homepage hero.png, Homepage hero background.png

```
Wide cinematic photograph of a modern creative studio in Dar es Salaam,
Tanzania. A diverse East African creative team working across disciplines —
one person at a large colour-calibrated monitor showing brand designs, another
reviewing a printed proof, a third checking a lighting rig in the background.
Warm natural afternoon light through tall windows, deep shadows, an ink-black and acid-lime colour cast. Shot on 35mm, shallow depth of field, slight
film grain. Editorial commercial photography, authentic and unstaged, not a
stock-photo handshake. Space in the left third for overlaid text.
```
*Generate 2560×1440 JPG.*

### 3.2 Alternative abstract hero ✅

> **Generated** — `some of the prompted images/` → Alternative abstract hero.png

```
Abstract 3D render: five glowing ribbon-like streams in acid lime #ccff01, flame #f74932,
teal #0f9488, violet #8b46e0 and amber #d98200, flowing from five
separate origins on the left and braiding into a single powerful rope of light
on the right. Set against a near-black #0d0d0d background with a subtle
radial glow. Soft volumetric lighting, glass and light material, high-end
motion-graphics still. Clean, no text, no logo. Wide composition with empty
space on the left.
```
*Generate 2560×1440 JPG.*

### 3.3 Division page headers (five images) — 1 of 5 ✅

Generate one per division, all 2400×1000 JPG.

**Creative & Marketing** ✅ — generated: `some of the prompted images/artworks/Creative & Marketing.png`
```
Overhead photograph of a creative direction session: brand boards, colour
swatches, printed logo explorations and a tablet showing a campaign layout,
arranged on a dark walnut table. Hands of two East African creatives mid-
discussion, one pointing at a swatch. Warm directional light from the upper
left, rich shadows, ink, warm neutral and acid-lime tones dominant. Editorial photography,
shallow depth of field, authentic workspace.
```

**Web & Digital**
```
A designer's desk photographed at a low angle: a large monitor showing a
clean website wireframe in navy and white, a phone beside it showing the same
layout responsively, a notebook with sketched user flows. Cool blue #2f6fed
light from the screen mixing with warm ambient light. Dar es Salaam skyline
softly out of focus through the window behind. Modern, uncluttered, real.
```

**AI Business Systems**
```
A shopkeeper in Dar es Salaam smiling while looking at their phone, a WhatsApp
conversation visible but unreadable on screen. Soft teal #0f9488 glow from the
device. Warm, human, hopeful — technology serving a real small business, not a
sci-fi abstraction. Natural light, documentary photography style, East African
setting, authentic clothing and environment.
```

**Events & Experiences**
```
A corporate product launch in full flow at a Dar es Salaam venue: a large LED
wall glowing behind a speaker on stage, violet #8b46e0 and warm stage lighting
washing across an engaged seated audience, haze in the light beams. Shot from
the rear three-quarter of the room. Cinematic, high production value,
professional event photography, real crowd energy.
```

**Print & Production**
```
Close-up of a wide-format printer mid-run, a vivid colour banner emerging
sharply in focus with the ink still glossy. Amber #d98200 machine indicator
lights, industrial workshop background softly blurred. Shallow depth of field,
crisp detail on the substrate texture, sense of craft and scale. Industrial
commercial photography.
```

---

## 4. Service and package imagery

### 4.1 Service card images (generate per service as needed)

Template — substitute the subject:

```
Clean editorial photograph representing [SERVICE SUBJECT], shot in a Tanzanian
professional context. Natural light, uncluttered composition, navy and orange
colour grading to match brand. Shallow depth of field, authentic and
unstaged, no visible text or logos. Square crop, subject positioned slightly
off-centre.
```

Suggested subjects: `a brand guideline document being reviewed` · `a website
being tested on a phone` · `a WhatsApp business conversation on a phone` ·
`an exhibition stand being assembled` · `a roll-up banner in a hotel lobby` ·
`branded t-shirts folded in a stack` · `an LED wall being rigged` ·
`a vehicle being wrapped in vinyl`

*Generate 1200×1200 JPG each.*

### 4.2 Package tier illustrations ✅

> **Generated** — `some of the prompted images/` → Package tier illustrations.png

```
Three minimal isometric illustrations in a row, flat vector style, on white:
1. "Launch Pad" — a small rocket on a launch platform built from a logo, a
   browser window and a business card, in flame #f74932 tones
2. "Always On" — a circular loop of connected icons (content, hosting, chat
   bubble) rotating continuously, in ink #191919 and acid lime #ccff01
3. "Event Engine" — a stage with LED screen, truss and audience silhouettes
   forming a single machine-like unit, in violet #8b46e0 and amber #d98200
Consistent isometric angle, 2px outlines, limited flat palette, generous
white space. Modern SaaS illustration style, no gradients, no text.
```
*Generate 3000×1000 PNG, slice into three.*

---

## 5. Print mockup templates

These are the base scene photographs the mockup system overlays artwork onto.
**Critical:** the surface receiving artwork must be evenly lit, unobstructed
and shot as close to straight-on as the scene allows.

### 5.1 Outdoor banner mockup ✅

> **Generated** — `some of the prompted images/` → Outdoor banner mockup.png

```
Photograph of a blank white PVC banner, 6 metres by 3 metres, stretched taut
with visible metal eyelets and rope, mounted on a metal frame outside a modern
office building in Dar es Salaam. Bright overcast daylight for even
illumination with no harsh shadows across the banner face. Shot straight on,
slight natural perspective, the full banner clearly visible and unobstructed.
The banner surface is pure blank white with realistic fabric texture and a
gentle natural ripple. Photorealistic commercial mockup.
```

### 5.2 Roll-up banner mockup ✅

> **Generated** — `some of the prompted images/` → Roll-up banner mockup.png

```
Photograph of a blank white roll-up banner stand, 850mm by 2000mm, standing in
a bright modern hotel conference foyer in East Africa. Clean neutral flooring,
soft even daylight from large windows, out-of-focus background. The banner face
is pure blank white with subtle realistic fabric texture. Shot straight on at
banner-centre height, the entire banner visible from base to top cap.
Photorealistic product mockup.
```

### 5.3 Media wall / step-and-repeat mockup ✅

> **Generated** — `some of the prompted images/` → Media wall.png

```
Photograph of a blank white step-and-repeat media wall, 3 metres by 2.4 metres,
in an event press area with a red carpet running in front of it. Even
professional lighting with no hotspots across the wall face. Shot straight on,
the full wall visible and unobstructed. Pure blank white fabric surface with
realistic tension-fabric texture. Photorealistic event mockup.
```

### 5.4 T-shirt mockup ✅

> **Generated** — `some of the prompted images/` → T-shirt mockup.png

```
Flat-lay photograph of a blank white cotton crew-neck t-shirt on a light
neutral grey surface, perfectly centred and symmetrical, sleeves arranged
naturally, shot directly from above. Soft even studio lighting, realistic
fabric weave and subtle natural fold shadows at the sleeves only — the chest
print area is completely flat, clean and unshadowed. Photorealistic apparel
mockup.
```

### 5.5 Branded mug mockup ✅

> **Generated** — `some of the prompted images/` → Branded mug mockup.png

```
Photograph of a blank white ceramic mug on a light wooden desk, handle turned
to the right, shot straight on at mug height. Soft directional studio light
from the upper left, gentle realistic reflection and shadow. The front face of
the mug is clean, evenly lit and unobstructed. Shallow depth of field on the
background. Photorealistic product mockup.
```

### 5.6 Vehicle branding mockup ✅

> **Generated** — `some of the prompted images/` → Vehicle branding mockup.png

```
Photograph of a clean blank white panel van parked on a plain concrete surface,
shot from a straight-on side three-quarter angle showing the full side panel
and part of the front. Bright even overcast daylight, no harsh reflections or
hotspots on the paintwork. The side panel is large, flat and completely
unobstructed. Modern commercial van, East African street context softly blurred
behind. Photorealistic vehicle mockup.
```

### 5.7 Exhibition stand mockup ✅

> **Generated** — `some of the prompted images/` → Exhibition stand mockup.png

```
Photograph of a blank white modular exhibition stand, 3 metres by 3 metres, on
a trade-fair floor. Large flat rear wall panel, a small counter to one side,
spotlights above. Even professional lighting across the rear panel with no
shadows or hotspots. Shot straight on to the rear wall. All surfaces pure
blank white with realistic fabric and laminate textures. Photorealistic
exhibition mockup.
```

### 5.8 Signage mockup ✅

> **Generated** — `some of the prompted images/` → Signage mockup.png

```
Photograph of a blank white illuminated fascia sign mounted above the entrance
of a modern retail unit in Dar es Salaam. Shot straight on from street level,
early evening blue hour so the internal illumination is visible and even. The
sign face is pure blank white, evenly lit edge to edge, completely
unobstructed. Photorealistic architectural signage mockup.
```

*Generate all mockups at 2400×1800 JPG minimum. Upload to Media Library, then
create the template in **Admin → Website → Mockup templates** and set the four
corner points of the artwork area.*

---

## 6. Team and about page

### 6.1 Team portraits

```
Professional corporate headshot of an East African [man/woman] in their
[20s/30s/40s], smart-casual business attire, photographed against a plain
ink black #191919 background. Soft even key light from the front left with a
subtle rim light, warm skin tones, natural relaxed expression looking directly
at camera, slight smile. Shot at 85mm, shallow depth of field. Consistent
studio setup so all portraits in the set match. Square crop, head and
shoulders, eyes on the upper third.
```
*Generate 1000×1000 JPG per person. Keep the lighting description identical
across the whole team so the grid looks like one shoot.*

### 6.2 Studio / culture photograph ✅

> **Generated** — `some of the prompted images/` → culture photograph.png

```
Wide photograph of a Tanzanian creative agency studio: an open-plan space with
a long shared desk, plants, printed work pinned to a wall, large windows with
Dar es Salaam visible outside. A few team members working naturally, nobody
posing for the camera. Warm afternoon light, lived-in and real rather than
sterile. Editorial documentary photography, authentic African creative
workplace.
```
*Generate 2400×1350 JPG.*

---

## 7. Social and marketing

### 7.1 Social profile picture ✅

> **Generated** — `some of the prompted images/` → Social profile picture.png

```
Square social media profile image: the Creative Engine five-segment mark
centred on a ink black #191919 background with a very subtle radial gradient
toward #122E52 at the edges. The mark is white with one acid-lime #ccff01
segment. Generous padding around the mark so it stays clear when cropped to a
circle. Flat, clean, no text.
```
*Generate 1024×1024 PNG.*

### 7.2 Social cover banner ✅

> **Generated** — `some of the prompted images/` → Social cover banner.png

```
Wide banner: ink black #191919 to #0d0d0d gradient background with five
subtle glowing ribbon streams in the brand colours converging from left to
right. The words "From Ideas to Impact." in clean bold sans-serif, white, on
the left third. Generous empty space on the right. No logo, no other text.
Modern, confident, uncluttered.
```
*Generate 1500×500 PNG for X, and 1640×856 PNG for LinkedIn.*

### 7.3 Instagram post template ✅

> **Generated** — `some of the prompted images/` → Instagram post template.png

```
Square social media graphic template: ink black #191919 background, a bold
acid-lime #ccff01 geometric accent shape entering from the bottom-right
corner, generous empty space in the upper-left two-thirds for headline text.
Small subtle five-segment mark in the bottom-left corner. Flat design, no
photograph, no placeholder text, no lorem ipsum. Clean modern brand template.
```
*Generate 1080×1080 PNG.*

### 7.4 Case study cover template ✅

> **Generated** — `some of the prompted images/` → Case study cover template.png

```
Landscape template for a case study card: a photograph area occupying the top
two-thirds (leave it as a flat mid-grey placeholder block), with a solid deep
navy #191919 band across the bottom third containing generous empty space for
a client name and project title. A thin acid-lime #ccff01 rule separating
the two areas. Flat vector layout, no text, no lorem ipsum.
```
*Generate 1600×1200 PNG.*

---

## 8. Illustrations for empty states and error pages

### 8.1 Empty state illustration ✅

> **Generated** — `some of the prompted images/` → Empty state illustration.png

```
Minimal line illustration on white: an open empty cardboard box with a few
small geometric shapes floating gently above it, drawn in a single 2px deep
ink #191919 stroke with one small flame #f74932 accent shape.
Friendly, light, not sad. Flat vector, generous white space, no text,
no shadow.
```
*Generate 800×600 PNG with transparency.*

### 8.2 404 page illustration ✅

> **Generated** — `some of the prompted images/` → 404 page illustration.png

```
Minimal line illustration: a disconnected plug and socket floating apart with
a few small spark marks between them, drawn in 2px ink black #191919 stroke
with flame #f74932 sparks. Playful, simple, on white. Flat vector, no text,
no shadow, generous white space.
```
*Generate 800×600 PNG with transparency.*

### 8.3 AI assistant avatar ✅

> **Generated** — `some of the prompted images/` → AI assistant avatar.png

```
Simple friendly chat avatar: a soft rounded square in acid lime #ccff01 containing
a minimal white speech-bubble glyph with three dots inside it. Flat vector, no
gradient, no face, no eyes, no robot. Approachable and professional. Reads
clearly at 40 pixels.
```
*Generate 512×512 PNG with transparency.*

---

## 9. Document and proposal graphics

### 9.1 Invoice and quote letterhead

```
Clean A4 letterhead design, portrait: a ink black #191919 band across the top
120mm tall containing generous space for a logo on the left, with a thin
acid-lime #ccff01 rule beneath it. A matching thin navy rule across the
bottom 20mm. Everything between is pure white and empty. No text, no lorem
ipsum, no placeholder content. Minimal corporate stationery design.
```
*Generate 2480×3508 PNG (A4 at 300dpi).*

### 9.2 Proposal cover

```
A4 portrait cover page: full-bleed ink black #191919 to #122E52 gradient, five
subtle brand-coloured ribbon streams converging diagonally across the lower
half, generous empty space in the upper half for a title. Small five-segment
mark bottom-centre. Premium, confident, understated. No text, no lorem ipsum.
```
*Generate 2480×3508 PNG.*

---

## 10. Prompt-writing notes

A few things that consistently improve results:

- **Name the colour hex explicitly.** Models handle `#ccff01` far better than
  "orange", and it keeps the whole asset set consistent.
- **Say "no text" and "no lorem ipsum".** Generators love adding garbled
  lettering to anything that looks like a layout.
- **For mockups, ask for "even lighting, no harsh shadows, shot straight on".**
  A dramatically lit mockup looks better in isolation but makes overlaid
  artwork look pasted on.
- **Generate sets in one image where consistency matters** (icon sets, team
  portraits), then slice. Separate generations drift in weight and style.
- **For Tanzanian context, name the city.** "Dar es Salaam" produces noticeably
  more authentic architecture, vehicles and clothing than "Africa".
- **Reject the first handshake.** If a prompt returns generic stock-photo
  business imagery, add "documentary, unstaged, authentic, not stock
  photography" and regenerate.


---

## 11. Gaps the supplied photography does not cover

These have no equivalent in the images that ship with the platform. Generating
them is what will make the site feel like yours rather than a template.

### 11.1 Real client work (replace the seeded case studies)

The portfolio seeds with no images at all — it is waiting for your actual
projects. Photograph real work wherever you can; these prompts are a stopgap
for a launch deadline, not a substitute.

```
Editorial photograph of [DESCRIBE THE DELIVERABLE — e.g. a branded exhibition
stand at a trade fair / a fleet of wrapped delivery vans / a conference stage
mid-session] for a Tanzanian corporate client. Shot on location in Dar es
Salaam, natural light where possible, wide establishing composition with the
branding clearly legible. Documentary commercial photography, authentic and
unstaged, no visible watermarks or placeholder text.
```
*Generate 1600×1200 JPG per case study.*

### 11.2 Team portraits

Nothing in the supplied set shows individual people at portrait scale.

```
Professional corporate headshot of an East African [man/woman] in their
[20s/30s/40s], smart-casual business attire, photographed against a plain
ink-black #191919 background. Soft even key light from the front left with a
subtle rim light, warm skin tones, natural relaxed expression looking directly
at camera, slight smile. Shot at 85mm, shallow depth of field. Square crop,
head and shoulders, eyes on the upper third.
```
*Generate 1000×1000 JPG per person. Keep this prompt identical across the whole
team so the grid reads as one shoot rather than a collage.*

### 11.3 Equipment detail shots

The supplied equipment image is a single wide scene. The hire catalogue shows
thirteen distinct items, each of which wants its own photograph.

```
Clean product photograph of [EQUIPMENT ITEM — e.g. an LED video wall panel /
a line array speaker cabinet / a moving head spotlight / a modular stage deck]
against a plain warm grey #f2f0ec background. Even studio lighting, slight
shadow beneath for grounding, shot straight on at three-quarter angle. The
item fills most of the frame, no props, no people, no text. Commercial
equipment catalogue photography.
```
*Generate 1200×900 JPG per item.*

### 11.4 Print mockup templates

Covered in section 5 above, and none of these exist yet. The mockup system in
**Admin → Website → Mockup templates** is inert until you upload at least one.
Start with the outdoor banner and the roll-up — they cover most enquiries.

### 11.5 Client logos

The logo wall renders whatever you upload and looks unfinished while empty.
Use your clients' real logos with their permission; do not generate fake ones.
If you have permission for only a few, show only those — three real logos beat
twelve invented ones.

### 11.6 Open Graph / social share image

Nothing currently renders when a page is shared to WhatsApp or LinkedIn.

```
Wide social share card: ink-black #191919 background, the words
"CREATIVE ENGINE" in bold uppercase geometric sans-serif (Plus Jakarta Sans),
tight letter-spacing, white, positioned left of centre. An acid-lime #ccff01
highlight block behind the single word "ENGINE". Small five-node orbit mark
in the lower left. Generous empty space. Flat, no photograph, no other text.
```
*Generate 1200×630 PNG. Set it in Admin → Settings → SEO.*


---

## 12. Image slots — upload a PNG, the site updates

Every image below is a **slot**. Generate it, rename the file to the exact
name in the table, upload it to the Media Library, and it goes live.

| Slot filename | Where it appears | Size |
|---|---|---|
| `ce-slot-home-hero.png` | The wide image under the homepage headline | 21:9 — 2560×1100 |
| `ce-slot-home-partner.png` | Beside "The waste is not the work" on the homepage | 4:3 — 1600×1200 |
| `ce-slot-home-journey.png` | The sticky image beside the seven-stage journey | 4:3 — 1600×1200 |
| `ce-slot-home-ai.png` | The tall image in the dark AI section | 3:4 — 1200×1600 |
| `ce-slot-about-studio.png` | The About page header image | 4:3 — 1600×1200 |
| `ce-slot-about-why.png` | The tall image beside "Six suppliers. Six people to blame." | 3:4 — 1200×1600 |
| `ce-slot-services-help.png` | Beside "Tell us the problem, not the service" | 4:3 — 1600×1200 |
| `ce-slot-equipment-hero.png` | The equipment catalogue page header | 4:3 — 1600×1200 |
| `ce-slot-print-hero.png` | The print shop page header | 4:3 — 1600×1200 |
| `ce-slot-division-creative.png` | Header of the creative division page | 4:3 — 1600×1200 |
| `ce-slot-division-digital.png` | Header of the digital division page | 4:3 — 1600×1200 |
| `ce-slot-division-ai.png` | Header of the AI division page | 4:3 — 1600×1200 |
| `ce-slot-division-events.png` | Header of the events division page | 4:3 — 1600×1200 |
| `ce-slot-division-print.png` | Header of the print division page | 4:3 — 1600×1200 |
| `ce-slot-payment-methods.png` | The "How we price" band on the Packages page | Wide — 2075×758, transparent PNG |
| `ce-slot-og-share.png` | What appears when a page is shared to WhatsApp or LinkedIn | 1.91:1 — 1200×630 |
| `ce-slot-logo-mark.png` | Replaces the built-in orbit mark in the header and footer | Square — 512×512, transparent PNG |

Filenames are case-sensitive and must match exactly. Any of `.png`, `.jpg`,
`.webp` or `.avif` works — `.png` is assumed below.

### `ce-slot-home-hero.png`

**Homepage hero** — The wide image under the homepage headline. 21:9 — 2560×1100.

```
A wide view of a creative studio in Dar es Salaam mid-session: a diverse East African team working across disciplines — one at a colour-calibrated monitor showing brand work, another holding a printed proof, a third adjusting a light. Warm late-afternoon sun through tall windows, deep shadows. Leave the left third uncluttered for overlaid text. Editorial commercial photography, natural light, shot on 35mm with shallow depth of field, authentic and unstaged — not stock-photo posing. Warm neutral grade with acid-lime #ccff01 appearing naturally in the scene where it can. East African setting, authentic clothing and environment. No text, no watermarks, no logos.
```

### `ce-slot-home-partner.png`

**Homepage — one partner** — Beside "The waste is not the work" on the homepage. 4:3 — 1600×1200.

```
Two East African colleagues at a shared desk reviewing brand materials together — printed logo sheets, colour swatches, a tablet showing a layout. One is pointing at something on the page. Mid-conversation, unposed. Editorial commercial photography, natural light, shot on 35mm with shallow depth of field, authentic and unstaged — not stock-photo posing. Warm neutral grade with acid-lime #ccff01 appearing naturally in the scene where it can. East African setting, authentic clothing and environment. No text, no watermarks, no logos.
```

### `ce-slot-home-journey.png`

**Homepage — the journey** — The sticky image beside the seven-stage journey. 4:3 — 1600×1200.

```
A creative direction session working through a campaign concept: sketches, a moodboard and sticky notes across a wooden table, hands in frame, a laptop open to one side. Editorial commercial photography, natural light, shot on 35mm with shallow depth of field, authentic and unstaged — not stock-photo posing. Warm neutral grade with acid-lime #ccff01 appearing naturally in the scene where it can. East African setting, authentic clothing and environment. No text, no watermarks, no logos.
```

### `ce-slot-home-ai.png`

**Homepage — AI band** — The tall image in the dark AI section. 3:4 — 1200×1600.

```
The same AI assistant interface visible on three devices at once — a laptop, a phone on a stand, and a wall-mounted kiosk screen — on a clean desk in a warm, softly lit workspace. Tall vertical composition. Editorial commercial photography, natural light, shot on 35mm with shallow depth of field, authentic and unstaged — not stock-photo posing. Warm neutral grade with acid-lime #ccff01 appearing naturally in the scene where it can. East African setting, authentic clothing and environment. No text, no watermarks, no logos.
```

### `ce-slot-about-studio.png`

**About — studio** — The About page header image. 4:3 — 1600×1200.

```
The full studio space: open-plan, long shared desk, plants, printed work pinned across one wall, Dar es Salaam visible through large windows. A few people working naturally, nobody looking at the camera. Editorial commercial photography, natural light, shot on 35mm with shallow depth of field, authentic and unstaged — not stock-photo posing. Warm neutral grade with acid-lime #ccff01 appearing naturally in the scene where it can. East African setting, authentic clothing and environment. No text, no watermarks, no logos.
```

### `ce-slot-about-why.png`

**About — why we exist** — The tall image beside "Six suppliers. Six people to blame.". 3:4 — 1200×1600.

```
A close, quiet moment of creative direction — one person studying a printed proof under a desk lamp, brand materials spread around them. Tall vertical composition, shallow depth of field. Editorial commercial photography, natural light, shot on 35mm with shallow depth of field, authentic and unstaged — not stock-photo posing. Warm neutral grade with acid-lime #ccff01 appearing naturally in the scene where it can. East African setting, authentic clothing and environment. No text, no watermarks, no logos.
```

### `ce-slot-services-help.png`

**Services — not sure where to start** — Beside "Tell us the problem, not the service". 4:3 — 1600×1200.

```
A first client meeting in progress: two people across a table, a notebook open with a rough project sketch, coffee cups, relaxed body language. The moment a brief is being explained rather than presented. Editorial commercial photography, natural light, shot on 35mm with shallow depth of field, authentic and unstaged — not stock-photo posing. Warm neutral grade with acid-lime #ccff01 appearing naturally in the scene where it can. East African setting, authentic clothing and environment. No text, no watermarks, no logos.
```

### `ce-slot-equipment-hero.png`

**Equipment hire header** — The equipment catalogue page header. 4:3 — 1600×1200.

```
Staging, lighting rigs, speaker cabinets and LED panels prepared and organised in a warehouse before load-out. Clean, orderly, the scale of the kit visible. Editorial commercial photography, natural light, shot on 35mm with shallow depth of field, authentic and unstaged — not stock-photo posing. Warm neutral grade with acid-lime #ccff01 appearing naturally in the scene where it can. East African setting, authentic clothing and environment. No text, no watermarks, no logos.
```

### `ce-slot-print-hero.png`

**Print shop header** — The print shop page header. 4:3 — 1600×1200.

```
A wide-format printer mid-run, a vivid colour banner emerging sharply in focus with the ink still wet. Industrial workshop behind, softly out of focus. Editorial commercial photography, natural light, shot on 35mm with shallow depth of field, authentic and unstaged — not stock-photo posing. Warm neutral grade with acid-lime #ccff01 appearing naturally in the scene where it can. East African setting, authentic clothing and environment. No text, no watermarks, no logos.
```

### `ce-slot-division-creative.png`

**Division — Creative & Marketing** — Header of the creative division page. 4:3 — 1600×1200.

```
A designer at a colour-calibrated monitor working on a brand identity — logo variations visible on screen, printed colour swatches fanned beside the keyboard. Editorial commercial photography, natural light, shot on 35mm with shallow depth of field, authentic and unstaged — not stock-photo posing. Warm neutral grade with acid-lime #ccff01 appearing naturally in the scene where it can. East African setting, authentic clothing and environment. No text, no watermarks, no logos.
```

### `ce-slot-division-digital.png`

**Division — Web & Digital** — Header of the digital division page. 4:3 — 1600×1200.

```
A website shown on a large monitor beside the same layout on a phone, a notebook of sketched user flows between them. Cool screen light mixing with warm room light. Editorial commercial photography, natural light, shot on 35mm with shallow depth of field, authentic and unstaged — not stock-photo posing. Warm neutral grade with acid-lime #ccff01 appearing naturally in the scene where it can. East African setting, authentic clothing and environment. No text, no watermarks, no logos.
```

### `ce-slot-division-ai.png`

**Division — AI Business Systems** — Header of the AI division page. 4:3 — 1600×1200.

```
A shopkeeper in Dar es Salaam smiling at their phone, an active chat conversation visible but not readable. Technology quietly serving a real small business. Editorial commercial photography, natural light, shot on 35mm with shallow depth of field, authentic and unstaged — not stock-photo posing. Warm neutral grade with acid-lime #ccff01 appearing naturally in the scene where it can. East African setting, authentic clothing and environment. No text, no watermarks, no logos.
```

### `ce-slot-division-events.png`

**Division — Events & Experiences** — Header of the events division page. 4:3 — 1600×1200.

```
A corporate launch at full tilt: a large LED wall glowing behind a speaker on stage, haze in the light beams, an engaged seated audience. Shot from the rear three-quarter of the room. Editorial commercial photography, natural light, shot on 35mm with shallow depth of field, authentic and unstaged — not stock-photo posing. Warm neutral grade with acid-lime #ccff01 appearing naturally in the scene where it can. East African setting, authentic clothing and environment. No text, no watermarks, no logos.
```

### `ce-slot-division-print.png`

**Division — Print & Equipment** — Header of the print division page. 4:3 — 1600×1200.

```
Finished large-format work ready for collection — rolled banners, roll-up stands and signage panels stacked and labelled in a workshop. Editorial commercial photography, natural light, shot on 35mm with shallow depth of field, authentic and unstaged — not stock-photo posing. Warm neutral grade with acid-lime #ccff01 appearing naturally in the scene where it can. East African setting, authentic clothing and environment. No text, no watermarks, no logos.
```

### `ce-slot-payment-methods.png`

**Payment methods strip** — The "How we price" band on the Packages page. Wide — 2075×758, transparent PNG.

```
Flat graphic, not a photograph: a horizontal strip on a transparent background showing the payment logos a Tanzanian business accepts — M-Pesa, Mixx by Yas, Airtel Money, a bank-transfer icon and a cash icon — evenly spaced in a single row, each in its own official brand colours. Above them, the words "You can pay by mobile money" in bold ink-black; below, the line "Retainers are invoiced before each cycle" in smaller grey. Clean, no background fill, no drop shadows.
```

### `ce-slot-og-share.png`

**Social share card** — What appears when a page is shared to WhatsApp or LinkedIn. 1.91:1 — 1200×630.

```
Flat graphic, not a photograph: ink-black #191919 background with the words "CREATIVE ENGINE" in bold uppercase geometric sans-serif, white, left of centre, and an acid-lime #ccff01 highlight block behind the word "ENGINE". A small five-node orbit mark lower left. Generous empty space, no other text.
```

### `ce-slot-logo-mark.png`

**Logo mark** — Replaces the built-in orbit mark in the header and footer. Square — 512×512, transparent PNG.

```
Flat vector on a transparent background, not a photograph: an abstract mark of five interlocking segments suggesting five divisions converging into one core. Ink black #191919 with a single acid-lime #ccff01 segment. Geometric, built on a strict grid, legible at 16px and on a six-metre banner. No text, no shadow, no 3D.
```

