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
:root{--brand:#0e6b50;--on-brand:#fff;--link:#0e6b50;--soft:#e3f3ec}
@media(prefers-color-scheme:dark){:root{--brand:#3fbf98;--on-brand:#06120d;--link:#5fd3b0;--soft:#12302a}}
:root{--serif:Charter,"Bitstream Charter","Sitka Text",Cambria,Georgia,serif;--sans:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;--paper:#fff;--wash:#f4f6f8;--ink:#14202b;--mut:#52606d;--rule:#d8dee4;--card:#fff}
@media(prefers-color-scheme:dark){:root{--paper:#0f151b;--wash:#151d25;--ink:#e9eef2;--mut:#9aa8b5;--rule:#27333e;--card:#18212a}}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.6 var(--sans)}
.w{max-width:1040px;margin:0 auto;padding:0 20px}
a{color:var(--link);text-underline-offset:.16em}
:focus-visible{outline:3px solid var(--brand);outline-offset:2px;border-radius:4px}
.skip{position:absolute;left:-9999px;top:8px}.skip:focus{left:12px;background:var(--ink);color:var(--paper);padding:8px 12px;z-index:9;border-radius:8px}
header.top{background:var(--paper);border-bottom:1px solid var(--rule)}
header.top .w{display:flex;align-items:center;justify-content:space-between;gap:6px 20px;flex-wrap:wrap;min-height:68px}
.brand{display:flex;align-items:center;gap:11px;color:var(--ink);text-decoration:none;font:700 1.32rem/1 var(--serif);letter-spacing:-.01em;padding:10px 0}
.brand svg{width:36px;height:36px;flex:none;display:block}
nav.main{display:flex;gap:2px;flex-wrap:wrap}
nav.main a{padding:9px 11px;border-radius:8px;color:var(--mut);text-decoration:none;font-weight:500;font-size:.95rem}
nav.main a:hover{background:var(--wash);color:var(--ink)}
nav.main a[aria-current=page]{color:var(--ink);box-shadow:inset 0 -3px 0 var(--brand);border-radius:0}
@media(max-width:640px){header.top .w{padding-bottom:6px}nav.main{width:100%;margin:0 -8px}nav.main a{padding:8px 9px;font-size:.92rem}}
.band{background:radial-gradient(70% 150% at 100% 0%,var(--soft),transparent 64%),var(--wash);border-bottom:1px solid var(--rule)}
.band .w{padding-top:38px;padding-bottom:34px}
.crumbs{font-size:.85rem;color:var(--mut);margin:0 0 12px}.crumbs a{color:var(--mut)}
.band h1{font:700 clamp(1.85rem,4.6vw,2.9rem)/1.12 var(--serif);letter-spacing:-.015em;margin:0 0 14px;max-width:24ch}
.band.wide h1{max-width:30ch}
.band .lead{font:400 1.14rem/1.62 var(--serif);color:var(--mut);margin:0;max-width:64ch}
.trust{display:flex;flex-wrap:wrap;gap:8px 22px;margin:20px 0 0;padding:0;list-style:none;font-size:.92rem;font-weight:500}
.trust li{display:flex;align-items:center;gap:8px}
.trust li::before{content:"";width:18px;height:18px;border-radius:50%;background:var(--brand) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 18 18'%3E%3Cpath d='M5 9.3l2.6 2.6L13 6.4' fill='none' stroke='%23fff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center/100% no-repeat;flex:none}
main{padding:12px 0 48px}
main h2{font:650 1.55rem/1.25 var(--serif);margin:2.3rem 0 .5rem;letter-spacing:-.005em}
main h3{font:650 1.15rem/1.3 var(--serif);margin:1.7rem 0 .2rem}
main p,main li{font:400 1.0625rem/1.74 var(--serif)}
main p{margin:.85em 0;max-width:68ch}
main ul,main ol{max-width:68ch;padding-left:1.3em}main li{margin:.3em 0}
.card,.aff,.panel{font-family:var(--sans)}
.card p,.card li,.aff p,.aff li,td,th,label,.mut,.note,.d{font-family:var(--sans)}
.mut{color:var(--mut);font-size:.9rem;line-height:1.55}
.card{background:var(--card);border:1px solid var(--rule);border-radius:16px;padding:24px;margin:26px 0;box-shadow:0 1px 2px rgba(20,32,43,.05),0 14px 32px -18px rgba(20,32,43,.22)}
label{display:block;font:500 .86rem/1.35 var(--sans);color:var(--mut);margin:0 0 6px}
input,select,textarea{width:100%;padding:10px 12px;border:1px solid var(--rule);border-radius:10px;background:var(--paper);color:var(--ink);font:inherit;font-size:1rem;min-height:44px}
textarea{min-height:150px;resize:vertical}
input:focus,select:focus,textarea:focus{border-color:var(--brand);outline:3px solid color-mix(in srgb,var(--brand) 30%,transparent);outline-offset:0}
.grid{display:grid;gap:18px 20px;grid-template-columns:repeat(auto-fit,minmax(210px,1fr))}
table{width:100%;border-collapse:collapse;margin:14px 0;font-size:.97rem}
th{font:600 .82rem/1.3 var(--sans);color:var(--mut);text-align:left;padding:10px;border-bottom:2px solid var(--rule)}
td{padding:12px 10px;border-bottom:1px solid var(--rule);vertical-align:middle}
tr:last-child td{border-bottom:0}
@media(max-width:640px){main table{display:block;overflow-x:auto;max-width:100%}}
.big{font:700 1.9rem/1.1 var(--serif);color:var(--link);font-variant-numeric:tabular-nums}
#out tr:first-child td{background:var(--soft);font-weight:600}
#out tr:first-child td:first-child{box-shadow:inset 4px 0 0 var(--brand)}
.btn{display:inline-flex;align-items:center;justify-content:center;background:var(--brand);color:var(--on-brand);padding:12px 22px;border-radius:10px;font:600 1rem var(--sans);text-decoration:none;border:0;cursor:pointer;min-height:46px}
.btn:hover{filter:brightness(1.08)}
.btn.ghost{background:transparent;color:var(--link);border:1.5px solid var(--brand)}
.aff{background:var(--wash);border:1px solid var(--rule);border-left:4px solid var(--brand);border-radius:12px;padding:18px 20px;margin:28px 0}
.aff b{font:700 1.08rem var(--serif)}
.aff ul{list-style:none;padding:0;margin:12px 0;display:flex;flex-wrap:wrap;gap:8px;max-width:none}
.aff li{margin:0}
.aff li a{display:inline-block;padding:8px 13px;border:1px solid var(--rule);border-radius:999px;background:var(--paper);color:var(--ink);text-decoration:none;font:500 .92rem var(--sans)}
.aff li a:hover{border-color:var(--brand)}
ul.links{columns:2;column-gap:32px;list-style:none;padding:0;max-width:none}ul.links li{break-inside:avoid;margin:.35em 0}
@media(max-width:560px){ul.links{columns:1}}
.cards{display:grid;gap:16px;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));padding:0;list-style:none;max-width:none;margin:18px 0}
.cards li{margin:0;font-family:var(--sans)}
.cards a{display:block;height:100%;padding:20px;border:1px solid var(--rule);border-radius:14px;color:var(--ink);text-decoration:none;background:var(--card);box-shadow:inset 0 3px 0 var(--brand)}
.cards a:hover{border-color:var(--brand)}
.cards strong{display:block;font:650 1.08rem/1.3 var(--serif);margin-bottom:6px}
.cards span{display:block;color:var(--mut);font-size:.92rem;line-height:1.5}
.note,.d{font-size:.88rem;line-height:1.55;color:var(--mut)}
.d{padding:12px 14px;border:1px solid var(--rule);border-radius:10px;background:var(--wash);color:var(--ink);max-width:68ch}
footer.foot{background:#0f1a24;color:#c4cfd9;margin-top:24px;padding:42px 0 30px;font-size:.92rem;line-height:1.6}
footer.foot a{color:#e6edf3}
footer.foot .cols{display:grid;gap:30px;grid-template-columns:1.5fr 1fr 1fr}
@media(max-width:720px){footer.foot .cols{grid-template-columns:1fr}}
footer.foot .brand{color:#fff;padding:0 0 10px}
footer.foot h3{font:600 .85rem/1.3 var(--sans);color:#8fa1b1;margin:0 0 12px}
footer.foot ul{list-style:none;padding:0;margin:0;display:grid;gap:8px}
footer.foot p{margin:0 0 10px;max-width:46ch}
footer.foot .fine{border-top:1px solid #243342;margin-top:30px;padding-top:18px;font-size:.82rem;color:#93a4b3;max-width:none}
@media(max-width:640px){main table.rank{display:table}.rank th:first-child,.rank td:first-child{display:none}.rank th,.rank td{padding:10px 6px;font-size:.9rem}#out tr:first-child td:nth-child(2){box-shadow:inset 4px 0 0 var(--brand)}}
@media(max-width:640px){main table.entry,.entry tbody{display:block}.entry tr:first-child{display:none}.entry tr{display:grid;grid-template-columns:1fr 1fr;gap:8px 12px;padding:14px 0;border-bottom:1px solid var(--rule)}.entry td{display:block;padding:0;border:0}.entry td:first-child{grid-column:1/-1;font-weight:600}.entry td:nth-child(3){grid-column:1/-1;order:5;color:var(--mut);font-size:.85rem}.entry td[data-l]::before{content:attr(data-l);display:block;font:500 .8rem var(--sans);color:var(--mut);margin-bottom:4px}}
@media(prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
@media print{header.top nav,footer.foot,.aff{display:none}.band{background:none}}
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

const ADSENSE_ID = 'ca-pub-1399340452541176';
const MARK = `<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#0e6b50"/><path fill="#fff" d="M16 5.5c.5 3.4 2.4 5 4.5 7.4 2 2.300 3.100 4.200 3.100 6.800a7.600 7.600 0 0 1-15.200 0c0-3.200 1.700-5.300 3.400-6.600.2 1.700.9 2.800 2 3.200-.4-4 .4-7.400 2.200-10.800z"/><path fill="#0e6b50" d="M16 17.200c1.900 1.900 2.900 3.200 2.900 4.600a2.900 2.900 0 0 1-5.800 0c0-1.400 1-2.700 2.900-4.600z"/></svg>`;
const NAV = [['/', 'Calculator'], ['/state/', 'By state'], ['/guides/', 'Guides'], ['/tools/heat-need/', 'Heat need'], ['/about/', 'About']];
const navHtml = c => NAV.map(([h, t]) => `<a href="${h}"${(h === '/' ? (c === '/' || c.startsWith('/compare/')) : c.startsWith(h)) ? ' aria-current="page"' : ''}>${t}</a>`).join('');
const crumbsFor = c => {
  if (c === '/') return '';
  const seg = c.split('/').filter(Boolean);
  const trail = [['/', 'Calculator']];
  if (seg.length > 1 && seg[0] === 'state') trail.push(['/state/', 'By state']);
  if (seg.length > 1 && seg[0] === 'guides') trail.push(['/guides/', 'Guides']);
  return `<p class="crumbs">${trail.map(([h, t]) => `<a href="${h}">${t}</a>`).join(' / ')}</p>`;
};
const splitBody = body => {
  const m = body.match(/^\s*<h1>([\s\S]*?)<\/h1>\s*(<p>[\s\S]*?<\/p>)?/);
  if (!m) return { h1: '', lead: '', rest: body };
  let lead = m[2] || '', rest = body.slice(m[0].length);
  if (lead && lead.replace(/<[^>]+>/g, '').length > 300) { rest = lead + rest; lead = ''; }
  return { h1: m[1], lead: lead.replace(/^<p>/, '<p class="lead">'), rest };
};
const TRUST = ['Free to use', 'No sign-up', 'Your numbers stay in your browser'];

const layout = ({ title, desc, canonical, body, extraHead = '', trust = false, noindex = false }) => {
  const { h1, lead, rest } = splitBody(body);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE_URL}${canonical}">${noindex ? '\n<meta name="robots" content="noindex">' : ''}
<link rel="icon" type="image/svg+xml" href="/favicon.svg"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><meta name="theme-color" content="#0e6b50">
<meta property="og:type" content="website"><meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${SITE_URL}${canonical}"><meta property="og:image" content="${SITE_URL}/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="/style.css">
<script async src="https://www.googletagmanager.com/gtag/js?id=G-VD6P0Z7NSE"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag("js",new Date());gtag("config","G-VD6P0Z7NSE");</script>
<meta name="google-adsense-account" content="${ADSENSE_ID}">
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_ID}" crossorigin="anonymous"></script>
${extraHead}
</head><body>
<a class="skip" href="#main">Skip to content</a>
<header class="top"><div class="w"><a class="brand" href="/">${MARK}${SITE_NAME}</a><nav class="main" aria-label="Main">${navHtml(canonical)}</nav></div></header>
<div class="band${trust ? ' wide' : ''}"><div class="w">${crumbsFor(canonical)}<h1>${h1}</h1>${lead}${trust ? `<ul class="trust">${TRUST.map(t => `<li>${t}</li>`).join('')}</ul>` : ''}</div></div>
<main id="main" class="w">${rest}</main>
<footer class="foot"><div class="w">
<div class="cols">
<div><a class="brand" href="/">${MARK}${SITE_NAME}</a><p>Free calculators and plain-English guides for comparing home heating costs. Starting prices come from the U.S. Energy Information Administration; replace them with your own.</p></div>
<div><h3>Explore</h3><ul><li><a href="/">Heating cost calculator</a></li><li><a href="/state/">Costs by state</a></li><li><a href="/guides/">Guides</a></li><li><a href="/tools/heat-need/">Find your heat need</a></li></ul></div>
<div><h3>About</h3><ul><li><a href="/about/">About &amp; methodology</a></li><li><a href="/contact/">Contact</a></li><li><a href="/privacy/">Privacy policy</a></li></ul></div>
</div>
<p class="fine"><b>Disclosure:</b> As an Amazon Associate I earn from qualifying purchases. Some links on this site are affiliate links; we may earn a commission at no cost to you. Figures are estimates based on standard fuel energy content and typical equipment efficiency. Actual costs vary with your home, climate, equipment and local prices. Not professional advice. &copy; 2026 ${SITE_NAME}</p>
</div></footer></body></html>`;
};

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
const guideCards = `<ul class="cards">
<li><a href="/tools/heat-need/"><strong>How much heat does your home use?</strong><span>Turn a year of fuel bills into the one number every calculator here needs.</span></a></li>
<li><a href="/guides/heat-pump-vs-oil-what-decides/"><strong>Heat pump vs heating oil</strong><span>The break-even electricity price, and what decides who wins.</span></a></li>
<li><a href="/guides/propane-vs-heating-oil/"><strong>Propane vs heating oil</strong><span>Why the price per gallon misleads, with break-even prices.</span></a></li>
<li><a href="/guides/wood-pellets-vs-cordwood/"><strong>Wood pellets vs cordwood</strong><span>Cost per unit of heat, plus labor, moisture and storage.</span></a></li>
<li><a href="/guides/btu-mmbtu-therm-kwh/"><strong>BTU, MMBtu, therm and kWh</strong><span>The units behind heating costs, with worked examples.</span></a></li>
</ul>`;
const inputs = SYSTEMS.map(s => `<div><label for="p-${s.id}">${esc(s.name)} ($ per ${s.unit})</label><input id="p-${s.id}" type="number" step="0.01" value="${s.price}"></div>`).join('');
const allLinks = pairs.map(([x, y]) => `<li><a href="/compare/${x.id}-vs-${y.id}/">${esc(x.short)} vs ${esc(y.short)}</a></li>`).join('');
write('index.html', layout({
  title: 'Home Heating Cost Calculator: Compare Oil, Propane, Gas, Electric, Heat Pump, Pellets',
  desc: 'Free calculator that ranks home heating systems by yearly cost using your local fuel prices.',
  canonical: '/',
  trust: true,
  body: `<h1>Home Heating Cost Calculator: Compare Eight Systems</h1>
<p>See which way of heating your home costs least this winter. Enter your own fuel prices and the table ranks everything from oil to heat pumps.</p>
<div class="card"><div class="grid">${inputs}
<div><label for="load">Annual heat needed (MMBtu delivered) · <a href="/tools/heat-need/">find yours</a></label><input id="load" type="number" value="${DEFAULT_LOAD}"></div></div>
<table class="rank"><tr><th>#</th><th>System</th><th>Cost per MMBtu</th><th>Estimated yearly cost</th></tr><tbody id="out"></tbody></table>
<p class="mut">Starting prices for oil, propane, gas and electricity are U.S. average winter 2026-27 forecasts from the EIA. Kerosene, pellets and cordwood are rough estimates. Replace every price with your own.</p></div>
${affiliateSlot('Compare heating options')}
<h2>Heating costs by state</h2><p><a href="/state/">Start with your state's electricity rate →</a></p>
<h2>Tools and guides</h2>${guideCards}
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
<table class="rank"><tr><th>#</th><th>System</th><th>Cost per MMBtu</th><th>Estimated yearly cost</th></tr><tbody id="out"></tbody></table></div>
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
<td data-l="Used per year"><input id="amt-${s.id}" type="number" min="0" step="any" placeholder="0" aria-label="${esc(s.short)} used per year"></td>
<td>${esc(s.unit)}${s.unit === 'kWh' ? ' (heating only)' : ''}</td>
<td data-l="Efficiency %"><input id="eff-${s.id}" type="number" min="1" step="1" value="${Math.round(s.eff * 100)}" aria-label="${esc(s.short)} efficiency percent"></td></tr>`).join('');
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
<table class="entry"><tr><th>Fuel / system</th><th>Used per year</th><th>Unit</th><th>Efficiency %</th></tr>${rows}</table>
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
    body: `<h1>Home Heating Guides</h1><p>Plain-English explanations of the numbers behind heating costs.</p>${guideCards}` }));
}

// ---------- About / Privacy ----------
write('about/index.html', layout({ title: `About ${SITE_NAME} and Methodology`, desc: 'How the heating cost calculations work: energy content, efficiency assumptions, data sources and limits.', canonical: '/about/',
  body: `<h1>About &amp; Methodology</h1><p>${SITE_NAME} is a free tool for estimating home heating costs. Delivered heat cost = fuel price ÷ (energy content per unit × efficiency). Energy contents: heating oil 138,500 BTU/gal, propane 91,500 BTU/gal, natural gas 100,000 BTU/therm, kerosene 135,000 BTU/gal, electricity 3,412 BTU/kWh, pellets about 16.5 million BTU/ton, seasoned cordwood about 22 million BTU/cord (varies by species). Efficiencies are typical assumptions and can be changed by choosing different prices or load.</p><p>Default prices for heating oil ($5.26/gal), propane ($2.52/gal), natural gas ($1.30/therm, converted from $13.44 per thousand cubic feet) and electricity (18 cents/kWh, rounded from the 18.23 cent forecast) come from the U.S. Energy Information Administration's Winter Fuels Outlook 2026-27, published October 6, 2026. They are national averages, so your local price will differ. Prices last reviewed: November 1, 2026. State pages start with each state's average residential electricity price from the EIA Electric Power Monthly, Table 5.6.A (August 2026); oil, propane and natural gas on those pages still use the national averages above. Defaults for kerosene, wood pellets and cordwood are rough estimates, not sourced figures. Replace every default with your own latest price.</p>` }));
write('privacy/index.html', layout({ title: 'Privacy Policy', desc: 'How this site handles calculator inputs, cookies, affiliate links and third-party services.', canonical: '/privacy/',
  body: `<h1>Privacy Policy</h1>
<p>${SITE_NAME} does not require an account and does not collect personal information. Numbers you type into the calculators are processed in your browser and are not sent to or stored by this site.</p>
<h2>Affiliate links</h2>
<p>Some links go to Amazon.com and include our Amazon Associates tracking ID. When you click one, Amazon may set cookies and collect information under its own privacy notice. As an Amazon Associate I earn from qualifying purchases.</p>
<h2>Analytics</h2>
<p>We use Google Analytics to understand which pages are useful. It may set cookies and collect anonymized usage data such as pages viewed, approximate location and device type. You can opt out with the Google Analytics opt-out browser add-on or by blocking cookies in your browser.</p>
<h2>Advertising</h2>
<p>This site uses Google AdSense to show ads. Google and its advertising partners use cookies to serve ads based on your visits to this and other websites. You can manage or turn off personalized ads in <a href="https://adssettings.google.com">Google Ads Settings</a>, learn how Google uses information from sites that use its services at <a href="https://policies.google.com/technologies/partner-sites">policies.google.com/technologies/partner-sites</a>, or opt out of many third-party ad vendors at <a href="https://www.aboutads.info">aboutads.info</a>.</p>
<h2>Hosting</h2>
<p>This site is hosted on Netlify, which may log visitor IP addresses as part of serving pages.</p>
<h2>Contact form</h2>
<p>If you send a message through the contact page, we receive the name, email address and message you type, and use them only to reply.</p>
<h2>Third-party sites</h2>
<p>Links to other websites are governed by those sites' own policies.</p>` }));
urls.push('/about/', '/privacy/');

urls.push('/contact/');
write('contact/index.html', layout({ title: 'Contact HeatCostCalc', desc: 'Send a correction, question or suggestion about the heating cost calculators.', canonical: '/contact/',
  body: `<h1>Contact</h1><p>Found a price that looks wrong, a calculation that does not add up, or a comparison you would like to see? Send a note.</p>
<div class="card"><form name="contact" method="POST" action="/contact/thanks/" data-netlify="true" netlify-honeypot="bot-field">
<input type="hidden" name="form-name" value="contact">
<p hidden><label>Leave this empty <input name="bot-field"></label></p>
<div class="grid"><div><label for="cn">Your name</label><input id="cn" name="name" autocomplete="name" required></div>
<div><label for="ce">Your email</label><input id="ce" name="email" type="email" autocomplete="email" required></div></div>
<p><label for="cm">Message</label><textarea id="cm" name="message" required></textarea></p>
<button class="btn" type="submit">Send message</button></form></div>
<p class="mut">We use your details only to reply. See the <a href="/privacy/">privacy policy</a>. This site gives general estimates, not personal financial, tax or engineering advice.</p>` }));
write('contact/thanks/index.html', layout({ title: 'Message sent', desc: 'Thanks for your message.', canonical: '/contact/thanks/', noindex: true,
  body: `<h1>Thanks, your message was sent</h1><p>We read every message and reply when we can.</p><p><a class="btn" href="/">Back to the calculator</a></p>` }));
write('ads.txt', `google.com, pub-1399340452541176, DIRECT, f08c47fec0942fa0\n`);
write('favicon.svg', MARK);

write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `<url><loc>${SITE_URL}${u}</loc></url>`).join('\n')}\n</urlset>\n`);
write('404.html', layout({ title: 'Page not found', desc: 'Page not found.', canonical: '/404.html',
  body: `<h1>Page not found</h1><p>That page doesn't exist. Try the <a href="/">heating cost calculator</a>, <a href="/state/">your state</a>, or the <a href="/guides/">guides</a>.</p>` }));
write('.nojekyll', '');
write('_headers', `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n`);
console.log(`Built ${urls.length} pages (${pairs.length} comparisons) into ${OUT}`);
