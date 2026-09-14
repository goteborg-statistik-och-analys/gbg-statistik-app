import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resultCSV,resultExcel,sourceName} from '../exports.js';
import {read,utils} from '../vendor/xlsx.mjs';

const result={rows:[{year:2023,value:123456},{year:2024,value:null},{year:2025,value:0}],area:'Majorna',date:'2026-09-11',measure:'Folkmängd',detail:'Alla åldrar · Båda könen',notes:'Uppgifter saknas för ett år.',table:{title:'Folkmängd 1984–2025',url:'https://example.org/api/secret-path'}};
test('CSV export uses a source name without the API address and preserves missing versus zero',()=>{
  const text=resultCSV(result);
  assert.ok(text.startsWith('\uFEFF'));
  assert.ok(text.includes(sourceName));
  assert.ok(!text.includes(result.table.url));
  assert.ok(!text.includes('https://'));
  assert.ok(text.includes('"2024";"Majorna";""'));
  assert.ok(text.includes('"2025";"Majorna";"0"'));
  assert.ok(text.includes(result.notes));
});
test('Excel export round-trips numbers, missing cells, source, date and selection',async()=>{
  const bytes=await resultExcel(result);
  assert.deepEqual([...new Uint8Array(bytes).slice(0,2)],[80,75]);
  const workbook=read(bytes,{type:'array',cellDates:true,cellNF:true});
  assert.deepEqual(workbook.SheetNames,['Statistik']);
  const sheet=workbook.Sheets.Statistik;
  assert.equal(sheet.A10.t,'n');assert.equal(sheet.A10.v,2023);
  assert.equal(sheet.C10.t,'n');assert.equal(sheet.C10.v,123456);
  assert.equal(sheet.C10.z,'#,##0');
  assert.equal(sheet.C11,undefined);assert.equal(sheet.C12.v,0);
  assert.equal(sheet.B2.v,sourceName);assert.equal(sheet.B4.v,result.detail);
  assert.equal(sheet.B5.t,'d');assert.equal(sheet.B5.v.toISOString().slice(0,10),result.date);
  assert.equal(sheet['!autofilter'].ref,'A9:D12');
  assert.ok(!JSON.stringify(utils.sheet_to_json(sheet,{header:1})).includes(result.table.url));
});
