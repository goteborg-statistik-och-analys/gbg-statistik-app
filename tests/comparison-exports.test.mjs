import {test} from 'node:test';
import assert from 'node:assert/strict';
import {comparisonExportRows,comparisonCSV,comparisonExcel,comparisonExportSVG} from '../src/comparison-exports.js';
import {ageGroups} from '../src/comparison-indicators.js';
const model={title:'Åldersstruktur',subtitle:'2025',unit:'Procent',age:true,labels:ageGroups.map(g=>g[0]),series:[{name:'Göteborg',slot:0,values:ageGroups.map((_,i)=>i===2?null:i/10)}],notes:['CKM från 2025. Andelar summerar inte alltid till 100 procent.']};
test('Comparison exports preserve five-year labels, missing values, numeric precision and method notes',async()=>{
  const rows=comparisonExportRows(model);assert.deepEqual(rows[5],['Ålder','Göteborg']);assert.deepEqual(rows[8],['10–14 år',null]);
  assert.match(comparisonCSV(rows),/CKM från 2025/);assert.ok(comparisonCSV(rows).includes('"10–14 år";""'));
  const XLSX=await import('../vendor/xlsx.mjs');const book=XLSX.read(await comparisonExcel(model),{type:'array'});
  const parsed=XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]],{header:1,defval:null});
  assert.equal(parsed[7][1],0.1);assert.equal(parsed[8][1],null);assert.equal(parsed.at(-1)[0],'100+ år');
  const svg=comparisonExportSVG(model);assert.match(svg,/Åldersstruktur/);assert.match(svg,/Göteborg/);assert.match(svg,/100\+/);assert.match(svg,/Källa: SCB/);assert.match(svg,/CKM från 2025/);assert.ok(!/NaN|clip-path|year-guide/.test(svg));
});
