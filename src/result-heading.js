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
// SVGs preserve their aspect ratio and can have horizontal space around the
// drawing. Align the HTML heading with the rendered subtitle, not the SVG box.
export function alignVisualHeadings(panel){
  let frame;
  const update=()=>{
    cancelAnimationFrame(frame);
    frame=requestAnimationFrame(()=>{
      for(const heading of panel.querySelectorAll('.visual-heading')){
        const sibling=heading.nextElementSibling;
        const svg=sibling?.matches('.chart-viewport')?sibling.querySelector('svg'):sibling;
        if(svg?.tagName.toLowerCase()!=='svg'||!svg.getBoundingClientRect().width)continue;
        const subtitle=svg.querySelector('text'),matrix=subtitle?.getScreenCTM();
        if(!matrix)continue;
        const point=svg.createSVGPoint();
        point.x=Number(subtitle.getAttribute('x'));point.y=Number(subtitle.getAttribute('y'));
        const left=point.matrixTransform(matrix).x-heading.getBoundingClientRect().left;
        heading.style.paddingLeft=`${Math.max(0,left)}px`;
      }
    });
  };
  const resize=new ResizeObserver(update);
  const observe=()=>{
    resize.disconnect();resize.observe(panel);
    for(const svg of panel.querySelectorAll('.chart-viewport>svg,.map-canvas>svg'))resize.observe(svg);
    update();
  };
  new MutationObserver(records=>{
    if(records.some(record=>record.target.matches?.('#chart,.chart-viewport,.map-canvas')))observe();
  }).observe(panel,{childList:true,subtree:true});
  observe();
}
export function resultAreaLabel(result){
  const dimension=result.table?.metadata&&areaOf(result.table.metadata);
  if(!dimension)return result.area||'Göteborg';
  const areas=[...new Set((result.groups||[]).flatMap(group=>group.selections?.[dimension.code]||[]))];
  if(areas.length>1)return `${areas.length} valda områden`;
  return areas.length===1?labelOf(valueLabel(dimension,areas[0])):result.area||'Göteborg';
}
