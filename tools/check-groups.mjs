// Optional live integration check: three small extracts, no files modified.
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {planGroups,groupDimensions,totalValues,ageRangeValues} from '../group-selection.js';
import {aggregate} from '../core.js';
const catalog=JSON.parse(await readFile(new URL('../data/search-catalog.json',import.meta.url),'utf8'));
const population=catalog.find(t=>t.kind==='population'&&t.level==='Primärområde');
const education=catalog.find(t=>t.kind==='education'&&t.level==='Kommun');
for(const [table,range] of [[population,[1,5]],[population,[6,15]],[education,[20,64]]]){
  const response=await fetch(table.url,{signal:AbortSignal.timeout(25000)});assert.ok(response.ok);
  const metadata=await response.json();
  const selections=Object.fromEntries(groupDimensions(metadata).map(v=>[v.code,totalValues(v)]));
  selections['Ålder']=ageRangeValues(metadata.variables.find(v=>v.code==='Ålder'),...range);
  const [plan]=planGroups({...table,metadata},table.kind==='population'?'103 Majorna':'',2024,2025,[{name:range.join('–')+' år',selections}]);
  const dataResponse=await fetch(table.url,{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify(plan.query),signal:AbortSignal.timeout(25000)});assert.ok(dataResponse.ok);
  const rows=aggregate(await dataResponse.json(),plan.query);assert.equal(rows.length,2);assert.ok(rows.every(row=>row.value>0));
  console.log(JSON.stringify({table:table.title,group:plan.name,rows}));
}
