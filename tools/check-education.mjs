// Run from the project root. Audit all education tables before enabling them.
import {readFile,writeFile} from 'node:fs/promises';
const catalog=JSON.parse(await readFile('data/search-catalog.json','utf8'));
const sourceOnly=process.argv.includes('--source-only');
const entries=sourceOnly?JSON.parse(await readFile('data/education-audit.json','utf8')):[];
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function request(url,query,px=false){
  for(let attempt=0;attempt<4;attempt++){
    await sleep(1200);
    const response=await fetch(url,{signal:AbortSignal.timeout(25000),...(query?{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify(query)}:{})});
    if(response.status===429){await sleep(11000);continue;}
    if(!response.ok)throw new Error(`HTTP ${response.status}: ${url}`);
    return px?new TextDecoder('windows-1252').decode(await response.arrayBuffer()):response.json();
  }
  throw new Error('API-anropsgränsen nåddes');
}
for(const table of sourceOnly?[]:catalog.filter(t=>t.subject==='Utbildning')){
  const metadata=await request(table.url);
  const query={query:metadata.variables.map(v=>({code:v.code,selection:{filter:'item',values:[v.time?v.values.at(-1):v.values[0]]}})),response:{format:'json'}};
  const payload=await request(table.url,query);
  entries.push({id:table.id,title:table.title,level:table.level,url:table.url,checkedAt:new Date().toISOString(),metadata,query,payload});
  await writeFile('data/education-audit.json',JSON.stringify(entries,null,2));
  console.log(`${entries.length}: ${table.level} · ${table.title}`);
}
for(const entry of entries){
  const px=await request(entry.url,{...entry.query,response:{format:'px'}},true);
  entry.sourceUnit=px.match(/UNITS="([^"]+)";/)?.[1];
  entry.sourceNotes=[...px.matchAll(/(?:^|\n)NOTE(?:X)?="((?:""|[^"])*)";/g)].map(match=>match[1].replaceAll('""','"').replaceAll('#','\n').trim());
  if(!entry.sourceUnit)throw new Error(`Enhet saknas: ${entry.title}`);
  await writeFile('data/education-audit.json',JSON.stringify(entries,null,2));
  console.log(`Enhet: ${entry.sourceUnit} · ${entry.level} · ${entry.title}`);
}
