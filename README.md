# Creative Engine

An integrated platform for a creative, digital, AI, events and production
agency — built for the Tanzanian market. Public website, admin back office and
client portal in one application.

Prices are held in Tanzanian shillings and displayed in TZS or USD using live
exchange rates. VAT is applied at 18% and invoices carry the TIN and VRN fields
the TRA expects.

---

## What is in here

| Layer | Stack |
|---|---|
| Front end | React 18, React Router 6, Recharts, Vite |
| API | Node 20+, Express 4 |
| Database | MySQL 8 / MariaDB 10.4+ |
| Auth | JWT access tokens with rotating refresh tokens, bcrypt |
| Images | sharp (automatic thumbnails, EXIF-aware) |
| FX rates | open.er-api.com, with a jsDelivr fallback and manual override |

### The five divisions

The whole platform is organised around them:

1. **Creative & Marketing** — branding, campaigns, social, content, video
2. **Web & Digital** — websites, hosting, domains, SEO, e-commerce
3. **AI Business Systems** — assistants, lead capture, knowledge bases
4. **Events & Experiences** — conferences, launches, activations, exhibitions
5. **Print, Branding & Equipment** — large format, signage, merchandise, hire

---

## Getting it running

### Prerequisites

- **Node.js 20 or newer** — `node --version`
- **MySQL 8 or MariaDB 10.4+** — XAMPP, Laragon, or a standalone install

### 1. Install

```bash
cd creative-engine
npm run install:all
```

This installs three sets of dependencies: the root (which provides
`concurrently`, used to run the API and front end together), then `server/`
and `client/`. If you install the sub-projects individually instead, run
`npm install` in the root as well or `npm run dev` will fail with
`'concurrently' is not recognized`.

### 2. Configure

```bash
cp server/.env.example server/.env
```

Open `server/.env` and set at minimum:

```ini
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password      # blank on a default XAMPP install
DB_NAME=creative_engine

# Generate a real secret before going live:
#   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
JWT_SECRET=replace-this-with-a-long-random-string
```

### 3. Create the database

Make sure MySQL is running first (start it from the XAMPP control panel, or
`C:\xampp\mysql\bin\mysqld.exe` directly), then:

```bash
npm run db:setup
```

This creates 69 tables, seeds the five divisions, 29 services, 4 packages,
13 equipment items, 8 print products and 15 FAQs, and prompts you to create
the first administrator account.

To wipe and start again: `cd server && npm run db:reset`

### 4. Start

```bash
npm run dev
```

- Public website — http://localhost:5173
- Admin — http://localhost:5173/admin
- Client portal — http://localhost:5173/portal
- API — http://localhost:4000/api

---

## The design system

The identity runs on two accents that split the work: **lime fills, flame
speaks.** Acid lime is brilliant as a background but illegible as small text,
so it carries fills, highlights and the logo core; flame orange carries
anything that has to be read.

| Token | Hex | Used for |
|---|---|---|
| `--primary` | `#ccff01` | Fills, the highlight behind words, buttons, logo core |
| `--flame` | `#f74932` | Accent text, dots, emphasis |
| `--ink` | `#191919` | Body text, dark sections, footer, admin sidebar |
| `--surface` | `#f9f9f9` | Page ground |
| `--surface-2` | `#f2f0ec` | Alternate section ground |

Type is **Plus Jakarta Sans** for display (uppercase, tight tracking),
**Inter Tight** for headings and **Inter** for body and UI.

Everything lives in `client/src/styles/global.css`. Change a token there and
it propagates through the public site, admin and client portal — they share
one system rather than three.

### Motion

`client/src/hooks/useMotion.js` holds the observers; `components/Motion.jsx`
wraps them as components:

