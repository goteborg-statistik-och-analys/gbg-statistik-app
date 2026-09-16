import {aggregate,areaOf,labelOf,periodOf} from './core.js';
import {valueLabel,selectionDetail} from './group-selection.js';
export function alignPeriods(series){
  const periods=[...new Map(series.flatMap(s=>s.rows.map(r=>[r.year,{year:r.year,...(r.period?{period:r.period}:{})}]))).values()].sort((a,b)=>a.year-b.year);
  for(const s of series){const rows=new Map(s.rows.map(r=>[r.year,r]));s.rows=periods.map(p=>rows.get(p.year)||{...p,value:null});}
  return series;
}
export function splitQuery(query,separate,maxCells=100000){
  const count=query.query.reduce((n,v)=>n*v.selection.values.length,1);
  if(count<=maxCells)return [query];
  const dimension=query.query.filter(v=>separate.includes(v.code)&&v.selection.values.length>1).sort((a,b)=>b.selection.values.length-a.selection.values.length)[0];
  if(!dimension)throw new Error('Urvalet är för stort per serie. Välj färre år eller kategorier att summera.');
  const size=Math.ceil(dimension.selection.values.length/2);
  return [dimension.selection.values.slice(0,size),dimension.selection.values.slice(size)].flatMap(values=>splitQuery({...query,query:query.query.map(v=>v===dimension?{...v,selection:{...v.selection,values}}:v)},separate,maxCells));
}
export function detailedSeries(payload,query,group,table){
  if(!Array.isArray(payload.columns)||!Array.isArray(payload.data))throw new Error('Statistikdatabasen svarade med ett oväntat format.');
  const separate=group.separate||[];
  if(!separate.length)return [{name:group.name,area:group.area,detail:group.detail,dimensions:{},rows:aggregate(payload,query,table.measure)}];
  const dimensions=payload.columns.filter(c=>c.type!=='c');
  const buckets=new Map();
  for(const row of payload.data){const key=JSON.stringify(separate.map(code=>row.key[dimensions.findIndex(d=>d.code===code)]));if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(row);}
  let combinations=[{}];
  for(const code of separate)combinations=combinations.flatMap(combo=>query.query.find(v=>v.code===code).selection.values.map(value=>({...combo,[code]:value})));
  return combinations.map(combo=>{
    const selections={...group.selections,...Object.fromEntries(Object.entries(combo).map(([code,value])=>[code,[value]]))};
    const labels=Object.fromEntries(Object.entries(combo).map(([code,value])=>[code,valueLabel(table.metadata.variables.find(v=>v.code===code),value)]));
    const local={...query,query:query.query.map(v=>combo[v.code]!==undefined?{...v,selection:{...v.selection,values:[combo[v.code]]}}:v)};
    const area=areaOf(table.metadata),areaText=area&&combo[area.code]!==undefined?labelOf(labels[area.code]):group.area;
    const detail=(area?`Område: ${areaText} · `:'')+selectionDetail(table.metadata,selections);
    return {name:(group.customName?group.customName+' · ':'')+Object.values(labels).join(' · '),area:areaText,detail,dimensions:labels,dimensionValues:combo,rows:aggregate({...payload,data:buckets.get(JSON.stringify(separate.map(code=>combo[code])))||[]},local,table.measure)};
  });
}
export function resultGrid(result){
  const codes=[...new Set(result.series.flatMap(s=>Object.keys(s.dimensions||{})))].filter(code=>code!==(result.table?.metadata?areaOf(result.table.metadata)?.code:'Område'));
  return {headers:[result.series[0]?.rows[0]?.period?'Period':'År','Område',...codes,'Grupp','Urval',result.unit||'Antal personer'],
    rows:result.series.flatMap(s=>s.rows.map(r=>[periodOf(r),s.area||result.area,...codes.map(code=>s.dimensions?.[code]||'Summerat urval'),s.name,s.detail,r.value]))};
}
