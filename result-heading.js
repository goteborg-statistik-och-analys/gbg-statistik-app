import {selectionDetail,groupDimensions,totalValues,valueLabel} from './group-selection.js';
import {tableSummary} from './catalog-groups.js';
import {escapeXML as esc,areaOf,labelOf} from './core.js';

export function resultHeading(result){
  const title=result.table?.title?tableSummary(result.table).title:result.measure;
  const metadata=result.table?.metadata,groups=result.groups||[],selections=groups[0]?.selections;
  if(!metadata||!selections)return {title,selection:''};
  const dimensions=groupDimensions(metadata);
  const restricted=new Set(dimensions.filter(v=>{
    const chosen=selections[v.code]||[];
    if(!chosen.length)return false;
    // Only shared filters belong in the heading of a comparison.
    if(groups.some(group=>group.selections?.[v.code]?.length!==chosen.length||!chosen.every(value=>group.selections[v.code].includes(value))))return false;
    let total;try{total=totalValues(v);}catch{total=v.values;}
    return chosen.length!==total.length||!total.every(value=>chosen.includes(value));
  }).map(v=>v.code));
  const selection=selectionDetail({...metadata,variables:metadata.variables.filter(v=>!dimensions.includes(v)||restricted.has(v.code))},selections);
  return {title,selection};
}
export function resultHeadingText(result){
  const {title,selection}=resultHeading(result);
  return [title,selection].filter(Boolean).join(' · ');
}
export function visualHeading(result){
  const {title,selection}=resultHeading(result);
  return `<div class="visual-heading"><h3>${esc(title)}</h3>${selection?`<p>${esc(selection)}</p>`:''}</div>`;
}
export function resultAreaLabel(result){
  const dimension=result.table?.metadata&&areaOf(result.table.metadata);
  if(!dimension)return result.area||'Göteborg';
  const areas=[...new Set((result.groups||[]).flatMap(group=>group.selections?.[dimension.code]||[]))];
  if(areas.length>1)return `${areas.length} valda områden`;
  return areas.length===1?labelOf(valueLabel(dimension,areas[0])):result.area||'Göteborg';
}
