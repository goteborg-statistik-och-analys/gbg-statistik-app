import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reviewedCountMeasure} from '../src/table-measures.js';
import {resultCSV,resultExcel} from '../src/exports.js';
import {seriesChart} from '../src/series-chart.js';
import {aggregate} from '../src/core.js';
test('Reviewed count families use their own units; averages and unknown tables stay unsupported',()=>{
  assert.equal(reviewedCountMeasure({subject:'Bostäder och byggande',title:'Bostadsbestånd efter hustyp'}).unit,'Antal bostäder');
  assert.equal(reviewedCountMeasure({subject:'Arbetsmarknad',title:'Antal arbetsställen efter storlek'}).unit,'Antal arbetsställen');
  assert.equal(reviewedCountMeasure({subject:'Arbetsmarknad',title:'Ohälsotal efter utbildningsnivå'}),null);
  assert.equal(reviewedCountMeasure({subject:'Inkomst',title:'Förvärvsinkomst'}),null);
});
test('Signed housing changes remain numeric and are plotted inside the chart',()=>{
  const payload={columns:[{code:'År',type:'t'},{code:'Antal',type:'c'}],data:[{key:['2025'],values:['-4']}]};
  const query={query:[{code:'År',selection:{values:['2025']}}]};
  assert.equal(aggregate(payload,query,{allowNegative:true})[0].value,-4);
  assert.equal(aggregate(payload,query)[0].value,null);
  const svg=seriesChart({area:'Göteborg',table:{level:'Kommun'},measure:'Bostäder',unit:'Antal bostäder',date:'2026-09-14',series:[{name:'Ombyggnation',detail:'Valt urval',rows:[{year:2024,value:-4},{year:2025,value:2}]}]});
  for(const match of svg.matchAll(/<circle[^>]*cy="([^"]+)"/g))assert.ok(Number(match[1])>=115&&Number(match[1])<=415);
});
test('Housing units reach charts, points, CSV and Excel without person labels',async()=>{
  const result={area:'Göteborg',table:{title:'Bostadsbestånd',level:'Kommun'},measure:'Bostadsbestånd',unit:'Antal bostäder',date:'2026-09-14',detail:'Alla hustyper',notes:'',series:[{name:'Totalt',detail:'Alla hustyper',rows:[{year:2024,value:1},{year:2025,value:2}]}]};result.rows=result.series[0].rows;
  const svg=seriesChart(result);assert.ok(svg.includes('Antal bostäder'));assert.ok(svg.includes('2 bostäder'));assert.ok(!svg.includes('personer'));
  assert.ok(resultCSV(result).includes('Antal bostäder'));assert.ok(!resultCSV(result).includes('personer'));
  const XLSX=await import('../vendor/xlsx.mjs');const workbook=XLSX.read(await resultExcel(result),{type:'array'});assert.equal(workbook.Sheets.Statistik.D10.v,'Antal bostäder');
});
