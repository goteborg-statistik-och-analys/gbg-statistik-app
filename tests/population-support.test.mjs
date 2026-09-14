import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {aggregate,areaOf,timeOf,makeQuery,csv} from '../core.js';
import {planGroups} from '../group-selection.js';
import {reviewedCountMeasure} from '../table-measures.js';
import {detailedSeries} from '../detailed-results.js';
const audit=JSON.parse(await readFile(new URL('../data/population-audit.json',import.meta.url),'utf8'));
const catalog=JSON.parse(await readFile(new URL('../data/search-catalog.json',import.meta.url),'utf8'));
test('All population tables have complete metadata and a verified numeric source extract',()=>{
  for(const table of catalog.filter(t=>t.subject==='Befolkning')){
    assert.ok(table.kind,table.title);
    if(table.kind!=='count')continue;
    const entry=audit.find(e=>e.id===table.id);assert.ok(entry?.payload,table.title);
    assert.ok(aggregate(entry.payload,entry.query,table.measure).some(r=>r.value!==null),table.title);
    const selections=Object.fromEntries(entry.query.query.map(v=>[v.code,v.selection.values]));
    const year=Number(selections[timeOf(table.metadata).code][0]);
    assert.equal(planGroups(table,selections[areaOf(table.metadata)?.code],year,year,[{name:'Kontroll',selections}]).length,1);
  }
});
test('Months remain chronological time points, preserve missingness and export readable periods',()=>{
  const metadata={variables:[{code:'År',values:['2025']},{code:'Månad',values:['Februari','Januari']},{code:'Kön',values:['Man','Kvinna']}]};
  const query=makeQuery(metadata,undefined,2025,2025,{Månad:['Februari','Januari'],Kön:['Man','Kvinna']});
  const payload={columns:[{code:'År'},{code:'Månad'},{code:'Kön'},{code:'value',type:'c'}],data:[{key:['2025','Januari','Man'],values:['10']},{key:['2025','Januari','Kvinna'],values:['12']},{key:['2025','Februari','Man'],values:['11']}]};
  const rows=aggregate(payload,query,{monthly:true});
  assert.deepEqual(rows.map(r=>[r.period,r.value]),[['2025-01',22],['2025-02',null]]);
  assert.match(csv(rows,'Göteborg','Källa','idag'),/"Period"/);assert.match(csv(rows,'Göteborg','Källa','idag'),/2025-02/);
});
test('Forecast queries use Prognosår and geographic aliases retain their role',()=>{
  const entry=audit.find(e=>e.metadata?.variables.some(v=>v.code==='Prognosår'));
  const selections=Object.fromEntries(entry.query.query.map(v=>[v.code,v.selection.values]));
  const year=Number(selections.Prognosår[0]);
  assert.ok(makeQuery(entry.metadata,selections[areaOf(entry.metadata)?.code],year,year,selections).query.some(v=>v.code==='Prognosår'));
  assert.equal(areaOf({variables:[{code:'Relationsområde'},{code:'Mellanområde2021'}]}).code,'Mellanområde2021');
});
test('Density and overlapping migration measures cannot be summed but can be compared',()=>{
  for(const title of ['Befolkningstäthet','Flyttningar']){
    const metadata={variables:[{code:'Primärområde',values:['A','B']},{code:'Flyttyp',values:['In','Netto']},{code:'År',values:['2025']}]};
    const measure=reviewedCountMeasure({subject:'Befolkning',title,metadata});
    const table={kind:'count',title,metadata,measure};
    const group={name:'',selections:{Primärområde:['A'],Flyttyp:['In','Netto']}};
    assert.throws(()=>planGroups(table,'A',2025,2025,[group]),/summer/);
    const plan=planGroups(table,'A',2025,2025,[{...group,separate:['Flyttyp']}])[0];
    const payload={columns:[{code:'Primärområde'},{code:'Flyttyp'},{code:'År'},{code:'value',type:'c'}],data:[{key:['A','In','2025'],values:['10']},{key:['A','Netto','2025'],values:['-2']}]};
    const series=detailedSeries(payload,plan.query,plan,table);assert.equal(series.length,2);
    if(measure.allowNegative)assert.equal(series[1].rows[0].value,-2);
  }
});
