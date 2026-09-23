import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {comparisonAges,comparisonSexes,completeSum,decodeScbDataset} from '../src/comparison-data.js';

const output='data/goteborg-jamforelse',staging='tmp/comparison-build';
await mkdir(staging,{recursive:true});
const municipalities=JSON.parse(await readFile(`${output}/municipalities.json`,'utf8'));
const regions=municipalities.areas.map(area=>area.code);
assert.equal(new Set(regions).size,38,'Kommunurvalet har ändrats och behöver granskas.');
const years=Array.from({length:26},(_,i)=>2000+i),historyYears=years.filter(y=>y<2025).map(String);
const base='https://api.scb.se/OV0104/v1/doris/sv/ssd/BE/BE0101/';
const sources={
  history:{url:base+'BE0101A/BefolkningNy',population:'BE0101N1',growth:'BE0101N2'},
  current:{url:base+'BE0101A/BefolkningCKM',population:'000007ME',growth:'000007MG'},
  meanAge:{url:base+'BE0101B/BefolkningMedelAlder',measure:'BE0101G9'},
  dependency:{url:base+'BE0101A/FkvotHVD',measure:'00000708'}
};
const hash=value=>createHash('sha256').update(value).digest('hex');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let lastRequest=0;
async function request(url,query){
  for(let attempt=0;attempt<4;attempt++){
    await sleep(Math.max(0,lastRequest+1300-Date.now()));lastRequest=Date.now();
    try{
      const response=await fetch(url,{signal:AbortSignal.timeout(60000),...(query?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(query)}:{})});
      if(response.status===429||response.status>=500){console.log(`SCB HTTP ${response.status}, nytt försök ${attempt+1}/4`);await sleep(10000);continue;}
      if(!response.ok)throw Error(`HTTP ${response.status}: ${await response.text()}`);
      return await response.json();
    }catch(error){
      if(!(error instanceof TypeError)&&error.name!=='TimeoutError')throw error;
      if(attempt===3)throw error;
      console.log(`Anslutningen bröts, nytt försök ${attempt+1}/4`);await sleep(3000*(attempt+1));
    }
  }
  throw Error('SCB svarar inte. Ingen ny version publicerades.');
}
for(const [id,source] of Object.entries(sources)){
  source.metadata=await request(source.url);
  for(const area of municipalities.areas){
    const v=source.metadata.variables.find(v=>v.code==='Region');
    assert.equal(v?.valueTexts[v.values.indexOf(area.code)],area.name,`Kommunen saknas eller har ändrats: ${id}/${area.code}`);
  }
}
function checkLabel(id,code,value,label){
  const variable=sources[id].metadata.variables.find(v=>v.code===code);
  assert.equal(variable?.valueTexts[variable.values.indexOf(value)],label,`${id}/${code}/${value}`);
}
for(const [id,source] of Object.entries(sources)){
  if(source.population)checkLabel(id,'ContentsCode',source.population,'Folkmängd');
  if(source.growth)checkLabel(id,'ContentsCode',source.growth,'Folkökning');
}
checkLabel('meanAge','ContentsCode',sources.meanAge.measure,'Medelålder');
checkLabel('dependency','ContentsCode',sources.dependency.measure,'Försörjningskvot totalt');
for(const age of comparisonAges){
  const historical=sources.history.metadata.variables.find(v=>v.code==='Alder');
  checkLabel('current','Alder',age==='100+'?'100+1':age,historical.valueTexts[historical.values.indexOf(age)]);
}
checkLabel('history','Alder','tot','totalt ålder');
checkLabel('current','Alder','TotSA','totalt, samtliga åldrar');
checkLabel('current','Civilstand','SC','totalt, samtliga civilstånd');
checkLabel('current','Kon','TotSa','totalt, samtliga män och kvinnor');
for(const id of ['history','current','meanAge']){checkLabel(id,'Kon','1','män');checkLabel(id,'Kon','2','kvinnor');}
checkLabel('meanAge','Kon','1+2','totalt');

