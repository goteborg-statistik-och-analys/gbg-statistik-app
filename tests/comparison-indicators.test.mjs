import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {indicator,percentage,rankMunicipalities,growthSummary,ageGroups} from '../src/comparison-indicators.js';
import {lineChart,ageChart} from '../src/comparison-chart.js';

const root=new URL('../data/goteborg-jamforelse/',import.meta.url);
const json=async file=>JSON.parse(await readFile(new URL(file,root),'utf8'));
const manifest=await json('metadata.json'),snapshot=await json(manifest.file),contextManifest=await json('context-metadata.json'),context=await json(contextManifest.file);

test('National denominators and growth use published totals, including the 1999 baseline',()=>{
  const area=snapshot.data['1480'].all;
  const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-12);
  close(indicator(snapshot,context,'1480',2000,'growthRate'),area.growth[0]/context.baseline1999['1480']*100);
  close(indicator(snapshot,context,'1480',2025,'growthRate'),area.growth.at(-1)/area.population.at(-2)*100);
  close(indicator(snapshot,context,'1480',2025,'nationalShare'),area.population.at(-1)/context.country.population.at(-1)*100);
  assert.equal(percentage(null,100),null);assert.equal(percentage(10,0),null);assert.equal(percentage(0,100),0);
});

test('Ranking is independent of chart selections, sorts raw values and supports negative growth and ties',()=>{
  const fixture={ranking:[{code:'a',name:'A',growth:1,populationPrevious:1000},{code:'b',name:'B',growth:1,populationPrevious:1001},{code:'c',name:'C',growth:1,populationPrevious:1000},{code:'d',name:'D',growth:1,populationPrevious:1000},{code:'e',name:'E',growth:-5,populationPrevious:100}]};
  const ranked=rankMunicipalities(fixture,[],{measure:'growthRate'});
  assert.deepEqual(ranked.map(row=>[row.code,row.rank]),[['a',1],['c',1],['d',1],['b',4],['e',5]]);
  assert.equal(rankMunicipalities(fixture,[],{direction:'asc'})[0].code,'e');
  assert.equal(rankMunicipalities(context,snapshot.municipalities.areas).length,290);
  for(const [scope,count] of [['A1',3],['B3',23],['GR',13],['selected',38]])assert.equal(rankMunicipalities(context,snapshot.municipalities.areas,{scope}).length,count);
  assert.equal(rankMunicipalities(context,snapshot.municipalities.areas)[0].code,'1480');
});

test('Supplementary snapshot is consistent and only downloads the required national and latest-year data',async()=>{
  assert.equal(contextManifest.populationSnapshotSha256,manifest.sha256);
  for(const [file,expected] of [[contextManifest.file,contextManifest.sha256],[contextManifest.auditFile,contextManifest.auditSha256]])assert.equal(createHash('sha256').update(await readFile(new URL(file,root))).digest('hex'),expected);
  const audit=await json(contextManifest.auditFile);
  for(const extract of audit){
    const q=Object.fromEntries(extract.query.query.map(item=>[item.code,item.selection.values]));
    assert.equal(q.Alder.length,1); // only published totals, never single ages for national rankings
    if(q.Region.length===290)assert.ok(q.Tid.length===1&&['2024','2025'].includes(q.Tid[0]));
    else if(q.Region.length===38)assert.deepEqual(q.Tid,['1999']);
    else assert.deepEqual(q.Region,['00']);
  }
  assert.deepEqual(context.country.years,snapshot.years);
  for(const area of snapshot.municipalities.areas){
    const row=context.ranking.find(row=>row.code===area.code),saved=snapshot.data[area.code].all;
    assert.equal(row.populationPrevious,saved.population.at(-2));assert.equal(row.population,saved.population.at(-1));assert.equal(row.growth,saved.growth.at(-1));
  }
});

test('Charts support missing values without false zeros and preserve accessible alternatives',()=>{
  const chart=lineChart({series:[{name:'Göteborg',slot:0,values:[5,null,-3]}],years:[2000,2001,2002],title:'Befolkning',unit:'Personer',width:320});
  assert.ok(!/NaN|Infinity/.test(chart));assert.match(chart,/tabindex="0"/);assert.match(chart,/Använd vänster och höger/);
  assert.match(chart,/<path d="M[^L]+M/); // a missing year breaks the line
  assert.equal(ageGroups.length,21);assert.equal(ageGroups[0][1],0);assert.equal(ageGroups.at(-1)[2],100);
  for(const group of ageGroups.slice(0,-1))assert.equal(group[2]-group[1]+1,5);
  for(let i=1;i<ageGroups.length;i++)assert.equal(ageGroups[i][1],ageGroups[i-1][2]+1);
  assert.ok(!/NaN|Infinity/.test(ageChart({series:[{name:'Göteborg',slot:0,values:[null,10,20,20,20,20,10]}],groups:ageGroups.map(g=>g[0]),title:'Åldrar',width:320})));
});

test('Municipality summary respects the ranking scope and distinguishes unchanged from missing',()=>{
  const fixture={ranking:[{code:'a',name:'A',growth:2},{code:'b',name:'B',growth:-1},{code:'c',name:'C',growth:0},{code:'d',name:'D',growth:null}]};
  assert.deepEqual(growthSummary(fixture,[]),{total:3,increased:1,decreased:1,unchanged:1});
  assert.deepEqual(growthSummary(fixture,[{code:'a',groups:['GR']}],'GR'),{total:1,increased:1,decreased:0,unchanged:0});
  const actual=growthSummary(context,snapshot.municipalities.areas);
  assert.equal(actual.increased+actual.decreased+actual.unchanged,290);
});
