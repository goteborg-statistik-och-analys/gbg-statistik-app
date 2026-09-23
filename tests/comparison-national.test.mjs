import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {withNationalReference,indicator,ageGroups} from '../src/comparison-indicators.js';
import {comparisonValue} from '../src/comparison-data.js';
import {comparisonExportRows,comparisonExportSVG} from '../src/comparison-exports.js';
const root=new URL('../data/goteborg-jamforelse/',import.meta.url),json=async name=>JSON.parse(await readFile(new URL(name,root),'utf8'));
test('National reference only appears in comparable measures and does not mutate municipality selections',()=>{
  const selected=Array.from({length:4},(_,slot)=>({code:String(slot),name:'Kommun '+slot,slot}));
  for(const panel of ['ages','dependencyRatio','growth']){
    const result=withNationalReference(selected,{enabled:true,panel});assert.equal(result.length,5);assert.equal(result.at(-1).name,'Riket');assert.equal(selected.length,4);
  }
  for(const panel of ['population','nationalShare'])assert.equal(withNationalReference(selected,{enabled:true,panel}).length,4);
  assert.equal(withNationalReference(selected,{enabled:true,panel:'growth',growthMeasure:'growth'}).length,4);
  assert.equal(withNationalReference(selected,{enabled:false,panel:'ages'}).length,4);
});
test('National data is complete, versioned and uses official totals; its export includes the reference',async()=>{
  const manifest=await json('national-metadata.json'),contextManifest=await json('context-metadata.json'),populationManifest=await json('metadata.json');
  assert.equal(manifest.populationSnapshotSha256,populationManifest.sha256);assert.equal(manifest.contextSha256,contextManifest.sha256);
  for(const [file,sha] of [[manifest.file,manifest.sha256],[manifest.auditFile,manifest.auditSha256]])assert.equal(createHash('sha256').update(await readFile(new URL(file,root))).digest('hex'),sha);
  const national=await json(manifest.file),context=await json(contextManifest.file),audit=await json(manifest.auditFile);
  for(const extract of audit)assert.deepEqual(extract.query.query.find(q=>q.code==='Region').selection.values,['00']);
  assert.deepEqual(national.data['00'].all.population,context.country.population);
  context.baseline1999['00']=national.baseline1999;
  const all=national.data['00'].all;
  for(const key of ['population','growth','meanAge']){assert.equal(all[key].length,26);assert.ok(all[key].every(Number.isFinite));}
  assert.equal(national.data['00'].dependencyRatio.length,26);
  assert.equal(indicator(national,context,'00',2000,'growthRate'),100*all.growth[0]/national.baseline1999);
  const groups=ageGroups.map(([,fromAge,toAge])=>comparisonValue(national,{region:'00',year:2025,measure:'ageShare',fromAge,toAge}).value);
  assert.equal(groups[0],100*all.byAge.at(-1).slice(0,5).reduce((a,b)=>a+b,0)/all.population.at(-1));
  const model={title:'Åldersstruktur',subtitle:'2025',age:true,labels:ageGroups.map(g=>g[0]),series:[{name:'Riket',slot:4,values:groups}],unit:'Procent',notes:['SCB, publicerade totaler.']};
  assert.ok(comparisonExportRows(model).some(row=>row.includes('Riket')));const svg=comparisonExportSVG(model);assert.match(svg,/Riket/);assert.match(svg,/stroke-dasharray="16 6"/);assert.ok(!svg.includes('undefined'));
});
