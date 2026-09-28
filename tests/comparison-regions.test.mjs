import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {metropolitanGrowth,metropolitanRegions} from '../src/comparison-regions.js';
import {comparisonExportRows,comparisonExportSVG,comparisonExcel} from '../src/comparison-exports.js';
const read=async name=>JSON.parse(await readFile(new URL('../data/'+name,import.meta.url),'utf8'));
const cm=await read('goteborg-jamforelse/context-metadata.json'),pm=await read('goteborg-jamforelse/periods-metadata.json');
const context=await read('goteborg-jamforelse/'+cm.file);
context.periodBaselines=(await read('goteborg-jamforelse/'+pm.file)).baselines;
test('Metropolitan comparison has three cities and complete SCB regions excluding their central cities',()=>{
  const rows=metropolitanGrowth(context);
  assert.equal(rows.length,6);
  assert.deepEqual(rows.slice(3).map(r=>r.codes.length),[12,25,11]);
  for(const [i,region] of metropolitanRegions.entries()){
    assert.equal(new Set(region.codes).size,region.codes.length);
    assert.ok(!rows[i+3].codes.includes(region.center));
    assert.equal(rows[i].growth,context.ranking.find(r=>r.code===region.center).growth);
    assert.ok(region.codes.every(code=>context.ranking.some(r=>r.code===code)));
  }
});
test('Every period aggregates published totals and uses a weighted regional growth rate',()=>{
  for(const period of [1,3,5,10])for(const row of metropolitanGrowth(context,period).slice(3)){
    const members=context.ranking.filter(r=>row.codes.includes(r.code));
    const baseline=members.reduce((sum,r)=>sum+(period===1?r.populationPrevious:context.periodBaselines[r.code][2025-period]),0);
    const growth=period===1?members.reduce((sum,r)=>sum+r.growth,0):members.reduce((sum,r)=>sum+r.population,0)-baseline;
    assert.equal(row.growth,growth);assert.equal(row.growthRate,100*growth/baseline);
  }
});
test('Missing regional members or baselines cannot silently produce partial totals',()=>{
  const missing={...context,ranking:context.ranking.filter(r=>r.code!=='1440')};
  assert.equal(metropolitanGrowth(missing)[3].growth,null);
  assert.equal(metropolitanGrowth({...context,periodBaselines:{}},3)[3].growthRate,null);
});
test('Metropolitan exports contain six numeric rows, a separate Excel sheet and visible SVG comparison',async()=>{
  const model={kind:'map',metroRows:metropolitanGrowth(context,10),geometry:await read('sweden-municipalities-map.json'),mapRows:[],measure:'growth',startYear:2015,endYear:2025,title:'Test',subtitle:'Testurval',unit:'Personer',notes:['CKM från 2025'],labels:[],series:[]};
  const rows=comparisonExportRows(model).slice(-6);
  assert.equal(rows.length,6);assert.equal(typeof rows[3][1],'number');assert.equal(typeof rows[3][2],'number');
  const XLSX=await import('../vendor/xlsx.mjs'),book=XLSX.read(await comparisonExcel(model),{type:'array'});
  const sheet=XLSX.utils.sheet_to_json(book.Sheets['Storstäder och regioner'],{header:1});
  assert.deepEqual(sheet.slice(3,9),rows);
  const svg=comparisonExportSVG(model);
  assert.match(svg,/Storstäder och omgivande regioner/);assert.match(svg,/2015–2025/);assert.match(svg,/exkl\./);assert.doesNotMatch(svg,/NaN|undefined/);
});
