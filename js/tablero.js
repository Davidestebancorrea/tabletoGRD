const D = window.DATOS_GRD;
const YEARS = D.years, MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const MONTHS_L = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const METRICS = {
  eg:{label:'Egresos',fmt:v=>fi(v),better:0,unit:''},
  em:{label:'Estancia media',fmt:v=>f1(v),better:-1,unit:'días'},
  iema:{label:'IEMA',fmt:v=>f2(v),better:-1,unit:''},
  pm:{label:'Peso GRD medio',fmt:v=>f3(v),better:0,unit:''},
  mort:{label:'Mortalidad',fmt:v=>pc(v),better:-1,unit:''},
  evit:{label:'Estancias evitables',fmt:v=>fs(v),better:-1,unit:'días'},
  outl:{label:'% Outliers',fmt:v=>pc(v),better:-1,unit:''}
};
const nf0=new Intl.NumberFormat('es-CL',{maximumFractionDigits:0});
const fi=v=>v==null?'—':nf0.format(v);
const f1=v=>v==null?'—':v.toLocaleString('es-CL',{minimumFractionDigits:1,maximumFractionDigits:1});
const f2=v=>v==null?'—':v.toLocaleString('es-CL',{minimumFractionDigits:2,maximumFractionDigits:2});
const f3=v=>v==null?'—':v.toLocaleString('es-CL',{minimumFractionDigits:3,maximumFractionDigits:3});
const pc=v=>v==null?'—':(v*100).toLocaleString('es-CL',{minimumFractionDigits:2,maximumFractionDigits:2})+'%';
const fs=v=>v==null?'—':(v>0?'+':'')+nf0.format(Math.round(v));

const state={scope:'hosp',year:2026,mTo:7,metric:'iema',sortKey:'eg',sortDir:-1};
try{const s=JSON.parse(localStorage.getItem('grd-tablero')||'{}');Object.assign(state,s);}catch(e){}
const save=()=>{try{localStorage.setItem('grd-tablero',JSON.stringify({metric:state.metric,mTo:state.mTo,year:state.year}))}catch(e){}};

const sc=id=>D.scopes.find(s=>s.id===id);
const yi=y=>YEARS.indexOf(y);

// aggregate a scope over months 0..mTo for year index j
function agg(s,j,mTo){
  let eg=0,dep=0,emN=0,emE=0,pmN=0,mortN=0,mortW=0,ev=0,evN=0,n=0,olN=0,olW=0;
  for(let m=0;m<=mTo;m++){
    const e=s.eg[m][j]; if(e==null) continue; n++;
    eg+=e; const d=s.dep[m][j]??e;
    const em=s.em[m][j], ie=s.iema[m][j], pm=s.pm[m][j], mo=s.mort[m][j], evv=s.evit[m][j];
    if(em!=null&&d){dep+=d;emN+=em*d; if(ie) emE+=em/ie*d;}
    if(pm!=null&&d) pmN+=pm*d;
    if(mo!=null){mortN+=mo*e;mortW+=e;}
    if(evv!=null){ev+=evv;evN++;}
    if(s.ol&&s.ol[m][j]!=null){olN+=s.ol[m][j]*e;olW+=e;}
  }
  if(!n) return null;
  return {n,eg,em:dep?emN/dep:null,iema:emE?emN/emE:null,pm:dep?pmN/dep:null,mort:mortW?mortN/mortW:null,evit:evN?ev:null,outl:s.ol?(olW?olN/olW:null):(s.outl?s.outl[j]:null),outlAnnual:!s.ol};
}
function lastMonth(s,j){let l=-1;for(let m=0;m<12;m++) if(s.eg[m][j]!=null) l=m;return l;}
function monthVal(s,metric,m,j){
  const e=s.eg[m][j]; if(e==null) return null;
  if(metric==='outl') return s.ol?s.ol[m][j]:null;
  return metric==='eg'?e:s[metric][m][j];
}
function iemaStatus(v){if(v==null)return null;return v<=1?['good','Eficiente']:v<=1.10?['warn','Vigilancia']:['crit','Sobreestadía'];}
function deltaHTML(cur,prev,key,prevYear){
  if(cur==null||prev==null) return `<span class="neu">sin comparación ${prevYear}</span>`;
  const M=METRICS[key]; let txt, d=cur-prev;
  if(key==='eg') txt=(prev?((d/prev*100)>0?'+':'')+(d/prev*100).toLocaleString('es-CL',{maximumFractionDigits:1})+'%':'—');
  else if(key==='mort'||key==='outl') txt=(d>0?'+':'')+(d*100).toLocaleString('es-CL',{minimumFractionDigits:2,maximumFractionDigits:2})+' pp';
  else if(key==='evit') txt=(d>0?'+':'')+nf0.format(Math.round(d))+' días';
  else txt=(d>0?'+':'')+(key==='pm'?f3(d):key==='iema'?f2(d):f1(d));
  let cls='neu'; if(M.better&&Math.abs(d)>1e-9) cls=(d*M.better>0)?'pos':'neg';
  const arrow=d>0?'▲':d<0?'▼':'■';
  return `<span class="${cls}">${arrow} ${txt}</span> vs ${prevYear}`;
}

