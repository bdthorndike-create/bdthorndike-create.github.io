// Static site generator: HeatCostCalc
// Run: SITE_URL=https://yourdomain.com node build.mjs  -> outputs ./dist
import fs from 'fs';
import path from 'path';

const SITE_URL = (process.env.SITE_URL || 'https://example.pages.dev').replace(/\/$/, '');
const SITE_NAME = 'HeatCostCalc';
const OUT = path.resolve('dist');

// Energy content and typical efficiencies are standard engineering approximations.
// defaultPrice values are ILLUSTRATIVE placeholders. Users enter their own local prices.
const SYSTEMS = [
  { id: 'heating-oil',   name: 'Heating oil furnace/boiler', short: 'Heating oil',   unit: 'gallon', btu: 138500,  eff: 0.85, price: 5.26 },
  { id: 'propane',       name: 'Propane furnace/boiler',     short: 'Propane',       unit: 'gallon', btu: 91500,   eff: 0.92, price: 2.52 },
  { id: 'natural-gas',   name: 'Natural gas furnace/boiler', short: 'Natural gas',   unit: 'therm',  btu: 100000,  eff: 0.92, price: 1.30 },
  { id: 'kerosene',      name: 'Kerosene heater/furnace',    short: 'Kerosene',      unit: 'gallon', btu: 135000,  eff: 0.80, price: 4.50 },
  { id: 'electric',      name: 'Electric baseboard/resistance', short: 'Electric resistance', unit: 'kWh', btu: 3412, eff: 1.00, price: 0.18 },
  { id: 'heat-pump',     name: 'Cold-climate heat pump',     short: 'Heat pump',     unit: 'kWh',    btu: 3412,    eff: 2.50, price: 0.18 },
  // price note: oil/propane/gas/electric defaults = EIA Winter Fuels Outlook 2026-27 (Oct 6, 2026); gas converted from $13.44/Mcf at ~10.36 therms/Mcf
  { id: 'wood-pellets',  name: 'Wood pellet stove',          short: 'Wood pellets',  unit: 'ton',    btu: 16500000, eff: 0.80, price: 330 },
  { id: 'cordwood',      name: 'Cordwood stove',             short: 'Cordwood',      unit: 'cord',   btu: 22000000, eff: 0.65, price: 300 },
];
const DEFAULT_LOAD = 70; // MMBtu delivered heat per year (adjustable)

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const costPerMMBtu = (s, price) => price / (s.btu * s.eff / 1e6);
const money = n => '$' + Math.round(n).toLocaleString('en-US');

const CSS = `
:root{--bg:#fafaf7;--fg:#1d2330;--mut:#5b6475;--acc:#c2410c;--card:#fff;--bd:#e4e2da}
@media(prefers-color-scheme:dark){:root{--bg:#14171d;--fg:#eceae4;--mut:#9aa3b2;--acc:#fb923c;--card:#1c2028;--bd:#2c313b}}
*{box-sizing:border-box}body{margin:0;font:16px/1.6 system-ui,sans-serif;background:var(--bg);color:var(--fg)}
.w{max-width:860px;margin:0 auto;padding:0 16px}
header{border-bottom:1px solid var(--bd);padding:14px 0}header a{color:var(--fg);font-weight:700;text-decoration:none}
h1{font-size:1.8rem;line-height:1.2;margin:1.2rem 0 .5rem}h2{margin-top:2rem}
.card{background:var(--card);border:1px solid var(--bd);border-radius:10px;padding:16px;margin:16px 0}
label{display:block;font-size:.85rem;color:var(--mut);margin:8px 0 2px}
input{width:100%;padding:8px;border:1px solid var(--bd);border-radius:6px;background:var(--bg);color:var(--fg);font:inherit}
.grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(200px,1fr))}
table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:8px;border-bottom:1px solid var(--bd)}
.big{font-size:1.5rem;font-weight:700;color:var(--acc)}.mut{color:var(--mut);font-size:.9rem}
.aff{border:1px dashed var(--bd);border-radius:10px;padding:12px;margin:16px 0}
a{color:var(--acc)}footer{border-top:1px solid var(--bd);margin-top:3rem;padding:20px 0;color:var(--mut);font-size:.85rem}
ul.links{columns:2;padding-left:18px}@media(max-width:560px){ul.links{columns:1}}
`;

