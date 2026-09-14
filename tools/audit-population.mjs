import {readFile,writeFile} from 'node:fs/promises';
const catalog=JSON.parse(await readFile('data/search-catalog.json','utf8'));
let results=[];try{results=JSON.parse(await readFile('data/population-audit.json','utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function request(url,body){
  for(let attempt=0;attempt<4;attempt++){
    await sleep(2100);
    const response=await fetch(url,{...(body?{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(25000)});
    const data=await response.json();if(response.status===429||String(data.error).includes('429')){await sleep(11000);continue;}
    if(!response.ok||data.error)throw new Error(JSON.stringify(data));return data;
  }throw new Error('Anropsgräns');
}
const priority=t=>/månadsvis|täthet|prognos|mot kommuner|^Göteborg,/.test(t.title)?0:1;
for(const table of catalog.filter(t=>t.subject==='Befolkning'&&!t.kind).sort((a,b)=>priority(a)-priority(b))){
  if(results.some(r=>r.id===table.id&&r.payload))continue;
  results=results.filter(r=>r.id!==table.id);
  try{
    const metadata=await request(table.url);
    const query={query:metadata.variables.map(v=>({code:v.code,selection:{filter:'item',values:[v.code==='År'||v.time?v.values.at(-1):v.values[0]]}})),response:{format:'json'}};
    const payload=await request(table.url,query);results.push({id:table.id,title:table.title,metadata,query,payload});
  }catch(error){results.push({id:table.id,title:table.title,error:error.message});}
  await writeFile('data/population-audit.json',JSON.stringify(results,null,2));
}
console.log(JSON.stringify({checked:results.filter(r=>r.payload).length,failed:results.filter(r=>r.error)}));
