import {createSnapshotLoader, selectForecastGroups, ageLabel, forecastMeasures, forecastMeasureSeries} from './forecast-data.js';
import {forecastChart, fitForecastChart} from './forecast-chart.js';
import {escapeXML as esc} from './core.js';
import {forecastExportRows,forecastCSV,forecastExcel} from './forecast-exports.js';
const $=id=>document.getElementById('forecast-'+id);
const load=createSnapshotLoader();
const fmt=value=>value===null?'Uppgift saknas':new Intl.NumberFormat('sv-SE',{maximumFractionDigits:measureMode==='percent'?2:0}).format(value);
let data,series=[],svg='',version=0;
let disposeChart=()=>{};
let measureMode='population';
const selections={kommun:['1480'],stadsomraden:[],mellanomraden:[]};
let custom={from:0,to:100,top:true};
function status(message){$('status').textContent=message;}
function visibleAreas(){return data.areas.filter(area=>data.level!=='mellanomraden'||!$('parent').value||area.parent===$('parent').value);}
function renderAreas(){
  const available=visibleAreas(),selected=selections[data.level];
  $('areas').innerHTML=available.map(area=>`<label><input type="checkbox" value="${esc(area.code)}" ${selected.includes(area.code)?'checked':''}>${esc(area.name)}</label>`).join('');
  $('all').disabled=available.length*Math.max(1,ranges().length)>7;
  $('all').title=$('all').disabled?'Urvalet skulle ge fler än sju linjer. Välj områden var för sig.':'';
  updateAreaCount();
}
function updateAreaCount(){
  const selected=selections[data.level];
  const groups=Math.max(1,ranges().length);
  $('area-count').textContent=`${selected.length} områden valda · ${selected.length*ranges().length} av högst 7 linjer`;
  for(const input of $('areas').querySelectorAll('input'))input.disabled=!input.checked&&(selected.length+1)*groups>7;
}
function configureAges(){
  const previousFrom=custom.from,previousTo=custom.top?data.maxAge:Math.min(custom.to,data.maxAge);
  for(const id of ['from','to'])$(''+id).innerHTML=Array.from({length:data.maxAge+1},(_,age)=>`<option value="${age}">${age===data.maxAge?age+' år och äldre':age+' år'}</option>`).join('');
  $('from').value=Math.min(previousFrom,data.maxAge);$('to').value=previousTo;
}
function ranges(){
  return [...$('age').querySelectorAll('input:checked')].map(input=>{
    const chosen=input.value;
    if(chosen==='all')return [0,data.maxAge];
    if(chosen==='custom')return [Number($('from').value),Number($('to').value)];
    const [from,to]=chosen.split(':');return [Number(from),to==='top'?data.maxAge:Number(to)];
  });
}
function render(){
  disposeChart();
  closeExports();
  $('custom-age').hidden=!$('age').querySelector('input[value="custom"]').checked;
  const chosenRanges=ranges(),measure=forecastMeasures[measureMode];
  for(const button of $('measure').querySelectorAll('button'))button.setAttribute('aria-pressed',String(button.dataset.measure===measureMode));
  $('measure-note').textContent=measure.note;$('measure-note').hidden=!measure.note;
  let errorMessage='';
  try{series=forecastMeasureSeries(selectForecastGroups(data,selections[data.level],chosenRanges),measureMode);}catch(error){series=[];errorMessage=error.message;}
  for(const id of ['csv','xlsx','png','svg','print','expand','export-toggle'])$(id).disabled=!series.length;
  for(const element of document.querySelectorAll('.forecast-table,.forecast-method,.forecast-key'))element.hidden=!series.length;
  if(!series.length){
    svg='';$('result').hidden=false;$('title').textContent='Folkmängd och befolkningsprognos';$('subtitle').textContent='';$('age-heading').hidden=true;$('source').textContent='';$('comparability').textContent='';
    $('chart').innerHTML='<p class="forecast-empty">'+esc(errorMessage||(!selections[data.level].length?'Välj områden ovan för att visa diagrammet.':'Välj minst en åldersgrupp ovan för att visa diagrammet.'))+'</p>';
    $('table-body').replaceChildren();status('');return;
  }
  status('');$('result').hidden=false;
  const age=chosenRanges.map(([from,to])=>ageLabel(from,to,data.maxAge)).join(', '),title=measure.title;
  const subtitle=`${data.label==='Kommun'?'Göteborg':data.label+'n'} · ${data.years[0]}–${data.years.at(-1)}`;
  const date=data.fetchedAt.slice(0,10);
  const source=`Källa: Göteborgs Stads statistikdatabas · ${data.forecastTitle} · Hämtad ${date}`;
  $('title').textContent=title;$('age-heading').textContent='Ålder: '+age;$('age-heading').hidden=false;$('subtitle').textContent=subtitle;
  const exportSource=source+(data.level==='kommun'?'':' · Historisk gränsjämförbarhet är inte fullt verifierad.');
  svg=forecastChart(series,{title,subtitle,age,unit:measure.unit,forecastStart:data.forecastStart,source:exportSource});
  const chartOptions={title,subtitle,age,unit:measure.unit,forecastStart:data.forecastStart,source,includeHeading:false};
  $('chart').innerHTML=forecastChart(series,chartOptions);disposeChart=fitForecastChart($('chart'),series,chartOptions);
  $('source').textContent=source;
  $('comparability').textContent=data.level==='kommun'?'': 'Historiken visas enligt källtabellens områdesindelning. Jämförbarheten i områdesgränser över hela perioden är inte fullt verifierad.';
  $('notes').innerHTML='<ul>'+data.notes.map(note=>`<li>${esc(note)}</li>`).join('')+'</ul><p>'+data.sources.map(s=>`<a href="${esc(s.webUrl)}" target="_blank" rel="noopener">${s.type==='history'?'Historik':'Prognos'}: ${esc(s.title)} ↗</a>`).join('<br>')+'</p>';
  $('table-caption').textContent=`${title} · Ålder: ${age} · ${subtitle} · ${measure.unit}`;
  $('table-head').innerHTML='<tr><th scope="col">År</th><th scope="col">Typ</th>'+series.map(s=>`<th class="number" scope="col">${esc(s.name)}</th>`).join('')+'</tr>';
  $('table-body').innerHTML=data.years.map((year,index)=>`<tr><th scope="row">${year}</th><td>${series[0].rows[index].type}</td>${series.map(s=>`<td class="number">${fmt(s.rows[index].value)}</td>`).join('')}</tr>`).join('');
}
async function changeLevel(){
  const current=++version,level=$('level').value;
  $('controls').disabled=true;$('result').hidden=true;$('retry').hidden=true;status('Laddar underlaget …');
  try{
    const next=await load(level);if(current!==version)return;data=next;
    $('edition').textContent=`${data.forecastTitle} · Utfall till ${data.historyEnd} · Underlag hämtat ${data.fetchedAt.slice(0,10)}`;
    $('area-field').hidden=level==='kommun';$('parent-field').hidden=level!=='mellanomraden';
    for(const control of $('controls').querySelectorAll('select,input,button'))control.disabled=false;
    configureAges();renderAreas();$('controls').disabled=false;render();
  }catch(error){if(current!==version)return;data=undefined;status(error.message+' Försök igen eller välj en annan nivå.');$('controls').disabled=false;for(const control of $('controls').querySelectorAll('select,input,button'))control.disabled=control!==$('level');$('retry').hidden=false;}
}
$('measure').addEventListener('click',event=>{const mode=event.target.closest('button')?.dataset.measure;if(!mode||!data||mode===measureMode)return;measureMode=mode;render();});
$('level').addEventListener('change',changeLevel);$('retry').addEventListener('click',changeLevel);
$('age').addEventListener('change',event=>{
  if(!data)return;
  const input=event.target,all=$('age').querySelector('input[value="all"]');
  if(input.checked&&input===all)for(const other of $('age').querySelectorAll('input')){if(other!==all)other.checked=false;}
  else if(input.checked)all.checked=false;
  if(ranges().length*Math.max(1,selections[data.level].length)>7){input.checked=false;status('Välj högst sju linjer totalt (områden × åldersgrupper).');return;}
  renderAreas();render();
});
for(const name of ['from','to'])$(name).addEventListener('change',()=>{custom={from:Number($('from').value),to:Number($('to').value),top:Number($('to').value)===data.maxAge};render();});
$('parent').addEventListener('change',()=>{if(!data||data.level!=='mellanomraden')return;selections[data.level]=selections[data.level].filter(code=>visibleAreas().some(area=>area.code===code));renderAreas();render();});
$('areas').addEventListener('change',event=>{if(!event.target.matches('input'))return;const code=event.target.value,chosen=selections[data.level];if(event.target.checked&&(chosen.length+1)*Math.max(1,ranges().length)>7){event.target.checked=false;status('Välj högst sju linjer totalt (områden × åldersgrupper).');return;}selections[data.level]=event.target.checked?[...chosen,code]:chosen.filter(value=>value!==code);updateAreaCount();render();});
$('all').addEventListener('click',()=>{const areas=visibleAreas();if(areas.length*Math.max(1,ranges().length)>7)return;selections[data.level]=areas.map(area=>area.code);renderAreas();render();});
$('clear').addEventListener('click',()=>{selections[data.level]=[];renderAreas();render();});
function download(body,type,extension,level=data.level){const url=URL.createObjectURL(new Blob([body],{type}));const a=document.createElement('a');a.href=url;a.download=`befolkningsprognos-${level}.${extension}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('svg').addEventListener('click',()=>download(svg,'image/svg+xml;charset=utf-8','svg'));
function exportRows(){
  return forecastExportRows({data,series,unit:forecastMeasures[measureMode].unit,calculation:forecastMeasures[measureMode].note,title:$('title').textContent,age:$('age-heading').textContent,subtitle:$('subtitle').textContent,source:$('source').textContent,comparability:$('comparability').textContent});
}
$('csv').addEventListener('click',()=>{
  const rows=exportRows();
  download(forecastCSV(rows),'text/csv;charset=utf-8','csv');
});
$('xlsx').addEventListener('click',async()=>{
  const rows=exportRows(),level=data.level;
  try{download(await forecastExcel(rows),'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','xlsx',level);}
  catch{status('Excel-filen kunde inte skapas. Försök igen.');}
});
$('png').addEventListener('click',async()=>{
  const level=data.level,imageURL=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
  try{const image=new Image();image.src=imageURL;await image.decode();const canvas=document.createElement('canvas');canvas.width=2000;canvas.height=Math.round(2000*image.height/image.width);canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error();download(blob,'image/png','png',level);}
  catch{status('PNG-filen kunde inte skapas. Försök igen.');}finally{URL.revokeObjectURL(imageURL);}
});
let visualPlaceholder;
function closeExports(){
  $('export-options').hidden=true;$('export-toggle').setAttribute('aria-expanded','false');
}
$('export-toggle').addEventListener('click',()=>{const open=$('export-options').hidden;$('export-options').hidden=!open;$('export-toggle').setAttribute('aria-expanded',String(open));});
$('export-options').addEventListener('click',event=>{if(event.target.closest('button'))closeExports();});
document.addEventListener('click',event=>{if(!event.target.closest('.forecast-export'))closeExports();});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('export-options').hidden){event.preventDefault();closeExports();$('export-toggle').focus();}});
$('expand').addEventListener('click',()=>{closeExports();visualPlaceholder=document.createComment('forecast-visual');$('visual').before(visualPlaceholder);$('dialog-content').append($('visual'));$('expand').hidden=true;$('dialog').showModal();document.documentElement.classList.add('forecast-expanded');});
$('close').addEventListener('click',()=>$('dialog').close());
$('dialog').addEventListener('close',()=>{visualPlaceholder.replaceWith($('visual'));$('expand').hidden=false;document.documentElement.classList.remove('forecast-expanded');$('expand').focus({preventScroll:true});});
$('dialog').addEventListener('click',event=>{if(event.target!==$('dialog'))return;const box=$('dialog').getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)$('dialog').close();});
$('print').addEventListener('click',()=>{if($('dialog').open)$('dialog').close();window.print();});
await changeLevel();
// These small local files are loaded once. Filter interactions never call the API.
if(data){const warm=()=>Promise.allSettled(['stadsomraden','mellanomraden'].map(level=>load(level)));if('requestIdleCallback' in window)window.requestIdleCallback(warm);else setTimeout(warm,300);}
