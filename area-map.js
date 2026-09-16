import {areaOf,escapeXML as esc} from './core.js';
import {selectionDetail} from './group-selection.js';
import {resultHeading as mapHeading,resultHeadingText,visualHeading} from './result-heading.js';
export {resultHeading as mapHeading} from './result-heading.js';

const format=value=>new Intl.NumberFormat('sv-SE',{maximumFractionDigits:2}).format(value);
const wrap=(text,length=100)=>{
  const lines=[''];
  for(const word of String(text).split(/\s+/)){if(lines.at(-1)&&lines.at(-1).length+word.length+1>length)lines.push('');lines[lines.length-1]+=(lines.at(-1)?' ':'')+word;}
  return lines.filter(Boolean);
};
export const areaCode=value=>String(value??'').trim().match(/^(\d+)(?:\s|$)/)?.[1].replace(/^0+(?=\d)/,'')||'';
export function mapSeries(result){
  const dimension=result.table?.metadata&&areaOf(result.table.metadata);
  // A single selection ensures every area is compared using the same other filters.
  if(result.table?.level!=='Stadsområde'||result.table.measure?.monthly||result.table.measure?.additive===false||!dimension||result.groups?.length!==1)return null;
  const separate=result.groups[0].separate||[];
  if(separate.length!==1||separate[0]!==dimension.code)return null;
  const series=new Map();
  for(const item of result.series){
    const raw=item.dimensionValues?.[dimension.code];
    if(raw===undefined)return null;
    const code=areaCode(raw);
    if(code==='99'||code==='9')continue;
    if(!['1','2','3','4'].includes(code)||series.has(code))return null;
    if(item.rows.some(row=>row.period))return null;
    series.set(code,item);
  }
  return series.size?series:null;
}

