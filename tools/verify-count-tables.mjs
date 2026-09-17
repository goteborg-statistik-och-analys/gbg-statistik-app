import {readFile,writeFile} from 'node:fs/promises';
import {reviewedCountMeasure} from '../src/table-measures.js';
import {groupDimensions,planGroups} from '../src/group-selection.js';
import {aggregate} from '../src/core.js';
const catalog=JSON.parse(await readFile('data/search-catalog.json','utf8'));
const audit=JSON.parse(await readFile('data/expanded-metadata.json','utf8'));
let results=[];
try{results=JSON.parse(await readFile('data/count-table-checks.json','utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
for(const entry of audit){
  if(results.some(result=>result.id===entry.id&&result.ok))continue;
  results=results.filter(result=>result.id!==entry.id);
  if(!entry.metadata?.variables)continue;
  const table={...catalog.find(t=>t.id===entry.id),metadata:entry.metadata,kind:'count'};
  table.measure=reviewedCountMeasure(table);if(!table.measure)continue;
  try{
    const selections=Object.fromEntries(groupDimensions(table.metadata).map(v=>[v.code,[v.values[0]]]));
    const area=table.metadata.variables.find(v=>v.code==='Område')?.values[0];
    const year=Number(table.metadata.variables.find(v=>v.code==='År').values.at(-1));
    const [plan]=planGroups(table,area,year,year,[{name:'Kontrollurval',selections}]);
    let payload;
    for(let attempt=0;attempt<3;attempt++){
      await sleep(2100);
      const response=await fetch(table.url,{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify(plan.query),signal:AbortSignal.timeout(25000)});
      const body=await response.json();
      if(response.status===429||String(body.error).includes('429')){await sleep(11000);continue;}
      if(!response.ok||!body.data)throw new Error(JSON.stringify(body));payload=body;break;
    }
    if(!payload)throw new Error('Anropsgränsen nåddes');
    const measures=payload.columns.filter(c=>c.type==='c');
    if(measures.length!==1||/andel|procent|medel|median|ohälso/i.test(measures[0].text))throw new Error('Måttet behöver separat hantering');
    if(payload.data.length!==1)throw new Error('Oväntat antal observationer');
    const rows=aggregate(payload,plan.query,table.measure);
    results.push({id:table.id,ok:true,query:plan.query,payload,rows});
  }catch(error){results.push({id:table.id,ok:false,error:error.message});}
  await writeFile('data/count-table-checks.json',JSON.stringify(results,null,2));
}
console.log(JSON.stringify({passed:results.filter(r=>r.ok).length,failed:results.filter(r=>!r.ok)}));
