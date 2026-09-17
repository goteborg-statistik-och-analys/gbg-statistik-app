import {readFile,writeFile} from 'node:fs/promises';
import {reviewedCountMeasure} from '../src/table-measures.js';
import {planGroups} from '../src/group-selection.js';
import {aggregate,areaOf,timeOf} from '../src/core.js';
const catalog=JSON.parse(await readFile('data/search-catalog.json','utf8'));
const audit=JSON.parse(await readFile('data/population-audit.json','utf8'));
const enabled=[],pending=[];
for(const entry of audit){
  const table=catalog.find(t=>t.id===entry.id);
  try{
    if(!entry.metadata||!entry.payload)throw new Error(entry.error||'Datauttag saknas');
    const candidate={...table,metadata:entry.metadata};
    const measure=reviewedCountMeasure(candidate);
    if(!measure)throw new Error('Mått behöver granskas');
    if(entry.payload.columns.filter(c=>c.type==='c').length!==1)throw new Error('Flera värdekolumner');
    const rows=aggregate(entry.payload,entry.query,measure);
    if(!rows.some(r=>r.value!==null))throw new Error('Kontrolluttaget saknar numeriska värden');
    candidate.kind='count';candidate.measure=measure;
    const selections=Object.fromEntries(entry.query.query.map(v=>[v.code,v.selection.values]));
    const year=Number(selections[timeOf(candidate.metadata).code][0]);
    planGroups(candidate,selections[areaOf(candidate.metadata)?.code],year,year,[{name:'Kontroll',selections}]);
    if(measure.label==='Flyttningar'&&!/^Flyttningar/.test(candidate.title))candidate.title='Flyttningar · '+candidate.title;
    Object.assign(table,candidate);enabled.push(table.id);
  }catch(error){pending.push({id:entry.id,title:table.title,reason:error.message});}
}
await writeFile('data/search-catalog.json',JSON.stringify(catalog,null,2));
await writeFile('data/population-table-status.json',JSON.stringify({enabled,pending},null,2));
console.log(JSON.stringify({added:enabled.length,enabled:catalog.filter(t=>t.kind).length,pending},null,2));
