/**
 * Find candidate photographs for the equipment catalogue.
 *
 * Searches Openverse, which indexes openly-licensed media and can filter to
 * licences that permit commercial use — the catalogue is a commercial rental
 * listing, so anything else is unusable regardless of how well it matches.
 *
 * This step only gathers candidates and their licence details; it downloads
 * nothing and writes nothing to the database. Picking among the candidates is
 * a judgement about whether the photo actually shows the item described, which
 * happens after reviewing this output.
 *
 *   node scripts/source-equipment-images.mjs > candidates.json
 */
import fs from 'node:fs';

const API = 'https://api.openverse.org/v1/images/';

/**
 * Query terms per item, ordered most to least specific. A line array is not a
 * "speaker" and a moving head is not a "light": the specific term is tried
 * first and the looser ones are only a fallback, so a vague photo never wins
 * over an accurate one.
 */
const ITEMS = [
  { slug: 'led-p39-indoor',  queries: ['indoor LED video wall stage', 'LED wall panel screen', 'LED video wall'] },
  { slug: 'led-p49-outdoor', queries: ['outdoor LED screen concert', 'outdoor LED display billboard', 'large LED screen'] },
  { slug: 'line-array-12',        queries: ['line array speakers', 'line array loudspeaker concert', 'flown PA line array'] },
  { slug: 'pa-system-500',        queries: ['PA speaker stage', 'loudspeaker subwoofer stage', 'sound system speakers'] },
  { slug: 'moving-head-spot',     queries: ['moving head stage light', 'intelligent lighting fixture stage', 'moving head spot'] },
  { slug: 'led-par-rgbw',          queries: ['LED par can stage light', 'par can uplighter', 'stage par light'] },
  { slug: 'stage-deck',       queries: ['stage deck platform modular', 'portable stage platform', 'stage riser'] },
  { slug: 'truss-box-3m',         queries: ['aluminium box truss', 'stage truss segment', 'lighting truss'] },
  { slug: 'stretch-tent-10x15',   queries: ['stretch tent event', 'bedouin stretch tent', 'event marquee tent'] },
  { slug: 'tiffany-chair',        queries: ['tiffany chiavari chair', 'chiavari chair banquet', 'event chair banquet'] },
  { slug: 'round-table-10',       queries: ['round banquet table set', 'banquet round table linen', 'event round table'] },
  { slug: 'generator-60kva',      queries: ['silent diesel generator', 'generator set canopy', 'portable power generator'] },
  { slug: 'projector-10000',        queries: ['large venue projector', 'conference projector installation', 'projector lens'] },
];

async function search(q) {
  const url = `${API}?q=${encodeURIComponent(q)}&license_type=commercial`
            + `&page_size=8&mature=false&extension=jpg,png`;
  const res = await fetch(url, { headers: { 'User-Agent': 'creative-engine/1.0' } });
  if (!res.ok) return [];
  const json = await res.json();
  return (json.results || []).map(r => ({
    id: r.id,
    title: r.title,
    url: r.url,
    thumb: r.thumbnail,
    license: `${r.license} ${r.license_version || ''}`.trim(),
    creator: r.creator,
    source: r.source,
    landing: r.foreign_landing_url,
    width: r.width,
    height: r.height,
  }));
}

const out = {};
for (const item of ITEMS) {
  out[item.slug] = [];
  for (const q of item.queries) {
    const hits = await search(q);
    for (const h of hits) {
      if (out[item.slug].some(x => x.url === h.url)) continue;
      out[item.slug].push({ ...h, matched_query: q });
    }
    if (out[item.slug].length >= 10) break;
  }
  console.error(`${item.slug}: ${out[item.slug].length} candidates`);
}

fs.writeFileSync(process.argv[2] || 'candidates.json', JSON.stringify(out, null, 1));
console.error('\nwritten to ' + (process.argv[2] || 'candidates.json'));