| Component | What it does |
|---|---|
| `<Marquee>` | Auto-scrolling band. Clones its track so the loop is seamless at any width, and pauses on hover so the content is readable. |
| `<Reveal stagger={90}>` | Fades and lifts its children into view on scroll, offsetting each one. |
| `<ZoomIn>` | Image that settles from a slight scale-up as it enters. |
| `<Odometer value="24">` | Rolling digit strip that counts up when scrolled to. |
| `<Words text="…">` | Headline that reveals word by word. |
| `<Cursor>` | Trailing ring that swells over anything interactive. |
| `<ScrollProgress>` | The lime→flame bar that fills as you move down the page. |
| `useParallax(0.06)` | Gentle translation against scroll on a tagged element. |

Every one of these checks `prefers-reduced-motion` and degrades to the
**finished** state rather than the starting state — someone who has asked
their system for less movement still sees all the content, immediately.

### Photography

Eleven curated photographs ship with the platform, registered in the Media
Library with titles and alt text, and wired into the homepage, the five
division pages, the equipment catalogue and the about page.

```bash
cd server && node db/importMedia.js
```

Re-running is safe: images are matched on their SHA-256 checksum, so an
already-imported file is skipped rather than duplicated.

### Image slots

Sixteen fixed positions on the public site — the homepage hero, each division
header, the social share card — resolve to whatever has been uploaded under a
reserved filename:

```
generate  →  rename to ce-slot-home-hero.png  →  upload  →  live
```

No admin field to find and no code change. Re-uploading replaces; deleting
reverts to the shipped photograph. PNG, JPG, WebP and AVIF all work.

**Admin → Media Library → Image slots** shows which are filled and the exact
filename for each. The definitions live in
`server/src/services/mediaSlots.js`; after changing them run
`node gen-slot-prompts.mjs` to regenerate the prompt list so the two cannot
drift apart.

`graphics prompts.md` has a ready prompt for every slot, plus what is still
**missing** — print mockup templates, team portraits, equipment detail shots
and real client work.

---

## First things to do after installing

1. **Change the admin password** — Admin → Users, or via your profile menu.
2. **Enter your TIN and VRN** — Admin → Settings → Finance. These print on
   every tax invoice and the TRA requires them.
3. **Set your real contact details and brand colours** — Admin → Settings.
4. **Upload your logo** — Admin → Media Library, then set it in Settings.
5. **Review the seeded prices** — Admin → Website → Services. Every price is a
   realistic placeholder for the Tanzanian market, but they are not your prices.
6. **Add real clients** — Admin → Clients.

---

## How money is handled

Every monetary value is stored as an **integer number of cents in TZS**.

```
1_000_000 cents  =  TZS 10,000.00
```

The shilling has no circulating subunit in practice, but keeping two implied
decimals means VAT at 18%, percentage discounts and per-square-metre rates
never accumulate floating-point drift.

When you enter a price in the admin, you enter cents. `250000000` is
TZS 2,500,000.

**Currency display.** Users toggle between TZS and USD in the header. Rates
refresh automatically twice a day from a free public feed. An admin can set a
manual rate (Settings → Currency) which always overrides the live one — useful
when you have agreed a fixed rate with a client. Quotes and invoices lock the
rate at the moment they are issued, so a historical document never changes
value.

**Payments.** M-Pesa, Mixx by Yas, Airtel Money, HaloPesa, bank transfer, cash,
cheque and card are all recordable, each with a provider reference for
reconciliation.

One thing worth knowing: Mixx by Yas does not support recurring direct debit.
Subscriptions therefore default to `invoice_push` — an invoice is raised and
the client pays it — rather than assuming automatic collection.

---

## Roles

| Role | Sees |
|---|---|
| **Administrator** | Everything, always. Cannot have permissions removed. |
| **Staff** | Operational modules. No settings, no destructive finance actions. Editable in Settings → Roles. |
| **Client** | Only their own organisation's projects, invoices, deliverables and requests. Draft invoices are hidden from them entirely. |

Client scoping is enforced in the API, not just hidden in the UI — a client
calling the API directly still only ever receives their own organisation's rows.

---

## Notable features