// ---------- filters
const fScope=document.getElementById('fScope'),fYear=document.getElementById('fYear'),fMonth=document.getElementById('fMonth'),fMetric=document.getElementById('fMetric');
fScope.innerHTML=D.scopes.map(s=>`<option value="${s.id}">${s.name}</option>`).join('');
fYear.innerHTML=YEARS.slice().reverse().map(y=>`<option>${y}</option>`).join('');
fMonth.innerHTML=MONTHS_L.map((m,i)=>`<option value="${i}">${i===0?'Enero':'Enero a '+m}${i===11?' (año completo)':''}</option>`).join('');
fMetric.innerHTML=Object.entries(METRICS).map(([k,M])=>`<button type="button" data-k="${k}">${M.label}</button>`).join('');
fScope.onchange=()=>{state.scope=fScope.value;render();};
fYear.onchange=()=>{state.year=+fYear.value;save();render();};
fMonth.onchange=()=>{state.mTo=+fMonth.value;save();render();};
fMetric.onclick=e=>{const b=e.target.closest('button');if(!b)return;state.metric=b.dataset.k;save();render();};

// ---------- tooltip
const tip=document.createElement('div');tip.className='tip';tip.hidden=true;
function showTip(host,x,y,html){if(tip.parentNode!==host)host.appendChild(tip);tip.innerHTML=html;tip.style.left=x+'px';tip.style.top=y+'px';tip.hidden=false;}
function hideTip(){tip.hidden=true;}

// ---------- scales
function niceTicks(min,max,count){
  if(min===max){max=min+1;}
  const span=max-min, step0=span/count, mag=Math.pow(10,Math.floor(Math.log10(step0)));
  const step=[1,2,2.5,5,10].map(f=>f*mag).find(s=>span/s<=count)||10*mag;
  const lo=Math.floor(min/step)*step, hi=Math.ceil(max/step)*step, t=[];
  for(let v=lo;v<=hi+step/1e6;v+=step) t.push(+v.toFixed(10));
  return t;
}
function axisFmt(key,v){
  if(key==='eg'||key==='evit') return Math.abs(v)>=1000?(v/1000).toLocaleString('es-CL',{maximumFractionDigits:1})+' mil':nf0.format(v);
  if(key==='mort'||key==='outl') return (v*100).toLocaleString('es-CL',{maximumFractionDigits:1})+'%';
  if(key==='iema') return f2(v);
  if(key==='pm') return f2(v);
  return f1(v);
}

