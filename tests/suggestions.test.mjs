import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {suggestedTables} from '../src/table-suggestions.js';
const catalog=JSON.parse(await readFile(new URL('../data/search-catalog.json',import.meta.url),'utf8'));
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
