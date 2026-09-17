// Keep different category definitions and time coverage separate, even when titles match.
import {isAreaCode} from './core.js';
const normalizeLabel=value=>String(value).normalize('NFC').toLocaleLowerCase('sv').replace(/[–−]/g,'-').replace(/\s*-\s*/g,'-').replace(/\s+/g,' ').trim();
const dimensionName=name=>({
  'snibokstav 2007':'näringsgren', 'näringsgren (sni 2007)':'näringsgren',
  'tabellvärden':'tabellvärde', 'svensk/utländsk bakgrund':'bakgrund'
}[normalizeLabel(name)]||normalizeLabel(name));
function categoryLabel(name,value){
  const label=normalizeLabel(value);
  // Explicit synonyms only: age limits and missing categories stay significant.
  const synonyms={
    kön:{män:'man',kvinnor:'kvinna','total (man+kvinna)':'båda kön'},
    bakgrund:{'båda bakgrunder':'totalt (båda bakgrunder)','total (svensk+utländsk bakgrund)':'totalt (båda bakgrunder)','total (svensk+utländsk bakgr)':'totalt (båda bakgrunder)'},
    utbildningsnivå:{'förgymnasial utbildning':'förgymnasial','gymnasial utbildning':'gymnasial','eftergymnasial utbildning':'eftergymnasial','alla utbildningsnivåer':'totalt (alla utbildningsnivåer)','total (alla utbildniningsnivåer)':'totalt (alla utbildningsnivåer)'},
    ålder:{'total (18-år)':'18-år','totalt (18-år)':'18-år','18+ år':'18-år'}
  };
  return synonyms[name]?.[label]||label;
}
function groupingTitle(table){
  let title=normalizeLabel(table.title.replaceAll(',',' ')).replace(/^syselsatta /,'sysselsatta ');
  if(table.subject==='Befolkning'&&title.startsWith('antal hushåll efter hushållsstorlek och '))title=title.replace('och bostadens ','och ');
  if(table.subject==='Bostäder och byggande'&&/^nybygg(?:nation av|da färdigställda) bostäder efter bostadstyp och upplåtelseform /.test(title)){
    title=title.replace(/^nybyggda färdigställda /,'nybyggnation av ').replace(/ \(stadsbyggnadsförvaltningen\)$/,'');
  }
  return title;
}
function categorySignature(table){
  // Education metadata has been audited across all four geographic levels.
  // Its labels resolve differing API codes that the old catalog summary cannot.
  if(table.subject==='Utbildning'&&table.metadata?.variables)return table.metadata.variables
    .filter(v=>normalizeLabel(v.code)!=='område')
    .map(v=>[normalizeLabel(v.text||v.code),(v.valueTexts||v.values).map(normalizeLabel).sort()])
    .sort((a,b)=>a[0].localeCompare(b[0],'sv'));
  return (table.variables||'').split(' | ').filter(v=>!isAreaCode(v.split(':')[0].trim())).map(variable=>{
    const match=variable.match(/^([^:]+): \[(.*)\]$/);
    if(!match)return normalizeLabel(variable);
    const name=dimensionName(match[1]);
    const metadata=table.metadata?.variables.find(v=>v.code===match[1]);
    const values=match[2].split('; ').map(value=>{
      // Resolve opaque numeric codes only with the table's own source labels.
      const index=metadata?.values.indexOf(value);
      const label=/^\d+$/.test(value)&&index>=0?metadata.valueTexts?.[index]||value:value;
      return categoryLabel(name,label);
    }).sort();
    return JSON.stringify([name,values]);
  }).sort();
}
export function groupTables(tables){
  const groups=[],byKey=new Map();
  for(const table of tables){
    const title=groupingTitle(table);
    const subject=table.subject==='Inkomster'?'Inkomst':table.subject;
    const key=JSON.stringify([subject,title,categorySignature(table)]);
    const candidates=byKey.get(key)||[];
    let group=candidates.find(candidate=>!candidate.tables.some(t=>t.level===table.level));
    if(!group){group={...table,tables:[]};groups.push(group);candidates.push(group);byKey.set(key,candidates);}
    group.tables.push(table);
  }
  return groups;
}

export function tableSummary(table){
  const period=table.title.match(/\s*,?\s*((?:19|20)\d{2}\s*[-–]\s*(?:19|20)\d{2})(?:\s*,?\s*(\([^)]*\)))?$/);
  const title=period?table.title.slice(0,period.index).replace(/[,\s]+$/,''):table.title;
  const dimensions=(table.variables||'').split(' | ').map(v=>v.split(':')[0]).filter(v=>v&&!isAreaCode(v)&&v!=='År').join(', ');
  return {title,detail:[period?.[1].replace(/\s*[-–]\s*/,'–'),dimensions,period?.[2]].filter(Boolean).join(' · ')};
}

export const levelLabels={Kommun:'Hela Göteborg',Stadsområde:'Stadsområden',Mellanområde:'Mellanområden',Primärområde:'Primärområden',Basområde:'Basområden'};
