import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {aggregate,areaOf,timeOf} from '../src/core.js';
import {groupDimensions,planGroups,totalValues} from '../src/group-selection.js';
import {reviewedCountMeasure,tableMeasure} from '../src/table-measures.js';
import {searchSelection} from '../src/search-selection.js';
import {detailedSeries} from '../src/detailed-results.js';
import {mapSeries,areaCode} from '../src/area-map.js';
import {resultCSV,resultExcel} from '../src/exports.js';
import {read,utils} from '../vendor/xlsx.mjs';
const catalog=JSON.parse(await readFile(new URL('../data/search-catalog.json',import.meta.url),'utf8'));
const audit=JSON.parse(await readFile(new URL('../data/education-audit.json',import.meta.url),'utf8'));
const education=catalog.filter(t=>t.subject==='Utbildning');
test('All 16 education tables have verified source units, exact queries and working area series',async()=>{
  assert.equal(education.length,16);assert.ok(education.every(t=>t.kind));
  for(const table of education){
    const source=audit.find(e=>e.id===table.id);
    assert.deepEqual(tableMeasure(table),reviewedCountMeasure(table));
    assert.equal(table.measure.unit,source.sourceUnit);
    const selections=Object.fromEntries(source.query.query.map(q=>[q.code,q.selection.values]));
    const area=areaOf(table.metadata),year=Number(selections[timeOf(table.metadata).code][0]);
    const groups=planGroups(table,area?.values[0],year,year,[{name:'',selections,separate:area?[area.code]:[]}]);
    assert.deepEqual(groups[0].query,source.query);
    const series=detailedSeries(source.payload,groups[0].query,groups[0],table);
    assert.equal(series.length,1);
    assert.equal(series[0].rows[0].value,Number(source.payload.data[0].values[0]));
    const totals=Object.fromEntries(groupDimensions(table.metadata).map(v=>[v.code,totalValues(v)]));
    assert.doesNotThrow(()=>planGroups(table,area?.values[0],year,year,[{name:'Totalt',selections:totals}]));
    if(area){
      assert.equal(mapSeries({table,groups,series}).size,1);
      const file={Stadsområde:'stadsomraden',Mellanområde:'mellanomraden',Primärområde:'primaromraden'}[table.level];
      const geometry=JSON.parse(await readFile(new URL(`../data/${file}-map.json`,import.meta.url),'utf8'));
      assert.deepEqual(area.values.map(areaCode).filter(c=>!['99','199'].includes(c)).sort(),geometry.features.map(f=>areaCode(f.code)).sort());
    }
  }
});
test('Child age labels map to API codes and education notes and units survive both exports',async()=>{
  const table=education.find(t=>t.level==='Stadsområde'&&t.measure.unit==='Antal barn');
  const preset=searchSelection(table.metadata,{age:[0,5]});
  assert.deepEqual(preset.selections,{'Barnets ålder':['0']});assert.deepEqual(preset.warnings,[]);
  assert.ok(searchSelection(table.metadata,{age:[0,6]}).warnings.length);
  const source=audit.find(e=>e.id===table.id);
  const result={table,rows:aggregate(source.payload,source.query,table.measure),unit:table.measure.unit,measure:table.measure.label,area:'Nordost',detail:'Barn 0–5 år',date:'2026-09-17',notes:table.sourceNotes.join('\n')};
  assert.match(result.notes,/sekretess/);
  const csv=resultCSV(result);assert.match(csv,/Antal barn/);assert.ok(csv.includes(result.notes));
  const workbook=read(await resultExcel(result),{type:'array'});
  const cells=utils.sheet_to_json(workbook.Sheets.Statistik,{header:1}).flat().join('\n');
  assert.match(cells,/Antal barn/);assert.match(cells,/sekretess/);
  assert.equal(reviewedCountMeasure({subject:'Utbildning',title:'Andel behöriga'}),null);
});
