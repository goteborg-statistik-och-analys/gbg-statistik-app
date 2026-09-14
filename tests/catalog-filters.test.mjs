import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {browseTables,catalogThemes,filterTables} from '../catalog-filters.js';
import {findTables} from '../search.js';
const catalog=JSON.parse(await readFile(new URL('../data/search-catalog.json',import.meta.url),'utf8'));
test('Browsing includes every table and prioritizes tables supported by the app',()=>{
  const tables=browseTables(catalog);
  assert.equal(tables.length,237);
  assert.deepEqual(tables.map(t=>t.id).sort(),catalog.map(t=>t.id).sort());
  assert.ok(tables.slice(0,6).every(t=>t.kind));
  assert.equal(filterTables(tables).length,237);
  assert.equal(filterTables(tables,{readyOnly:true}).length,catalog.filter(t=>t.kind).length);
});
test('Theme and geography filters combine across the entire catalogue and search results',()=>{
  const matches=filterTables(browseTables(catalog),{theme:'Utbildning',level:'Primärområde'});
  assert.ok(matches.length>0);
  assert.ok(matches.every(t=>t.subject==='Utbildning'&&t.level==='Primärområde'));
  assert.equal(filterTables(catalog,{theme:'Inkomst'}).length,20);
  assert.deepEqual(catalogThemes(catalog),['Arbetsmarknad','Befolkning','Bostäder och byggande','Inkomst','Utbildning','Övrigt']);
  const search=findTables('folkmängd',catalog).tables;
  assert.ok(filterTables(search,{theme:'Befolkning',level:'Kommun'}).length>0);
  assert.deepEqual(filterTables(search,{theme:'Utbildning'}),[]);
  assert.deepEqual(filterTables(catalog,{theme:'Inkomst',readyOnly:true}),[]);
});
