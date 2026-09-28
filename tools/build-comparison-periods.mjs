import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {decodeScbDataset} from '../src/comparison-data.js';

// Only three extra baseline totals for the latest-year map/rankings, not full histories.
const root='data/goteborg-jamforelse';
const read=async file=>JSON.parse(await readFile(`${root}/${file}`,'utf8'));
const manifest=await read('metadata.json'),contextManifest=await read('context-metadata.json');
const snapshot=await read(manifest.file),context=await read(contextManifest.file);
const selection={Region:context.ranking.map(r=>r.code),Alder:['tot'],ContentsCode:['BE0101N1'],Tid:['2015','2020','2022']};
const query={query:Object.entries(selection).map(([code,values])=>({code,selection:{filter:'item',values}})),response:{format:'json-stat2'}};
const response=await fetch(manifest.sources.history,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(query),signal:AbortSignal.timeout(60000)});
assert.ok(response.ok,`SCB HTTP ${response.status}`);
const dataset=await response.json(),rows=decodeScbDataset(dataset,selection);
assert.equal(dataset.source,'SCB');
assert.equal(dataset.dimension.ContentsCode.category.unit.BE0101N1.base,'antal personer');
assert.equal(rows.length,870);
const baselines={};
for(const {key,value} of rows){
  assert.ok(Number.isInteger(value)&&value>0);
  (baselines[key.Region]??={})[key.Tid]=value;
  if(snapshot.data[key.Region])assert.equal(value,snapshot.data[key.Region].all.population[snapshot.years.indexOf(+key.Tid)],`${key.Region}/${key.Tid}: changed source`);
}
const builtAt=new Date().toISOString();
const data={builtAt,contextSha256:contextManifest.sha256,baselines};
const audit={url:manifest.sources.history,query,omittedDimensions:['Civilstand','Kon'],fetchedAt:builtAt,response:dataset};
const save=async(name,value)=>{const json=JSON.stringify(value),sha256=createHash('sha256').update(json).digest('hex'),file=`${name}-${sha256.slice(0,12)}.json`;await writeFile(`${root}/${file}`,json);return {file,sha256};};
const saved=await save('periods',data),source=await save('periods-sources',audit);
await writeFile(`${root}/periods-metadata.json`,JSON.stringify({...saved,auditFile:source.file,auditSha256:source.sha256,contextSha256:contextManifest.sha256},null,2)+'\n');
console.log('Validated 870 published baseline totals; all 38 shared municipalities match existing history.');
