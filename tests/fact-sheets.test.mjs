import {test} from 'node:test';
import assert from 'node:assert/strict';
import {matchingFactSheets,filterFactSheets,publishedFactSheets} from '../src/fact-sheets.js';
import {suggestedFactSheets} from '../src/table-suggestions.js';

test('Forecast searches offer the published fact sheet with a working destination',()=>{
  for(const query of ['befolkningsprognos','kommunprognos','prognos','mellanområdesprognos','stadsområdesprognos','BEFOLKNINGSPROGNOS','prognoser','Visa kommunprognosen','mellanområdesprog']){
    const sheets=suggestedFactSheets(query);
    assert.equal(sheets[0].href,'prognos.html',query);
    assert.equal(sheets.filter(sheet=>sheet.href).length,1,query);
  }
  for(const query of ['','inkomst','program','väderprognos'])assert.deepEqual(matchingFactSheets(query),[],query);
});

test('Published fact sheets respect theme and geographic filters',()=>{
  for(const level of ['','Kommun','Stadsområde','Mellanområde'])assert.equal(filterFactSheets(publishedFactSheets,{theme:'Faktablad',level,readyOnly:true}).length,['','Kommun'].includes(level)?2:1);
  assert.equal(filterFactSheets(publishedFactSheets).length,2);
  assert.deepEqual(filterFactSheets(publishedFactSheets,{level:'Primärområde'}),[]);
  assert.deepEqual(filterFactSheets(publishedFactSheets,{theme:'Inkomst'}),[]);
});

test('Comparison search and the fact sheet theme expose the new sheet without changing forecast matches',()=>{
  for(const query of ['Göteborg i jämförelse','jämför kommuner','befolkningstillväxt','folkökning','försörjningskvot'])assert.ok(matchingFactSheets(query).some(sheet=>sheet.href==='jamforelse.html'),query);
  assert.equal(matchingFactSheets('Faktablad').length,2);
});
