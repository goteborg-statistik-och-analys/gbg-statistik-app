import {normalize,labelOf,areaOf} from './core.js';
import {concepts,spelling,phrases} from './search-keywords.js';
const stop=new Set('vad har vi for statistik om finns det vilka tabeller tabell jag vill ha visa mig kan du ge fran till och under mellan ar aren i pa over kring hur manga antal utveckling utvecklingen jamfor jamfora med mot som bor se veta ta fram gar att aven alla totalt bada kon bland unga ungdomar aldre'.split(' '));
const levels={kommun:'Kommun',primaromrade:'Primärområde',mellanomrade:'Mellanområde',stadsomrade:'Stadsområde',basomrade:'Basområde'};
const cache=new WeakMap();
function indexCatalog(catalog){
  if(cache.has(catalog))return cache.get(catalog);
  const entries=catalog.map(table=>{
    const variable=table.metadata?areaOf(table.metadata):null;
    const labels=variable?variable.values.map((value,i)=>variable.valueTexts?.[i]||value):((table.variables||'').match(/Område: \[([^\]]*)\]/)?.[1]||'').split(';');
    return {table,areas:labels.map(label=>normalize(labelOf(label.trim()))),title:normalize(table.title),heading:normalize(table.title+' '+table.subject),body:normalize(table.title+' '+table.subject+' '+(table.variables||''))};
  });
  const names=[...new Set(entries.flatMap(e=>e.areas))].filter(name=>name.length>2&&name!=='goteborg').sort((a,b)=>b.length-a.length);
  const index={entries,names};cache.set(catalog,index);return index;
}
function removePhrase(text,phrase){
  const escaped=phrase.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return text.replace(new RegExp('(^|[^a-z0-9])'+escaped+'(?=$|[^a-z0-9])','g'),'$1 ');
}
export function findTables(text,catalog){
  const index=indexCatalog(catalog),q=normalize(text);
  const years=[...q.matchAll(/\b(?:19|20)\d{2}\b/g)].map(m=>Number(m[0]));
  let remaining=q.replace(/\b(?:19|20)\d{2}\b/g,' ');
  const agePattern=/\b(\d{1,3})\s*(?:[-–]|till)\s*(\d{1,3})\s*(?:ar|aring(?:ar)?)\b/g;
  const ages=[...remaining.matchAll(agePattern)];
  let age=ages.length===1?[Number(ages[0][1]),Number(ages[0][2])]:null;
  remaining=remaining.replace(agePattern,' ');
  if(!ages.length){const exact=remaining.match(/\b(\d{1,3})\s*(?:ar|aring(?:ar)?)\b/);if(exact){age=[Number(exact[1]),Number(exact[1])];remaining=remaining.replace(exact[0],' ');}}
  const sexes=[];
  if(/\b(kvinnor|kvinna|kvinnlig[a]?)\b/.test(remaining))sexes.push('female');
  const pronoun=/\b(?:kan|ska|skall|vill|bor|far|behover|gor) man\b/.test(q)&&!/\bmän\b/i.test(text);
  if(/\b(man|manlig[a]?)\b/.test(remaining)&&!pronoun)sexes.push('male');
  remaining=remaining.replace(/\b(kvinnor|kvinna|kvinnlig[a]?|man|manlig[a]?)\b/g,' ');
  const areas=[];
  for(const name of index.names){const stripped=removePhrase(remaining,name);if(stripped!==remaining){areas.push(name);remaining=stripped;}}
  const city=/\bgoteborg\b/.test(remaining);remaining=remaining.replace(/\bgoteborg\b/g,' ');
  for(const [pattern,replacement] of phrases)remaining=remaining.replace(pattern,replacement);
  let level='';
  let tokens=remaining.split(/[^a-z0-9]+/).filter(Boolean).map(token=>spelling[token]||token).filter(token=>!stop.has(token));
  tokens=tokens.filter(token=>{const key=Object.keys(levels).find(k=>token.startsWith(k));if(key){level=levels[key];return false;}return true;});
  const conceptFor=token=>concepts.find(c=>c.id==='forecast'&&c.query.test(token))||concepts.find(c=>c.query.test(token));
  const terms=tokens.map(token=>({token,concept:conceptFor(token)}));
  if(!terms.length&&(sexes.length||age||/\b(unga|ungdomar|aldre)\b/.test(q)))terms.push({token:'folkmangd',concept:concepts.find(c=>c.id==='population')});
  const results=index.entries.map(entry=>{
    const {table,title,heading,body}=entry;
    if(level&&table.level!==level)return null;
    if(areas.length&&!areas.every(area=>entry.areas.includes(area)))return null;
    let score=0;
    for(const {token,concept} of terms){
      if(concept){if(!concept.terms.some(term=>(concept.variables?body:heading).includes(term)))return null;score+=8;if(concept.prefer?.test(title))score+=12;}
      else if(!body.includes(token))return null;
      if(title.includes(token))score+=5;
    }
    if(city&&table.level==='Kommun')score+=4;
    if(age&&/alder/.test(body))score+=2;
    if(sexes.length&&/kon:/.test(body))score+=2;
    if(years.length&&years.every(year=>year>=table.years?.[0]&&year<=table.years?.at(-1)))score+=2;
    if(table.kind)score+=1;
    return {table,score};
  }).filter(Boolean).sort((a,b)=>b.score-a.score||a.table.title.localeCompare(b.table.title,'sv')).map(r=>r.table);
  const notes=[];
  if(/\blon(?:er)?\b/.test(q))notes.push('Lön och förvärvsinkomst är olika mått. Prova ”förvärvsinkomst” om det är det du söker.');
  if(ages.length>1)notes.push('Flera åldersintervall hittades. Skapa egna grupper efter tabellvalet.');
  if(areas.length>1||sexes.length>1)notes.push('Flera områden eller kön hittades. Välj jämförelse eller summering efter tabellvalet.');
  if(/barn|forskolealder|\b(unga|ungdomar|aldre)\b/.test(q)&&!terms.some(t=>t.concept?.id==='uvas'))notes.push('Kontrollera och välj den åldersgrupp du avser efter tabellvalet.');
  return {tables:results,years,level,topic:terms.find(t=>t.concept)?.concept.label||null,intent:{age,sexes,areas,city},notes};
}
