// Keep different category definitions and time coverage separate, even when titles match.
export function groupTables(tables){
  const groups=[],byKey=new Map();
  for(const table of tables){
    const variables=(table.variables||'').split(' | ').filter(v=>!v.startsWith('Område:')).sort();
    const key=JSON.stringify([table.subject,table.title,variables]);
    const candidates=byKey.get(key)||[];
    let group=candidates.find(candidate=>!candidate.tables.some(t=>t.level===table.level));
    if(!group){group={...table,tables:[]};groups.push(group);candidates.push(group);byKey.set(key,candidates);}
    group.tables.push(table);
  }
  return groups;
}

export function tableSummary(table){
  const period=table.title.match(/\s*,?\s*((?:19|20)\d{2}[-–](?:19|20)\d{2})(?:\s*(\([^)]*\)))?$/);
  const title=period?table.title.slice(0,period.index).replace(/[,\s]+$/,''):table.title;
  const dimensions=(table.variables||'').split(' | ').map(v=>v.split(':')[0]).filter(v=>v&&v!=='Område'&&v!=='År').join(', ');
  return {title,detail:[period?.[1].replace('-', '–'),dimensions,period?.[2]].filter(Boolean).join(' · ')};
}

export const levelLabels={Kommun:'Hela Göteborg',Stadsområde:'Stadsområden',Mellanområde:'Mellanområden',Primärområde:'Primärområden',Basområde:'Basområden'};
