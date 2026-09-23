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
  for(const code of selection.ContentsCode)assert.equal(dataset.dimension.ContentsCode.category.unit[code].base,(id==='meanAge'?'medelvärde':id==='dependency'?'antal':'antal personer'));
  assert.ok(rows.every(row=>Number.isFinite(row.value)),'Saknat eller ogiltigt värde');
  audit.push({url:sources[id],query,omittedDimensions:omitted,fetchedAt:new Date().toISOString(),response:dataset});
  return rows;
}
const metadata={};
for(const id of ['history','current','meanAge','dependency'])metadata[id]=await request(sources[id]);
const years=snapshot.years,old=years.filter(y=>y<2025).map(String),ages=[...Array.from({length:100},(_,i)=>String(i)),'100+'];
const population=await extract('history',metadata.history,{Region:['00'],Alder:[...ages,'tot'],ContentsCode:['BE0101N1'],Tid:old},['Civilstand','Kon']);
const growth=await extract('history',metadata.history,{Region:['00'],Alder:['tot'],ContentsCode:['BE0101N2'],Tid:old},['Civilstand','Kon']);
const baseline=await extract('history',metadata.history,{Region:['00'],Alder:['tot'],ContentsCode:['BE0101N1'],Tid:['1999']},['Civilstand','Kon']);
console.log('Rikets historik hämtad');
const current=await extract('current',metadata.current,{Region:['00'],Civilstand:['SC'],Alder:[...ages.map(a=>a==='100+'?'100+1':a),'TotSA'],Kon:['TotSa'],ContentsCode:['000007ME'],Tid:['2025']});
const currentGrowth=await extract('current',metadata.current,{Region:['00'],Civilstand:['SC'],Alder:['TotSA'],Kon:['TotSa'],ContentsCode:['000007MG'],Tid:['2025']});
const mean=await extract('meanAge',metadata.meanAge,{Region:['00'],Kon:['1+2'],ContentsCode:['BE0101G9'],Tid:years.map(String)});
const dependency=await extract('dependency',metadata.dependency,{Region:['00'],ContentsCode:['00000708'],Tid:years.map(String)});
const historical=new Map(population.map(r=>[`${r.key.Tid}/${r.key.Alder}`,r.value])),latest=new Map(current.map(r=>[r.key.Alder,r.value]));
const series=rows=>years.map(y=>rows.find(r=>r.key.Tid===String(y))?.value??null);
const all={population:years.map(y=>y===2025?latest.get('TotSA'):historical.get(`${y}/tot`)),byAge:years.map(y=>ages.map(a=>y===2025?latest.get(a==='100+'?'100+1':a):historical.get(`${y}/${a}`))),growth:series([...growth,...currentGrowth]),meanAge:series(mean)};
const contextManifest=JSON.parse(await readFile(`${root}/context-metadata.json`,'utf8'));
const context=JSON.parse(await readFile(`${root}/${contextManifest.file}`,'utf8'));
assert.deepEqual(all.population,context.country.population,'Rikets totaler måste matcha det tidigare underlaget.');
for(let i=0;i<25;i++)assert.equal(all.byAge[i].reduce((a,b)=>a+b,0),all.population[i]);
const result={schemaVersion:1,builtAt:new Date().toISOString(),years,baseline1999:baseline[0].value,data:{'00':{all,dependencyRatio:series(dependency)}},ckmDifference2025:all.byAge.at(-1).reduce((a,b)=>a+b,0)-all.population.at(-1)};
assert.ok([...all.population,...all.growth,...all.meanAge,...all.byAge.flat(),...result.data['00'].dependencyRatio].every(Number.isFinite));
const json=JSON.stringify(result),auditJson=JSON.stringify(audit),file=`national-${hash(json).slice(0,12)}.json`,auditFile=`national-sources-${hash(auditJson).slice(0,12)}.json`;
await writeFile(`${root}/${file}`,json);await writeFile(`${root}/${auditFile}`,auditJson);
await writeFile(`${root}/national-metadata.next`,JSON.stringify({file,sha256:hash(json),auditFile,auditSha256:hash(auditJson),populationSnapshotSha256:manifest.sha256,contextSha256:contextManifest.sha256},null,2)+'\n');
await rename(`${root}/national-metadata.next`,`${root}/national-metadata.json`);
console.log(`Rikets referens validerad och sparad: ${file}`);
