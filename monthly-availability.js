import {monthNumber} from './core.js';
// Probe the whole population, not the selected subgroup: a subgroup may genuinely be zero.
export function monthlyAvailabilityQuery(metadata,start,end){
  return {query:metadata.variables.map(v=>({code:v.code,selection:{filter:'item',values:v.code==='År'?v.values.filter(y=>Number(y)>=start&&Number(y)<=end):v.values}})),response:{format:'json'}};
}
export function populatedMonths(payload){
  if(!Array.isArray(payload.columns)||!Array.isArray(payload.data))throw new Error('Månadsstatistikens tillgänglighet kunde inte kontrolleras.');
  const columns=payload.columns.filter(c=>c.type!=='c'),year=columns.findIndex(c=>c.code==='År'),month=columns.findIndex(c=>c.code==='Månad');
  if(year<0||month<0)throw new Error('År eller månad saknas i källsvaret.');
  return new Set(payload.data.filter(r=>Number(r.values?.[0])>0).map(r=>`${r.key[year]}-${String(monthNumber(r.key[month])).padStart(2,'0')}`));
}
