import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {groupTables,tableSummary} from '../src/catalog-groups.js';
const catalog=JSON.parse(await readFile(new URL('../data/search-catalog.json',import.meta.url),'utf8'));

test('Reviewed spelling, dimension aliases and source codes group tables across all themes',()=>{
  for(const [prefix,count] of [
    ['Förvärvsarbetande, 2008',4],
    ['Befolkningstäthet',4],
    ['Befolkningen efter senaste invandringsår',4],
    ['Huvudsaklig inkomstkälla',4],
    ['Personbilar i trafik',5]
  ]){
    const groups=groupTables(catalog.filter(t=>t.title.startsWith(prefix)));
    assert.equal(groups.length,1,prefix);assert.equal(groups[0].tables.length,count,prefix);
  }
  for(const dimension of ['hustyp','upplåtelseform']){
    const tables=catalog.filter(t=>t.title.startsWith('Antal hushåll efter hushållsstorlek')&&t.title.includes(dimension));
    assert.equal(groupTables(tables).length,1);assert.equal(tables.length,4);
  }
  const newHousing=catalog.filter(t=>/^Nybygg/.test(t.title));
  assert.equal(groupTables(newHousing).length,1);assert.equal(newHousing.length,3);
  const income=catalog.filter(t=>t.title.startsWith('Förvärvsinkomst efter utbildningsnivå')&&t.title.includes('2007-2024'));
  assert.equal(groupTables(income).length,1);
  const car=catalog.find(t=>t.title==='Personbilar i trafik 2003 - 2025');
  assert.deepEqual(tableSummary(car),{title:'Personbilar i trafik',detail:'2003–2025 · Tabellvärde'});
});

test('Missing dimensions, distinct age bands, periods and unknown codes remain separate',()=>{
  const day=catalog.filter(t=>t.title.startsWith('Dagbefolkning'));
  const groups=groupTables(day);
  assert.equal(groups.length,2);
  assert.deepEqual(groups.map(g=>g.tables.map(t=>t.level)),[['Kommun','Stadsområde'],['Mellanområde','Primärområde']]);
  assert.equal(groupTables(catalog.filter(t=>t.title.startsWith('Sysselsatta efter sektorkod')||t.title.startsWith('Syselsatta efter sektorkod'))).length,2);
  assert.equal(groupTables(catalog.filter(t=>t.title.startsWith('Förvärvsinkomst efter bakgrund')&&t.title.includes('2007-2024'))).length,2);
  assert.equal(groupTables(catalog.filter(t=>t.title.startsWith('Förvärvsinkomst efter utbildningsnivå')&&t.title.includes('2012-2024'))).length,2);
  assert.equal(groupTables(catalog.filter(t=>t.title.startsWith('Folkmängd efter hushållstyp'))).length,2);
  const worker=catalog.find(t=>t.level==='Kommun'&&t.title==='Förvärvsarbetande, 2008-2024');
  const coded=catalog.find(t=>t.level==='Primärområde'&&t.title===worker.title);
  assert.equal(groupTables([worker,{...coded,metadata:undefined}]).length,2);
  assert.equal(groupTables([worker,{...worker,level:'Mellanområde',title:worker.title.replace('2008','2009')}]).length,2);
});

test('Education groups equivalent geographies despite punctuation and age codes',()=>{
  const highest=catalog.filter(t=>t.subject==='Utbildning'&&t.title.startsWith('Högsta utbildningsnivå'));
  const groups=groupTables(highest);
  assert.equal(groups.length,2);
  assert.deepEqual(groups.find(g=>g.tables.length===3).tables.map(t=>t.level).sort(),['Kommun','Mellanområde','Stadsområde']);
  assert.equal(groups.find(g=>g.tables.length===1).tables[0].level,'Primärområde');
  const children=catalog.filter(t=>t.subject==='Utbildning'&&t.title.startsWith('Antal barn 0-17'));
  assert.equal(groupTables(children).length,1);
  assert.equal(groupTables(children)[0].tables.length,4);
  const changed=structuredClone(children[1]);
  const ages=changed.metadata.variables.find(v=>v.code==='Barnets ålder');
  ages.valueTexts[0]='0-4 år';
  assert.equal(groupTables([children[0],changed]).length,2);
  const otherYears=structuredClone(children[1]);
  const year=otherYears.metadata.variables.find(v=>v.code==='År');
  year.values.shift();year.valueTexts.shift();
  assert.equal(groupTables([children[0],otherYears]).length,2);
});
test('Housing tables group all geographic levels despite category capitalization',()=>{
  const tables=catalog.filter(t=>t.title==='Bostadsbestånd efter hustyp och byggnadsår, exklusive specialbostäder, 2014-2025');
  assert.equal(tables.length,5);
  const groups=groupTables(tables);
  assert.equal(groups.length,1);
  assert.deepEqual(groups[0].tables.map(t=>t.level),['Kommun','Stadsområde','Mellanområde','Primärområde','Basområde']);
  assert.equal(groupTables([tables[0],{...tables[1],variables:tables[1].variables.replace('2014-2025','2015-2025')}]).length,2);
});
test('Supported tables group population levels and keep distinct education definitions',()=>{
  const groups=groupTables(catalog.filter(t=>['population','education'].includes(t.kind)));
  assert.equal(groups.length,4);
  assert.deepEqual(groups[0].tables.map(t=>t.level),['Kommun','Mellanområde','Primärområde']);
  assert.ok(groups.slice(1).every(g=>g.tables.length===1));
  assert.deepEqual(tableSummary(groups[0]),{title:'Folkmängd',detail:'1984–2025 · Ålder, Kön · (SCB)'});
});
test('Grouping retains every table and respects filters and distinct category definitions',()=>{
  const groups=groupTables(catalog);
  assert.deepEqual(groups.flatMap(g=>g.tables.map(t=>t.id)).sort(),catalog.map(t=>t.id).sort());
  assert.ok(groups.every(g=>new Set(g.tables.map(t=>t.level)).size===g.tables.length));
  const local=groupTables(catalog.filter(t=>t.level==='Primärområde'));
  assert.ok(local.every(g=>g.tables.every(t=>t.level==='Primärområde')));
  const table=catalog.find(t=>t.kind==='population');
  assert.equal(groupTables([table,{...table,level:'Primärområde',variables:'Ålder: [15-19 år]'}]).length,2);
  assert.equal(tableSummary({...table,title:'Tabell utan årtal'}).title,'Tabell utan årtal');
});
