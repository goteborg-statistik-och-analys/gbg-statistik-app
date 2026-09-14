// Activate only reviewed count families with complete metadata and valid totals.
import {readFile,writeFile} from 'node:fs/promises';
import {reviewedCountMeasure} from '../table-measures.js';
import {groupDimensions,totalValues,planGroups} from '../group-selection.js';
const catalog=JSON.parse(await readFile('data/search-catalog.json','utf8'));
const audit=JSON.parse(await readFile('data/expanded-metadata.json','utf8'));
const checks=JSON.parse(await readFile('data/count-table-checks.json','utf8'));
const enabled=[],pending=[];
for(const entry of audit){
  const table=catalog.find(t=>t.id===entry.id);
  if(!entry.metadata?.variables){pending.push({id:entry.id,reason:'Metadata saknas'});continue;}
  const candidate={...table,metadata:entry.metadata};
  const measure=reviewedCountMeasure(candidate);
  if(!measure){pending.push({id:entry.id,reason:'Mått kräver separat stöd'});continue;}
  if(!checks.some(check=>check.id===entry.id&&check.ok)){pending.push({id:entry.id,reason:'Datauttag ej verifierat'});continue;}
  candidate.kind='count';candidate.measure=measure;
  try{
    const selections=Object.fromEntries(groupDimensions(candidate.metadata).map(v=>[v.code,totalValues(v)]));
    const area=candidate.metadata.variables.find(v=>v.code==='Område')?.values[0];
    const year=Number(candidate.metadata.variables.find(v=>v.code==='År').values.at(-1));
    planGroups(candidate,area,year,year,[{name:'Totalt',selections}]);
    Object.assign(table,candidate);enabled.push(table.id);
  }catch(error){pending.push({id:entry.id,reason:error.message});}
}
await writeFile('data/search-catalog.json',JSON.stringify(catalog,null,2));
await writeFile('data/count-table-audit.json',JSON.stringify({enabled,pending},null,2));
console.log(JSON.stringify({added:enabled.length,enabled:catalog.filter(t=>t.kind).length,pending}));