// ---------- annual trend
function drawTrend(){
  const el=document.getElementById('cTrend'), s=sc(state.scope), key=state.metric, M=METRICS[key];
  const W=Math.max(300,el.clientWidth), H=260, pl=52, pr=12, pt=16, pb=30;
  const vals=YEARS.map((y,j)=>{const a=agg(s,j,state.mTo);return a?{y,v:a[key],n:a.n,last:lastMonth(s,j)}:{y,v:null};});
  const present=vals.filter(d=>d.v!=null);
  let mn=Math.min(...present.map(d=>d.v)), mx=Math.max(...present.map(d=>d.v));
  const isBar=(key==='eg'||key==='evit');
  if(isBar){mn=Math.min(0,mn);mx=Math.max(0,mx);}
  if(key==='iema'){mn=Math.min(mn,0.95);mx=Math.max(mx,1.05);}
  const ticks=niceTicks(mn,mx,4), y0=ticks[0], y1=ticks[ticks.length-1];
  const X=j=>pl+(W-pl-pr)*(j+.5)/YEARS.length, Y=v=>pt+(H-pt-pb)*(1-(v-y0)/(y1-y0));
  const bw=Math.min(34,(W-pl-pr)/YEARS.length*.58);
  let g='';
  ticks.forEach(t=>{g+=`<line x1="${pl}" x2="${W-pr}" y1="${Y(t)}" y2="${Y(t)}" stroke="var(--grid)" stroke-width="1"/><text x="${pl-8}" y="${Y(t)+4}" text-anchor="end">${axisFmt(key,t)}</text>`;});
  if(key==='iema') g+=`<line x1="${pl}" x2="${W-pr}" y1="${Y(1)}" y2="${Y(1)}" stroke="var(--ink-3)" stroke-dasharray="4 4" stroke-width="1"/><text x="${W-pr}" y="${Y(1)-5}" text-anchor="end">norma 1,00</text>`;
  if(isBar&&y0<0) g+=`<line x1="${pl}" x2="${W-pr}" y1="${Y(0)}" y2="${Y(0)}" stroke="var(--ink-3)" stroke-width="1"/>`;
  YEARS.forEach((y,j)=>{g+=`<text x="${X(j)}" y="${H-10}" text-anchor="middle" ${y===state.year?'style="fill:var(--ink);font-weight:500"':''}>${y}</text>`;});
  const partial=d=>d.last<state.mTo;
  if(isBar){
    vals.forEach((d,j)=>{if(d.v==null)return;const top=Math.min(Y(d.v),Y(0)),h=Math.max(1,Math.abs(Y(d.v)-Y(0)));
      const r=Math.min(4,h/2), up=d.v>=0, x=X(j)-bw/2, fill=d.y===state.year?'var(--s1)':'var(--s-prev)';
      const path=up?`M${x},${top+h}V${top+r}Q${x},${top} ${x+r},${top}H${x+bw-r}Q${x+bw},${top} ${x+bw},${top+r}V${top+h}Z`
                   :`M${x},${top}V${top+h-r}Q${x},${top+h} ${x+r},${top+h}H${x+bw-r}Q${x+bw},${top+h} ${x+bw},${top+h-r}V${top}Z`;
      g+=`<path d="${path}" fill="${fill}" ${partial(d)?'fill-opacity=".45" stroke="'+fill+'" stroke-dasharray="3 2"':''}/>`;});
  } else {
    let p='';vals.forEach((d,j)=>{if(d.v==null)return;p+=(p?'L':'M')+X(j)+','+Y(d.v);});
    g+=`<path d="${p}" fill="none" stroke="var(--s1)" stroke-width="2" stroke-linejoin="round"/>`;
    vals.forEach((d,j)=>{if(d.v==null)return;const sel=d.y===state.year;
      g+=`<circle cx="${X(j)}" cy="${Y(d.v)}" r="${sel?5.5:4}" fill="${partial(d)?'var(--panel)':'var(--s1)'}" stroke="${sel?'var(--panel)':'var(--s1)'}" stroke-width="2"/>`;
      if(sel) g+=`<circle cx="${X(j)}" cy="${Y(d.v)}" r="7.5" fill="none" stroke="var(--s1)" stroke-width="1.5"/>`;});
  }
  const sel=vals.find(d=>d.y===state.year);
  if(sel&&sel.v!=null) g+=`<text x="${X(yi(state.year))}" y="${(isBar&&sel.v<0)?Y(sel.v)+16:Y(sel.v)-12}" text-anchor="middle" style="fill:var(--ink);font-weight:500">${M.fmt(sel.v)}</text>`;
  vals.forEach((d,j)=>{g+=`<rect x="${X(j)-(W-pl-pr)/YEARS.length/2}" y="${pt}" width="${(W-pl-pr)/YEARS.length}" height="${H-pt-pb}" fill="transparent" data-j="${j}"/>`;});
  el.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${M.label} por año">${g}</svg>`;
  el.querySelectorAll('rect[data-j]').forEach(r=>{
    r.onmousemove=()=>{const d=vals[+r.dataset.j];if(d.v==null){hideTip();return;}
      showTip(el,X(+r.dataset.j)/W*el.clientWidth,(isBar?Math.min(Y(d.v),Y(0)):Y(d.v))/H*el.clientHeight,
      `<b>${d.y}</b> · ${M.label}: ${M.fmt(d.v)}${M.unit?' '+M.unit:''}<br>${d.n} ${d.n===1?'mes':'meses'} con datos${partial(d)?' (parcial)':''}`);};
    r.onmouseleave=hideTip;});
  document.getElementById('tTrend').textContent=`${M.label} por año`;
  const anyPartial=present.some(partial);
  const annNote=(key==='outl'&&!s.ol)?' · la fuente trae solo el % anual de este servicio, el período no se aplica':'';
  document.getElementById('sTrend').textContent=`${s.name} · ${state.mTo===11?'año completo':'enero a '+MONTHS_L[state.mTo]} de cada año`+(anyPartial?' · contorno punteado o punto hueco = año con meses faltantes':'')+annNote;
}

