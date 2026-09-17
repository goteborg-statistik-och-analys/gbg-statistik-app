import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {groupDimensions,totalValues,planGroups} from '../src/group-selection.js';
import {aggregate} from '../src/core.js';
const catalog=JSON.parse(await readFile(new URL('../data/search-catalog.json',import.meta.url),'utf8'));
const checks=JSON.parse(await readFile(new URL('../data/count-table-checks.json',import.meta.url),'utf8'));
test('Every enabled employment and housing count table has a verified source extract and usable defaults',()=>{
  const expanded=catalog.filter(t=>t.kind==='count'&&['Arbetsmarknad','Bostäder och byggande'].includes(t.subject));
  assert.ok(expanded.length>0);
  for(const table of expanded){
    const check=checks.find(check=>check.id===table.id&&check.ok);
    assert.ok(check,table.title);assert.ok(table.measure.unit.startsWith('Antal '));
    assert.deepEqual(aggregate(check.payload,check.query,table.measure),check.rows);
    const selections=Object.fromEntries(groupDimensions(table.metadata).map(v=>[v.code,totalValues(v)]));
    const area=table.metadata.variables.find(v=>v.code==='Område')?.values[0];
    const year=Number(table.metadata.variables.find(v=>v.code==='År').values.at(-1));
    assert.equal(planGroups(table,area,year,year,[{name:'Totalt',selections}]).length,1);
  }
  assert.ok(expanded.some(t=>t.measure.unit==='Antal bostäder'));
  assert.ok(expanded.some(t=>t.measure.unit==='Antal arbetsställen'));
  assert.ok(catalog.filter(t=>/^Ohälsotal/.test(t.title)).every(t=>!t.kind));
});
