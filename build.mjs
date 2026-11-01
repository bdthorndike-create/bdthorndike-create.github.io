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
try{const q=parseFloat(new URLSearchParams(location.search).get('load'));if(q>0&&q<2000&&$('load'))$('load').value=q;}catch(e){}
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
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E%F0%9F%94%A5%3C/text%3E%3C/svg%3E">
<meta property="og:type" content="website"><meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${SITE_URL}${canonical}"><meta name="twitter:card" content="summary">
<link rel="stylesheet" href="/style.css">
<!-- ANALYTICS: paste Cloudflare Web Analytics / Plausible snippet here -->
<!-- ADSENSE: paste AdSense script here after approval -->
${extraHead}
</head><body>
<header><div class="w"><a href="/">🔥 ${SITE_NAME}</a></div></header>
<main class="w">${body}</main>
<footer><div class="w">
<p><b>Disclosure:</b> As an Amazon Associate I earn from qualifying purchases. Some links on this site are affiliate links; we may earn a commission at no cost to you. Figures are estimates based on standard fuel energy content and typical equipment efficiency. Actual costs vary with your home, climate, equipment and local prices. Not professional advice.</p>
<p><a href="/tools/heat-need/">Find your heat need</a> · <a href="/guides/">Guides</a> · <a href="/state/">By state</a> · <a href="/about/">About &amp; methodology</a> · <a href="/privacy/">Privacy</a></p>
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
  <div><label for="load">Annual heat needed (MMBtu delivered) · <a href="/tools/heat-need/">find yours</a></label><input id="load" type="number" step="1" value="${DEFAULT_LOAD}"></div>
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
<div><label for="load">Annual heat needed (MMBtu delivered) · <a href="/tools/heat-need/">find yours</a></label><input id="load" type="number" value="${DEFAULT_LOAD}"></div></div>
<table><tr><th>#</th><th>System</th><th>Cost per MMBtu</th><th>Estimated yearly cost</th></tr><tbody id="out"></tbody></table></div>
${affiliateSlot('Compare heating options')}
<h2>Heating costs by state</h2><p><a href="/state/">Start with your state's electricity rate →</a></p>
<h2>Tools and guides</h2><ul><li><a href="/tools/heat-need/">How much heat does your home use? (from your fuel bills)</a></li><li><a href="/guides/heat-pump-vs-oil-what-decides/">Heat pump vs heating oil: what decides which costs less</a></li><li><a href="/guides/btu-mmbtu-therm-kwh/">BTU, MMBtu, therm and kWh explained</a></li><li><a href="/guides/propane-vs-heating-oil/">Propane vs heating oil</a></li><li><a href="/guides/wood-pellets-vs-cordwood/">Wood pellets vs cordwood</a></li></ul>
<h2>Head-to-head comparisons</h2><ul class="links">${allLinks}</ul>
<script>window.__SYS__=${JSON.stringify(SYSTEMS)};window.__RUN__='index';</script><script src="/calc.js"></script>`,
}));

// ---------- State pages ----------
// Residential electricity, cents/kWh, EIA Electric Power Monthly Table 5.6.A, August 2026.
const ELEC = {
  'Hawaii':47.18,'Maine':32.11,'Massachusetts':30.48,'California':29.75,'Alaska':29.41,'New York':28.65,'Rhode Island':28.18,
  'New Hampshire':27.64,'District of Columbia':25.98,'New Jersey':24.61,'Connecticut':24.51,'Vermont':23.84,'Michigan':22.99,
  'Pennsylvania':21.77,'Maryland':21.4,'Wisconsin':19.41,'Ohio':19.38,'Illinois':19.32,'Delaware':18.7,'Virginia':17.64,
  'Minnesota':17.2,'Colorado':17.17,'Iowa':17.06,'Indiana':17.02,'New Mexico':16.51,'Alabama':16.33,'West Virginia':16.31,
  'Missouri':16.02,'Oregon':15.92,'Texas':15.91,'Georgia':15.9,'South Carolina':15.76,'Montana':15.57,'Kansas':15.47,
  'South Dakota':15.15,'Arizona':15.05,'Florida':14.99,'North Carolina':14.95,'Oklahoma':14.82,'Washington':14.63,
  'Mississippi':14.43,'Wyoming':14.43,'Arkansas':14.37,'Kentucky':13.8,'Nebraska':13.54,'Tennessee':13.42,'Idaho':13.37,
  'North Dakota':13.31,'Utah':13.31,'Louisiana':12.87,'Nevada':12.72,
};
const EXCLUDE = new Set(['Hawaii', 'Florida']); // negligible home heating demand; skip thin pages
const ranked = Object.entries(ELEC).sort((x, y) => y[1] - x[1]).map(e => e[0]);
const slugOf = n => n.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
const pairSlug = (x, y) => { const i = SYSTEMS.indexOf(x), j = SYSTEMS.indexOf(y); return i < j ? `${x.id}-vs-${y.id}` : `${y.id}-vs-${x.id}`; };
const byId = id => SYSTEMS.find(s => s.id === id);
const stateNames = Object.keys(ELEC).filter(n => !EXCLUDE.has(n)).sort();
const hp = byId('heat-pump'), oil = byId('heating-oil'), prop = byId('propane'), gas = byId('natural-gas'), res = byId('electric');
urls.push('/state/');

for (const name of stateNames) {
  const cents = ELEC[name], kwh = cents / 100, rank = ranked.indexOf(name) + 1;
  const slug = slugOf(name), canonical = `/state/${slug}/`;
  urls.push(canonical);
  const sys = SYSTEMS.map(s => (s.unit === 'kWh' ? { ...s, price: kwh } : s));
  const costs = sys.map(s => ({ s, a: costPerMMBtu(s, s.price) * DEFAULT_LOAD })).sort((x, y) => x.a - y.a);
  const get = id => costs.find(c => c.s.id === id).a;
  const beOil = costPerMMBtu(oil, oil.price) * (hp.btu * hp.eff / 1e6);   // $/kWh where heat pump = oil
  const beProp = costPerMMBtu(prop, prop.price) * (hp.btu * hp.eff / 1e6);
  const beGas = costPerMMBtu(gas, gas.price) * (hp.btu * hp.eff / 1e6);
  const hpVs = (id, be) => `${esc(name)}'s ${cents.toFixed(2)} cents/kWh residential rate is ${kwh <= be ? 'below' : 'above'} the ${(be * 100).toFixed(1)} cents/kWh break-even against ${esc(byId(id).short.toLowerCase())} at default prices, so a heat pump ${kwh <= be ? 'costs less to run' : 'costs more to run'} in this comparison.`;
  const title = `Home Heating Costs in ${name}: Heat Pump vs Oil, Propane, Gas, Electric`;
  const desc = `Estimate yearly heating cost in ${name} using the state's ${cents.toFixed(2)}¢/kWh electricity rate. Compare heat pump, oil, propane, natural gas and more.`;
  const inputs2 = sys.map(s => `<div><label for="p-${s.id}">${esc(s.name)} ($ per ${s.unit})</label><input id="p-${s.id}" type="number" step="0.01" value="${s.unit === 'kWh' ? kwh.toFixed(4) : s.price}"></div>`).join('');
  const pairLinks = [[hp, oil], [hp, prop], [hp, gas], [hp, res], [oil, prop], [oil, gas]]
    .map(([x, y]) => `<li><a href="/compare/${pairSlug(x, y)}/">${esc(x.short)} vs ${esc(y.short)}</a></li>`).join('');
  const body = `
<h1>Home Heating Costs in ${esc(name)}</h1>
<p>${esc(name)} residential electricity averaged <b>${cents.toFixed(2)} cents per kWh</b> in August 2026 (EIA), which ranks ${rank} of ${ranked.length} among states and DC from highest to lowest. Electricity price is the biggest state-by-state difference for heat pumps and electric heat, so the calculator below starts with ${esc(name)}'s rate for those two systems and U.S. average winter 2026-27 forecasts for oil, propane and natural gas. Replace any price with your own.</p>
<div class="card"><div class="grid">${inputs2}
<div><label for="load">Annual heat needed (MMBtu delivered) · <a href="/tools/heat-need/">find yours</a></label><input id="load" type="number" value="${DEFAULT_LOAD}"></div></div>
<table><tr><th>#</th><th>System</th><th>Cost per MMBtu</th><th>Estimated yearly cost</th></tr><tbody id="out"></tbody></table></div>
${affiliateSlot(`Heating a home in ${name}?`, [hp, oil])}
<h2>${esc(name)} at default prices</h2>
<ul>
<li>Heat pump: about ${money(get('heat-pump'))} per year; electric resistance: about ${money(get('electric'))} per year.</li>
<li>Heating oil: about ${money(get('heating-oil'))}; propane: about ${money(get('propane'))}; natural gas: about ${money(get('natural-gas'))}.</li>
<li>${hpVs('heating-oil', beOil)}</li>
<li>${hpVs('propane', beProp)}</li>
<li>${hpVs('natural-gas', beGas)}</li>
</ul>
<p class="mut">These use the default ${DEFAULT_LOAD} MMBtu of annual heat. Colder climates and larger or leakier homes need more, which scales every cost up proportionally and widens the gaps between systems. Local gas, oil and propane prices in ${esc(name)} may differ from the national averages used here.</p>
<h2>Related comparisons</h2><ul class="links">${pairLinks}</ul>
<p><a href="/state/">All states</a> · <a href="/">All systems ranked</a></p>
<script>window.__SYS__=${JSON.stringify(sys)};window.__RUN__='index';</script><script src="/calc.js"></script>`;
  write(`state/${slug}/index.html`, layout({ title, desc, canonical, body }));
}
write('state/index.html', layout({
  title: 'Home Heating Costs by State', desc: 'State-by-state home heating cost calculators using local electricity rates.', canonical: '/state/',
  body: `<h1>Home Heating Costs by State</h1><p>Pick your state to start the calculator with its residential electricity rate (EIA, August 2026).</p>
<ul class="links">${stateNames.map(n => `<li><a href="/state/${slugOf(n)}/">${esc(n)}</a> (${ELEC[n].toFixed(2)}¢/kWh)</li>`).join('')}</ul>
<script>try{var q=parseFloat(new URLSearchParams(location.search).get('load'));if(q>0&&q<2000)document.querySelectorAll('ul.links a').forEach(function(a){a.href+='?load='+q;});}catch(e){}</script>`,
}));

