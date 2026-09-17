import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {reviewedCountMeasure} from '../src/table-measures.js';
import {aggregate,areaOf,timeOf} from '../src/core.js';
import {planGroups,groupDimensions,totalValues} from '../src/group-selection.js';
const catalog=JSON.parse(await readFile('data/search-catalog.json','utf8'));
const audit=JSON.parse(await readFile('data/education-audit.json','utf8'));
const education=catalog.filter(t=>t.subject==='Utbildning');
for(const table of education){
  const entry=audit.find(e=>e.id===table.id&&e.url===table.url);
  assert.ok(entry?.metadata?.variables&&entry.payload?.data,'Verifierat uttag saknas: '+table.title);
  const candidate={...table,metadata:entry.metadata};
  const measure=reviewedCountMeasure(candidate);
  assert.ok(measure,'Okänt utbildningsmått');
  assert.equal(entry.sourceUnit,measure.unit,'Källans enhet stämmer inte');
  assert.equal(entry.payload.columns.filter(c=>c.type==='c').length,1);
  assert.equal(entry.payload.data.length,1);
  const rows=aggregate(entry.payload,entry.query,measure);
  assert.equal(rows.length,1);assert.ok(Number.isInteger(rows[0].value)&&rows[0].value>=0);
  candidate.kind=table.kind||'count';candidate.measure=measure;
  candidate.sourceNotes=entry.sourceNotes;
  const selections=Object.fromEntries(groupDimensions(candidate.metadata).map(v=>[v.code,totalValues(v)]));
  const area=areaOf(candidate.metadata)?.values[0],year=Number(timeOf(candidate.metadata).values.at(-1));
  planGroups(candidate,area,year,year,[{name:'Totalt',selections}]);
  Object.assign(table,candidate);
}
await writeFile('data/search-catalog.json',JSON.stringify(catalog,null,2));
console.log(`${education.length} utbildningstabeller aktiverade; ${catalog.filter(t=>t.kind).length} tabeller kan visas i appen.`);
