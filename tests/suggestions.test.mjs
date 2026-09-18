import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {suggestedTables,suggestedFactSheets} from '../src/table-suggestions.js';
import {groupTables} from '../src/catalog-groups.js';
import {findTables} from '../src/search.js';
const catalog=JSON.parse(await readFile(new URL('../data/search-catalog.json',import.meta.url),'utf8'));
test('Fact sheet previews recognize age groups without treating years as ages',()=>{
  for(const query of ['antal 1-5 åringar','1–5-åringar','barn 1-5 år']){
    assert.deepEqual(suggestedFactSheets(query),[{title:'Faktablad: 1–5-åringar',factSheet:'hub-facts-age'}]);
  }
  for(const query of ['','folkmängd 2010–2025','5-1 åringar','1-150 åringar'])assert.deepEqual(suggestedFactSheets(query),[]);
});
test('Fact sheet previews recognize topics and keep unrelated queries empty',()=>{
  assert.equal(suggestedFactSheets('jämlik')[0].title,'Faktablad: jämlikhet');
  assert.equal(suggestedFactSheets('JÄMLIKHET')[0].factSheet,'hub-facts-topic');
  assert.equal(suggestedFactSheets('segregation')[0].title,'Faktablad: segregation');
  assert.equal(suggestedFactSheets('arbetsmarknaden')[0].title,'Faktablad: arbetsmarknad');
  assert.deepEqual(suggestedFactSheets('ojämliknande'),[]);
});

test('Fact sheet topics match word prefixes from three letters without matching unrelated words',()=>{
  for(const topic of ['jämlikhet','segregation','arbetsmarknad']){
    for(let length=3;length<=topic.length;length++){
      assert.deepEqual(suggestedFactSheets('Visa '+topic.slice(0,length)),[{title:'Faktablad: '+topic,factSheet:'hub-facts-topic'}]);
    }
  }
  assert.equal(suggestedFactSheets('JÄM')[0].title,'Faktablad: jämlikhet');
  for(const query of ['jä','jämförelse','ojämliknande','segrare'])assert.deepEqual(suggestedFactSheets(query),[]);
  assert.equal(suggestedFactSheets('jäm jämlik jämlikhet').length,1);
});
test('Empty input suggests six different subjects, preferring supported tables',()=>{
  const suggestions=suggestedTables('',catalog);
  assert.equal(suggestions.length,6);
  assert.equal(new Set(suggestions.map(t=>t.subject)).size,6);
  assert.equal(suggestions.filter(t=>t.kind==='population').length,1);
  assert.ok(suggestions[0].kind);
  assert.deepEqual(suggestedTables('  ',catalog),suggestedTables('',catalog));
});

test('Small catalogs fill with distinct titles without repeating geographic variants',()=>{
  const suggestions=suggestedTables('',catalog.filter(t=>['population','education'].includes(t.kind)));
  assert.equal(suggestions.length,4);
  assert.equal(new Set(suggestions.map(t=>t.title)).size,4);
  assert.deepEqual(suggestedTables('',[]),[]);
});
test('Table suggestions adapt to partial text, level and absent matches',()=>{
  const partial=suggestedTables('folk',catalog);
  assert.ok(partial.length>0&&partial.length<=6);
  assert.ok(partial.every(t=>/folk/i.test(t.title)));
  assert.ok(suggestedTables('utbildning',catalog).some(t=>t.kind==='education'));
  const local=suggestedTables('folkmängd primärområde',catalog);
  assert.ok(local.length>0&&local.every(t=>t.level==='Primärområde'));
  assert.deepEqual(suggestedTables('zqxzy',catalog),[]);
  assert.deepEqual(suggestedTables('folk',[]),[]);
});

test('Suggestions group geographic variants before limiting the number of results',()=>{
  const suggestions=suggestedTables('folkmängd',catalog);
  assert.deepEqual(suggestions,groupTables(findTables('folkmängd',catalog).tables).slice(0,6));
  assert.ok(suggestions.some(group=>group.tables.length>1));
  const levels=suggestedTables('folkmängd primärområde',catalog).flatMap(group=>group.tables);
  assert.ok(levels.length>0);
  assert.ok(levels.every(table=>table.level==='Primärområde'));
});

test('Initial suggestions retain the geographic choices for each table',()=>{
  const suggestions=suggestedTables('',catalog);
  const population=suggestions.find(group=>group.kind==='population');
  assert.ok(population.tables.length>1);
  assert.equal(new Set(population.tables.map(table=>table.level)).size,population.tables.length);
});