export function mapScale(series,year){
  const values=[...series.values()].flatMap(s=>s.rows.filter(r=>year===undefined||r.year===year).map(r=>r.value)).filter(Number.isFinite);
  if(!values.length)return null;
  const min=Math.min(...values),max=Math.max(...values);
  return {min,max};
}
export function mapUnavailableReason(result){
  if(result.table?.level!=='Stadsområde')return 'Kartvyn finns för stadsområden. Välj en tabell med Stadsområde som geografisk nivå.';
  if(result.table.measure?.monthly)return 'Kartvyn stöder årsdata. Välj en tabell med årsdata i stället för månadsdata.';
  if(result.table.measure?.additive===false)return 'Kartvyn stöder ännu bara summerbara antalsmått, inte detta mått.';
  if(result.groups?.length!==1)return 'Kartvyn kräver en urvalsgrupp. Använd en grupp i stället för flera jämförelsegrupper.';
  const dimension=result.table.metadata&&areaOf(result.table.metadata),separate=result.groups[0].separate||[];
  if(!dimension||!separate.includes(dimension.code))return 'Välj Visa varje kategori separat för Område. Kartan behöver ett värde per område och år.';
  const extra=separate.filter(code=>code!==dimension.code).map(code=>result.table.metadata.variables.find(v=>v.code===code)?.text||code);
  if(extra.length)return `Du redovisar även ${extra.join(', ')} separat. Välj Summera valda för dessa filter och hämta statistiken igen. Kartan behöver ett värde per område och år.`;
  return 'De valda områdena kan inte kopplas till kartan. Välj minst ett av stadsområdena Nordost, Centrum, Sydväst eller Hisingen. Ospecificerat Göteborg visas inte på kartan.';
}
// Continuous interpolation requested for the map, using the profile's blue endpoints.
export function mapColor(value,scale){
  if(!scale||!Number.isFinite(value))return '#d1d9dc';
  const t=value<scale.min?0:value>scale.max?1:scale.max===scale.min?.5:(value-scale.min)/(scale.max-scale.min);
  return '#'+[192,228,242].map((start,i)=>Math.round(start+([63,85,100][i]-start)*t).toString(16).padStart(2,'0')).join('');
}
export function mapValues(geometry,series,year){
  return geometry.features.map(feature=>{
    const item=series.get(areaCode(feature.code));
    const value=item?.rows.find(row=>row.year===year)?.value??null;
    return {...feature,value,state:!item?'outside':value===null?'missing':'value'};
  });
}
export function mapNotes(result){
  const selection=result.groups?.[0]?.selections?selectionDetail(result.table.metadata,result.groups[0].selections):'';
  return [selection,'Områdesgränser: aktuellt underlag 2026, samma gränser för alla år.',
    'Ospecificerat Göteborg visas inte på kartan. Streckat: uppgift saknas. Vit yta: ingår inte i urvalet.',
    'Värdena avser källtabellens områdesindelning. Kontrollera källans områdesindelning vid jämförelser över tid.',
    `Källa: Göteborgs Stads statistikdatabas · Hämtad ${result.date}`].filter(Boolean);
}
export function mapSVG(result,geometry,series,year,scale,{includeNotes=true,includeHeading=true,scaleYear,scaleControl}={}){
  const entries=mapValues(geometry,series,year);
  const caption=mapHeading(result),titleLines=includeHeading?wrap(caption.title,65):[],selectionLines=includeHeading?wrap(caption.selection):[];
  const headerShift=includeHeading?(titleLines.length-1)*27+selectionLines.length*20:-35;
  const header=titleLines.map((line,i)=>`<text x="30" y="${35+i*27}" font-size="22" font-weight="800">${esc(line)}</text>`).join('')+selectionLines.map((line,i)=>`<text x="30" y="${60+(titleLines.length-1)*27+i*20}" font-size="15" font-weight="700">${esc(line)}</text>`).join('')+`<text x="30" y="${63+headerShift}">Stadsområden · ${year} · ${esc(result.unit)}</text>`;
  // Give the geography more space relative to the sidebar within the same CSS height cap.
  const geometryScale=includeNotes?1:0.9;
  if(!includeNotes)geometry={...geometry,width:geometry.width*geometryScale,height:geometry.height*geometryScale};
  const detailLines=includeNotes?mapNotes(result).flatMap(text=>wrap(text)):[];
  const height=geometry.height+(includeNotes?120:90)+headerShift+(detailLines.length?40+detailLines.length*22:0);
  const paths=entries.map(entry=>{
    const label=`${entry.name}: ${entry.state==='outside'?'Ingår inte i urvalet':entry.state==='missing'?'Uppgift saknas':format(entry.value)+' '+result.unit}`;
    const fill=entry.state==='outside'?'#ffffff':entry.state==='missing'?'url(#map-missing)':mapColor(entry.value,scale);
    const value=entry.state==='outside'?'Ingår inte i urvalet':entry.state==='missing'?'Uppgift saknas':format(entry.value);
    return `<path d="${entry.path}" fill="${fill}" fill-rule="evenodd" stroke="#1f1f1f" stroke-width="0.7" tabindex="0" role="img" aria-label="${esc(label)} · ${year}" data-map-label="${esc(label)}" data-map-name="${esc(entry.name)}" data-map-value="${esc(value)}" data-map-unit="${esc(entry.state==='value'?result.unit.toLowerCase().replace(/^antal /,''):'')}"></path>`;
  }).join('');
  const labels=entries.map((entry,i)=>`<text x="${geometry.width+30}" y="${155+i*65}" font-weight="800">${esc(entry.name)}</text><text x="${geometry.width+30}" y="${178+i*65}">${esc(entry.state==='outside'?'Ingår inte i urvalet':entry.state==='missing'?'Uppgift saknas':format(entry.value))}</text>`).join('');
  const defaultLegend=scale?`<text x="${geometry.width+30}" y="435" font-weight="800">Färgskala</text><rect x="${geometry.width+30}" y="452" width="240" height="12" rx="2" fill="${scale.min===scale.max?mapColor(scale.min,scale):'url(#map-scale)'}"/><text x="${geometry.width+30}" y="486">${format(scale.min)}</text>${scale.min===scale.max?'':`<text x="${geometry.width+270}" y="486" text-anchor="end">${format(scale.max)}</text>`}<text x="${geometry.width+30}" y="516" font-size="13">${scaleYear===undefined?'Samma skala för alla valda år':`Skala låst till ${scaleYear}`}</text>`:`<text x="${geometry.width+30}" y="450">Uppgift saknas för alla valda år</text>`;
  const constant=scale&&scale.min===scale.max&&scaleYear!==undefined;
  const legend=constant?`<text x="${geometry.width+30}" y="435" font-weight="800">Färgskala</text>${[scale.min-1,scale.min,scale.min+1].map((value,i)=>`<rect x="${geometry.width+30+i*80}" y="452" width="80" height="12" fill="${mapColor(value,scale)}"/><text x="${geometry.width+30+i*120}" y="486" text-anchor="${i===0?'start':i===1?'middle':'end'}">${i===0?'&lt; ':i===2?'&gt; ':''}${format(scale.min)}</text>`).join('')}<text x="${geometry.width+30}" y="516" font-size="13">Skala låst till ${scaleYear}</text>`:defaultLegend;
  const lockControl=scaleControl?`<foreignObject x="${geometry.width+30}" y="${535+headerShift}" width="275" height="95"><div xmlns="http://www.w3.org/1999/xhtml" class="map-scale-control"><label><input id="map-scale-lock" type="checkbox" ${scaleControl.checked?'checked="checked"':''} ${scaleControl.available?'':'disabled="disabled"'}/><span>Lås färgskalan vid senaste år</span></label><p>${scaleControl.available?`Senaste år i urvalet: ${scaleControl.latestYear}`:`Uppgift saknas för ${scaleControl.latestYear}`}</p></div></foreignObject>`:'';
  const clipped=scale&&entries.some(entry=>entry.state==='value'&&(entry.value<scale.min||entry.value>scale.max));
  const scaleNote=scaleYear!==undefined&&clipped?`<text x="${geometry.width+30}" y="${scaleControl?652+headerShift:548+headerShift}" font-size="12">Värden utanför skalan får ändfärger.</text>`:'';
  const notes=detailLines.map((line,i)=>`<text x="30" y="${geometry.height+150+headerShift+i*22}" font-size="13">${esc(line)}</text>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${geometry.width+320} ${height}" width="${geometry.width+320}" height="${height}" role="group" aria-label="${esc(caption.title)}. ${esc(caption.selection)}. Stadsområden ${year}" style="font-family:Open Sans,Arial,sans-serif;font-size:15px;color:#1f1f1f"><defs><linearGradient id="map-scale" color-interpolation="sRGB"><stop offset="0" stop-color="#c0e4f2"/><stop offset="1" stop-color="#3f5564"/></linearGradient><pattern id="map-missing" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#d1d9dc"/><path d="M0 8L8 0" stroke="#1f1f1f" stroke-width="1"/></pattern></defs><rect width="100%" height="100%" fill="#ffffff"/><g fill="#1f1f1f">${header}<g transform="translate(0 ${(includeNotes?105:75)+headerShift}) scale(${geometryScale})">${paths}</g><g transform="translate(0 ${headerShift})"><text x="${geometry.width+30}" y="113" font-size="17" font-weight="800">Värden per stadsområde</text>${labels}${legend}</g>${lockControl}${scaleNote}${notes}</g></svg>`;
}

export function attachMapTooltip(canvas,year){
  const tooltip=document.createElement('div');tooltip.className='map-tooltip';tooltip.hidden=true;tooltip.setAttribute('aria-hidden','true');
  const title=document.createElement('span'),value=document.createElement('strong'),unit=document.createElement('span');
  title.className='map-tooltip-title';unit.className='map-tooltip-unit';tooltip.append(title,value,unit);canvas.append(tooltip);
  let active;
  const clear=()=>{tooltip.hidden=true;active?.removeAttribute('data-active');active=null;};
  function show(path,event){
    if(active!==path){active?.removeAttribute('data-active');active=path;path.setAttribute('data-active','true');}
    title.textContent=path.dataset.mapName+' · '+year;value.textContent=path.dataset.mapValue;unit.textContent=path.dataset.mapUnit?' '+path.dataset.mapUnit:'';
    tooltip.hidden=false;
    const bounds=canvas.getBoundingClientRect(),shape=path.getBoundingClientRect();
    const x=Number.isFinite(event?.clientX)?event.clientX-bounds.left:shape.left+shape.width/2-bounds.left;
    const y=Number.isFinite(event?.clientY)?event.clientY-bounds.top:shape.top+shape.height/2-bounds.top;
    const width=tooltip.offsetWidth,height=tooltip.offsetHeight;
    tooltip.style.left=(canvas.scrollLeft+Math.max(8,Math.min(canvas.clientWidth-width-8,x+16)))+'px';
    tooltip.style.top=(canvas.scrollTop+Math.max(8,Math.min(canvas.clientHeight-height-8,y-height-12)))+'px';
  }
  for(const path of canvas.querySelectorAll('[data-map-label]')){
    for(const event of ['pointerenter','pointermove','pointerdown','focus'])path.addEventListener(event,e=>show(path,e));
    path.addEventListener('pointerleave',clear);path.addEventListener('blur',clear);
    path.addEventListener('keydown',event=>{if(event.key==='Escape')clear();});
  }
  canvas.onpointerleave=clear;canvas.onpointercancel=clear;canvas.onscroll=clear;
}

let geometryPromise;
function getGeometry(){
  if(!geometryPromise)geometryPromise=fetch('./data/stadsomraden-map.json').then(response=>{if(!response.ok)throw new Error('Kartunderlaget kunde inte laddas.');return response.json();}).catch(error=>{geometryPromise=null;throw error;});
  return geometryPromise;
}
export function mountAreaMap({result,panel,toolbar=panel,chart,chooser,heading,drawChart,setExport}){
  const series=mapSeries(result);
  const originalHidden=panel.hidden;
  panel.hidden=false;
  const toggle=document.createElement('div');toggle.className='view-toggle';toggle.setAttribute('role','group');toggle.setAttribute('aria-label','Visning av statistiken');
  const diagram=document.createElement('button'),map=document.createElement('button');
  diagram.type=map.type='button';diagram.textContent='Diagram';map.textContent='Karta';
  diagram.innerHTML='<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M2 11h3l3-7 4 12 3-7h3"/></svg><span>Diagram</span>';
  map.innerHTML='<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m2 5 5-2 6 2 5-2v12l-5 2-6-2-5 2Z"/><path d="M7 3v12M13 5v12"/></svg><span>Karta</span>';
  diagram.setAttribute('aria-pressed','true');map.setAttribute('aria-pressed','false');toggle.append(diagram,map);
  if(!series){
    const explanation=document.createElement('div');explanation.className='map-unavailable';explanation.id='map-unavailable';explanation.hidden=true;
    const message=document.createElement('p');message.setAttribute('role','status');
    const help=document.createElement('a');help.href='#help-maps';help.textContent='Läs om kartor i Så här fungerar appen';help.setAttribute('data-help-topic','help-maps');
    explanation.append(message,help);toolbar.prepend(toggle);panel.insertBefore(explanation,chart);
    map.className='is-unavailable';map.setAttribute('aria-label','Karta – visa varför kartvyn inte är tillgänglig');map.setAttribute('aria-expanded','false');map.setAttribute('aria-controls',explanation.id);
    map.addEventListener('click',()=>{explanation.hidden=!explanation.hidden;map.setAttribute('aria-expanded',String(!explanation.hidden));message.textContent=explanation.hidden?'':'Kartvyn är inte tillgänglig för det här urvalet. '+mapUnavailableReason(result);});
    diagram.addEventListener('click',()=>{explanation.hidden=true;map.setAttribute('aria-expanded','false');});
    if(originalHidden)chart.innerHTML='<p>Diagrammet kräver minst två år med tillgängliga värden. Du kan läsa resultatet i tabellen.</p>';
    return ()=>{toggle.remove();explanation.remove();chart.hidden=false;};
  }
  const mapPanel=document.createElement('div');mapPanel.className='area-map';mapPanel.hidden=true;
  const canvas=document.createElement('div');canvas.className='map-canvas';
  const notes=document.createElement('div');notes.className='map-notes';
  for(const text of mapNotes(result)){const paragraph=document.createElement('p');paragraph.textContent=text;notes.append(paragraph);}
  const controls=document.createElement('div');controls.className='map-years';
  const previous=document.createElement('button'),next=document.createElement('button');previous.type=next.type='button';previous.textContent='←';next.textContent='→';previous.setAttribute('aria-label','Föregående år');next.setAttribute('aria-label','Nästa år');
  const label=document.createElement('label');label.htmlFor='map-year';label.textContent='År';
  const slider=document.createElement('input');slider.type='range';slider.id='map-year';slider.min='0';slider.step='1';
  const yearText=document.createElement('output');yearText.setAttribute('for','map-year');
  const years=[...new Set([...series.values()].flatMap(s=>s.rows.map(r=>r.year)))].sort((a,b)=>a-b);
  let index=years.length-1,geometry,active=false,disposed=false,lockScale=false;
  const scale=mapScale(series),latestYear=years.at(-1),latestScale=mapScale(series,latestYear);slider.max=String(index);slider.value=String(index);controls.hidden=years.length<=1;
  controls.append(label,previous,slider,next,yearText);mapPanel.append(canvas,controls,notes);toolbar.prepend(toggle);panel.append(mapPanel);
  function draw(){
    if(!geometry||disposed||!active)return;
    const year=years[index];slider.value=String(index);slider.setAttribute('aria-valuetext',String(year));yearText.textContent=String(year);previous.disabled=index===0;next.disabled=index===years.length-1;
    canvas.setAttribute('style',`--map-aspect:${(geometry.width*.9+320)/(geometry.height*.9+55)}`);
    const currentScale=lockScale?latestScale:scale,scaleYear=lockScale?latestYear:undefined;
    canvas.innerHTML=visualHeading(result)+mapSVG(result,geometry,series,year,currentScale,{includeNotes:false,includeHeading:false,scaleYear,scaleControl:{checked:lockScale,available:Boolean(latestScale),latestYear}});
    setExport(mapSVG(result,geometry,series,year,currentScale,{scaleYear}));
    const lock=canvas.querySelector('#map-scale-lock');
    lock?.addEventListener('change',()=>{const restoreFocus=document.activeElement===lock;lockScale=lock.checked&&Boolean(latestScale);draw();if(restoreFocus)canvas.querySelector('#map-scale-lock')?.focus({preventScroll:true});});
    attachMapTooltip(canvas,year);
  }
  slider.addEventListener('input',()=>{index=Number(slider.value);draw();});previous.addEventListener('click',()=>{index=Math.max(0,index-1);draw();});next.addEventListener('click',()=>{index=Math.min(years.length-1,index+1);draw();});
  diagram.addEventListener('click',()=>{active=false;mapPanel.hidden=true;chart.hidden=false;chooser.hidden=result.rows.length===1;heading.textContent=resultHeadingText(result);diagram.setAttribute('aria-pressed','true');map.setAttribute('aria-pressed','false');drawChart();if(originalHidden)chart.innerHTML='<p>Ett linjediagram kräver minst två år med tillgängliga värden. Välj Karta eller läs tabellen.</p>';});
  map.addEventListener('click',async()=>{
    active=true;chart.hidden=true;chooser.hidden=true;mapPanel.hidden=false;diagram.setAttribute('aria-pressed','false');map.setAttribute('aria-pressed','true');heading.textContent=resultHeadingText(result);setExport('');
    canvas.textContent='Laddar karta …';
    try{geometry=await getGeometry();draw();}catch(error){if(!disposed&&active){canvas.textContent='Kartunderlaget kunde inte laddas. Klicka på Karta för att försöka igen.';}}
  });
  if(originalHidden)chart.innerHTML='<p>Välj Karta för att visa områdena, eller läs värdena i tabellen.</p>';
  return ()=>{disposed=true;toggle.remove();mapPanel.remove();chart.hidden=false;};
}
