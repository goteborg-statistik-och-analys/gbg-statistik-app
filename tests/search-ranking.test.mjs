import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {findTables} from '../src/search.js';
import {suggestedTables} from '../src/table-suggestions.js';

const catalog=JSON.parse(await readFile(new URL('../data/search-catalog.json',import.meta.url),'utf8'));

test('Population is the first suggestion for both folk and longer population searches',()=>{
  for(const query of ['folk','FOLK','folkm','folkmängd','befolkning']){
    assert.match(suggestedTables(query,catalog)[0].title,/^Folkmängd \d/);
  }
  const results=findTables('folk',catalog).tables;
  assert.ok(results.some(table=>/^Befolkningen efter födelseland/.test(table.title)));
  assert.ok(results.some(table=>/^Dagbefolkning/.test(table.title)));
  assert.ok(findTables('folk primärområde',catalog).tables.every(table=>table.level==='Primärområde'));
});

test('Word prefixes outrank substring matches while retaining all matches',()=>{
  const tables=['Befolkningsålder','Fördelning efter ålder','Åldersgrupper'].map((title,id)=>({id,title,subject:'Test',level:'Kommun',variables:''}));
  const results=findTables('åld',tables).tables;
  assert.deepEqual(results.map(table=>table.id),[1,2,0]);
});
