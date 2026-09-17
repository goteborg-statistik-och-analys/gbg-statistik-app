// Diagnostic: real API requests and the application's processing, without browser rendering.
import {readFile,writeFile} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
import {areaOf} from '../src/core.js';
import {categoryValues,totalValues,planGroups} from '../src/group-selection.js';
import {splitQuery,detailedSeries,alignPeriods,resultGrid} from '../src/detailed-results.js';

const catalog=JSON.parse(await readFile(new URL('../data/search-catalog.json',import.meta.url),'utf8'));
const table={...catalog.find(t=>t.id==='primar')};
const stamp=()=>performance.now();
const metadataStart=stamp();
const metadataResponse=await fetch(table.url,{signal:AbortSignal.timeout(25000)});
if(!metadataResponse.ok)throw new Error(`Metadata HTTP ${metadataResponse.status}`);
table.metadata=await metadataResponse.json();
const metadataMs=stamp()-metadataStart;
const area=areaOf(table.metadata),age=table.metadata.variables.find(v=>v.code==='Ålder');
const selections=Object.fromEntries(table.metadata.variables.filter(v=>v.code!=='År').map(v=>[v.code,[area.code,age.code].includes(v.code)?categoryValues(v):totalValues(v)]));
const start=stamp();
const [group]=planGroups(table,selections[area.code],1984,2025,[{name:'',selections,separate:[area.code,age.code]}]);
const mode=process.argv[3]||'baseline',concurrency=Number(process.argv[4]||1);
if(!['baseline','packed'].includes(mode)||![1,2].includes(concurrency))throw new Error('Use baseline|packed and concurrency 1|2');
// Preserve the old algorithm for comparisons after production adopted packing.
function legacySplitQuery(query,separate,maxCells=100000){
  const count=query.query.reduce((n,v)=>n*v.selection.values.length,1);
  if(count<=maxCells)return [query];
  const dimension=query.query.filter(v=>separate.includes(v.code)&&v.selection.values.length>1).sort((a,b)=>b.selection.values.length-a.selection.values.length)[0];
  if(!dimension)throw new Error('Cannot split query');
  const size=Math.ceil(dimension.selection.values.length/2);
  return [dimension.selection.values.slice(0,size),dimension.selection.values.slice(size)].flatMap(values=>legacySplitQuery({...query,query:query.query.map(v=>v===dimension?{...v,selection:{...v.selection,values}}:v)},separate,maxCells));
}
const queries=(mode==='packed'?splitQuery:legacySplitQuery)(group.query,group.separate);
const report={measuredAt:new Date().toISOString(),mode,concurrency,runtime:process.version,table:table.title,metadataMs,dimensions:group.query.query.map(v=>({code:v.code,count:v.selection.values.length})),preparationMs:stamp()-start,requests:[]};
console.log(JSON.stringify({dimensions:report.dimensions,requests:queries.length}));
const series=[];
const parts=new Array(queries.length);
async function measurePart(i,query){
  const item={part:i+1,cells:query.query.reduce((n,v)=>n*v.selection.values.length,1),attempts:[],retryWaitMs:0};
  let payload;
  for(let attempt=0;attempt<3;attempt++){
    const begin=stamp();
    const response=await fetch(table.url,{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify(query),signal:AbortSignal.timeout(25000)});
    const headersAt=stamp(),body=await response.text(),bodyAt=stamp();
    try{payload=JSON.parse(body);}catch{throw new Error(`Invalid JSON, HTTP ${response.status}`);}
    item.attempts.push({status:response.status,headersMs:headersAt-begin,bodyMs:bodyAt-headersAt,parseMs:stamp()-bodyAt,bytes:Buffer.byteLength(body)});
    if(response.status===429||String(payload.error||'').includes('429')){
      if(attempt===2)throw new Error('API rate limit after retries');
      const waitStart=stamp();await new Promise(resolve=>setTimeout(resolve,12000));item.retryWaitMs+=stamp()-waitStart;continue;
    }
    if(!response.ok||payload.error)throw new Error(`API error HTTP ${response.status}: ${payload.error||''}`);
    break;
  }
  const processingStart=stamp();
  parts[i]=detailedSeries(payload,query,group,table);
  item.processingMs=stamp()-processingStart;
  report.requests.push(item);
  console.log(JSON.stringify(item));
}
let cursor=0,failed=false;
const workers=await Promise.allSettled(Array.from({length:concurrency},async()=>{
  while(!failed&&cursor<queries.length){const i=cursor++;try{await measurePart(i,queries[i]);}catch(error){failed=true;throw error;}}
}));
for(const worker of workers)if(worker.status==='rejected')throw worker.reason;
for(const part of parts)series.push(...part);
const alignStart=stamp();alignPeriods(series);report.alignMs=stamp()-alignStart;
const gridStart=stamp();const grid=resultGrid({series,table,unit:'Antal personer'});report.gridMs=stamp()-gridStart;
report.totalMs=stamp()-start;report.series=series.length;report.rows=grid.rows.length;
report.networkMs=report.requests.reduce((sum,r)=>sum+r.attempts.reduce((n,a)=>n+a.headersMs+a.bodyMs,0),0);
report.parseMs=report.requests.reduce((sum,r)=>sum+r.attempts.reduce((n,a)=>n+a.parseMs,0),0);
report.processingMs=report.requests.reduce((sum,r)=>sum+r.processingMs,0)+report.alignMs+report.gridMs;
report.retryWaitMs=report.requests.reduce((sum,r)=>sum+r.retryWaitMs,0);
report.bytes=report.requests.reduce((sum,r)=>sum+r.attempts.reduce((n,a)=>n+a.bytes,0),0);
// Compare canonical result values independent of request and series ordering.
const canonical=series.map(s=>[JSON.stringify(Object.entries(s.dimensionValues).sort(([a],[b])=>a.localeCompare(b))),s.rows.map(r=>[r.year,r.value])]).sort(([a],[b])=>a.localeCompare(b));
report.resultSha256=createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
report.requests.sort((a,b)=>a.part-b.part);
const output=process.argv[2];if(output)await writeFile(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,requests:report.requests.length},null,2));