**Quote → project → invoice.** An accepted quote converts to a project (with a
task auto-created per line item) and to an invoice (carrying both parties' tax
numbers). Clients accept quotes from an emailed link without needing a login;
the typed signature, timestamp and IP are recorded.

**Proofing with pin annotations.** Upload a deliverable, and the client clicks
anywhere on the artwork to drop a numbered comment pin. Positions are stored as
percentages so they land correctly at any screen size. Versions are tracked, and
when a deliverable exceeds its stated revision limit the platform says so
plainly — extra rounds are billable rather than silently absorbed.

**Equipment hire that cannot be double-booked.** Availability is computed
against every confirmed booking and maintenance window, and setup/teardown
times extend the block — gear leaving the store the day before an event is not
available to anyone else that day. Attempting to over-book returns a 409 naming
exactly what is short.

**Print preflight.** Artwork is checked for effective DPI at the final printed
size, colour mode and aspect-ratio mismatch before anything reaches the press.
Large format is priced per square metre with substrate modifiers and per-unit
finishing charges (per metre of hem, per eyelet).

**AI assistant with grounding.** The assistant answers only from an approved
knowledge base, which you populate in one click from your own FAQs, services
and packages. If it cannot ground an answer it says so and offers a human
rather than inventing a price. The Insights tab lists every question it could
not answer — that list is the most useful thing the module produces.

**Capacity-based retainers.** Subscriptions carry a stated number of included
deliverables per cycle, with usage tracked and overage rates defined. This is
deliberate: flat "unlimited" retainers are what quietly destroy agency margin.

---

## Project layout

```
creative-engine/
├── server/
│   ├── db/
│   │   ├── schema.sql          69 tables, views, indexes
│   │   ├── seed.sql            divisions, services, equipment, FAQs
│   │   └── setup.js            bootstrap script
│   ├── src/
│   │   ├── config/             env and database pool
│   │   ├── middleware/         auth, uploads, error handling
│   │   ├── routes/             12 route modules
│   │   ├── services/           CRUD factory, FX, notifications, audit log
│   │   └── utils/              money maths, helpers
│   └── uploads/                media, organised by year/month
├── client/
│   └── src/
│       ├── components/         UI kit, ResourceManager, MediaPicker, ProofViewer
│       ├── context/            auth, currency, toasts
│       ├── layouts/            public, admin, portal
│       ├── pages/
│       │   ├── public/         marketing site
│       │   ├── admin/          back office
│       │   └── portal/         client portal
│       └── utils/              API client, formatting
├── graphics prompts.md         AI prompts for every visual asset
└── README.md
```

---

## Deploying

1. Set `NODE_ENV=production` and a strong `JWT_SECRET` in `server/.env`.
2. Point `CLIENT_URL` at your real domain.
3. Build the front end: `npm run build`.
4. Start the API with a process manager: `pm2 start server/src/index.js`.
   In production the API serves the built front end from the same origin.
5. Put nginx or Apache in front with TLS.
6. Back up the `creative_engine` database **and** the `server/uploads`
   directory. The database alone will not restore your media.

---

## Troubleshooting

**"Cannot reach the database"** — MySQL is not running, or `server/.env` has the
wrong credentials. On XAMPP, start MySQL from the control panel and leave
`DB_PASSWORD` blank unless you have set one.

**Setup fails partway** — run `cd server && npm run db:reset` to drop and
rebuild cleanly.

**The chat widget does not appear** — that is intentional. It stays hidden until
an AI assistant is active and `AI_API_KEY` is set in `server/.env`. An
unconfigured assistant would only be able to refer everyone to a human.

**Thumbnails are not generating** — sharp needs its native binary. Reinstall
with `cd server && npm install sharp --force`.

**`'concurrently' is not recognized`** — the root dependencies were not
installed. Run `npm install` in the `creative-engine` folder itself, not just
in `server/` and `client/`.

**Port 4000 already in use** — an old server is still running. On Windows:
`taskkill /F /IM node.exe`.