const CALC_JS = `
const SYS = window.__SYS__;
const cpm = (s,p)=>p/(s.btu*s.eff/1e6);
const $ = id => document.getElementById(id);
const fmt = n => '$' + Math.round(n).toLocaleString('en-US');
function runIndex(){
  const load = parseFloat($('load').value)||0;
  const rows = SYS.map(s=>{
    const p = parseFloat($('p-'+s.id).value)||0;
    return {s, c: cpm(s,p), a: cpm(s,p)*load};
  }).sort((x,y)=>x.a-y.a);
  $('out').innerHTML = rows.map((r,i)=>'<tr><td>'+(i+1)+'</td><td>'+r.s.name+'</td><td>'+fmt(r.c)+' / MMBtu</td><td><b>'+fmt(r.a)+'</b> / yr</td></tr>').join('');
}
function runPair(){
  const [a,b] = SYS;
  const load = parseFloat($('load').value)||0;
  const pa = parseFloat($('pa').value)||0, pb = parseFloat($('pb').value)||0;
  const ca = cpm(a,pa)*load, cb = cpm(b,pb)*load;
  const diff = Math.abs(ca-cb), win = ca<cb ? a : b;
  $('ra').textContent = fmt(ca); $('rb').textContent = fmt(cb);
  $('rw').textContent = ca===cb ? 'Equal cost' : win.short+' saves about '+fmt(diff)+' per year';
  // break-even price of A that makes costs equal, given B's cost
  const beA = (cpm(b,pb)) * (a.btu*a.eff/1e6);
  const beB = (cpm(a,pa)) * (b.btu*b.eff/1e6);
  $('bea').textContent = a.short+' breaks even with '+b.short+' at about $'+beA.toFixed(2)+' per '+a.unit;
  $('beb').textContent = b.short+' breaks even with '+a.short+' at about $'+beB.toFixed(2)+' per '+b.unit;
}
document.querySelectorAll('input').forEach(i=>i.addEventListener('input', window.__RUN__==='pair'?runPair:runIndex));
(window.__RUN__==='pair'?runPair:runIndex)();
`;

const layout = ({ title, desc, canonical, body, extraHead = '' }) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE_URL}${canonical}">
<link rel="stylesheet" href="/style.css">
<!-- ANALYTICS: paste Cloudflare Web Analytics / Plausible snippet here -->
<!-- ADSENSE: paste AdSense script here after approval -->
${extraHead}
</head><body>
<header><div class="w"><a href="/">🔥 ${SITE_NAME}</a></div></header>
<main class="w">${body}</main>
<footer><div class="w">
<p><b>Disclosure:</b> As an Amazon Associate I earn from qualifying purchases. Some links on this site are affiliate links; we may earn a commission at no cost to you. Figures are estimates based on standard fuel energy content and typical equipment efficiency. Actual costs vary with your home, climate, equipment and local prices. Not professional advice.</p>
<p><a href="/about/">About &amp; methodology</a> · <a href="/privacy/">Privacy</a></p>
</div></footer></body></html>`;

const AMAZON_TAG = process.env.AMAZON_TAG || 'earthazoid-20';
const amz = q => `https://www.amazon.com/s?k=${encodeURIComponent(q)}&tag=${AMAZON_TAG}`;
const SHOP = {
  'heating-oil':  ['Oil tank level gauge', 'oil tank gauge'],
  'propane':      ['Propane tank gauge', 'propane tank gauge'],
  'natural-gas':  ['Gas leak detector', 'natural gas leak detector'],
  'kerosene':     ['Kerosene fuel containers', 'kerosene fuel can'],
  'electric':     ['Baseboard heater thermostats', 'baseboard heater thermostat'],
  'heat-pump':    ['Mini-split heat pumps', 'mini split heat pump'],
  'wood-pellets': ['Pellet stove cleaning kits', 'pellet stove cleaning kit'],
  'cordwood':     ['Firewood moisture meters', 'wood moisture meter'],
};
const GENERAL = [
  ['Smart & programmable thermostats', 'smart thermostat'],
  ['Window insulation kits', 'window insulation kit'],
  ['Carbon monoxide detectors', 'carbon monoxide detector'],
];
const affiliateSlot = (label, systems = []) => {
  const items = [...systems.map(s => SHOP[s.id]).filter(Boolean), ...GENERAL];
  return `
<aside class="aff"><b>${esc(label)}</b>
<p class="mut">Ways to cut your heating bill or heat more safely (links go to Amazon):</p>
<ul>${items.map(([t, q]) => `<li><a href="${amz(q)}" rel="sponsored nofollow noopener" target="_blank">${esc(t)}</a></li>`).join('')}</ul>
<p class="mut">As an Amazon Associate I earn from qualifying purchases.</p></aside>`;
};

