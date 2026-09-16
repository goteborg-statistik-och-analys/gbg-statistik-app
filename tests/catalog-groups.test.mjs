import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {groupTables,tableSummary} from '../catalog-groups.js';
const catalog=JSON.parse(await readFile(new URL('../data/search-catalog.json',import.meta.url),'utf8'));
test('Housing tables group all geographic levels despite category capitalization',()=>{
  const tables=catalog.filter(t=>t.title==='Bostadsbestånd efter hustyp och byggnadsår, exklusive specialbostäder, 2014-2025');
  assert.equal(tables.length,5);
  const groups=groupTables(tables);
  assert.equal(groups.length,1);
  assert.deepEqual(groups[0].tables.map(t=>t.level),['Kommun','Stadsområde','Mellanområde','Primärområde','Basområde']);
  assert.equal(groupTables([tables[0],{...tables[1],variables:tables[1].variables.replace('2014-2025','2015-2025')}]).length,2);
});
test('Supported tables group population levels and keep distinct education definitions',()=>{
  const groups=groupTables(catalog.filter(t=>['population','education'].includes(t.kind)));
  assert.equal(groups.length,4);
  assert.deepEqual(groups[0].tables.map(t=>t.level),['Kommun','Mellanområde','Primärområde']);
  assert.ok(groups.slice(1).every(g=>g.tables.length===1));
  assert.deepEqual(tableSummary(groups[0]),{title:'Folkmängd',detail:'1984–2025 · Ålder, Kön · (SCB)'});
});
test('Grouping retains every table and respects filters and distinct category definitions',()=>{
  const groups=groupTables(catalog);
  assert.deepEqual(groups.flatMap(g=>g.tables.map(t=>t.id)).sort(),catalog.map(t=>t.id).sort());
  assert.ok(groups.every(g=>new Set(g.tables.map(t=>t.level)).size===g.tables.length));
  const local=groupTables(catalog.filter(t=>t.level==='Primärområde'));
  assert.ok(local.every(g=>g.tables.every(t=>t.level==='Primärområde')));
  const table=catalog.find(t=>t.kind==='population');
  assert.equal(groupTables([table,{...table,level:'Primärområde',variables:'Ålder: [15-19 år]'}]).length,2);
  assert.equal(tableSummary({...table,title:'Tabell utan årtal'}).title,'Tabell utan årtal');
});
