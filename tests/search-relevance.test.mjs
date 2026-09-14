import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {findTables} from '../search.js';
import {searchSelection} from '../search-selection.js';
const catalog=JSON.parse(await readFile(new URL('../data/search-catalog.json',import.meta.url),'utf8'));
const cases=[
  ['Hur många kvinnor 20–64 år bor i Majorna 2020–2025?',/^Folkmängd 1984/],
  ['barn i förskoleålder',/^Folkmängd 1984/],
  ['medianinkomst i Majorna',/^Förvärvsinkomst/],
  ['arbetslöshet bland unga',/Arbetssökande|arbetslösa/],
  ['personbilar',/^Personbilar/],
  ['befolkningsprognos',/prognos/],
  ['utbilding',/^Högsta utbildningsnivå/],
  ['födda i utlandet',/födda i Sverige eller utlandet|födelseland/],
  ['nybyggda bostäder',/Nybygg|Färdigställda/]
];
for(const [query,title] of cases)test(`Search relevance: ${query}`,()=>assert.match(findTables(query,catalog).tables[0]?.title||'',title));
test('Age, sex, year and area are parsed separately and prefilled using source codes',()=>{
  const found=findTables(cases[0][0],catalog);
  assert.deepEqual(found.years,[2020,2025]);assert.deepEqual(found.intent.age,[20,64]);assert.deepEqual(found.intent.areas,['majorna']);
  const table=found.tables[0];assert.equal(table.level,'Primärområde');
  const preset=searchSelection(table.metadata,found.intent);
  assert.equal(preset.selections['Ålder'].length,45);assert.deepEqual(preset.selections['Kön'],['Kvinna']);assert.deepEqual(preset.selections['Område'],['103 Majorna']);assert.deepEqual(preset.warnings,[]);
});
test('Unsupported intervals are explained; several groups are not silently combined',()=>{
  const table=catalog.find(t=>t.title.includes('5-årsklasser'));
  const preset=searchSelection(table.metadata,{age:[21,64]});assert.ok(preset.warnings.length);assert.equal(preset.selections['Ålder'],undefined);
  const found=findTables('Jämför 1–5 år och 6–15 år i Majorna och Stigberget',catalog);
  assert.equal(found.intent.age,null);assert.equal(found.intent.areas.length,2);assert.ok(found.notes.length>=2);
  assert.equal(searchSelection(table.metadata,found.intent).selections['Område'],undefined);
});
test('Unknown topics, distinct measures and geographic constraints stay meaningful',()=>{
  assert.deepEqual(findTables('Kan man visa folkmängden?',catalog).intent.sexes,[]);
  assert.deepEqual(findTables('Hur många män bor i Göteborg?',catalog).intent.sexes,['male']);
  assert.equal(findTables('zqxzy',catalog).tables.length,0);
  assert.equal(findTables('lön',catalog).tables.length,0);assert.ok(findTables('lön',catalog).notes.length);
  assert.ok(findTables('folkmängd primärområde',catalog).tables.every(t=>t.level==='Primärområde'));
  assert.ok(findTables('folkmängd i Majorna',catalog).tables.every(t=>t.level==='Primärområde'));
});
