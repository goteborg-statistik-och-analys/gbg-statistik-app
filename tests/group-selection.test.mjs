import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {ageRangeValues,totalValues,planGroups,groupDimensions} from '../src/group-selection.js';
import {aggregate} from '../src/core.js';
import {resultCSV,resultExcel} from '../src/exports.js';
import {seriesChart} from '../src/series-chart.js';
const catalog=JSON.parse(await readFile(new URL('../data/search-catalog.json',import.meta.url),'utf8'));
const table=catalog.find(t=>t.kind==='population'&&t.level==='Primärområde');
const payload=JSON.parse(await readFile(new URL('../data/verified-majorna.json',import.meta.url),'utf8'));
const age=table.metadata.variables.find(v=>v.code==='Ålder');
const defaults=()=>Object.fromEntries(groupDimensions(table.metadata).map(v=>[v.code,totalValues(v)]));
function extract(query){
  const dimensions=payload.columns.filter(c=>c.type!=='c');
  return {...payload,data:payload.data.filter(row=>dimensions.every((v,i)=>query.query.find(q=>q.code===v.code).selection.values.includes(row.key[i])))};
}
test('Custom age groups 1–5 and 6–15 reproduce independent sums from real API observations',()=>{
  const groups=[[1,5],[6,15]].map(([from,to])=>({name:`${from}–${to} år`,selections:{...defaults(),'Ålder':ageRangeValues(age,from,to)}}));
  const plans=planGroups(table,'103 Majorna',2010,2025,groups);
  for(const plan of plans){
    const data=extract(plan.query),rows=aggregate(data,plan.query);
    for(const row of rows){
      const expected=payload.data.filter(r=>r.key[3]===String(row.year)&&plan.selections['Ålder'].includes(r.key[1])).reduce((sum,r)=>sum+Number(r.values[0]),0);
      assert.equal(row.value,expected);
    }
    assert.equal(rows.length,16);
  }
  assert.notDeepEqual(aggregate(extract(plans[0].query),plans[0].query),aggregate(extract(plans[1].query),plans[1].query));
});
test('20–64 sum, total and missing observations remain distinct',()=>{
  const [plan]=planGroups(table,'103 Majorna',2010,2025,[{name:'20–64 år',selections:{...defaults(),'Ålder':ageRangeValues(age,20,64)}}]);
  assert.equal(plan.selections['Ålder'].length,45);
  const data=extract(plan.query);assert.ok(aggregate(data,plan.query).every(r=>r.value>0));
  const missing=structuredClone(data);missing.data.shift();assert.equal(aggregate(missing,plan.query)[0].value,null);
  assert.equal(totalValues(age).length,101);
});

test('Men and women form two series whose sum equals total population',()=>{
  const sex=table.metadata.variables.find(v=>v.code==='Kön');
  const plans=planGroups(table,'103 Majorna',2010,2025,sex.values.map(value=>({name:value,selections:{...defaults(),Kön:[value]}})));
  const series=plans.map(plan=>aggregate(extract(plan.query),plan.query));
  const [total]=planGroups(table,'103 Majorna',2010,2025,[{name:'Totalt',selections:defaults()}]);
  const rows=aggregate(payload,total.query);
  rows.forEach((row,i)=>assert.equal(series[0][i].value+series[1][i].value,row.value));
  assert.notDeepEqual(series[0],series[1]);
});
test('Education categories can be summed using source codes; partial five-year bins are rejected',()=>{
  const education=catalog.find(t=>t.kind==='education'&&t.title.includes('5-årsklasser'));
  const selections=Object.fromEntries(groupDimensions(education.metadata).map(v=>[v.code,totalValues(v)]));
  const age=education.metadata.variables.find(v=>v.code==='Ålder');
  selections['Ålder']=ageRangeValues(age,20,64);selections['Utbildningsnivå']=['Förgymnasial','Gymnasial'];
  const [plan]=planGroups(education,education.metadata.variables.find(v=>v.code==='Område').values[0],2025,2025,[{name:'Valda nivåer',selections}]);
  assert.equal(plan.query.query.find(v=>v.code==='Utbildningsnivå').selection.values.length,2);
  assert.throws(()=>ageRangeValues(age,21,64),/indelning/);
  assert.throws(()=>ageRangeValues(age,64,20),/giltigt/);
});
test('Totals never double-count their components and non-additive measures cannot be summed',()=>{
  const sex={code:'Kön',values:['Män','Kvinnor','Båda kön']};assert.deepEqual(totalValues(sex),['Båda kön']);
  const fake={kind:'population',metadata:{variables:[{code:'År',values:['2025']},sex]}};
  assert.throws(()=>planGroups(fake,'',2025,2025,[{name:'Fel',selections:{Kön:sex.values}}]),/totalen/);
  const overlapping={code:'Ålder',values:['0-4 år','5-9 år','0-9 år']};assert.deepEqual(totalValues(overlapping),['0-9 år']);
  fake.metadata.variables[1]=overlapping;
  assert.throws(()=>planGroups(fake,'',2025,2025,[{name:'Fel',selections:{'Ålder':overlapping.values}}]),/överlappar/);
  assert.throws(()=>planGroups({...table,kind:'income'},'103 Majorna',2025,2025,[{name:'Median',selections:defaults()}]),/kan inte summeras/);
});
test('Multi-series CSV, Excel and SVG preserve every group and missing values',async()=>{
  const result={area:'Majorna',table,measure:'Folkmängd',date:'2026-09-14',notes:'Källnot',detail:'Två grupper',series:[{name:'1–5 år',detail:'Ålder: 1–5 år',rows:[{year:2024,value:12},{year:2025,value:null}]},{name:'6–15 år',detail:'Ålder: 6–15 år',rows:[{year:2024,value:20},{year:2025,value:0}]}]};
  result.rows=result.series[0].rows;
  const csv=resultCSV(result);assert.ok(csv.includes('"Grupp"'));assert.ok(csv.includes('"1–5 år"'));assert.ok(csv.includes('"6–15 år"'));assert.ok(csv.includes('"2025";"Majorna";""'));assert.ok(csv.includes('"2025";"Majorna";"0"'));
  const XLSX=await import('../vendor/xlsx.mjs');const workbook=XLSX.read(await resultExcel(result),{type:'array'}),sheet=workbook.Sheets.Statistik;
  assert.equal(sheet.E10.v,'1–5 år');assert.equal(sheet.E12.v,'6–15 år');assert.equal(sheet.C13.v,0);assert.equal(sheet['!autofilter'].ref,'A9:F13');
  const svg=seriesChart(result);assert.ok(svg.includes('stroke-dasharray="9 4"'));assert.ok(svg.includes('1–5 år'));assert.ok(svg.includes('6–15 år'));assert.ok(!svg.includes('NaN'));
});
