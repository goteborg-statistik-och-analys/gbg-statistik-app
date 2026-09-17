import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const skill=await readFile('C:/Users/robnor2002/.codex/skills/gbg-api/SKILL.md','utf8');
const prior=JSON.parse(await readFile('data/search-catalog.json','utf8'));
const live=JSON.parse(await readFile('data/catalog.json','utf8'));
const pattern=/\*\*([^\n]+)\*\*\r?\n- Nivå: ([^\r\n]+)\r?\n- URL: `([^`]+)`\r?\n- Variabler: ([^\r\n]+)/g;
const catalog=[...skill.matchAll(pattern)].map(([,title,level,url,variables])=>{
  const existing=live.find(t=>t.url===url);
  const parts=decodeURIComponent(url).split('/');
  const subject=parts.includes('Utbildning')?'Utbildning':parts.includes('Inkomst och utbildning')?'Inkomst':parts.includes('Arbetsmarknad')?'Arbetsmarknad':parts.includes('Befolkning')?'Befolkning':parts.includes('Bostäder')?'Bostäder':parts.at(-3);
  const years=[...title.matchAll(/\b(?:19|20)\d{2}\b/g)].map(m=>Number(m[0]));
  const encoded=url.split('/api/v1/sv/')[1].split('/');
  const webUrl=`https://statistikdatabas.goteborg.se/pxweb/sv/${encoded[0]}/${encoded.slice(0,-1).join('__')}/${encoded.at(-1)}/`;
  return {id:existing?.id||createHash('sha256').update(url).digest('hex').slice(0,12),title,level,url,subject,variables,years,webUrl,kind:existing?'population':null,...(existing?{metadata:existing.metadata}: {})};
});
const education=catalog.filter(t=>/Högsta utbildningsnivå/.test(t.title)&&['Kommun','Primärområde'].includes(t.level)||/Gymnasiebehörighet/.test(t.title)&&t.level==='Primärområde');
for(const t of education)t.kind='education';
for(const table of catalog){const saved=prior.find(t=>t.url===table.url);if(saved?.metadata)table.metadata=saved.metadata;if(saved?.kind==='count'||saved?.kind==='education'){table.kind=saved.kind;table.measure=saved.measure;}if(saved?.sourceNotes)table.sourceNotes=saved.sourceNotes;}
await writeFile('data/search-catalog.json',JSON.stringify(catalog,null,2));
console.log(JSON.stringify({count:catalog.length,education:education.map(t=>({id:t.id,url:t.url,title:t.title}))},null,2));
