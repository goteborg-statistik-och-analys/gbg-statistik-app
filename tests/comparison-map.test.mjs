import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {growthMapColor,growthMapSVG,municipalityViewBox} from '../src/comparison-map.js';
import {rankMunicipalities} from '../src/comparison-indicators.js';
import {comparisonExportRows,comparisonExportSVG,comparisonExcel} from '../src/comparison-exports.js';
const read=async path=>JSON.parse(await readFile(new URL('../'+path,import.meta.url),'utf8'));
const geometry=await read('data/sweden-municipalities-map.json');
const manifest=await read('data/goteborg-jamforelse/context-metadata.json');
const context=await read('data/goteborg-jamforelse/'+manifest.file);
const rows=rankMunicipalities(context,[],{scope:'all'});
test('Municipality zoom preserves proportions and keeps small and edge municipalities in bounds',()=>{
  const full={width:400,height:800};
  for(const box of [{x:200,y:400,width:2,height:2},{x:0,y:0,width:20,height:40},{x:380,y:760,width:20,height:40},{x:0,y:0,width:400,height:800}]){
    const [x,y,w,h]=municipalityViewBox(full,box);
    assert.equal(w/h,.5);assert.ok(w>=40&&w<=400);
    assert.ok(x>=0&&y>=0&&x+w<=400&&y+h<=800);
    assert.ok(x<=box.x&&y<=box.y&&x+w>=box.x+box.width&&y+h>=box.y+box.height);
  }
});
test('SCB geometry joins every latest-year municipality exactly once with valid bounded paths',()=>{
  assert.equal(geometry.features.length,290);
  assert.deepEqual(geometry.features.map(f=>f.code).sort(),rows.map(r=>r.code).sort());
  assert.equal(geometry.license,'CC0');assert.equal(geometry.crs,'EPSG:3006');
  for(const f of geometry.features){
    assert.match(f.path,/^M/);assert.ok(f.path.endsWith('Z'));
    for(const point of f.path.matchAll(/([\d.]+),([\d.]+)/g)){
      assert.ok(+point[1]>=0&&+point[1]<=geometry.width);
      assert.ok(+point[2]>=0&&+point[2]<=geometry.height);
    }
  }
});
test('Map breaks distinguish zero, missing values and sign at fixed count/percent boundaries',()=>{
  for(const [measure,cut] of [['growth',500],['growthRate',1]]){
    assert.equal(growthMapColor(-cut-0.1,measure),'#d24723');
    assert.equal(growthMapColor(-cut,measure),'#fbcfb9');
    assert.equal(growthMapColor(0,measure),'#d1d9dc');
    assert.equal(growthMapColor(cut,measure),'#c0e4f2');
    assert.equal(growthMapColor(cut+0.1,measure),'#3f5564');
    assert.equal(growthMapColor(null,measure),'#ffffff');
  }
  const svg=growthMapSVG(geometry,rows.slice(0,3),'growth',{interactive:true});
  assert.equal((svg.match(/data-municipality=/g)||[]).length,3);
  assert.equal((svg.match(/tabindex="0"/g)||[]).length,1);
});
test('Map exports include selected geography, numeric counts and percentages without interactive markers',async()=>{
  const subset=rows.slice(0,3),model={kind:'map',geometry,mapRows:subset,measure:'growthRate',title:'Befolkningsförändring 2024–2025',subtitle:'Testurval',unit:'Procent',labels:subset.map(r=>r.name),series:[{name:'Antal',values:subset.map(r=>r.growth)},{name:'Procent',values:subset.map(r=>r.growthRate)}],notes:['CKM från 2025.']};
  const data=comparisonExportRows(model);
  assert.deepEqual(data[5],['Kommun','Antal','Procent']);assert.equal(typeof data[6][1],'number');assert.equal(typeof data[6][2],'number');
  const svg=comparisonExportSVG(model);assert.match(svg,/Testurval/);assert.match(svg,/CKM/);assert.doesNotMatch(svg,/data-municipality|tabindex|is-selected|NaN/);
  const XLSX=await import('../vendor/xlsx.mjs'),book=XLSX.read(await comparisonExcel(model),{type:'array'});
  const sheet=XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]],{header:1});assert.deepEqual(sheet.at(-1),data.at(-1));
});