const provenance=[],sourceVersions=new Map();
async function extract(id,selection,omitted=[]){
  const source=sources[id];
  for(const variable of source.metadata.variables){
    const values=selection[variable.code];
    if(!values){assert.ok(omitted.includes(variable.code)&&variable.elimination===true,`Oavsiktligt utelämnad dimension: ${id}/${variable.code}`);continue;}
    assert.ok(values.length&&new Set(values).size===values.length,`Tomt eller dubblerat urval ${variable.code}`);
    for(const value of values)assert.ok(variable.values.includes(value),`Saknad kod ${id}/${variable.code}/${value}`);
  }
  for(const code of Object.keys(selection))assert.ok(source.metadata.variables.some(v=>v.code===code));
  const query={query:Object.entries(selection).map(([code,values])=>({code,selection:{filter:'item',values}})),response:{format:'json-stat2'}};
  const cacheKey=hash(JSON.stringify({url:source.url,query}));
  let record;
  if(process.argv.includes('--reuse-downloads')){
    try{record=JSON.parse(await readFile(`${staging}/${cacheKey}.json`,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
  }
  if(!record){record={fetchedAt:new Date().toISOString(),dataset:await request(source.url,query)};await writeFile(`${staging}/${cacheKey}.json`,JSON.stringify(record));}
  const dataset=record.dataset,rows=decodeScbDataset(dataset,selection);
  assert.equal(dataset.source,'SCB');
  assert.ok(dataset.updated,`${id}: uppdateringsdatum saknas`);
  if(sourceVersions.has(id))assert.equal(dataset.updated,sourceVersions.get(id),`${id}: källan uppdaterades under uttaget. Kör om hela uttaget.`);
  sourceVersions.set(id,dataset.updated);
  for(const measure of selection.ContentsCode){
    const expectedUnit=id==='meanAge'?'medelvärde':id==='dependency'?'antal':'antal personer';
    assert.equal(dataset.dimension.ContentsCode.category.unit?.[measure]?.base,expectedUnit,`${id}: måttets enhet har ändrats`);
    if(measure!==source.growth)assert.equal(dataset.dimension.ContentsCode.extension?.refperiod?.[measure],'31 december respektive år',`${id}: referenstid har ändrats`);
  }
  const missing=rows.filter(row=>row.value===null).length;
  if(missing)throw Error(`${id}: ${missing} saknade värden. Ingen ny version publicerades.`);
  const {value,status,...description}=dataset;
  provenance.push({source:id,url:source.url,query,omittedDimensions:omitted,
    fetchedAt:record.fetchedAt,responseSha256:hash(JSON.stringify(dataset)),cells:rows.length,missing,description});
  console.log(`${id}: ${rows.length} värden, ${selection.Tid[0]}–${selection.Tid.at(-1)}, ${selection.Region.length} kommuner`);
  return rows;
}
const empty=()=>Array(years.length).fill(null);
const data=Object.fromEntries(regions.map(region=>[region,{...Object.fromEntries(comparisonSexes.map(sex=>[sex,{population:empty(),growth:empty(),meanAge:empty(),byAge:years.map(()=>Array(comparisonAges.length).fill(null))}])),dependencyRatio:empty()}]));
const seen=new Set();
function store(region,sex,year,measure,value,age){
  const yi=years.indexOf(Number(year));assert.ok(yi>=0);
  const key=[region,sex,year,measure,age??''].join('|');assert.ok(!seen.has(key),`Dubblett ${key}`);seen.add(key);
  assert.ok(Number.isFinite(value));
  if(['population','growth','byAge'].includes(measure))assert.ok(Number.isInteger(value));
  if(measure!=='growth')assert.ok(value>=0);
  if(measure==='meanAge')assert.ok(value<=120);
  if(measure==='dependencyRatio'){data[region].dependencyRatio[yi]=value;return;}
  if(measure==='byAge'){const ai=comparisonAges.indexOf(age);assert.ok(ai>=0);data[region][sex].byAge[yi][ai]=value;}
  else data[region][sex][measure][yi]=value;
}
function consumePopulation(rows,forcedSex){
  for(const {key,value} of rows){
    const sex=forcedSex??({'1':'men','2':'women',TotSa:'all'}[key.Kon]);assert.ok(sex);
    const age=key.Alder==='100+1'?'100+':key.Alder;
    store(key.Region,sex,key.Tid,['tot','TotSA'].includes(age)?'population':'byAge',value,age);
  }
}
// Civilstånd och (för båda könen) kön utelämnas endast när SCB anger elimination=true.
// API:et levererar då källans total, utan en egen summering av åldersceller.
for(let offset=0;offset<regions.length;offset+=8){
  const Region=regions.slice(offset,offset+8);
  const selection={Region,Alder:[...comparisonAges,'tot'],ContentsCode:[sources.history.population],Tid:historyYears};
  consumePopulation(await extract('history',{...selection,Kon:['1','2']},['Civilstand']));
  consumePopulation(await extract('history',selection,['Civilstand','Kon']),'all');
}
consumePopulation(await extract('current',{Region:regions,Civilstand:['SC'],Alder:[...comparisonAges.map(age=>age==='100+'?'100+1':age),'TotSA'],Kon:['TotSa','1','2'],ContentsCode:[sources.current.population],Tid:['2025']}));

for(const [id,Tid] of [['history',historyYears],['current',['2025']]]){
  const selection={Region:regions,Alder:[id==='history'?'tot':'TotSA'],ContentsCode:[sources[id].growth],Tid};
  const variants=id==='history'?[{Kon:['1','2'],omitted:['Civilstand']},{omitted:['Civilstand','Kon'],forcedSex:'all'}]:[{Kon:['TotSa','1','2'],Civilstand:['SC'],omitted:[]}];
  for(const {omitted,forcedSex,...dimensions} of variants){
    for(const {key,value} of await extract(id,{...selection,...dimensions},omitted))store(key.Region,forcedSex??({'1':'men','2':'women',TotSa:'all'}[key.Kon]),key.Tid,'growth',value);
  }
}
for(const {key,value} of await extract('meanAge',{Region:regions,Kon:['1+2','1','2'],ContentsCode:[sources.meanAge.measure],Tid:years.map(String)}))store(key.Region,({'1':'men','2':'women','1+2':'all'}[key.Kon]),key.Tid,'meanAge',value);
for(const {key,value} of await extract('dependency',{Region:regions,ContentsCode:[sources.dependency.measure],Tid:years.map(String)}))store(key.Region,'all',key.Tid,'dependencyRatio',value);

const ckmDifferences=[],growthDifferences=[];
let historicalChecks=0;
for(const region of regions){
  for(const [yi,year] of years.entries()){
    assert.ok(Number.isFinite(data[region].dependencyRatio[yi]));
    for(const sex of comparisonSexes){
      const series=data[region][sex];
      for(const measure of ['population','growth','meanAge'])assert.ok(Number.isFinite(series[measure][yi]));
      const sum=completeSum(series.byAge[yi]);assert.notEqual(sum,null);
      const difference=sum-series.population[yi];
      if(year<2025){assert.equal(difference,0,`Historisk ålderssumma: ${region}/${sex}/${year}`);historicalChecks++;}
      else ckmDifferences.push({region,year,sex,check:'ages-minus-total',difference});
      if(yi>0){const difference=series.population[yi]-series.population[yi-1]-series.growth[yi];if(difference!==0)growthDifferences.push({region,year,sex,difference});}
    }
    const sexDifference=data[region].men.population[yi]+data[region].women.population[yi]-data[region].all.population[yi];
    if(year<2025){assert.equal(sexDifference,0,`Historisk könssumma: ${region}/${year}`);historicalChecks++;}
    else ckmDifferences.push({region,year,check:'sexes-minus-total',difference:sexDifference});
  }
}
const notes=[
  'Total folkmängd hämtas från SCB:s totalvärden. Åldersandelar använder dessa som nämnare för samma kommun, kön och år.',
  'Egna åldersintervall summeras från ettårsåldrar. Från 2025 summeras då även CKM-osäkerhet. Andelar normaliseras inte till 100 procent.',
  '100+ är en öppen ålderskategori. Medelålder hämtas från SCB:s separata tabell, inte från ettårsåldrarna.',
  'Försörjningskvot totalt: personer 0–19 år och 65+ per 100 personer 20–64 år. Måttet avser ålder, inte faktisk sysselsättning.',
  'Folkökning hämtas som eget mått. Historikens definition ändras 2010 beträffande regional indelning. Den kan därför avvika från differensen mellan publicerade årstotaler.',
  'Uppsala: Knivsta bildades 2003-01-01. Uppgifterna följer källans regionala indelning, inte en konstant kommungeografi.',
  'CKM infördes 2025. Tabellerna saknar överlappande år. Valideringen styrker kod- och definitionstäckning men är inte en jämförelse av samma års värden.'
];
const validation={historicalChecks,missingValues:0,uniqueStoredValues:seen.size,ckmDifferences,growthDifferences,
  maximumAbsoluteCkmDifference:Math.max(...ckmDifferences.map(row=>Math.abs(row.difference))),
  checks:['Alla 38 kommuner och samtliga år 2000–2025','Unika nycklar och exakta svarskategorier','101 ålderskategorier, totalt samt män, kvinnor och båda könen','Historiska ålders- och könssummor mot SCB:s totaler','Medelålder och försörjningskvot från separata källtabeller'],
  limitations:notes.slice(-3)};
const snapshot={schemaVersion:1,builtAt:new Date().toISOString(),years,ages:comparisonAges,sexes:comparisonSexes,municipalities,notes,
  measures:{population:{label:'Folkmängd',unit:'personer'},growth:{label:'Folkökning',unit:'personer'},meanAge:{label:'Medelålder',unit:'år'},dependencyRatio:{label:'Demografisk försörjningskvot',unit:'personer per 100 personer 20–64 år'}},data};
const payload=JSON.stringify(snapshot),digest=hash(payload).slice(0,12),file=`population-${digest}.json`;
const audit=JSON.stringify({schemaVersion:1,sources,provenance,validation},null,2),auditFile=`sources-${hash(audit).slice(0,12)}.json`;
await mkdir(output,{recursive:true});
await writeFile(`${output}/${file}`,payload+'\n');
await writeFile(`${output}/${auditFile}`,audit+'\n');
const manifest={schemaVersion:1,builtAt:snapshot.builtAt,startYear:2000,endYear:2025,municipalityCount:regions.length,
  file,auditFile,sha256:hash(payload+'\n'),auditSha256:hash(audit+'\n'),bytes:Buffer.byteLength(payload+'\n'),
  sources:Object.fromEntries(Object.entries(sources).map(([id,s])=>[id,s.url])),validation:{historicalChecks,missingValues:0,maximumAbsoluteCkmDifference:validation.maximumAbsoluteCkmDifference},
  notes};
await writeFile(`${output}/metadata.next.json`,JSON.stringify(manifest,null,2)+'\n');
await rename(`${output}/metadata.next.json`,`${output}/metadata.json`);
console.log(JSON.stringify({file,bytes:manifest.bytes,historicalChecks,ckmMaximum:validation.maximumAbsoluteCkmDifference,growthDifferences:growthDifferences.length,goteborg2025:{population:data['1480'].all.population.at(-1),growth:data['1480'].all.growth.at(-1),meanAge:data['1480'].all.meanAge.at(-1),dependencyRatio:data['1480'].dependencyRatio.at(-1)}},null,2));