// ---------- monthly
function drawMonth(){
  const el=document.getElementById('cMonth'), s=sc(state.scope), key=state.metric, M=METRICS[key];
  const j=yi(state.year), jp=j-1;
  const W=Math.max(300,el.clientWidth), H=242, pl=52, pr=12, pt=14, pb=28;
  const cur=MONTHS.map((_,m)=>monthVal(s,key,m,j)), prev=jp>=0?MONTHS.map((_,m)=>monthVal(s,key,m,jp)):MONTHS.map(()=>null);
  const all=[...cur,...prev].filter(v=>v!=null);
  if(!all.length){el.innerHTML=`<p class="sub">${key==='outl'?(s.outl?'La planilla trae el % de outliers de este servicio solo como total anual, sin apertura mensual.':'La planilla no trae el indicador de outliers para este servicio.'):'Sin datos para este servicio y año.'}</p>`;document.getElementById('lgMonth').innerHTML='';return;}
  let mn=Math.min(...all), mx=Math.max(...all);
  if(key==='eg'){mn=0;} if(key==='evit'){mn=Math.min(0,mn);mx=Math.max(0,mx);}
  if(key==='iema'){mn=Math.min(mn,0.95);mx=Math.max(mx,1.05);}
  const ticks=niceTicks(mn,mx,4), y0=ticks[0], y1=ticks[ticks.length-1];
  const X=m=>pl+(W-pl-pr)*(m+.5)/12, Y=v=>pt+(H-pt-pb)*(1-(v-y0)/(y1-y0));
  let g='';
  ticks.forEach(t=>{g+=`<line x1="${pl}" x2="${W-pr}" y1="${Y(t)}" y2="${Y(t)}" stroke="var(--grid)"/><text x="${pl-8}" y="${Y(t)+4}" text-anchor="end">${axisFmt(key,t)}</text>`;});
  if(key==='iema') g+=`<line x1="${pl}" x2="${W-pr}" y1="${Y(1)}" y2="${Y(1)}" stroke="var(--ink-3)" stroke-dasharray="4 4"/>`;
  if(key==='evit'&&y0<0) g+=`<line x1="${pl}" x2="${W-pr}" y1="${Y(0)}" y2="${Y(0)}" stroke="var(--ink-3)"/>`;
  g+=`<rect x="${pl}" y="${pt}" width="${X(state.mTo)+(W-pl-pr)/24-pl}" height="${H-pt-pb}" fill="var(--accent-soft)" opacity=".55"/>`;
  MONTHS.forEach((m,i)=>{if(W<420&&i%2)return;g+=`<text x="${X(i)}" y="${H-9}" text-anchor="middle">${m}</text>`;});
  const line=(arr,col,w)=>{let p='',segs=[];arr.forEach((v,i)=>{if(v==null){if(p)segs.push(p);p='';return;}p+=(p?'L':'M')+X(i)+','+Y(v);});if(p)segs.push(p);
    return segs.map(d=>`<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"/>`).join('');};
  g+=line(prev,'var(--s-prev)',2)+line(cur,'var(--s1)',2.25);
  prev.forEach((v,i)=>{if(v!=null)g+=`<circle cx="${X(i)}" cy="${Y(v)}" r="3" fill="var(--s-prev)" stroke="var(--panel)" stroke-width="1.5"/>`;});
  cur.forEach((v,i)=>{if(v!=null)g+=`<circle cx="${X(i)}" cy="${Y(v)}" r="4" fill="var(--s1)" stroke="var(--panel)" stroke-width="2"/>`;});
  g+=`<line id="xh" x1="0" x2="0" y1="${pt}" y2="${H-pb}" stroke="var(--ink-3)" stroke-width="1" visibility="hidden"/>`;
  MONTHS.forEach((_,i)=>{g+=`<rect x="${X(i)-(W-pl-pr)/24}" y="${pt}" width="${(W-pl-pr)/12}" height="${H-pt-pb}" fill="transparent" data-m="${i}"/>`;});
  el.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${M.label} mensual ${state.year} y ${state.year-1}">${g}</svg>`;
  const xh=el.querySelector('#xh');
  el.querySelectorAll('rect[data-m]').forEach(r=>{const i=+r.dataset.m;
    r.onmousemove=()=>{xh.setAttribute('x1',X(i));xh.setAttribute('x2',X(i));xh.setAttribute('visibility','visible');
      const top=Math.min(...[cur[i],prev[i]].filter(v=>v!=null).map(Y),H/2);
      showTip(el,X(i)/W*el.clientWidth,top/H*el.clientHeight,`<b>${MONTHS_L[i][0].toUpperCase()+MONTHS_L[i].slice(1)}</b><br>${state.year}: ${M.fmt(cur[i])}<br>${state.year-1}: ${M.fmt(prev[i])}`);};
    r.onmouseleave=()=>{xh.setAttribute('visibility','hidden');hideTip();};});
  document.getElementById('tMonth').textContent=`${M.label} mes a mes`;
  document.getElementById('sMonth').textContent=`${s.name} · banda sombreada = período seleccionado`;
  document.getElementById('lgMonth').innerHTML=`<span><i style="background:var(--s1)"></i>${state.year}</span>`+(jp>=0?`<span><i style="background:var(--s-prev)"></i>${state.year-1}</span>`:'');
}