// ---------- Heat-need tool ----------
urls.push('/tools/heat-need/');
{
  const rows = SYSTEMS.map(s => `<tr><td>${esc(s.name)}</td>
<td><input id="amt-${s.id}" type="number" min="0" step="any" placeholder="0" aria-label="${esc(s.short)} used per year"></td>
<td>${esc(s.unit)}${s.unit === 'kWh' ? ' (heating only)' : ''}</td>
<td><input id="eff-${s.id}" type="number" min="1" step="1" value="${Math.round(s.eff * 100)}" aria-label="${esc(s.short)} efficiency percent"></td></tr>`).join('');
  const js = `
const SYS=${JSON.stringify(SYSTEMS.map(s => ({ id: s.id, btu: s.btu })))};
function run(){let t=0;for(const s of SYS){const a=parseFloat(document.getElementById('amt-'+s.id).value)||0;const e=(parseFloat(document.getElementById('eff-'+s.id).value)||0)/100;t+=a*s.btu*e/1e6;}
document.getElementById('res').textContent=t.toFixed(1);
const v=t>0?t.toFixed(1):'';
document.getElementById('go').innerHTML=t>0?'<a href="/?load='+v+'">Rank all systems with '+v+' MMBtu →</a> · <a href="/state/?load='+v+'">Pick your state</a>':'';}
document.querySelectorAll('input').forEach(i=>i.addEventListener('input',run));run();`;
  const body = `
<h1>How Much Heat Does Your Home Use?</h1>
<p>Enter what you actually burned or used for heating over a full year, from your fuel delivery receipts or utility bills. The tool converts it to <b>MMBtu of delivered heat</b>, the number every calculator on this site asks for. It multiplies each fuel by its energy content and by your system's efficiency, so a gallon of oil burned in an 85% efficient boiler counts for less than the gallon's full energy.</p>
<div class="card">
<table><tr><th>Fuel / system</th><th>Used per year</th><th>Unit</th><th>Efficiency %</th></tr>${rows}</table>
<p>Delivered heat: <span class="big" id="res">0.0</span> MMBtu per year</p>
<p id="go"></p>
</div>
<h2>Tips for good numbers</h2>
<ul>
<li>Use a full 12 months so you capture the whole heating season.</li>
<li>For electricity, enter only the kWh used for heating (a heat pump or baseboard heat), not the whole house. If you can't separate it, leave electricity blank and treat the result as a floor.</li>
<li>Efficiency defaults are typical values (for example 85% oil, 92% gas, 250% heat pump). Use your equipment's rated figure if you know it. Heat pump efficiency of 250% means a seasonal COP of 2.5.</li>
<li>If you changed systems or added insulation recently, last year's fuel use may not predict next year's.</li>
<li>If you can't find your numbers, the default of ${DEFAULT_LOAD} MMBtu on the calculators is a rough starting point only.</li>
</ul>
<p>Energy contents used: oil 138,500 BTU/gal, propane 91,500 BTU/gal, natural gas 100,000 BTU/therm, kerosene 135,000 BTU/gal, electricity 3,412 BTU/kWh, pellets about 16.5 million BTU/ton, cordwood about 22 million BTU/cord. See <a href="/guides/btu-mmbtu-therm-kwh/">the units guide</a>.</p>
<script>${js}</script>`;
  write('tools/heat-need/index.html', layout({ title: 'How Much Heat Does My Home Use? Annual MMBtu Calculator', desc: 'Convert a year of oil, propane, gas, electric, pellet or wood use into delivered heat (MMBtu) to feed any heating cost calculator.', canonical: '/tools/heat-need/', body }));
}

