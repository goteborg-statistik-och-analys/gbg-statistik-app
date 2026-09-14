import {normalize,makeQuery,areaOf,labelOf,timeOf,isAreaCode} from './core.js';

export const groupDimensions=metadata=>metadata.variables.filter(v=>![timeOf(metadata)?.code,areaOf(metadata)?.code].includes(v.code));
export const valueLabel=(v,value)=>v.valueTexts?.[v.values.indexOf(value)]||value;
export function categoryValues(v){
  const all=totalValues(v);
  return all.length===1&&v.values.length>1?v.values.filter(value=>value!==all[0]):[...v.values];
}
const isTotal=label=>/^(totalt?\b|samtliga\b|alla\b|bada\b)/.test(normalize(label));
export function ageBounds(label){
  const match=label.trim().match(/^(\d+)\s*(?:([-–])\s*(\d*)|(\+))?\s*år$/);
  return match?[Number(match[1]),match[2]||match[4]?(match[3]?Number(match[3]):Infinity):Number(match[1])]:null;
}
export function validateValues(v,values){
  if(!values?.length||values.some(value=>!v.values.includes(value)))throw new Error(`Välj minst en kategori för ${v.text||v.code}.`);
  if(values.length>1&&values.some(value=>isTotal(valueLabel(v,value))))throw new Error(`${v.text||v.code}: välj totalen eller delgrupper, inte båda.`);
  if(normalize(v.code).includes('alder')){
    const ranges=values.map(value=>ageBounds(valueLabel(v,value))).filter(Boolean).sort((a,b)=>a[0]-b[0]);
    if(ranges.some((range,i)=>i&&range[0]<=ranges[i-1][1]))throw new Error('Åldersgrupperna överlappar. Välj separata åldersgrupper för att undvika dubbelräkning.');
  }
  return values;
}
export function totalValues(v){
  if(isAreaCode(v.code)){
    const city=v.values.find(value=>/^(goteborg|hela goteborg|hela kommunen)$/.test(normalize(labelOf(valueLabel(v,value)))));
    if(city)return [city];
  }
  const total=v.values.find(value=>isTotal(valueLabel(v,value)));
  if(total)return [total];
  const ranges=v.values.map(value=>ageBounds(valueLabel(v,value)));
  if(normalize(v.code).includes('alder')&&ranges.every(Boolean)){
    const encompassing=ranges.findIndex(r=>ranges.every(other=>r[0]<=other[0]&&r[1]>=other[1]));
    if(encompassing>=0)return [v.values[encompassing]];
  }
  return validateValues(v,[...v.values]);
}
export function ageRangeValues(v,start,end){
  if(!Number.isInteger(start)||!Number.isInteger(end)||start>end)throw new Error('Ange ett giltigt åldersintervall.');
  const entries=v.values.map(value=>({value,range:ageBounds(valueLabel(v,value))}));
  const chosen=entries.filter(({range})=>range&&range[0]>=start&&range[1]<=end).sort((a,b)=>a.range[0]-b.range[0]);
  let next=start;
  for(const {range} of chosen){if(range[0]!==next)throw new Error('Intervallet måste följa tabellens åldersindelning.');next=range[1]+1;}
  if(next!==end+1)throw new Error('Intervallet måste följa tabellens åldersindelning. Välj hela grupper i listan.');
  return chosen.map(entry=>entry.value);
}
export function selectionDetail(metadata,selections){
  return groupDimensions(metadata).map(v=>{
    const values=selections[v.code],labels=values.map(value=>valueLabel(v,value));
    let text=labels.join(', ');
    if(normalize(v.code).includes('alder')){
      const ranges=labels.map(ageBounds).filter(Boolean).sort((a,b)=>a[0]-b[0]);
      if(ranges.length===labels.length&&ranges.every((r,i)=>!i||r[0]===ranges[i-1][1]+1))text=ranges.at(-1)[1]===Infinity?`${ranges[0][0]} år och äldre`:`${ranges[0][0]}–${ranges.at(-1)[1]} år`;
    }else if(values.length===v.values.length&&values.length>1)text=v.code==='Månad'?'Alla månader (över tid)':'Alla kategorier';
    return `${v.text||v.code}: ${text}`;
  }).join(' · ');
}
export function planGroups(table,area,start,end,groups){
  if(!groups.length||groups.length>7)throw new Error('Välj mellan en och sju grupper.');
  // Only verified count tables may aggregate across categories.
  const additive=['population','education'].includes(table.kind)||table.measure?.additive===true;
  const areaCode=areaOf(table.metadata)?.code||'Område';
  const geographyVaries=new Set(groups.map(group=>JSON.stringify([...(group.selections[areaCode]??(Array.isArray(area)?area:[area]))].sort()))).size>1;
  return groups.map((group,i)=>{
    for(const code of table.measure?.noSum||[]){if((group.selections[code]?.length||0)>1&&!group.separate?.includes(code))throw new Error(code+': välj en kategori eller redovisa kategorierna separat. De får inte summeras.');}
    const dimension=areaOf(table.metadata),areas=group.selections[areaCode]??(Array.isArray(area)?area:[area]);
    const areaLabel=dimension?areas.map(value=>labelOf(valueLabel(dimension,value))).join(' + '):'Göteborg';
    const areaName=areaLabel.length>60?`${areas.length} områden`:areaLabel;
    for(const v of groupDimensions(table.metadata)){
      if(group.separate?.includes(v.code))for(const value of group.selections[v.code]||[])validateValues(v,[value]);
      else validateValues(v,group.selections[v.code]);
    }
    if(!additive&&((areas.length>1&&!group.separate?.includes(areaCode))||Object.entries(group.selections).some(([code,values])=>values.length>1&&!group.separate?.includes(code))))throw new Error('Detta mått kan inte summeras. Välj en kategori per dimension för jämförelse.');
    return {...group,customName:group.name.trim(),area:areaLabel,name:group.name.trim()||(dimension&&(geographyVaries||areas.length>1)?areaName:`Grupp ${i+1}`),detail:(dimension?`Område: ${areaLabel} · `:'')+selectionDetail(table.metadata,group.selections),query:makeQuery(table.metadata,areas,start,end,group.selections,{maxCells:group.separate?.length?1000000:100000})};
  });
}
