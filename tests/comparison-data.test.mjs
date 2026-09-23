import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {comparisonValue,completeSum,decodeScbDataset} from '../src/comparison-data.js';

function fixture(){
  return {years:[2025],data:{'1480':{all:{population:[1000],growth:[-5],meanAge:[40.2],byAge:[Array(101).fill(11)]},men:{population:[480],growth:[-3],meanAge:[39.1],byAge:[Array(101).fill(5)]},women:{population:[519],growth:[-2],meanAge:[41.1],byAge:[Array(101).fill(6)]},dependencyRatio:[62.7]}}};
}
test('Total population, all-age shares, mean age and growth use published values despite CKM non-additivity',()=>{
  const snapshot=fixture();
  const get=options=>comparisonValue(snapshot,{region:'1480',year:2025,...options});
  assert.equal(get({}).value,1000);
  assert.equal(get({measure:'agePopulation'}).value,1000);
  assert.equal(get({measure:'ageShare'}).value,100);
  assert.equal(get({measure:'ageShare',fromAge:0,toAge:9}).value,11);
  assert.equal(get({measure:'ageShare',sex:'men',fromAge:0,toAge:9}).denominator,480);
  assert.equal(get({measure:'meanAge'}).value,40.2);
  assert.equal(get({measure:'growth'}).value,-5);
  assert.equal(get({measure:'dependencyRatio'}).value,62.7);
  assert.throws(()=>get({measure:'dependencyRatio',sex:'women'}));
});
test('Age shares preserve missingness and zero; invalid selections do not silently select a partial series',()=>{
  const snapshot=fixture(),options={region:'1480',year:2025,measure:'ageShare',fromAge:0,toAge:4};
  snapshot.data['1480'].all.byAge[0][0]=null;
  assert.equal(comparisonValue(snapshot,options).value,null);
  snapshot.data['1480'].all.byAge[0].fill(0);
  assert.equal(comparisonValue(snapshot,options).value,0);
  snapshot.data['1480'].all.population[0]=0;
  assert.equal(comparisonValue(snapshot,options).value,null);
  assert.throws(()=>comparisonValue(snapshot,{...options,fromAge:-1}));
  assert.throws(()=>comparisonValue(snapshot,{...options,toAge:101}));
  assert.throws(()=>comparisonValue(snapshot,{...options,year:1999}));
  assert.equal(completeSum([0,2]),2);
  assert.equal(completeSum([null,2]),null);
});
test('JSON-stat decoding follows source dimension and category order, with explicit coverage checks',()=>{
  const dataset={class:'dataset',id:['Tid','Region'],size:[2,2],dimension:{Tid:{category:{index:{2025:0,2024:1}}},Region:{category:{index:{'1480':1,'0180':0}}}},value:[10,20,30,40]};
  const selection={Region:['1480','0180'],Tid:['2024','2025']};
  const rows=decodeScbDataset(dataset,selection);
  assert.deepEqual(rows.map(r=>[r.key.Region,r.key.Tid,r.value]),[['0180','2025',10],['1480','2025',20],['0180','2024',30],['1480','2024',40]]);
  assert.throws(()=>decodeScbDataset(dataset,{...selection,Region:['1480']}));
  assert.throws(()=>decodeScbDataset({...dataset,value:[1]},selection));
  const sparse=decodeScbDataset({...dataset,value:{0:0,3:8}},selection);
  assert.deepEqual(sparse.map(r=>r.value),[0,null,null,8]);
  assert.throws(()=>decodeScbDataset({...dataset,value:{0:'..'}},selection));
});

test('Saved snapshot and audit match the manifest and preserve published totals for real CKM data',async()=>{
  const root=new URL('../data/goteborg-jamforelse/',import.meta.url);
  const manifest=JSON.parse(await readFile(new URL('metadata.json',root),'utf8'));
  const raw=await readFile(new URL(manifest.file,root)),auditRaw=await readFile(new URL(manifest.auditFile,root));
  assert.equal(createHash('sha256').update(raw).digest('hex'),manifest.sha256);
  assert.equal(createHash('sha256').update(auditRaw).digest('hex'),manifest.auditSha256);
  const snapshot=JSON.parse(raw),audit=JSON.parse(auditRaw);
  assert.deepEqual(snapshot.years,Array.from({length:26},(_,i)=>2000+i));
  assert.equal(Object.keys(snapshot.data).length,38);
  assert.equal(audit.validation.missingValues,0);
  assert.equal(audit.validation.historicalChecks,3800);
  const goteborg=comparisonValue(snapshot,{region:'1480',year:2025});
  assert.equal(goteborg.value,613278); // Kontrollerat direkt mot SCB:s total, 2026-09-23.
  const row=audit.validation.ckmDifferences.find(row=>row.check==='ages-minus-total'&&row.difference!==0);
  assert.ok(row);
  const series=snapshot.data[row.region][row.sex],index=snapshot.years.indexOf(row.year);
  assert.notEqual(completeSum(series.byAge[index]),series.population[index]);
  assert.equal(comparisonValue(snapshot,{region:row.region,sex:row.sex,year:row.year}).value,series.population[index]);
  assert.equal(comparisonValue(snapshot,{region:row.region,sex:row.sex,year:row.year,measure:'ageShare'}).value,100);
});