// ---------- KPIs
function drawKpis(){
  const s=sc(state.scope), j=yi(state.year), a=agg(s,j,state.mTo), p=j>0?agg(s,j-1,state.mTo):null, py=state.year-1;
  const box=document.getElementById('kpis');
  if(!a){box.innerHTML='<div class="kpi">Sin datos para este período.</div>';return;}
  const st=iemaStatus(a.iema);
  const k=(key,hint,extra='')=>{const M=METRICS[key];return `<div class="kpi"><span class="lab">${M.label}</span>
    <div class="v">${M.fmt(a[key])}${M.unit?`<small>${M.unit}</small>`:''}</div>${extra}
    <div class="d">${deltaHTML(a[key],p?p[key]:null,key,py)}</div><div class="hint">${hint}</div></div>`;};
  box.innerHTML=k('eg',`${a.n} ${a.n===1?'mes':'meses'} con datos`)+
    k('em','días por egreso depurado')+
    k('iema','observada / esperada',st?`<span><span class="chip ${st[0]}">${st[1]}</span></span>`:'')+
    k('pm','complejidad de la casuística')+
    k('mort','fallecidos / egresos')+
    k('evit',a.evit!=null&&a.evit<0?'días bajo la norma':'días sobre la norma')+
    k('outl',a.outl==null?'sin dato en la fuente':a.outlAnnual?'total anual de la fuente':'estancias prolongadas · B.3_1.4');
}

// ---------- table
const COLS=[
  {k:'name',l:'Servicio'},{k:'eg',l:'Egresos'},{k:'em',l:'Estancia media'},{k:'iema',l:'IEMA'},{k:'pm',l:'Peso GRD'},
  {k:'mort',l:'Mortalidad'},{k:'evit',l:'Est. evitables'},{k:'outl',l:'% Outliers'}];
