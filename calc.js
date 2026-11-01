
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
