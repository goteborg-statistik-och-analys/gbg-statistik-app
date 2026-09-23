import {readFile,writeFile,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {decodeScbDataset} from '../src/comparison-data.js';

// National denominators, previous-year baselines and the independent national ranking.
const root='data/goteborg-jamforelse';
const manifest=JSON.parse(await readFile(`${root}/metadata.json`,'utf8'));
const snapshot=JSON.parse(await readFile(`${root}/${manifest.file}`,'utf8'));
const sources=manifest.sources,audit=[],versions=new Map();
const hash=value=>createHash('sha256').update(value).digest('hex');
async function request(url,query){
  for(let i=0;i<4;i++){
    await new Promise(resolve=>setTimeout(resolve,1500));
    const response=await fetch(url,{signal:AbortSignal.timeout(60000),...(query?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(query)}:{})});
    if(response.status===429||response.status>=500){await new Promise(resolve=>setTimeout(resolve,10000));continue;}
    if(!response.ok)throw Error(`SCB HTTP ${response.status}`);
    return response.json();
  }
  throw Error('SCB svarar inte.');
}
const history=await request(sources.history),current=await request(sources.current);
const regions=current.variables.find(v=>v.code==='Region');
const municipalities=regions.values.filter(code=>/^\d{4}$/.test(code));
assert.equal(municipalities.length,290);
async function extract(id,metadata,selection,omitted=[]){
  for(const variable of metadata.variables){
    const values=selection[variable.code];
    if(!values){assert.ok(omitted.includes(variable.code)&&variable.elimination===true);continue;}
    assert.ok(values.every(value=>variable.values.includes(value)),`Saknade koder: ${variable.code}`);
  }
  const query={query:Object.entries(selection).map(([code,values])=>({code,selection:{filter:'item',values}})),response:{format:'json-stat2'}};
  const dataset=await request(sources[id],query),rows=decodeScbDataset(dataset,selection);
  assert.equal(dataset.source,'SCB');
  if(versions.has(id))assert.equal(dataset.updated,versions.get(id),'Källan ändrades under uttaget. Kör om.');
  assert.ok(dataset.updated);versions.set(id,dataset.updated);
  for(const code of selection.ContentsCode)assert.equal(dataset.dimension.ContentsCode.category.unit[code].base,'antal personer');
  assert.ok(rows.every(row=>Number.isInteger(row.value)),'Saknat eller ogiltigt värde');
  audit.push({url:sources[id],query,omittedDimensions:omitted,fetchedAt:new Date().toISOString(),response:dataset});
  return rows;
}
const years=Array.from({length:25},(_,i)=>String(2000+i));
// Only the national total needs a full time series outside the 38 selected municipalities.
const countryHistory=await extract('history',history,{Region:['00'],Alder:['tot'],ContentsCode:['BE0101N1'],Tid:years},['Civilstand','Kon']);
const baselines=await extract('history',history,{Region:snapshot.municipalities.areas.map(area=>area.code),Alder:['tot'],ContentsCode:['BE0101N1'],Tid:['1999']},['Civilstand','Kon']);
// All other municipalities need just the previous year's denominator and latest growth.
const rankingPrevious=await extract('history',history,{Region:municipalities,Alder:['tot'],ContentsCode:['BE0101N1'],Tid:['2024']},['Civilstand','Kon']);
console.log('Riket 2000–2024, basår 1999 för 38 kommuner och rankningsbas 2024 hämtade');
const latest=await extract('current',current,{Region:municipalities,Civilstand:['SC'],Alder:['TotSA'],Kon:['TotSa'],ContentsCode:['000007ME','000007MG'],Tid:['2025']});
const countryLatest=await extract('current',current,{Region:['00'],Civilstand:['SC'],Alder:['TotSA'],Kon:['TotSa'],ContentsCode:['000007ME'],Tid:['2025']});
const past=new Map([...countryHistory,...baselines,...rankingPrevious].map(row=>[`${row.key.Region}/${row.key.Tid}`,row.value]));
const now=new Map(latest.map(row=>[`${row.key.Region}/${row.key.ContentsCode}`,row.value]));
const context={schemaVersion:1,builtAt:new Date().toISOString(),populationSnapshotSha256:manifest.sha256,year:2025,previousYear:2024,
  country:{years:[...years.map(Number),2025],population:[...years.map(year=>past.get(`00/${year}`)),countryLatest[0].value]},
  baseline1999:Object.fromEntries(snapshot.municipalities.areas.map(area=>[area.code,past.get(`${area.code}/1999`)])),
  ranking:municipalities.map(code=>({code,name:regions.valueTexts[regions.values.indexOf(code)],populationPrevious:past.get(`${code}/2024`),population:now.get(`${code}/000007ME`),growth:now.get(`${code}/000007MG`)}))};
for(const area of snapshot.municipalities.areas){
  const values=snapshot.data[area.code].all,rank=context.ranking.find(row=>row.code===area.code);
  assert.equal(values.population[snapshot.years.indexOf(2024)],rank.populationPrevious,`${area.name}/2024: källan har ändrats`);
  assert.equal(values.population.at(-1),rank.population);
  assert.equal(values.growth.at(-1),rank.growth);
}
assert.ok(context.country.population.every(value=>value>0));
assert.ok(context.ranking.every(row=>row.populationPrevious>0&&row.population>0));
const json=JSON.stringify(context),auditJson=JSON.stringify(audit),file=`context-${hash(json).slice(0,12)}.json`,auditFile=`context-sources-${hash(auditJson).slice(0,12)}.json`;
await writeFile(`${root}/${file}`,json);await writeFile(`${root}/${auditFile}`,auditJson);
await writeFile(`${root}/context-metadata.next`,JSON.stringify({file,sha256:hash(json),auditFile,auditSha256:hash(auditJson),populationSnapshotSha256:manifest.sha256},null,2)+'\n');
await rename(`${root}/context-metadata.next`,`${root}/context-metadata.json`);
console.log(`Validerat: 290 kommuner endast 2024–2025, riket 2000–2025, samtliga gemensamma populationstal matchar. ${file}`);