function write(rel, content) {
  const f = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, content);
}

fs.rmSync(OUT, { recursive: true, force: true });
write('style.css', CSS);
write('calc.js', CALC_JS);
write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);

// ---------- Pair pages ----------
const urls = ['/'];
const pairs = [];
for (let i = 0; i < SYSTEMS.length; i++)
  for (let j = i + 1; j < SYSTEMS.length; j++) pairs.push([SYSTEMS[i], SYSTEMS[j]]);

for (const [a, b] of pairs) {
  const slug = `${a.id}-vs-${b.id}`;
  const canonical = `/compare/${slug}/`;
  urls.push(canonical);
  const ca = costPerMMBtu(a, a.price) * DEFAULT_LOAD;
  const cb = costPerMMBtu(b, b.price) * DEFAULT_LOAD;
  const win = ca < cb ? a : b;
  const title = `${a.short} vs ${b.short} Heating Cost Calculator`;
  const desc = `Compare annual heating costs of ${a.short.toLowerCase()} and ${b.short.toLowerCase()}. Enter your local prices to see yearly cost and the break-even fuel price.`;
  const others = pairs.filter(([x, y]) => (x === a || y === a || x === b || y === b) && !(x === a && y === b)).slice(0, 8)
    .map(([x, y]) => `<li><a href="/compare/${x.id}-vs-${y.id}/">${esc(x.short)} vs ${esc(y.short)}</a></li>`).join('');
  const body = `
<h1>${esc(a.short)} vs ${esc(b.short)}: Which Costs Less to Heat Your Home?</h1>
<p>Enter your own local prices and annual heating need below. The calculator shows yearly cost for each system and the fuel price at which they cost the same.</p>
<div class="card">
 <div class="grid">
  <div><label for="pa">${esc(a.short)} price ($ per ${a.unit})</label><input id="pa" type="number" step="0.01" value="${a.price}"></div>
  <div><label for="pb">${esc(b.short)} price ($ per ${b.unit})</label><input id="pb" type="number" step="0.01" value="${b.price}"></div>
  <div><label for="load">Annual heat needed (MMBtu delivered)</label><input id="load" type="number" step="1" value="${DEFAULT_LOAD}"></div>
 </div>
 <table><tr><th>${esc(a.short)} per year</th><th>${esc(b.short)} per year</th></tr>
 <tr><td class="big" id="ra"></td><td class="big" id="rb"></td></tr></table>
 <p><b id="rw"></b></p>
 <p class="mut" id="bea"></p><p class="mut" id="beb"></p>
</div>
${affiliateSlot('Planning an upgrade?', [a, b])}
<h2>How the numbers work</h2>
<p>Each fuel is converted to delivered heat: <i>cost per million BTU = price ÷ (BTU per unit × system efficiency ÷ 1,000,000)</i>. We assume ${esc(a.name.toLowerCase())} runs at ${Math.round(a.eff * 100)}% efficiency (${a.eff > 1 ? 'a seasonal COP of ' + a.eff : 'AFUE-style'}) with ${a.btu.toLocaleString()} BTU per ${a.unit}, and ${esc(b.name.toLowerCase())} at ${Math.round(b.eff * 100)}% with ${b.btu.toLocaleString()} BTU per ${b.unit}.</p>
<p>With the default prices shown (U.S. average winter 2026-27 forecasts from the EIA where available; see the About page) ($${a.price} per ${a.unit} for ${esc(a.short.toLowerCase())}, $${b.price} per ${b.unit} for ${esc(b.short.toLowerCase())}) and ${DEFAULT_LOAD} MMBtu of heat, the estimate is ${money(ca)} vs ${money(cb)} per year, favoring ${esc(win.short.toLowerCase())}. Your prices will differ, so use your latest bill or supplier quote.</p>
<h2>What this does not include</h2>
<ul><li>Equipment purchase and installation cost, and available rebates or tax credits</li>
<li>Maintenance, fan/pump electricity, chimney work, fuel storage</li>
<li>Heat pump efficiency drops in very cold weather; the ${a.id === 'heat-pump' || b.id === 'heat-pump' ? 'figure used here is a seasonal average' : 'heat pump figure is not used on this page'}</li>
<li>Home insulation and size, which change how much heat you need</li></ul>
<h2>Other comparisons</h2><ul class="links">${others}</ul>
<p><a href="/">See all heating systems ranked →</a></p>
<script>window.__SYS__=${JSON.stringify([a, b])};window.__RUN__='pair';</script>
<script src="/calc.js"></script>`;
  const ld = { '@context': 'https://schema.org', '@type': 'WebApplication', name: title, applicationCategory: 'UtilitiesApplication', operatingSystem: 'Any', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } };
  write(`compare/${slug}/index.html`, layout({ title, desc, canonical, body, extraHead: `<script type="application/ld+json">${JSON.stringify(ld)}</script>` }));
}

