import {escapeXML as esc,normalize} from './core.js';
import {comparisonValue} from './comparison-data.js';
import {ageGroups,indicator,rankMunicipalities,growthSummary,periodGrowth,withNationalReference} from './comparison-indicators.js';
import {factSheetActions,initFactSheetActions} from './fact-sheet-actions.js';
import {lineChart,ageChart,swatch,format,signed,palette,dashes} from './comparison-chart.js';

import {attachSeriesInteraction} from './series-chart.js';
import {animateChartEntrance} from './chart-animation.js';
import {growthMapSVG,growthMapClasses,attachGrowthMap,municipalityLabel} from './comparison-map.js';
const animations=new Map();
const exportModels=new Map();
const fittedAxes=new Set();
// Native selects may retain :focus-visible after a mouse click. Keep the
// keyboard indicator without drawing a focus ring for pointer interaction.
document.addEventListener('pointerdown',()=>document.body.classList.add('comparison-pointer'));
document.addEventListener('keydown',event=>{if(['Tab','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key))document.body.classList.remove('comparison-pointer');});
const $=id=>document.getElementById(id),root='data/goteborg-jamforelse/';
const selected=new Map([['1480',0]]);
let mapGeometry,mapSelection='',mapZoom=false;
let snapshot,context,areas,ageYear=2025,ageView='meanAge',growthMeasure='growthRate',resizeFrame;
async function json(path){const response=await fetch(path);if(!response.ok)throw Error(`Statistikunderlaget kunde inte hämtas (${response.status}).`);return response.json();}
function selectedAreas(){return [...selected].map(([code,slot])=>({...areas.find(area=>area.code===code),slot}));}
function value(code,year,measure){return indicator(snapshot,context,code,year,measure);}
function legend(series,dots=false){return `<div class="comparison-legend">${series.map(s=>`<span>${swatch(s.slot,dots)}${esc(s.name)}</span>`).join('')}</div>`;}
function table(labels,series,caption,digits=0){return `<details><summary>Visa värden i tabell</summary><div class="comparison-table-scroll"><table><caption>${esc(caption)}</caption><thead><tr><th scope="col">${labels[0].includes('år')?'Ålder':'År'}</th>${series.map(s=>`<th scope="col">${esc(s.name)}</th>`).join('')}</tr></thead><tbody>${labels.map((label,i)=>`<tr><th scope="row">${esc(String(label))}</th>${series.map(s=>`<td>${format(s.values[i],digits)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>`;}

function renderOptions(){
  const query=normalize($('area-search').value),group=$('area-group').value;
  const available=areas.filter(area=>!selected.has(area.code)&&(group==='all'||area.groups.includes(group))&&normalize(area.name).includes(query));
  $('area-options').innerHTML=available.map(area=>`<button type="button" data-add="${area.code}" ${selected.size===4?'disabled':''}>+ ${esc(area.name)}</button>`).join('');
  $('selection-status').textContent=selected.size===4?'Tre jämförelsekommuner är valda. Ta bort en för att lägga till en annan.':`${available.length} kommuner att välja bland. ${selected.size-1} av 3 jämförelsekommuner valda.`;
}
function renderTags(){
  $('filter-count').textContent=`${selected.size} ${selected.size===1?'vald':'valda'}`;
  $('selected-areas').innerHTML=selectedAreas().map(area=>`<span class="comparison-tag">${swatch(area.slot)}${esc(area.name)}${area.code==='1480'?'<span class="sr-only">, huvudkommun</span>':`<button type="button" data-remove="${area.code}" aria-label="Ta bort ${esc(area.name)}">×</button>`}</span>`).join('');
}
const definitions=[
  {id:'population',title:'Hur många bor i kommunen?',description:'Folkmängden vid årets slut. Göteborg visas med en kraftigare, heldragen linje.',measure:'population',unit:'Personer',digits:0},
  {id:'nationalShare',title:'Hur stor andel av Sveriges befolkning bor här?',description:'Kommunens folkmängd som andel av rikets folkmängd samma år.',measure:'nationalShare',unit:'Procent',digits:2},
  {id:'growth',title:'Hur snabbt växer befolkningen?',description:'Årlig folkökning. Procent gör det lättare att jämföra kommuner av olika storlek.',measure:'growthRate',unit:'Procent',digits:2},
  {id:'ages',title:'Hur förändras medelåldern?',description:'Följ SCB:s publicerade medelålder över tid. Växla till åldersstruktur för att se fördelningen i femårsklasser.',measure:'meanAge',unit:'År',digits:1},
  {id:'dependencyRatio',title:'Hur förändras den demografiska försörjningskvoten?',description:'Antal personer 0–19 år och 65 år eller äldre per 100 personer 20–64 år. Ett värde på 70 innebär 70 yngre och äldre per 100 i åldern 20–64 år.',measure:'dependencyRatio',unit:'Personer per 100 personer 20–64 år',digits:1}
];
function buildPanels(){
  $('charts').innerHTML=definitions.map(d=>`<section id="${d.id}" class="comparison-panel" aria-labelledby="${d.id}-title"><div class="comparison-panel-heading"><h2 id="${d.id}-title">${d.title}</h2>${factSheetActions(d.id)}</div><p class="fact-action-status" role="status"></p><p id="${d.id}-description">${d.description}</p>${d.id==='growth'?'<div class="comparison-chart-toolbar"><div><label for="growth-unit">Visa folkökning i</label><select id="growth-unit"><option value="growthRate">Procent</option><option value="growth">Antal personer</option></select></div></div>':d.id==='ages'?`<div class="comparison-chart-toolbar"><div><label for="age-view">Visa</label><select id="age-view"><option value="meanAge">Medelålder över tid</option><option value="structure">Åldersstruktur</option></select></div><div id="age-year-field" hidden><label for="age-year">År för åldersstrukturen</label><select id="age-year">${[...snapshot.years].reverse().map(year=>`<option>${year}</option>`).join('')}</select></div></div>`:''}<div class="comparison-chart-toolbar" id="${d.id}-axis-controls"><button type="button" class="secondary comparison-axis-toggle" id="${d.id}-axis-toggle" aria-pressed="false" aria-controls="${d.id}-body">Anpassa y-axeln</button></div><div id="${d.id}-body"></div></section>`).join('');
  for(const d of definitions)$(d.id+'-axis-toggle').addEventListener('click',()=>{
    if(fittedAxes.has(d.id))fittedAxes.delete(d.id);else fittedAxes.add(d.id);
    renderPanel(d);
  });
  $('growth-unit').addEventListener('change',event=>{growthMeasure=event.target.value;renderPanel(definitions.find(d=>d.id==='growth'));});
  $('age-view').addEventListener('change',event=>{ageView=event.target.value;renderPanel(definitions.find(d=>d.id==='ages'));});
  $('age-year').addEventListener('change',event=>{ageYear=Number(event.target.value);renderPanel(definitions.find(d=>d.id==='ages'));});
}
function renderPanel(definition){
  const d={...definition},body=$(d.id+'-body'),width=body.clientWidth||850,chosen=withNationalReference(selectedAreas(),{enabled:$('show-national').checked,panel:definition.id,growthMeasure});
  const fitYAxis=fittedAxes.has(d.id);
  $(d.id+'-axis-controls').hidden=d.id==='ages'&&ageView==='structure';
  const axisButton=$(d.id+'-axis-toggle');
  axisButton.textContent=fitYAxis?'Visa från noll':'Anpassa y-axeln';
  axisButton.setAttribute('aria-pressed',String(fitYAxis));
  animations.get(d.id)?.();
  const wasOpen=body.querySelector('details')?.open;
  if(d.id==='ages'){
    const structure=ageView==='structure';
    if(structure){d.title='Hur ser åldersstrukturen ut?';d.description='Andel av befolkningen i femårsklasser. Den sista gruppen omfattar alla som är 100 år eller äldre.';}
    $('ages-title').textContent=d.title;
    $('ages-description').textContent=d.description;
    $('age-year-field').hidden=!structure;
  }
  const dialog=body.closest('dialog');
  const layoutHeight=dialog?Math.max(180,dialog.querySelector('.visual-dialog-content').clientHeight-(body.closest('.comparison-panel').scrollHeight-body.querySelector('.comparison-chart').clientHeight)-48):d.id==='ages'&&ageView==='structure'?(width<500?240:260):(width<500?280:320);
  if(d.id==='ages'&&ageView==='structure'){
    const series=chosen.map(area=>({...area,values:ageGroups.map(([,fromAge,toAge])=>comparisonValue(snapshot,{region:area.code,year:ageYear,measure:'ageShare',fromAge,toAge}).value)}));
    const caption=`Åldersstruktur ${ageYear} · Procent av kommunens folkmängd`;
    body.innerHTML=legend(series)+`<figure class="comparison-figure"><div class="comparison-chart">${ageChart({series,groups:ageGroups.map(g=>g[0]),title:caption,width,layoutHeight})}</div><figcaption>Källa: SCB · ${ageYear}. Peka eller använd piltangenterna för att läsa varje femårsklass. ${ageYear>=2025?'Åldersandelarna kan avvika från 100 procent på grund av röjandekontroll (CKM).':''}</figcaption></figure>`+table(ageGroups.map(g=>g[0]),series,caption,2);
    attachSeriesInteraction(body.querySelector('.comparison-chart'),series.map(s=>({...s,rows:s.values.map((value,year)=>({year,value}))})), 'procent',{hoverRadius:6,palette:chosen.map(s=>palette[s.slot]),lineDashes:chosen.map(s=>dashes[s.slot]),labelForRow:row=>ageGroups[row.year][0],formatValue:value=>format(value,2)});
    exportModels.set(d.id,{title:d.title,subtitle:caption,age:true,labels:ageGroups.map(g=>g[0]),series,unit:'Procent',notes:['Femårsklasser 0–4 till 95–99 år, därefter 100+ år.',...snapshot.notes]});
  }else{
    if(d.id==='growth'){d.measure=growthMeasure;d.unit=growthMeasure==='growth'?'Personer':'Procent';d.digits=growthMeasure==='growth'?0:2;}
    const series=chosen.map(area=>({...area,values:snapshot.years.map(year=>value(area.code,year,d.measure))}));
    body.innerHTML=legend(series)+`<figure class="comparison-figure"><div class="comparison-chart">${lineChart({series,years:snapshot.years,title:d.title,unit:d.unit,width,digits:d.digits,layoutHeight,fitYAxis})}</div><figcaption>Källa: SCB · 2000–2025. Peka i diagrammet eller använd piltangenterna för att läsa ett år.${d.id==='growth'?' Folkökning i procent beräknas mot föregående års folkmängd.':''}</figcaption></figure>`+table(snapshot.years.map(String),series,`${d.title} · ${d.unit}`,d.digits);
    attachSeriesInteraction(body.querySelector('.comparison-chart'),series.map(s=>({...s,rows:s.values.map((value,i)=>({year:snapshot.years[i],value}))})),d.unit==='Personer per 100 personer 20–64 år'?'per 100':d.unit,{hoverRadius:6,palette:chosen.map(s=>palette[s.slot]),lineDashes:chosen.map(s=>dashes[s.slot]),formatValue:value=>format(value,d.digits)});
    exportModels.set(d.id,{title:d.title,subtitle:'2000–2025',age:false,labels:snapshot.years,series,unit:d.unit,fitYAxis,notes:[...(fitYAxis?['Y-axeln är anpassad efter valda serier och omfattar inte alltid noll.']:[]),...(d.id==='growth'&&growthMeasure==='growthRate'?['Folkökning i procent = SCB:s publicerade folkökning / föregående års folkmängd × 100.']:[]),...snapshot.notes]});
  }
  animations.set(d.id,animateChartEntrance(body.querySelector('.comparison-chart svg')));
  if(wasOpen)body.querySelector('details').open=true;
}
function renderCharts(){definitions.forEach(renderPanel);}
function renderRankings(){
  const scope=$('rank-scope').value,measure=$('rank-measure').value,label=measure==='growth'?'antal':'procent',configs=[[`Högst folkökning · ${label}`,measure,'desc'],[`Lägst folkökning · ${label}`,measure,'asc']];
  const period=Number($('rank-period').value),endYear=context.year,startYear=endYear-period,periodLabel=`${startYear}–${endYear}`;
  const method=period===1?`SCB:s publicerade folkökning, ${periodLabel}. Procent beräknas mot folkmängden ${startYear}.`:`Förändring mellan publicerade folkmängdstotaler ${periodLabel}, i procent av folkmängden ${startYear}. Total förändring under perioden, inte årlig genomsnittlig tillväxt.`;
  $('ranking-period-label').textContent=`Befolkningstillväxt · ${periodLabel}`;
  $('growth-map-title').textContent=`Befolkningsförändring ${periodLabel}`;
  $('growth-map-source-period').textContent=`Statistik ${periodLabel}`;
  const summary=growthSummary(context,areas,scope,period);
  const summaryCards=[['1480','Göteborg'],['00','Riket']].map(([code,name])=>{
    const result=periodGrowth(value(code,endYear,'population'),value(code,startYear,'population'),value(code,endYear,'growth'),period);
    return `<div class="growth-summary-group" role="group" aria-label="${name} folkökning ${periodLabel}"><p class="growth-summary-heading">${name} · ${periodLabel}</p><div class="growth-summary-cards"><div class="growth-summary-card"><strong>${signed(result.growth)}</strong><span>Personer</span></div><div class="growth-summary-card"><strong>${signed(result.growthRate,2)} %</strong><span>Folkökning</span></div></div></div>`;
  }).join('');
  $('growth-summary').innerHTML=summaryCards+`<div class="growth-summary-group growth-summary-counts" role="group" aria-label="Antal kommuner i valt urval"><p class="growth-summary-heading">Kommuner · ${summary.total} i valt urval</p><div class="growth-summary-cards">${[['Ökar',summary.increased],['Minskar',summary.decreased],['Oförändrade',summary.unchanged]].map(([label,count])=>`<div class="growth-summary-card"><strong>${count}</strong><span>${label}</span></div>`).join('')}</div></div>`;
  const count=rankMunicipalities(context,areas,{scope,period}).length;
  const mapRows=rankMunicipalities(context,areas,{scope,measure,period});
  const scopeLabel=$('rank-scope').selectedOptions[0].textContent;
  $('growth-map').innerHTML=growthMapSVG(mapGeometry,mapRows,measure,{interactive:true});
  $('growth-map-legend').innerHTML=growthMapClasses(measure).map(c=>`<span><i style="background:${c.color}"></i>${esc(c.label)}</span>`).join('');
  const filterMapOptions=()=>{
    const matches=[...mapRows].filter(row=>normalize(row.name).includes(normalize($('map-search').value))).sort((a,b)=>a.name.localeCompare(b.name,'sv'));
    $('map-municipality').innerHTML=matches.map(row=>`<option value="${row.code}">${esc(row.name)}</option>`).join('');
    $('map-municipality').value=mapSelection;
    $('map-search-status').textContent=matches.length?`${matches.length} kommuner`:'Inga kommuner matchar sökningen.';
  };
  filterMapOptions();
  const choose=attachGrowthMap($('growth-map'),mapRows,(row,zoom)=>{
    mapSelection=row?.code??'';mapZoom=zoom;$('map-municipality').value=mapSelection;$('map-selected-name').textContent=row?.name??'Ingen vald';$('growth-map-readout').textContent=row?municipalityLabel(row):'Välj en kommun för att markera och zooma in.';
  });
  const retained=mapRows.some(row=>row.code===mapSelection);
  if(retained)choose(mapSelection,{zoom:mapZoom,animate:false});else choose.reset({animate:false});
  $('map-municipality').onchange=event=>{choose(event.target.value);$('map-picker').open=false;$('map-picker').querySelector('summary').focus();};
  $('map-search').oninput=filterMapOptions;
  $('map-search').onkeydown=event=>{
    if(event.key==='Enter'&&$('map-municipality').options.length){event.preventDefault();choose($('map-municipality').options[0].value);$('map-picker').open=false;$('map-picker').querySelector('summary').focus();}
  };
  $('map-picker').ontoggle=()=>{if($('map-picker').open){$('map-search').value='';filterMapOptions();$('map-search').focus();}};
  $('map-reset').onclick=()=>{mapZoom=false;choose.reset();};
  const allRows=[...mapRows].sort((a,b)=>a.name.localeCompare(b.name,'sv'));
  $('growth-map-table').innerHTML=`<table><caption>${esc(scopeLabel)} · Befolkningsförändring ${periodLabel} · Källa: SCB</caption><thead><tr><th scope="col">Kommun</th><th scope="col">Antal</th><th scope="col">Procent</th></tr></thead><tbody>${allRows.map(row=>`<tr><th scope="row">${esc(row.name)}</th><td>${signed(row.growth)}</td><td>${signed(row.growthRate,2)} %</td></tr>`).join('')}</tbody></table>`;
  exportModels.set('rankings',{kind:'map',geometry:mapGeometry,mapRows,measure,startYear,endYear,title:`Befolkningsförändring ${periodLabel}`,subtitle:scopeLabel,unit:measure==='growth'?'Personer':'Procent',age:false,labels:allRows.map(row=>`${row.code} ${row.name}`),series:[{name:'Folkökning, antal personer',values:allRows.map(row=>row.growth)},{name:'Folkökning, procent',values:allRows.map(row=>row.growthRate)}],notes:[method,'CKM används för röjandekontroll från 2025.','Kommungränser: SCB, förenklad tematisk karta (CC0), arkiv 260225.',mapGeometry.url]});
  $('ranking-status').textContent=`${count} kommuner i urvalet. ${count<10?'Alla kommuner visas. ':''}Förändring ${periodLabel}. Negativa värden betyder folkminskning. ${method}`;
  $('ranking-tables').innerHTML=configs.map(([title,measure,direction])=>{
    const ranked=rankMunicipalities(context,areas,{scope,measure,direction,period}),top=ranked.slice(0,10),gothenburg=ranked.find(row=>row.code==='1480'),extra=gothenburg&&!top.some(row=>row.code==='1480');
    const rows=extra?[...top,gothenburg]:top;
    return `<div><h3>${title}</h3><div class="comparison-table-scroll"><table><caption>Folkökning ${periodLabel}${extra?' · Göteborg visas även efter tiolistan.':''}</caption><thead><tr><th scope="col">Plats</th><th scope="col">Kommun</th><th scope="col">Antal</th><th scope="col">Procent</th></tr></thead><tbody>${rows.map((row,i)=>`<tr class="${row.code==='1480'?'is-gothenburg ':''}${extra&&i===10?'outside-top':''}"><td>${row.rank}</td><th scope="row">${esc(row.name)}</th><td>${signed(row.growth)}</td><td>${signed(row.growthRate,2)} %</td></tr>`).join('')}</tbody></table></div>${!gothenburg?'<p class="comparison-note">Göteborg ingår inte i detta urval.</p>':''}</div>`;
  }).join('');
}
try{
  const [manifest,contextManifest,nationalManifest]=await Promise.all([json(root+'metadata.json'),json(root+'context-metadata.json'),json(root+'national-metadata.json')]);
  if(contextManifest.populationSnapshotSha256!==manifest.sha256)throw Error('Statistikens versioner stämmer inte överens.');
  [snapshot,context]=await Promise.all([json(root+manifest.file),json(root+contextManifest.file)]);
  if(nationalManifest.populationSnapshotSha256!==manifest.sha256||nationalManifest.contextSha256!==contextManifest.sha256)throw Error('Rikets statistikversion stämmer inte med kommununderlaget.');
  const national=await json(root+nationalManifest.file);
  const periodsManifest=await json(root+'periods-metadata.json');
  const periods=await json(root+periodsManifest.file);
  if(periodsManifest.contextSha256!==contextManifest.sha256||periods.contextSha256!==contextManifest.sha256)throw Error('Periodernas statistikversion stämmer inte med kommununderlaget.');
  context.periodBaselines=periods.baselines;
  mapGeometry=await json('data/sweden-municipalities-map.json');
  if(JSON.stringify(national.years)!==JSON.stringify(snapshot.years))throw Error('Rikets årstäckning stämmer inte med kommununderlaget.');
  snapshot.data['00']=national.data['00'];context.baseline1999['00']=national.baseline1999;
  areas=[...snapshot.municipalities.areas].sort((a,b)=>a.name.localeCompare(b.name,'sv'));
  $('comparison-content').hidden=false;$('load-status').hidden=true;
  const compact=matchMedia('(max-width: 760px)');
  const syncFilters=()=>{document.querySelector('.comparison-controls').open=!compact.matches;};
  compact.addEventListener('change',syncFilters);syncFilters();
  $('ranking-actions').innerHTML=factSheetActions('rankings');
  renderTags();renderOptions();buildPanels();renderCharts();renderRankings();
  initFactSheetActions({getModel:id=>exportModels.get(id),redraw:id=>id==='rankings'?renderRankings():renderPanel(definitions.find(d=>d.id===id))});
  $('data-edition').textContent=`Underlaget hämtades ${new Date(context.builtAt).toLocaleDateString('sv-SE')}. Senaste statistikår är 2025. Gemensamma totaler för 2024–2025 har kontrollerats mot jämförelseunderlaget.`;
  $('area-search').addEventListener('input',renderOptions);$('area-group').addEventListener('change',renderOptions);
  $('show-national').addEventListener('change',()=>{renderCharts();});
  $('area-options').addEventListener('click',event=>{const button=event.target.closest('[data-add]');if(!button||selected.size>=4)return;const slot=[1,2,3].find(slot=>![...selected.values()].includes(slot));selected.set(button.dataset.add,slot);$('area-search').value='';renderTags();renderOptions();renderCharts();$('area-search').focus();});
  $('selected-areas').addEventListener('click',event=>{const button=event.target.closest('[data-remove]');if(!button)return;selected.delete(button.dataset.remove);renderTags();renderOptions();renderCharts();$('area-search').focus();});
  $('rank-scope').addEventListener('change',renderRankings);
  $('rank-measure').addEventListener('change',renderRankings);
  $('rank-period').addEventListener('change',renderRankings);
  let previousWidth=$('charts').clientWidth;
  new ResizeObserver(()=>{const width=$('charts').clientWidth;if(width===previousWidth)return;previousWidth=width;cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(renderCharts);}).observe($('charts'));
}catch(error){$('comparison-content').hidden=true;$('load-status').hidden=false;$('load-status').textContent=`${error.message} Försök ladda om sidan.`;$('load-status').setAttribute('role','alert');console.error(error);}
