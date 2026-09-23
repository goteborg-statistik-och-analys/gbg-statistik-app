import {normalize,yearsOf,timeOf,areaOf,makeQuery} from './core.js';
import {totalValues,valueLabel} from './group-selection.js';

export function historySource(table,catalog){
  return table.measure?.forecast?catalog.find(t=>t.level===table.level&&t.kind&&/^Folkmängd \d{4}-\d{4} \(SCB\)$/.test(t.title)):undefined;
}
const key=label=>({man:'male',kvinna:'female',kvinnor:'female'}[normalize(label)]||normalize(label));
export function historyQuery(forecast,history,series){
  const start=yearsOf(forecast.metadata)[0],years=yearsOf(history.metadata).filter(y=>y>=start-10&&y<start);
  if(!years.length)throw new Error('Det finns inga historiska år före prognosen i folkmängdstabellen.');
  const selections={},sourceArea=areaOf(forecast.metadata),targetArea=areaOf(history.metadata);
  for(const target of history.metadata.variables){
    if(target.code===timeOf(history.metadata).code)continue;
    const source=target===targetArea?sourceArea:forecast.metadata.variables.find(v=>v.code===target.code);
    if(!source){
      if(target.code!=='Kön')throw new Error('Historiken saknar ett jämförbart urval för '+target.code+'.');
      selections[target.code]=totalValues(target);continue;
    }
    const chosen=series.dimensionValues?.[source.code]!==undefined?[series.dimensionValues[source.code]]:series.group.query.query.find(v=>v.code===source.code)?.selection.values;
    if(!chosen?.length)throw new Error('Historikens urval kunde inte matchas för '+source.code+'.');
    selections[target.code]=[...new Set(chosen.flatMap(value=>{
      const label=valueLabel(source,value);
      if(target.code==='Kön'&&/^totalt?\b|^båda\b/i.test(label))return totalValues(target);
      const match=target.values.find(v=>key(valueLabel(target,v))===key(label));
      if(match===undefined)throw new Error('Historiken kan inte matcha '+label+'. Prognosen behålls utan historik.');
      return [match];
    }))];
  }
  return makeQuery(history.metadata,selections[targetArea?.code],years[0],years.at(-1),selections);
}

export function combineHistory(snapshot,historical,source){
  const forecastStart=yearsOf(snapshot.table.metadata)[0];
  const series=snapshot.series.map((s,i)=>{
    const rows=new Map([...historical[i],...s.rows].map(r=>[r.year,r]));
    // Preserve gaps when the user selected a later forecast interval.
    const first=Math.min(...rows.keys()),last=Math.max(...rows.keys());
    return {...s,rows:Array.from({length:last-first+1},(_,j)=>rows.get(first+j)||{year:first+j,value:null})};
  });
  return {...snapshot,series,rows:series[0].rows,forecastStart,historySource:source,withoutHistory:snapshot,measure:'Folkmängd och befolkningsprognos',notes:snapshot.notes+' Historik: '+source.title+' ('+source.url+'). Samma områden, åldrar och kön som prognosurvalet. Prognos från '+forecastStart+'.'};
}
