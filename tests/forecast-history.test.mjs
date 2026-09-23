import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {findTables} from '../src/search.js';
import {suggestedTables} from '../src/table-suggestions.js';
import {historySource,historyQuery,combineHistory} from '../src/forecast-history.js';
import {planGroups,totalValues} from '../src/group-selection.js';
import {areaOf,timeOf,yearsOf} from '../src/core.js';
import {resultGrid} from '../src/detailed-results.js';
import {resultCSV,resultExcel} from '../src/exports.js';
import {seriesChart} from '../src/series-chart.js';
const catalog=JSON.parse(await readFile(new URL('../data/search-catalog.json',import.meta.url),'utf8'));
const forecast=catalog.find(t=>/^Kommunprognos/.test(t.title));
function seriesFor(table,overrides={}){
  const selections=Object.fromEntries(table.metadata.variables.filter(v=>v!==timeOf(table.metadata)).map(v=>[v.code,v===areaOf(table.metadata)?[v.values[0]]:totalValues(v)]));
  const group=planGroups(table,undefined,2026,2030,[{name:'Urval',selections:{...selections,...overrides}}])[0];
  return {name:'Urval',detail:group.detail,group,rows:[{year:2026,value:100},{year:2030,value:120}]};
}
test('Kommunprognos ranks first in search and autocomplete',()=>{
  for(const q of ['Kommunprognos','kommunprognosen','KOMMUNPROGNOS']){
    assert.equal(findTables(q,catalog).tables[0].id,forecast.id);
    assert.match(suggestedTables(q,catalog)[0].title,/^Kommunprognos/);
    assert.ok(findTables(q,catalog).tables.every(t=>t.measure?.forecast));
  }
});
test('Every forecast maps ten historical years with identical age coverage',()=>{
  for(const table of catalog.filter(t=>t.measure?.forecast)){
    const history=historySource(table,catalog),s=seriesFor(table),query=historyQuery(table,history,s);
    assert.deepEqual(query.query.find(v=>v.code==='År').selection.values,Array.from({length:10},(_,i)=>String(2016+i)));
    assert.deepEqual(query.query.find(v=>v.code==='Ålder').selection.values,s.group.selections['Ålder']);
    assert.deepEqual(query.query.find(v=>v.code==='Kön').selection.values,['Man','Kvinna']);
  }
});
test('Sex labels and separately displayed categories preserve the selected population',()=>{
  const s=seriesFor(forecast,{'Kön':['Män','Kvinnor'],'Ålder':['10 år','11 år']});
  s.dimensionValues={'Kön':'Kvinnor','Ålder':'11 år'};
  const query=historyQuery(forecast,historySource(forecast,catalog),s);
  assert.deepEqual(query.query.find(v=>v.code==='Kön').selection.values,['Kvinna']);
  assert.deepEqual(query.query.find(v=>v.code==='Ålder').selection.values,['11 år']);
});
test('Incompatible historical categories fail explicitly',()=>{
  const source=structuredClone(historySource(forecast,catalog));
  source.metadata.variables.find(v=>v.code==='Ålder').values=['0 år'];
  assert.throws(()=>historyQuery(forecast,source,seriesFor(forecast)),/kan inte matcha/);
});
test('Combined chart, table and downloads identify forecast and retain missing years',async()=>{
  const snapshot={table:forecast,series:[seriesFor(forecast)],area:'Göteborg',unit:'Antal personer',date:'2026-09-22',notes:''};
  const combined=combineHistory(snapshot,[[{year:2025,value:90}]],historySource(forecast,catalog));
  assert.equal(combined.forecastStart,yearsOf(forecast.metadata)[0]);
  assert.equal(combined.series[0].rows.find(r=>r.year===2027).value,null);
  assert.ok(resultGrid(combined).headers.includes('Typ'));
  assert.match(resultCSV(combined),/"Historik"/);
  assert.match(resultCSV(combined),/"Prognos"/);
  assert.match(seriesChart(combined),/data-forecast-start="2026"/);
  assert.ok((await resultExcel(combined)).byteLength>0);
  assert.equal(combined.withoutHistory,snapshot);
});
