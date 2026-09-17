import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planGroups,categoryValues} from '../group-selection.js';
import {splitQuery,detailedSeries,resultGrid} from '../detailed-results.js';
import {resultCSV,resultExcel} from '../exports.js';
import {seriesChart} from '../series-chart.js';
const table={kind:'population',title:'Folkmängd',level:'Primärområde',metadata:{variables:[{code:'Område',values:['A','B']},{code:'Ålder',values:['0 år','1 år','2 år']},{code:'Kön',values:['Man','Kvinna']},{code:'År',values:['2024','2025']}]}};
const [group]=planGroups(table,'A',2024,2025,[{name:'',separate:['Område','Ålder'],selections:{Område:['A','B'],'Ålder':['0 år','1 år','2 år'],Kön:['Man','Kvinna']}}]);
const payload={columns:[{code:'Område',type:'d'},{code:'Ålder',type:'d'},{code:'Kön',type:'d'},{code:'År',type:'t'},{code:'Antal',type:'c'}],data:['A','B'].flatMap((a,i)=>['0 år','1 år','2 år'].flatMap((age,j)=>['Man','Kvinna'].flatMap((sex,k)=>['2024','2025'].map(year=>({key:[a,age,sex,year],values:[String(100*i+10*j+k)]})))))};
const filter=query=>({...payload,data:payload.data.filter(row=>query.query.every((v,i)=>v.selection.values.includes(row.key[i])))});

test('Large extraction packs into nine bounded requests without duplicate or omitted ages',()=>{
  const query={query:[['Område',97],['Ålder',101],['Kön',2],['År',42]].map(([code,count])=>({code,selection:{filter:'item',values:Array.from({length:count},(_,i)=>String(i))}})),response:{format:'json'}};
  const chunks=splitQuery(query,['Område','Ålder']);
  const sizes=chunks.map(q=>q.query.reduce((n,v)=>n*v.selection.values.length,1));
  assert.equal(chunks.length,9);assert.ok(sizes.every(n=>n<=100000));assert.equal(sizes.reduce((a,b)=>a+b),822948);
  assert.deepEqual(chunks.flatMap(q=>q.query.find(v=>v.code==='Ålder').selection.values),query.query[1].selection.values);
  for(const chunk of chunks)for(const i of [0,2,3])assert.deepEqual(chunk.query[i],query.query[i]);
});
test('Separate areas and ages form all combinations while sexes are summed; chunking loses no series',()=>{
  const chunks=splitQuery(group.query,group.separate,8);
  assert.ok(chunks.length>1);assert.ok(chunks.every(q=>q.query.reduce((n,v)=>n*v.selection.values.length,1)<=8));
  const series=chunks.flatMap(query=>detailedSeries(filter(query),query,group,table));
  assert.equal(series.length,6);assert.equal(new Set(series.map(s=>s.name)).size,6);
  const b2=series.find(s=>s.area==='B'&&s.dimensions['Ålder']==='2 år');assert.equal(b2.rows[0].value,241);
  const complete=detailedSeries(payload,group.query,group,table);assert.deepEqual(series.sort((a,b)=>a.name.localeCompare(b.name)),complete.sort((a,b)=>a.name.localeCompare(b.name)));
  const missing=structuredClone(payload);missing.data=missing.data.filter(row=>!(row.key[0]==='B'&&row.key[1]==='2 år'));
  const absent=detailedSeries(missing,group.query,group,table).find(s=>s.area==='B'&&s.dimensions['Ålder']==='2 år');assert.ok(absent.rows.every(row=>row.value===null));
});
test('Detailed exports contain every area-age-year value as distinct spreadsheet columns',async()=>{
  const result={series:detailedSeries(payload,group.query,group,table),area:'valda områden',table,measure:'Folkmängd',unit:'Antal personer',date:'2026-09-14',detail:'Alla områden och åldrar',notes:''};result.rows=result.series[0].rows;
  const grid=resultGrid(result);assert.equal(grid.rows.length,12);assert.deepEqual(grid.headers,['År','Område','Ålder','Grupp','Urval','Antal personer']);
  const csv=resultCSV(result);assert.equal(csv.split('\r\n').length,13);assert.ok(csv.includes('"Ålder"'));assert.ok(csv.includes('"2025";"B";"2 år"'));
  const XLSX=await import('../vendor/xlsx.mjs');const sheet=XLSX.read(await resultExcel(result),{type:'array'}).Sheets.Statistik;assert.equal(sheet.C9.v,'Ålder');assert.equal(sheet['!autofilter'].ref,'A9:F21');assert.equal(sheet.F21.v,241);
});
test('Selecting every category excludes a source total and charts enforce seven lines',()=>{
  assert.deepEqual(categoryValues({code:'Kön',values:['Man','Kvinna','Båda kön']}),['Man','Kvinna']);
  assert.deepEqual(categoryValues({code:'Område',values:['101 A','102 B','Göteborg']}),['101 A','102 B']);
  assert.throws(()=>seriesChart({series:Array(8).fill({}),area:'A',table,measure:'Folkmängd',date:'2026-09-14'}),/sju/);
});
