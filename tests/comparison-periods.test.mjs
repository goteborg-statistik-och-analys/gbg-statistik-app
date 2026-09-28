import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {periodGrowth,rankMunicipalities,growthSummary} from '../src/comparison-indicators.js';
import {comparisonExportSVG} from '../src/comparison-exports.js';
import {municipalityLabel} from '../src/comparison-map.js';
const read=async file=>JSON.parse(await readFile(new URL('../data/goteborg-jamforelse/'+file,import.meta.url),'utf8'));
const cm=await read('context-metadata.json'),pm=await read('periods-metadata.json'),m=await read('metadata.json');
const context=await read(cm.file),periods=await read(pm.file),snapshot=await read(m.file);
context.periodBaselines=periods.baselines;
test('Periods use published annual growth for one year and total change for longer periods, preserving missing data',()=>{
  assert.deepEqual(periodGrowth(130,100,28,1),{growth:28,growthRate:28});
  for(const period of [3,5,10])assert.deepEqual(periodGrowth(130,100,28,period),{growth:30,growthRate:30});
  assert.deepEqual(periodGrowth(130,null,28,3),{growth:null,growthRate:null});
  assert.deepEqual(periodGrowth(90,100,28,10),{growth:-10,growthRate:-10});
  assert.throws(()=>periodGrowth(130,100,28,2));
});
test('Versioned period baselines cover all 290 municipalities and match the 38 historical series',async()=>{
  assert.equal(pm.contextSha256,cm.sha256);assert.equal(periods.contextSha256,cm.sha256);
  for(const [file,hash] of [[pm.file,pm.sha256],[pm.auditFile,pm.auditSha256]]){
    const bytes=await readFile(new URL('../data/goteborg-jamforelse/'+file,import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),hash);
  }
  assert.equal(Object.keys(periods.baselines).length,290);
  for(const period of [1,3,5,10]){
    const rows=rankMunicipalities(context,snapshot.municipalities.areas,{period});
    assert.equal(rows.length,290);
    const summary=growthSummary(context,[], 'all',period);
    assert.equal(summary.increased+summary.decreased+summary.unchanged,290);
    for(const area of snapshot.municipalities.areas){
      const row=rows.find(r=>r.code===area.code),series=snapshot.data[area.code].all;
      const expected=periodGrowth(series.population.at(-1),series.population[snapshot.years.indexOf(2025-period)],series.growth.at(-1),period);
      assert.equal(row.growth,expected.growth);assert.equal(row.growthRate,expected.growthRate);
      assert.match(municipalityLabel(row),new RegExp(`${2025-period}–2025`));
    }
  }
});
test('Ten-year map export carries the selected period in accessible title and source',async()=>{
  const geometry=JSON.parse(await readFile(new URL('../data/sweden-municipalities-map.json',import.meta.url),'utf8'));
  const svg=comparisonExportSVG({kind:'map',geometry,mapRows:rankMunicipalities(context,[],{period:10}),measure:'growthRate',startYear:2015,endYear:2025,title:'Befolkningsförändring 2015–2025',subtitle:'Alla kommuner',unit:'Procent',notes:['CKM från 2025.']});
  assert.match(svg,/Statistik 2015–2025/);assert.doesNotMatch(svg,/2024–2025|NaN|data-municipality/);
});