// ---------- Guides ----------
urls.push('/guides/', '/guides/btu-mmbtu-therm-kwh/', '/guides/heat-pump-vs-oil-what-decides/');
{
  const fuelRows = SYSTEMS.map(s => `<tr><td>${esc(s.short)}</td><td>${s.btu.toLocaleString('en-US')} BTU per ${s.unit}</td><td>${Math.round(s.eff * 100)}%</td><td>$${costPerMMBtu(s, s.price).toFixed(2)}</td></tr>`).join('');
  const units = `
<h1>BTU, MMBtu, Therm and kWh: The Units Behind Heating Costs</h1>
<p>Heating fuels are sold in different units: gallons, therms, kilowatt-hours, tons, cords. To compare them fairly, convert everything to one unit of <i>delivered heat</i>. This site uses the MMBtu (one million BTU).</p>
<h2>The basic conversions</h2>
<ul><li><b>BTU:</b> a small unit of heat energy.</li>
<li><b>MMBtu:</b> 1,000,000 BTU. (The "MM" is the traditional Roman-numeral-style "thousand thousand".)</li>
<li><b>Therm:</b> 100,000 BTU, so 10 therms = 1 MMBtu. Natural gas is often billed in therms or in hundreds or thousands of cubic feet (Ccf, Mcf); one Mcf is roughly 10 therms.</li>
<li><b>kWh:</b> 3,412 BTU, so about 293 kWh = 1 MMBtu.</li></ul>
<h2>Efficiency is what turns fuel into heat</h2>
<p>Furnaces and boilers are rated by AFUE, the share of the fuel's energy that ends up as heat in the house. An 85% oil boiler delivers 0.85 of each gallon's energy. Electric resistance heat is essentially 100% efficient at the point of use. A heat pump moves heat rather than making it, so it can deliver more than 100%: a seasonal coefficient of performance (COP) of 2.5 means 250%. Manufacturers often publish HSPF or HSPF2 instead; dividing HSPF by 3.412 gives a rough COP, though real results depend on your climate and installation.</p>
<h2>The formula</h2>
<p><b>Cost per MMBtu = price per unit ÷ (BTU per unit × efficiency ÷ 1,000,000)</b></p>
<p>Example: heating oil at $5.26 per gallon in an 85% boiler. A gallon holds 138,500 BTU, so it delivers 138,500 × 0.85 = 117,725 BTU. Cost per MMBtu = 5.26 ÷ 0.117725 ≈ <b>$44.68</b>. A heat pump at 18 cents per kWh and a COP of 2.5 delivers 3,412 × 2.5 = 8,530 BTU per kWh, so 0.18 ÷ 0.00853 ≈ <b>$21.10</b> per MMBtu.</p>
<h2>This site's defaults</h2>
<table><tr><th>System</th><th>Energy content</th><th>Efficiency</th><th>Cost per MMBtu at default price</th></tr>${fuelRows}</table>
<p class="mut">Defaults for oil, propane, natural gas and electricity are U.S. average EIA winter 2026-27 forecasts; kerosene, pellets and cordwood are rough estimates. Your local prices will differ.</p>
<p>Next: <a href="/tools/heat-need/">work out how many MMBtu your home actually uses</a>, then <a href="/">rank the systems with your prices</a>.</p>`;
  write('guides/btu-mmbtu-therm-kwh/index.html', layout({ title: 'BTU, MMBtu, Therm and kWh Explained for Home Heating', desc: 'How to convert gallons, therms and kilowatt-hours into comparable heating costs, with the formula and worked examples.', canonical: '/guides/btu-mmbtu-therm-kwh/', body: units }));

  // break-even table: electricity price (cents/kWh) at which a heat pump matches oil, by COP and oil price
  const cops = [2, 2.5, 3], oilPrices = [4, 5.26, 6, 7];
  const be = (op, cop) => (costPerMMBtu(oil, op) * (3412 * cop / 1e6) * 100).toFixed(1);
  const beRows = oilPrices.map(op => `<tr><td>$${op.toFixed(2)}</td>${cops.map(c => `<td>${be(op, c)}¢</td>`).join('')}</tr>`).join('');
  const hpoil = `
<h1>Heat Pump vs Heating Oil: What Actually Decides Which Costs Less</h1>
<p>The answer comes down to two ratios: how expensive electricity is compared with oil, and how efficiently your heat pump turns each kilowatt-hour into heat. Everything else, including upfront cost, incentives and comfort, matters too, but running cost is determined by these.</p>
<h2>The break-even electricity price</h2>
<p>An oil boiler at 85% efficiency delivers 117,725 BTU per gallon. A heat pump with a seasonal COP of 2.5 delivers 8,530 BTU per kWh. Setting the two costs per MMBtu equal gives the electricity price at which they tie. Below it, the heat pump is cheaper to run; above it, oil is.</p>
<table><tr><th>Oil price per gallon</th><th>COP 2.0</th><th>COP 2.5</th><th>COP 3.0</th></tr>${beRows}</table>
<p class="mut">Break-even electricity price in cents per kWh, assuming an 85% efficient oil boiler. If your electricity costs less than the figure in your row and column, the heat pump costs less to run.</p>
<h2>Why COP is the swing factor</h2>
<p>Heat pump efficiency falls as outdoor temperatures drop, so a unit that reaches a COP of 3 in mild weather may average much lower over a cold winter. Use a seasonal figure for your climate, from the manufacturer's cold-climate data if available, rather than the best-case number. Moving from COP 2.0 to 3.0 raises the break-even electricity price by half, which is often the difference between a heat pump winning and losing.</p>
<h2>What the running-cost math leaves out</h2>
<ul><li><b>Purchase and installation cost</b> for the heat pump, duct or distribution work, and any electrical panel upgrade.</li>
<li><b>Incentives:</b> federal, state and utility programs change often, so check current ones before deciding.</li>
<li><b>Backup heat</b> for the coldest days, which may use oil or electric resistance and costs more per MMBtu.</li>
<li><b>Maintenance and fuel storage:</b> oil needs tank and burner service; heat pumps need filter and coil care.</li>
<li><b>Future price changes</b> for either fuel.</li></ul>
<h2>Run your own numbers</h2>
<p>Use the <a href="/compare/${pairSlug(oil, hp)}/">heating oil vs heat pump calculator</a> with your local prices, or look up your state's electricity rate on the <a href="/state/">state pages</a>. Not sure how much heat your home needs? <a href="/tools/heat-need/">Work it out from your fuel bills</a>.</p>
${affiliateSlot('Before you switch', [hp, oil])}`;
  write('guides/heat-pump-vs-oil-what-decides/index.html', layout({ title: 'Heat Pump vs Heating Oil: What Decides Which Costs Less', desc: 'Break-even electricity prices for heat pumps against heating oil at different oil prices and efficiencies, with what the math leaves out.', canonical: '/guides/heat-pump-vs-oil-what-decides/', body: hpoil }));

  // ---- propane vs oil ----
  urls.push('/guides/propane-vs-heating-oil/', '/guides/wood-pellets-vs-cordwood/');
  const bePropRows = oilPrices.map(op => `<tr><td>$${op.toFixed(2)}</td><td>$${(costPerMMBtu(oil, op) * (prop.btu * prop.eff / 1e6)).toFixed(2)}</td><td>$${(costPerMMBtu(oil, op) * (gas.btu * gas.eff / 1e6)).toFixed(2)}</td></tr>`).join('');
  const propOil = `
<h1>Propane vs Heating Oil: Which Is Cheaper to Heat With?</h1>
<p>A gallon of propane holds less energy than a gallon of heating oil, so propane has to sell for noticeably less per gallon to match oil's cost. Comparing the per-gallon price tags alone is the most common mistake.</p>
<h2>Why the gallon price misleads</h2>
<p>Heating oil carries about 138,500 BTU per gallon and propane about 91,500, so a gallon of oil has roughly 1.5 times the energy. Modern propane furnaces and boilers are often rated slightly more efficient than oil units (this site assumes 92% vs 85%), which narrows the gap but does not close it. With those assumptions, one gallon of oil delivers about 117,700 BTU of heat and one gallon of propane about 84,200 BTU.</p>
<h2>Break-even propane price</h2>
<table><tr><th>Oil price per gallon</th><th>Propane breaks even at (per gallon)</th><th>Natural gas breaks even at (per therm)</th></tr>${bePropRows}</table>
<p class="mut">Prices at which each fuel costs the same per unit of delivered heat as oil, assuming 85% oil, 92% propane and 92% natural gas efficiency. Propane or gas priced below the figure in your row is cheaper to run than oil.</p>
<h2>Other things that change the answer</h2>
<ul><li><b>Equipment:</b> switching fuels means new equipment, a tank, and installation. Running-cost savings have to pay that back.</li>
<li><b>Price volatility and contracts:</b> propane and oil dealers often offer fixed-price or capped-price programs; compare the program price, not the market price.</li>
<li><b>Tank ownership and fees:</b> rental fees, delivery minimums and hazmat or service charges can add real cost.</li>
<li><b>Natural gas availability:</b> where a gas main is available, it is usually far cheaper per unit of heat than either (see the table above), so check before converting between delivered fuels.</li></ul>
<p>Plug in your own prices on the <a href="/compare/${pairSlug(oil, prop)}/">heating oil vs propane calculator</a>, or find your home's heat need with <a href="/tools/heat-need/">the heat-need tool</a>.</p>
${affiliateSlot('Fuel tank and safety gear', [oil, prop])}`;
  write('guides/propane-vs-heating-oil/index.html', layout({ title: 'Propane vs Heating Oil: Which Is Cheaper to Heat With?', desc: 'Why per-gallon prices mislead, with break-even propane and gas prices at several heating oil prices.', canonical: '/guides/propane-vs-heating-oil/', body: propOil }));

  // ---- pellets vs cordwood ----
  const pel = byId('wood-pellets'), cord = byId('cordwood');
  const galOilEq = s => (s.btu * s.eff / (oil.btu * oil.eff)).toFixed(0);
  const pelRows = [250, 330, 400].map(p => `<tr><td>Pellets $${p}/ton</td><td>$${costPerMMBtu(pel, p).toFixed(2)}</td></tr>`).join('');
  const cordRows = [200, 300, 400].map(p => `<tr><td>Cordwood $${p}/cord</td><td>$${costPerMMBtu(cord, p).toFixed(2)}</td></tr>`).join('');
  const woody = `
<h1>Wood Pellets vs Cordwood: Cost Per Unit of Heat</h1>
<p>Both are renewable fuels that often undercut oil and propane on price, but they differ a lot in effort, storage and consistency. Cost per MMBtu puts them on the same scale as every other fuel on this site.</p>
<h2>How much heat is in a ton or a cord?</h2>
<p>At the assumptions used here (about 16.5 million BTU per ton of pellets at 80% stove efficiency, and about 22 million BTU per cord of seasoned hardwood at 65% efficiency), one ton of pellets delivers about as much heat as ${galOilEq(pel)} gallons of heating oil in an 85% boiler, and one cord delivers about as much as ${galOilEq(cord)} gallons. Actual cordwood energy varies by species and moisture, and stove efficiency varies by model and how it is run.</p>
<h2>Cost per MMBtu at example prices</h2>
<table><tr><th>Fuel and price</th><th>Cost per MMBtu delivered</th></tr>${pelRows}${cordRows}</table>
<p class="mut">These prices are rough examples, not quotes; wood fuel prices vary widely by region and season. Compare with oil at $${costPerMMBtu(oil, oil.price).toFixed(2)} and propane at $${costPerMMBtu(prop, prop.price).toFixed(2)} per MMBtu at the EIA national winter averages.</p>
<h2>What the numbers don't capture</h2>
<ul><li><b>Labor:</b> pellet stoves are fed from bags or a hopper; cordwood means stacking, hauling and tending a fire. If you cut and split your own wood, the cash cost can fall far below the table but the time cost rises.</li>
<li><b>Moisture:</b> wood that is not well seasoned (commonly aimed at under about 20% moisture) delivers less heat and creates more creosote. A moisture meter is inexpensive and worth using.</li>
<li><b>Storage:</b> a cord takes roughly 128 cubic feet of stacked space; pellets are bagged and need to stay dry.</li>
<li><b>Electricity and maintenance:</b> pellet stoves use a small amount of electricity for feed and fans and need regular cleaning; wood stoves and chimneys need annual inspection and sweeping.</li>
<li><b>Safety and rules:</b> install and vent solid-fuel appliances to code, use working smoke and carbon monoxide detectors, and check local wood-burning restrictions.</li></ul>
<p>Compare directly with other fuels on the <a href="/compare/${pairSlug(pel, cord)}/">pellets vs cordwood calculator</a>.</p>
${affiliateSlot('Wood heat essentials', [pel, cord])}`;
  write('guides/wood-pellets-vs-cordwood/index.html', layout({ title: 'Wood Pellets vs Cordwood: Cost Per Unit of Heat', desc: 'Compare wood pellets and cordwood by delivered heat cost, oil-equivalent gallons, labor, moisture and storage.', canonical: '/guides/wood-pellets-vs-cordwood/', body: woody }));

  write('guides/index.html', layout({ title: 'Home Heating Guides', desc: 'Guides to heating units, efficiency and heat pump vs oil economics.', canonical: '/guides/',
    body: `<h1>Home Heating Guides</h1><ul>
<li><a href="/guides/btu-mmbtu-therm-kwh/">BTU, MMBtu, therm and kWh: the units behind heating costs</a></li>
<li><a href="/guides/propane-vs-heating-oil/">Propane vs heating oil: which is cheaper to heat with?</a></li>
<li><a href="/guides/wood-pellets-vs-cordwood/">Wood pellets vs cordwood: cost per unit of heat</a></li>
<li><a href="/guides/heat-pump-vs-oil-what-decides/">Heat pump vs heating oil: what decides which costs less</a></li>
<li><a href="/tools/heat-need/">Tool: how much heat does your home use?</a></li></ul>` }));
}

