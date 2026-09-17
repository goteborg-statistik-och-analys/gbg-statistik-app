export const normalize = s => s.toLocaleLowerCase('sv').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
export const timeOf = m => m.variables.find(v=>v.code==='År')||m.variables.find(v=>v.code==='Prognosår');
export const yearsOf = m => timeOf(m).values.map(Number).sort((a,b)=>a-b);
export const periodOf = row => row.period||row.year;
export function monthNumber(value){
  const months=['januari','februari','mars','april','maj','juni','juli','augusti','september','oktober','november','december'];
  const index=months.indexOf(normalize(value));
  if(index>=0)return index+1;
  const number=Number(value);if(Number.isInteger(number)&&number>=1&&number<=12)return number;
  throw new Error('Okänd månadsindelning i källtabellen.');
}
export const isAreaCode = code => /^(Område|Primärområde|Mellanområde|Stadsområde|Basområde)(?:\s*\d.*)?$/.test(code);
export const areaOf = m => m.variables.find(v=>v.code==='Område')||m.variables.find(v=>isAreaCode(v.code));
export const labelOf = v => v.replace(/^(?:SO\s*)?\d+\s+/i,'');
export function interpret(text,catalog){
  const q=normalize(text), years=[...q.matchAll(/\b(?:19|20)\d{2}\b/g)].map(m=>Number(m[0]));
  const matches=[];
  for(const table of catalog) for(const value of areaOf(table.metadata)?.values || []){
    const label=normalize(labelOf(value));
    if(label.length>2 && new RegExp('(?:^|[^a-z])'+label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?:$|[^a-z])').test(q)) matches.push({table:table.id,value,label});
  }
  const subject=/folkm|befolk|invanare|personer|manniskor/.test(q);
  const unsupported=/arbetslos|inkomst|utbildning|prognos|flytt|bostad|hushall|fodd|dod|medelalder|andel/.test(q);
  const subgroup=/kvinn|\bman\b|flick|pojk|barn|alder|aldre|yngre|\b\d{1,3}\s*(?:[-–]\s*\d{1,3}\s*)?(?:ar|aring)/.test(q);
  const browse=/tabell|vad finns|vilka|vad har/.test(q) && !matches.length;
  const city=/goteborg|kommun/.test(q);
  return {years, matches, browse, unsupported, subgroup, supported:!unsupported&&(subject||matches.length>0||city), city};
}
export function makeQuery(metadata,area,start,end,selections=null,{maxCells=100000}={}){
  const available=yearsOf(metadata);
  const timeCode=timeOf(metadata).code;
  if(!Number.isInteger(start)||!Number.isInteger(end)||start>end) throw new Error('Ange ett giltigt årintervall. Från år måste vara före eller samma som till år.');
  const years=Array.from({length:end-start+1},(_,i)=>String(start+i));
  if(years.some(y=>!available.includes(Number(y)))) throw new Error(`Tabellen innehåller åren ${available[0]}–${available.at(-1)}. Ändra urvalet för att fortsätta.`);
  const dimensions=areaOf(metadata);
  const areas=Array.isArray(area)?area:[area];
  if(dimensions&&(!areas.length||new Set(areas).size!==areas.length||areas.some(value=>!dimensions.values.includes(value)))) throw new Error('Välj ett eller flera olika områden som finns i tabellen.');
  if(dimensions&&areas.length>1&&areas.some(value=>/^(goteborg|hela goteborg|hela kommunen|totalt?|samtliga)(\b|$)/.test(normalize(labelOf(dimensions.valueTexts?.[dimensions.values.indexOf(value)]||value)))))throw new Error('Välj hela Göteborg eller delområden, inte båda i samma summa.');
  const valuesOf=v=>selections?(Array.isArray(selections[v.code])?selections[v.code]:[selections[v.code]]):v.values;
  if(selections)for(const v of metadata.variables.filter(v=>![timeCode,dimensions?.code].includes(v.code))){
    const values=valuesOf(v);
    if(!values.length||new Set(values).size!==values.length||values.some(value=>!v.values.includes(value)))throw new Error(`Välj ${v.text||v.code} innan du hämtar statistiken.`);
  }
  const query=metadata.variables.map(v=>({code:v.code,selection:{filter:'item',values:v.code===timeCode?years:v.code===dimensions?.code?areas:valuesOf(v)}}));
  const count=query.reduce((n,v)=>n*v.selection.values.length,1);
  if(count>maxCells)throw new Error('Urvalet är för stort. Välj färre områden, år eller kategorier.');
  return {query,response:{format:'json'}};
}
export function aggregate(payload,query,{allowNegative=false,monthly=false}={}){
  if(!Array.isArray(payload.columns)||!Array.isArray(payload.data))throw new Error('Statistikdatabasen svarade med ett oväntat format.');
  const timeCode=query.query.find(v=>['År','Prognosår'].includes(v.code))?.code;
  const dimensions=payload.columns.filter(c=>c.type!=='c'), yi=dimensions.findIndex(c=>c.code===timeCode),mi=dimensions.findIndex(c=>c.code==='Månad');
  if(yi<0)throw new Error('Årtal saknas i svaret.');
  const years=query.query.find(v=>v.code===timeCode).selection.values;
  const months=monthly?query.query.find(v=>v.code==='Månad').selection.values:[null];
  const expected=query.query.filter(v=>v.code!==timeCode&&!(monthly&&v.code==='Månad')).reduce((n,v)=>n*v.selection.values.length,1);
  const keyOf=(year,month)=>monthly?`${year}-${String(monthNumber(month)).padStart(2,'0')}`:year;
  const groups=new Map(years.flatMap(y=>months.map(month=>[keyOf(y,month),{year:Number(y)+(monthly?(monthNumber(month)-1)/12:0),...(monthly?{period:keyOf(y,month)}:{}),value:0,count:0,missing:false,keys:new Set()}])));
  for(const row of payload.data){
    const group=groups.get(keyOf(row.key[yi],row.key[mi])); if(!group)throw new Error('Svaret innehåller oväntade år eller månader.');
    const key=JSON.stringify(row.key);if(group.keys.has(key))throw new Error('Svaret innehåller dubbla värden.');group.keys.add(key);
    const raw=row.values?.[0], value=typeof raw==='number'?raw:typeof raw==='string'&&raw.trim()!==''?Number(raw):NaN;
    if(!Number.isFinite(value)||(!allowNegative&&value<0))group.missing=true;else group.value+=value;
    group.count++;
  }
  return [...groups.values()].sort((a,b)=>a.year-b.year).map(g=>({year:g.year,...(g.period?{period:g.period}:{}),value:g.missing||g.count!==expected?null:g.value}));
}
export const escapeXML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export function csv(rows,area,source,date,measure='Folkmängd',selection='Alla åldrar; båda könen',notes='',unit='Antal personer'){
  const quote=value=>'"'+String(value).replace(/"/g,'""')+'"';
  return '\uFEFF'+[[rows[0]?.period?'Period':'År','Område',measure,'Enhet','Urval','Källa','Hämtad','Anmärkningar'],...rows.map(r=>[periodOf(r),area,r.value===null?'':r.value,unit,selection,source,date,notes])].map(row=>row.map(quote).join(';')).join('\r\n');
}
