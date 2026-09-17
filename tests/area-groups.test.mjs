import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planGroups} from '../src/group-selection.js';
import {aggregate,makeQuery} from '../src/core.js';
import {resultCSV,resultExcel} from '../src/exports.js';
const table={kind:'population',title:'Folkmängd',metadata:{variables:[{code:'Område',values:['101 A','102 B','Göteborg']},{code:'Kön',values:['Man','Kvinna']},{code:'År',values:['2024','2025']}]}};
const group=areas=>({name:'',selections:{Område:areas,Kön:['Man','Kvinna']}});
const payload={columns:[{code:'Område',type:'d'},{code:'Kön',type:'d'},{code:'År',type:'t'},{code:'Antal',type:'c'}],data:['2024','2025'].flatMap(year=>['101 A','102 B'].flatMap((area,i)=>['Man','Kvinna'].map((sex,j)=>({key:[area,sex,year],values:[String((i+1)*10+j)]}))))};
test('Area comparisons and sums retain exact source selections and require complete data',()=>{
  const plans=planGroups(table,'101 A',2024,2025,[group(['101 A']),group(['102 B'])]);
  assert.deepEqual(plans.map(p=>p.name),['A','B']);
  const series=plans.map(plan=>aggregate({...payload,data:payload.data.filter(row=>plan.query.query[0].selection.values.includes(row.key[0]))},plan.query));
  assert.equal(series[0][0].value,21);assert.equal(series[1][0].value,41);
  const [sum]=planGroups(table,'101 A',2024,2025,[group(['101 A','102 B'])]);
  assert.equal(sum.area,'A + B');assert.equal(aggregate(payload,sum.query)[0].value,62);
  const missing=structuredClone(payload);missing.data.shift();assert.equal(aggregate(missing,sum.query)[0].value,null);
  assert.throws(()=>makeQuery(table.metadata,['Göteborg','101 A'],2024,2025),/inte båda/);
  for(const areas of [[],['101 A','101 A'],['does not exist']])assert.throws(()=>planGroups(table,'101 A',2024,2025,[group(areas)]),/områden/);
});
test('CSV and Excel identify the geography of each individual series',async()=>{
  const result={area:'valda områden',table,measure:'Folkmängd',date:'2026-09-14',detail:'Två områden',notes:'',series:[{name:'A',area:'A',detail:'Område: A',rows:[{year:2025,value:21}]},{name:'B',area:'B',detail:'Område: B',rows:[{year:2025,value:41}]}]};result.rows=result.series[0].rows;
  const csv=resultCSV(result);assert.ok(csv.includes('"2025";"A";"21"'));assert.ok(csv.includes('"2025";"B";"41"'));
  const XLSX=await import('../vendor/xlsx.mjs');const workbook=XLSX.read(await resultExcel(result),{type:'array'});
  assert.equal(workbook.Sheets.Statistik.B10.v,'A');assert.equal(workbook.Sheets.Statistik.B11.v,'B');
});