// ---------- About / Privacy ----------
write('about/index.html', layout({ title: `About ${SITE_NAME} and Methodology`, desc: 'How the heating cost calculations work.', canonical: '/about/',
  body: `<h1>About &amp; Methodology</h1><p>${SITE_NAME} is a free tool for estimating home heating costs. Delivered heat cost = fuel price ÷ (energy content per unit × efficiency). Energy contents: heating oil 138,500 BTU/gal, propane 91,500 BTU/gal, natural gas 100,000 BTU/therm, kerosene 135,000 BTU/gal, electricity 3,412 BTU/kWh, pellets about 16.5 million BTU/ton, seasoned cordwood about 22 million BTU/cord (varies by species). Efficiencies are typical assumptions and can be changed by choosing different prices or load.</p><p>Default prices for heating oil ($5.26/gal), propane ($2.52/gal), natural gas ($1.30/therm, converted from $13.44 per thousand cubic feet) and electricity (18 cents/kWh, rounded from the 18.23 cent forecast) come from the U.S. Energy Information Administration's Winter Fuels Outlook 2026-27, published October 6, 2026. They are national averages, so your local price will differ. State pages start with each state's average residential electricity price from the EIA Electric Power Monthly, Table 5.6.A (August 2026); oil, propane and natural gas on those pages still use the national averages above. Defaults for kerosene, wood pellets and cordwood are rough estimates, not sourced figures. Replace every default with your own latest price.</p>` }));
write('privacy/index.html', layout({ title: 'Privacy Policy', desc: 'Privacy policy.', canonical: '/privacy/',
  body: `<h1>Privacy Policy</h1><p>Calculator inputs stay in your browser and are not sent to us. We may use privacy-friendly analytics and advertising/affiliate partners, which may set cookies. Contact: <!-- ADD EMAIL --></p>` }));
urls.push('/about/', '/privacy/');

write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `<url><loc>${SITE_URL}${u}</loc></url>`).join('\n')}\n</urlset>\n`);
write('404.html', layout({ title: 'Page not found', desc: 'Page not found.', canonical: '/404.html',
  body: `<h1>Page not found</h1><p>That page doesn't exist. Try the <a href="/">heating cost calculator</a>, <a href="/state/">your state</a>, or the <a href="/guides/">guides</a>.</p>` }));
write('.nojekyll', '');
write('_headers', `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n`);
console.log(`Built ${urls.length} pages (${pairs.length} comparisons) into ${OUT}`);