// ---------- Home ----------
const inputs = SYSTEMS.map(s => `<div><label for="p-${s.id}">${esc(s.name)} ($ per ${s.unit})</label><input id="p-${s.id}" type="number" step="0.01" value="${s.price}"></div>`).join('');
const allLinks = pairs.map(([x, y]) => `<li><a href="/compare/${x.id}-vs-${y.id}/">${esc(x.short)} vs ${esc(y.short)}</a></li>`).join('');
write('index.html', layout({
  title: 'Home Heating Cost Calculator: Compare Oil, Propane, Gas, Electric, Heat Pump, Pellets',
  desc: 'Free calculator that ranks home heating systems by yearly cost using your local fuel prices.',
  canonical: '/',
  body: `<h1>Home Heating Cost Calculator</h1>
<p>Enter your local fuel prices to rank eight common heating systems by estimated yearly cost. Starting prices for oil, propane, gas and electricity are U.S. average winter 2026-27 forecasts from the EIA; kerosene, pellets and cordwood are rough estimates. Replace them with your own local prices.</p>
<div class="card"><div class="grid">${inputs}
<div><label for="load">Annual heat needed (MMBtu delivered)</label><input id="load" type="number" value="${DEFAULT_LOAD}"></div></div>
<table><tr><th>#</th><th>System</th><th>Cost per MMBtu</th><th>Estimated yearly cost</th></tr><tbody id="out"></tbody></table></div>
${affiliateSlot('Compare heating options')}
<h2>Head-to-head comparisons</h2><ul class="links">${allLinks}</ul>
<script>window.__SYS__=${JSON.stringify(SYSTEMS)};window.__RUN__='index';</script><script src="/calc.js"></script>`,
}));

// ---------- About / Privacy ----------
write('about/index.html', layout({ title: `About ${SITE_NAME} and Methodology`, desc: 'How the heating cost calculations work.', canonical: '/about/',
  body: `<h1>About &amp; Methodology</h1><p>${SITE_NAME} is a free tool for estimating home heating costs. Delivered heat cost = fuel price ÷ (energy content per unit × efficiency). Energy contents: heating oil 138,500 BTU/gal, propane 91,500 BTU/gal, natural gas 100,000 BTU/therm, kerosene 135,000 BTU/gal, electricity 3,412 BTU/kWh, pellets about 16.5 million BTU/ton, seasoned cordwood about 22 million BTU/cord (varies by species). Efficiencies are typical assumptions and can be changed by choosing different prices or load.</p><p>Default prices for heating oil ($5.26/gal), propane ($2.52/gal), natural gas ($1.30/therm, converted from $13.44 per thousand cubic feet) and electricity (18 cents/kWh, rounded from the 18.23 cent forecast) come from the U.S. Energy Information Administration's Winter Fuels Outlook 2026-27, published October 6, 2026. They are national averages, so your local price will differ. Defaults for kerosene, wood pellets and cordwood are rough estimates, not sourced figures. Replace every default with your own latest price.</p>` }));
write('privacy/index.html', layout({ title: 'Privacy Policy', desc: 'Privacy policy.', canonical: '/privacy/',
  body: `<h1>Privacy Policy</h1><p>Calculator inputs stay in your browser and are not sent to us. We may use privacy-friendly analytics and advertising/affiliate partners, which may set cookies. Contact: <!-- ADD EMAIL --></p>` }));
urls.push('/about/', '/privacy/');

write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `<url><loc>${SITE_URL}${u}</loc></url>`).join('\n')}\n</urlset>\n`);
write('_headers', `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n`);
console.log(`Built ${urls.length} pages (${pairs.length} comparisons) into ${OUT}`);