function drawTable(){
  const j=yi(state.year), py=state.year-1;
  const rows=D.scopes.map(s=>{const a=agg(s,j,state.mTo), p=j>0?agg(s,j-1,state.mTo):null;
    return {s,id:s.id,name:s.name,a,p,eg:a?a.eg:null,em:a?a.em:null,iema:a?a.iema:null,pm:a?a.pm:null,mort:a?a.mort:null,evit:a?a.evit:null,
      outl:a?a.outl:null,outlAnn:a&&a.outlAnnual&&a.outl!=null,outlNote:s.outlNote};}).filter(r=>r.a);
  const hosp=rows.find(r=>r.id==='hosp'), list=rows.filter(r=>r.id!=='hosp');
  list.sort((x,y)=>{const a=x[state.sortKey],b=y[state.sortKey];if(state.sortKey==='name')return a.localeCompare(b,'es')*state.sortDir;
    if(a==null)return 1;if(b==null)return -1;return (a-b)*state.sortDir;});
  const t=document.getElementById('tbl');
  t.tHead.innerHTML='<tr>'+COLS.map(c=>`<th tabindex="0" data-k="${c.k}" ${state.sortKey===c.k?`aria-sort="${state.sortDir>0?'ascending':'descending'}"`:''}>${c.l}</th>`).join('')+'</tr>';
  const egD=r=>{if(!r.p||!r.p.eg)return '';const d=(r.eg-r.p.eg)/r.p.eg*100;return `<span class="dl neu">${d>0?'+':''}${d.toLocaleString('es-CL',{maximumFractionDigits:0})}%</span>`;};
  const ibar=v=>{if(v==null)return '';const c=Math.max(-.5,Math.min(.5,v-1)),cx=45,w=Math.abs(c)/.5*44,x=c<0?cx-w:cx;
    const st=iemaStatus(v);return `<svg viewBox="0 0 90 12" aria-hidden="true"><rect x="${x}" y="2" width="${Math.max(1,w)}" height="8" rx="2" fill="var(--${st[0]})"/><line x1="45" x2="45" y1="0" y2="12" stroke="var(--ink-3)"/></svg>`;};
  const row=r=>{const st=iemaStatus(r.iema);return `<tr tabindex="0" data-id="${r.id.replace(/"/g,'&quot;')}" class="${r.id==='hosp'?'hosp ':''}${r.id===state.scope?'sel':''}">
    <td>${r.name}</td><td class="num">${fi(r.eg)}${egD(r)}</td><td class="num">${f1(r.em)}</td>
    <td class="num"><span class="ibar">${ibar(r.iema)}<span>${f2(r.iema)}</span>${st?`<span class="chip ${st[0]}" title="${st[1]}">${st[1]}</span>`:''}</span></td>
    <td class="num">${f3(r.pm)}</td><td class="num">${pc(r.mort)}</td><td class="num ${r.evit>0?'neg':r.evit<0?'pos':''}">${fs(r.evit)}</td>
    <td class="num" ${r.outlNote||r.outlAnn?`title="${[r.outlNote,r.outlAnn?'Total anual de la fuente':''].filter(Boolean).join(' · ')}"`:''}>${r.outl==null?'—':pc(r.outl)}${r.outlNote?'*':''}${r.outlAnn?'†':''}</td></tr>`;};
  t.tBodies[0].innerHTML=list.map(row).join('')+(hosp?row(hosp):'');
  t.tHead.querySelectorAll('th').forEach(th=>{const go=()=>{const k=th.dataset.k;if(state.sortKey===k)state.sortDir*=-1;else{state.sortKey=k;state.sortDir=k==='name'?1:-1;}drawTable();};
    th.onclick=go;th.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go();}};});
  t.tBodies[0].querySelectorAll('tr').forEach(tr=>{const go=()=>{state.scope=tr.dataset.id;render();window.scrollTo({top:0,behavior:'smooth'});};
    tr.onclick=go;tr.onkeydown=e=>{if(e.key==='Enter'){go();}};});
  document.getElementById('tTable').textContent=`Comparativo por servicio · ${state.year}, ${state.mTo===11?'año completo':'enero a '+MONTHS_L[state.mTo]}`;
  document.getElementById('sTable').textContent=`Egresos con variación vs ${py} en el mismo período. Haz clic en un servicio para ver su detalle arriba; los encabezados ordenan la tabla. % outliers: * UPC adulto y pediátrica combinadas; † total anual de la fuente (sin apertura mensual); Psiquiatría no tiene este indicador en la planilla.`;
}

function render(){
  fScope.value=state.scope; fYear.value=state.year; fMonth.value=state.mTo;
  fMetric.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.k===state.metric));
  const s=sc(state.scope), lm=lastMonth(s,yi(state.year)), n=document.getElementById('notice');
  if(lm<state.mTo){n.hidden=false;n.textContent=`${state.year} tiene datos hasta ${MONTHS_L[Math.max(lm,0)]}: los totales del año son parciales y la comparación con ${state.year-1} usa el mismo período elegido (enero a ${MONTHS_L[state.mTo]}). Para una comparación pareja, elige "Enero a ${MONTHS_L[lm]}".`;}
  else n.hidden=true;
  drawKpis();drawTrend();drawMonth();drawTable();
}
let rt;window.addEventListener('resize',()=>{clearTimeout(rt);rt=setTimeout(()=>{drawTrend();drawMonth();},120);});
render();
