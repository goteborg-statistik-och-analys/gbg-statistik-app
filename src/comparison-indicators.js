import {comparisonValue} from './comparison-data.js';

export const ageGroups=[...Array.from({length:20},(_,i)=>[`${i*5}–${i*5+4} år`,i*5,i*5+4]),['100+ år',100,100]];
export const percentage=(part,total)=>Number.isFinite(part)&&Number.isFinite(total)&&total>0?100*part/total:null;
export function withNationalReference(areas,{enabled,panel,growthMeasure='growthRate'}){
  return enabled&&(panel==='ages'||panel==='dependencyRatio'||panel==='growth'&&growthMeasure==='growthRate')?[...areas,{code:'00',name:'Riket',slot:4}]:areas;
}
export function indicator(snapshot,context,region,year,measure){
  if(measure==='nationalShare')return percentage(comparisonValue(snapshot,{region,year}).value,context.country.population[context.country.years.indexOf(year)]);
  if(measure==='growthRate'){
    const previous=year===snapshot.years[0]?context.baseline1999[region]:comparisonValue(snapshot,{region,year:year-1}).value;
    return percentage(comparisonValue(snapshot,{region,year,measure:'growth'}).value,previous);
  }
  return comparisonValue(snapshot,{region,year,measure}).value;
}
// Competition ranks: equal unrounded values receive the same rank. Names only order ties.
export function rankMunicipalities(context,areas,{scope='all',measure='growth',direction='desc'}={}){
  if(!['growth','growthRate'].includes(measure)||!['asc','desc'].includes(direction))throw Error('Ogiltig rangordning.');
  const eligible=new Set(areas.filter(area=>scope==='selected'||area.groups.includes(scope)).map(area=>area.code));
  const rows=context.ranking.filter(row=>scope==='all'||eligible.has(row.code)).map(row=>({...row,growthRate:percentage(row.growth,row.populationPrevious)})).filter(row=>Number.isFinite(row[measure]));
  rows.sort((a,b)=>(direction==='desc'?b[measure]-a[measure]:a[measure]-b[measure])||a.name.localeCompare(b.name,'sv'));
  let rank=0;
  return rows.map((row,index)=>{if(!index||row[measure]!==rows[index-1][measure])rank=index+1;return {...row,rank};});
}

export function growthSummary(context,areas,scope='all'){
  const rows=rankMunicipalities(context,areas,{scope});
  return {total:rows.length,increased:rows.filter(r=>r.growth>0).length,decreased:rows.filter(r=>r.growth<0).length,unchanged:rows.filter(r=>r.growth===0).length};
}
