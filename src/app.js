import {interpret,periodOf,yearsOf,areaOf,labelOf,aggregate,escapeXML as esc} from './core.js';
import {findTables} from './search.js';
import {splitQuery,detailedSeries,resultGrid,alignPeriods} from './detailed-results.js';
import {runExtraction} from './extraction-queue.js';
import {monthlyAvailabilityQuery,populatedMonths} from './monthly-availability.js';
import {tableMeasure} from './table-measures.js';
import {searchSelection} from './search-selection.js';
import {initSearchSuggestions} from './search-suggestions.js';
import {resultCSV,resultExcel} from './exports.js';
import {seriesChart,fitSeriesChart,chartPeriods,chartDescriptions} from './series-chart.js';
import {initGroupControls} from './group-controls.js';
import {planGroups} from './group-selection.js';
import {initTableSuggestions} from './table-suggestions.js';
import {groupTables,tableSummary,levelLabels} from './catalog-groups.js';
import {browseTables,catalogThemes,filterTables} from './catalog-filters.js';
import {mapSeries,mountAreaMap} from './area-map.js';
import {resultHeadingText,visualHeading,resultAreaLabel} from './result-heading.js';
import {initHelpDialog} from './help-dialog.js';
import {initVisualDialog} from './visual-dialog.js';
const $=id=>document.getElementById(id), fmt=n=>n===null?'Uppgift saknas':new Intl.NumberFormat('sv-SE').format(n);
const syncSearchSuggestion=initSearchSuggestions($('search'),$('search-suggestion'));
let catalog=[], selected=null, result=null, selectionVersion=0, dataVersion=0;
let searchResults=[], requestedYears, shown=3, groupControls, searchContext=null;
let disposeAreaMap=()=>{};
let disposeChart=()=>{};
const tableSuggestions=initTableSuggestions($('search'),()=>catalog,table=>{
  searchContext=findTables($('search').value,catalog);
  const area=matchedArea(table),years=searchContext.years;
  $('search').value=table.title;syncSearchSuggestion();
  if(table.kind)choose(table,area,years.length?years:undefined);
  else window.open(table.webUrl,'_blank','noopener');
});
const status=text=>{$('status').textContent=text;};
const scroll=id=>$(id).scrollIntoView({block:'start'});
async function request(url,options={}){
  const response=await fetch(url,{...options,signal:AbortSignal.timeout(25000),credentials:'omit'});
  if(!response.ok)throw new Error(response.status===429?'Många uttag görs just nu. Vänta en stund och försök igen.':`Statistikdatabasen kunde inte nås (HTTP ${response.status}). Försök igen om en stund.`);
  const body=await response.json();
  if(String(body?.error||'').includes('429'))throw new Error('Många uttag görs just nu. Vänta en stund och försök igen.');
  if(body?.error)throw new Error('Statistikdatabasen kunde inte behandla urvalet. Prova ett mindre urval.');
  return body;
}
const networkMessage=error=>error instanceof TypeError||error.name==='TimeoutError'?'Det gick inte att hämta uppgifter från statistikdatabasen. Kontrollera internetanslutningen och försök igen. Inga exempelvärden har lagts in.':error.message;
function updateCatalogPreview(){
  const grid=$('catalog'),items=[...grid.querySelectorAll('.catalog-row')];
  const top=grid.getBoundingClientRect().top;
  const positions=items.map(item=>item.getBoundingClientRect());
  const rows=[...new Set(positions.map(rect=>Math.round(rect.top-top)))];
  const clipped=rows.length>shown;
  items.forEach((item,index)=>{
    const preview=clipped&&Math.round(positions[index].top-top)>=rows[shown];
    item.inert=preview;
    if(preview)item.setAttribute('aria-hidden','true');
    else item.removeAttribute('aria-hidden');
  });
  if(clipped){
    const previewIndex=positions.findIndex(rect=>Math.round(rect.top-top)===rows[shown]);
    const height=rows[shown]+positions[previewIndex].height/2;
    grid.style.maxHeight=`${height}px`;
    grid.style.setProperty('--preview-start',`${rows[shown]}px`);
  }else grid.style.removeProperty('max-height');
  grid.classList.toggle('has-preview',clipped);
  $('show-more').hidden=!clipped;
}
new ResizeObserver(updateCatalogPreview).observe($('catalog'));
document.fonts.ready.then(updateCatalogPreview);
function filteredTables(){return filterTables(searchResults,{level:$('level-filter').value,theme:$('theme-filter').value,readyOnly:$('ready-filter').checked});}
function cards(){
  const tables=filteredTables();
  const groups=groupTables(tables);
  $('catalog-count').textContent=`${groups.length} tabellgrupper · ${tables.length} av ${catalog.length} tabeller`;
  $('catalog').replaceChildren();
  if(!tables.length)$('catalog').innerHTML='<p>Inga tabeller matchar sökningen och filtren. Prova ett bredare ämne eller välj en annan geografisk nivå.</p>';
  for(const [index,group] of groups.entries()){
    const row=document.createElement('article');row.className='catalog-row';
    const summary=tableSummary(group),headingId=`catalog-row-${index}`;
    row.setAttribute('aria-labelledby',headingId);
    row.innerHTML=`<div class="catalog-row-info"><span class="catalog-subject">${esc(group.subject)}</span><h3 id="${headingId}">${esc(summary.title)}</h3><p>${esc(summary.detail)}</p></div><div class="catalog-levels" role="group" aria-label="Välj geografisk nivå för ${esc(group.title)}"></div>`;
    for(const t of group.tables){
      const choice=document.createElement(t.kind?'button':'a');choice.className='level-choice';
      choice.innerHTML=`${esc(levelLabels[t.level]||t.level)} <span aria-hidden="true">${t.kind?'→':'↗'}</span>`;
      choice.setAttribute('aria-label',`${t.title}, ${t.level==='Kommun'?'Hela Göteborg':t.level}${t.kind?'':'. Öppna i statistikdatabasen, ny flik'}`);
      if(t.kind){choice.type='button';choice.addEventListener('click',()=>choose(t,matchedArea(t),requestedYears));}
      else{choice.href=t.webUrl;choice.target='_blank';choice.rel='noopener';choice.title='Öppna i statistikdatabasen, ny flik';}
      row.querySelector('.catalog-levels').append(choice);
    }
    $('catalog').append(row);
  }
  updateCatalogPreview();
}
function matchedArea(table){return table.metadata?interpret($('search').value,[table]).matches[0]?.value:undefined;}
async function choose(table,area,range){
  const version=++selectionVersion;++dataVersion;selected=null;
  $('selection-section').hidden=true;$('result').hidden=true;status('Kontrollerar tabellens tillgängliga områden och år …');
  let metadata;
  try{metadata=await request(table.url);}catch(error){if(version!==selectionVersion)return;status(networkMessage(error));return;}
  if(version!==selectionVersion)return;
  selected={...table,metadata};status('');
  const years=yearsOf(metadata), dimension=areaOf(metadata);
  $('selection-title').textContent=table.title;
  $('selection-description').textContent=`${metadata.title}. Tillgängliga år: ${years[0]}–${years.at(-1)}.`;
  $('area-field').hidden=true;$('area').replaceChildren();
  if(dimension)dimension.values.forEach((v,i)=>$('area').add(new Option(dimension.valueTexts?.[i]||v,v)));
  if(area&&dimension?.values.includes(area))$('area').value=area;
  const preset=searchSelection(metadata,searchContext?.intent);
  if(area&&dimension?.values.includes(area)&&!preset.selections[dimension?.code||'Område'])preset.selections[dimension?.code||'Område']=[area];
  if(preset.selections[dimension?.code||'Område'])$('area').value=preset.selections[dimension?.code||'Område'][0];
  groupControls=initGroupControls($('extra-filters'),metadata,()=>$('area').value,preset.selections,tableMeasure(table));
  $('selection-form').querySelector(':scope > .selection-help')?.remove();
  $('selection-form').prepend($('extra-filters').querySelector('.selection-help'));
  $('selection-note').textContent='Enhet: '+tableMeasure(table).unit+'. Totalt avser de kategorier och åldrar som ingår i källtabellen.';
  for(const id of ['start','end']){$(id).min=years[0];$(id).max=years.at(-1);}
  $('start').value=range?.[0]??years[0];$('end').value=range?.at(-1)??years.at(-1);
  $('selection-warning').hidden=true;
  if(range?.some(y=>!years.includes(y))){$('selection-warning').hidden=false;$('selection-warning').textContent=`Din fråga innehåller år som saknas. Tabellen täcker ${years[0]}–${years.at(-1)}. Justera årtalen innan du hämtar.`;}
  const searchNotes=[...(searchContext?.notes||[]),...preset.warnings];
  if(searchNotes.length){$('selection-warning').textContent=[$('selection-warning').hidden?'':$('selection-warning').textContent,...searchNotes].filter(Boolean).join(' ');$('selection-warning').hidden=false;}
  if(Object.keys(preset.selections).length)$('selection-note').textContent+=' Urval från sökningen är ifyllt. Kontrollera det innan du hämtar.';
  $('fetch-button').disabled=false;$('fetch-button').textContent='Visa statistiken →';
  $('selection-section').hidden=false;scroll('selection-section');
}
function resetCatalogFilters(){
  $('level-filter').value='';$('theme-filter').value='';$('ready-filter').checked=false;
}
function resetSearch(){
  ++selectionVersion;++dataVersion;selected=null;result=null;
  requestedYears=undefined;shown=3;searchContext=null;
  $('selection-section').hidden=true;$('result').hidden=true;
  resetCatalogFilters();
  $('catalog-title').textContent='Börja med en tabell';
  $('search-summary').textContent='';$('search-summary').hidden=true;
  $('catalog-section').classList.remove('is-active');
  searchResults=browseTables(catalog);
  if(catalog.length){status('');cards();}
  syncSearchSuggestion();
}
function search(text){
  tableSuggestions.close();
  resetCatalogFilters();
  if(!text.trim()){resetSearch();return;}
  syncSearchSuggestion();
  $('catalog-section').classList.add('is-active');
  ++selectionVersion;++dataVersion;selected=null;$('selection-section').hidden=true;$('result').hidden=true;
  const found=findTables(text,catalog);searchContext=found;status('');$('search-summary').hidden=false;
  searchResults=found.tables;requestedYears=found.years.length?found.years:undefined;shown=3;
  $('level-filter').value=found.level;
  $('catalog-title').textContent=found.topic?`Tabeller om ${found.topic}`:text.trim()?`Sökträffar för ”${text.trim()}”`:'Alla tabeller';
  $('search-summary').textContent='Välj en tabell och kontrollera dess geografiska nivå. '+catalog.filter(t=>t.kind).length+' tabeller kan visas direkt i appen. Övriga öppnas i statistikdatabasen i en ny flik. Årtal och föreslagna urval kontrolleras vid tabellval. '+found.notes.join(' ');
  cards();
  const population=filterTables(catalog,{level:$('level-filter').value,theme:$('theme-filter').value,readyOnly:$('ready-filter').checked}).filter(t=>t.kind==='population'),old=interpret(text,population);
  if(old.supported&&!old.subgroup&&!old.browse&&(/folkm|befolk|invån/i.test(text))){
    if(old.matches.length===1){const t=population.find(t=>t.id===old.matches[0].table);choose(t,old.matches[0].value,requestedYears);return;}
    if(old.city&&!old.matches.length){const city=population.find(t=>t.id==='kommun');if(city){choose(city,undefined,requestedYears);return;}}
  }
  scroll('catalog-section');
}
function render(){
  disposeAreaMap();disposeChart();
  const snapshot=result;
  const {series,rows,area,table,date,measure,unit,notes}=result;
  const start=rows[0],end=rows.at(-1),single=rows.length===1;
  $('result-title').textContent=measure+' i '+resultAreaLabel(result);
  $('result-subtitle').textContent=table.level+' · '+periodOf(start)+'–'+periodOf(end)+' · '+series.length+' '+(series.length===1?'grupp':'grupper');
  $('metrics').innerHTML=(series.length>7?[]:series).map(s=>{
    const first=s.rows[0],last=s.rows.at(-1),difference=first.value!==null&&last.value!==null?last.value-first.value:null;
    return '<div class="metric"><p>'+esc(s.name)+' · '+periodOf(last)+'</p><strong>'+esc(fmt(last.value))+'</strong><small>'+esc(unit)+(single?'':' · Förändring: '+(difference===null?'Uppgift saknas':(difference>0?'+':'')+fmt(difference)))+'</small><p class="metric-detail">'+esc(s.detail)+'</p></div>';
  }).join('');
  if(series.length===1&&!single){
    const difference=start.value!==null&&end.value!==null?end.value-start.value:null;
    const metrics=[[`${measure} ${periodOf(start)}`,fmt(start.value),unit],[`${measure} ${periodOf(end)}`,fmt(end.value),unit],['Förändring under perioden',difference===null?'Uppgift saknas':`${difference>0?'+':''}${fmt(difference)}`,difference!==null&&start.value>0?`${new Intl.NumberFormat('sv-SE',{maximumFractionDigits:1,signDisplay:'exceptZero'}).format(difference/start.value*100)} procent`:unit]];
    $('metrics').innerHTML=metrics.map(m=>`<div class="metric"><p>${esc(m[0])}</p><strong>${esc(m[1])}</strong><small>${esc(m[2])}</small></div>`).join('');
    $('result-subtitle').textContent+=' · '+series[0].detail;
  }
  $('chart-panel').hidden=single||series.every(s=>s.rows.every(r=>r.value===null));
  const chooser=document.createElement('details');chooser.className='chart-series-choice';
  const chooserTitle=document.createElement('summary');chooserTitle.textContent='Välj linjer i diagrammet (högst 7)';chooser.append(chooserTitle);
  const chartChoices=document.createElement('div');chartChoices.className='category-list';
  const findLabel=document.createElement('label');findLabel.htmlFor='find-chart-series';findLabel.textContent='Sök bland serier';
  const findSeries=document.createElement('input');findSeries.id='find-chart-series';findSeries.type='search';findSeries.placeholder='Till exempel Majorna eller 20 år';
  findSeries.addEventListener('input',()=>{const words=findSeries.value.toLocaleLowerCase('sv').trim().split(/\s+/);[...chartChoices.children].forEach(label=>{label.hidden=!words.every(word=>label.textContent.toLocaleLowerCase('sv').includes(word));});});
  const selection=new Set(series.length<=7?series.map((_,i)=>i):[]),checks=[];
  const draw=()=>{
    disposeChart();
    const visible=chartPeriods(series.filter((_,i)=>selection.has(i)),result.populatedMonths);
    chooserTitle.textContent='Linjer i diagrammet: '+selection.size+' av högst 7';
    checks.forEach((check,i)=>{check.disabled=!selection.has(i)&&selection.size>=7;});
    result.svg=visible.some(s=>s.rows.length)&&!single?seriesChart({...result,series:visible}):'';
    $('chart').innerHTML=result.svg?visualHeading(result)+'<div class="chart-viewport">'+seriesChart({...result,series:visible,includeHeading:false,includeDescriptions:false})+'</div>'+chartDescriptions(visible):(visible.length?'<p>Det saknas data för de valda serierna.</p>':'<p>Välj upp till sju serier för diagrammet. Alla serier finns i tabellen och exporterna.</p>');
    for(const id of ['svg','png'])$(id).disabled=!result.svg;
    if(result.svg)disposeChart=fitSeriesChart($('chart'),{...result,series:visible});
  };
  series.forEach((s,i)=>{const label=document.createElement('label');label.className='check-label';const check=document.createElement('input');check.type='checkbox';check.checked=selection.has(i);check.addEventListener('change',()=>{if(check.checked&&selection.size<7)selection.add(i);else{selection.delete(i);check.checked=false;}draw();});checks.push(check);label.append(check,document.createTextNode(s.name));chartChoices.append(label);});
  chooser.append(findLabel,findSeries,chartChoices);$('chart-panel').querySelector('.chart-series-choice')?.remove();$('chart-panel').insertBefore(chooser,$('chart'));chooser.open=series.length>7;chooser.hidden=single;draw();
  $('table-caption').textContent=measure+' i '+area+', '+periodOf(start)+'–'+periodOf(end);
  const grid=resultGrid(result),head=$('value-heading').parentElement;
  head.innerHTML=grid.headers.map((h,i)=>'<th scope="col"'+(i===grid.headers.length-1?' id="value-heading" class="number"':'')+'>'+esc(h)+'</th>').join('');
  let page=0;const pageSize=200;
  const pager=document.createElement('div');pager.className='table-pagination';
  const previous=document.createElement('button');previous.className='secondary';previous.textContent='Föregående';
  const next=document.createElement('button');next.className='secondary';next.textContent='Nästa';const pageLabel=document.createElement('span');
  const showPage=()=>{const start=page*pageSize;previous.disabled=page===0;next.disabled=start+pageSize>=grid.rows.length;pageLabel.textContent='Rad '+(start+1)+'–'+Math.min(start+pageSize,grid.rows.length)+' av '+grid.rows.length;
    $('table-body').innerHTML=grid.rows.slice(start,start+pageSize).map(row=>'<tr>'+row.map((value,i)=>i===row.length-1?'<td class="number">'+esc(fmt(value))+'</td>':i===0?'<th scope="row">'+esc(value)+'</th>':'<td>'+esc(value)+'</td>').join('')+'</tr>').join('');};
  previous.addEventListener('click',()=>{page--;showPage();});next.addEventListener('click',()=>{page++;showPage();});pager.append(previous,pageLabel,next);
  $('table-heading').parentElement.querySelector('.table-pagination')?.remove();$('table-body').closest('.table-scroll').after(pager);pager.hidden=grid.rows.length<=pageSize;showPage();
  $('result-note').textContent=single?(mapSeries(result)?'Ett år är valt. Resultatet kan visas som karta, nyckeltal och tabell.':'Ett år är valt. Resultatet visas som nyckeltal och tabell.'):'Varje grupp visas separat. Saknade delvärden ger Uppgift saknas för gruppen och året, inte noll.';
  $('source').innerHTML='Källa: Göteborgs Stads statistikdatabas. Hämtad '+esc(date)+'. <a href="'+esc(table.url)+'" target="_blank" rel="noopener">Tabellens metadata (API)</a> · <a href="'+esc(table.webUrl)+'" target="_blank" rel="noopener">Öppna källtabellen</a>';
  $('metadata-notes').textContent=notes;$('metadata-notes').parentElement.open=Boolean(notes);
  $('chart-heading').textContent=resultHeadingText(result);$('table-heading').textContent=measure+' per år';$('value-heading').textContent=unit;
  $('aggregation-note').textContent='Filter med summerad redovisning räknas ihop. Separat redovisade kategorier får egna rader och serier. Egna grupper kan överlappa och summeras inte med varandra. Totalt avser källtabellens population. Uppgift saknas som kategori ingår när Totalt är valt; det skiljer sig från ett saknat numeriskt värde.';
  disposeAreaMap=mountAreaMap({result,panel:$('chart-panel'),toolbar:$('chart-panel').querySelector('.section-heading'),chart:$('chart'),chooser,heading:$('chart-heading'),drawChart:draw,setExport:svg=>{if(result!==snapshot)return;result.svg=svg;for(const id of ['svg','png'])$(id).disabled=!svg;}});
  $('result').hidden=false;scroll('result');
}
function download(content,type,name){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
const filename=extension=>`statistik-${result.area.toLowerCase().replace(/[^a-zåäö0-9]+/g,'-')}-${periodOf(result.rows[0])}-${periodOf(result.rows.at(-1))}.${extension}`;
initHelpDialog($('app-help'),$('help-close'));
initVisualDialog($('chart-panel'));
$('search-form').addEventListener('submit',e=>{e.preventDefault();search($('search').value);});
$('search').addEventListener('focus',()=>{resetCatalogFilters();shown=3;cards();});
$('search').addEventListener('input',()=>{if(!$('search').value.trim())resetSearch();});
document.querySelectorAll('[data-example]').forEach(b=>b.addEventListener('click',()=>{$('search').value=b.dataset.example;search(b.dataset.example);}));
$('selection-form').addEventListener('input',()=>{++dataVersion;$('result').hidden=true;$('fetch-button').disabled=false;$('fetch-button').textContent='Visa statistiken →';status('');});
$('selection-form').addEventListener('submit',async e=>{
  e.preventDefault();if(!selected)return;const table=selected, version=++dataVersion;
  try{
    const groups=planGroups(table,$('area').value,Number($('start').value),Number($('end').value),groupControls.read());
    const {label:measure,unit}=tableMeasure(table);
    const areaLabels=[...new Set(groups.map(group=>group.area))];
    const area=areaLabels.length===1?(areaLabels[0].length>70?'valda områden':areaLabels[0]):'valda områden';
    $('fetch-button').disabled=true;$('fetch-button').textContent='Hämtar statistik …';$('result').hidden=true;status('Hämtar statistik från Göteborgs statistikdatabas …');
    const series=[],allNotes=new Set(table.sourceNotes||[]);
    const cells=groups.reduce((sum,g)=>sum+g.query.query.reduce((n,v)=>n*v.selection.values.length,1),0);
    if(cells>1000000)throw new Error('Urvalet är för stort. Välj färre år eller kategorier (högst en miljon källvärden).');
    const jobs=groups.flatMap(group=>splitQuery(group.query,group.separate||[]).map(query=>({group,query})));
    const parts=await runExtraction(jobs,async({group,query})=>{
      const payload=await request(table.url,{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify(query)});
      if(version!==dataVersion)return;
      return {series:detailedSeries(payload,query,group,table),notes:(payload.columns||[]).filter(column=>column.comment).map(column=>column.text+': '+column.comment)};
    },{isCurrent:()=>version===dataVersion,onRateLimit:()=>status('Väntar på statistikdatabasen. Hämtningen fortsätter automatiskt …')});
    if(!parts||version!==dataVersion)return;
    for(const part of parts){
      for(const note of part.notes)allNotes.add(note);
      for(const item of part.series)series.push(item);
    }
    let availableMonths;
    if(table.measure?.monthly){
      const query=monthlyAvailabilityQuery(table.metadata,Number($('start').value),Number($('end').value));
      const payload=await request(table.url,{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify(query)});
      if(version!==dataVersion)return;
      availableMonths=populatedMonths(payload);
    }
    alignPeriods(series);
    if(table.measure?.forecast)allNotes.add('Prognos: beräknad framtida folkmängd, inte observerad statistik.');
    result={series,groups,populatedMonths:availableMonths,rows:series[0].rows,area,table,measure,unit,detail:series.length>7?series.length+' serier. Se urval på varje rad.':series.map(s=>s.name+': '+s.detail).join(' | '),notes:[...allNotes].join(' '),date:new Date().toLocaleDateString('sv-SE')};status('');render();
  }catch(error){console.error(error);if(version===dataVersion)status(networkMessage(error));}
  finally{if(version===dataVersion){$('fetch-button').disabled=false;$('fetch-button').textContent='Visa statistiken →';}}
});
$('csv').addEventListener('click',()=>download(resultCSV(result),'text/csv;charset=utf-8',filename('csv')));
$('xlsx').addEventListener('click',async()=>{
  const snapshot=result,name=filename('xlsx'),button=$('xlsx');button.disabled=true;
  try{download(await resultExcel(snapshot),'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',name);}
  catch(error){console.error(error);status('Excel-filen kunde inte skapas. Försök igen eller välj CSV.');}
  finally{button.disabled=false;}
});
$('svg').addEventListener('click',()=>download(result.svg,'image/svg+xml;charset=utf-8',filename('svg')));
$('png').addEventListener('click',async()=>{
  const button=$('png');button.disabled=true;
  const snapshot=result, name=filename('png'),url=URL.createObjectURL(new Blob([snapshot.svg],{type:'image/svg+xml'}));
  try{const image=new Image();image.src=url;await image.decode();const canvas=document.createElement('canvas');canvas.width=2000;canvas.height=Math.round(2000*image.height/image.width);canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('PNG kunde inte skapas. Prova att ladda ner SVG.');download(blob,'image/png',name);}catch(error){status(error.message);}finally{URL.revokeObjectURL(url);button.disabled=false;}
});
$('level-filter').addEventListener('change',()=>{$('catalog-section').classList.add('is-active');shown=3;cards();});
$('theme-filter').addEventListener('change',()=>{$('catalog-section').classList.add('is-active');shown=3;cards();});
$('ready-filter').addEventListener('change',()=>{$('catalog-section').classList.add('is-active');shown=3;cards();});
$('show-more').addEventListener('click',()=>{const next=$('catalog').querySelector('.catalog-row[inert] .level-choice');shown+=3;updateCatalogPreview();next?.focus({preventScroll:true});});
try{
  catalog=await request('./data/search-catalog.json');searchResults=browseTables(catalog);
  for(const theme of catalogThemes(catalog))$('theme-filter').add(new Option(theme,theme));
  cards();tableSuggestions.refresh();
}catch(error){status('Tabellkatalogen kunde inte laddas. Starta appen via den lokala webbadressen och försök igen.');$('search-button').disabled=true;}

