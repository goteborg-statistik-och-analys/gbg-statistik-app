import {escapeXML as esc,periodOf} from './core.js';
import {resultHeading,resultAreaLabel} from './result-heading.js';
import {animateChartEntrance} from './chart-animation.js';
const colors=['#008391','#674b99','#d24723','#3f5564','#008767','#d53878','#ffcd37'];
const dashes=['','9 4','3 4','12 4 3 4','2 3','8 3 2 3','14 5'];
const fmt=value=>new Intl.NumberFormat('sv-SE').format(value);
export function chartDescriptions(series){
  if(!series.length)return '';
  return `<details class="chart-descriptions"><summary>Visa urval per serie</summary><ul>${series.map((s,i)=>`<li><svg width="32" height="12" viewBox="0 0 32 12" aria-hidden="true"><line x1="0" x2="32" y1="6" y2="6" stroke="${colors[i]}" stroke-width="3" stroke-dasharray="${dashes[i]}"/></svg><span><strong>${i+1}. ${esc(s.name)}</strong> · ${esc(s.detail)}</span></li>`).join('')}</ul></details>`;
}
export function chartPeriods(series,populated){
  if(!series.some(s=>s.rows.some(r=>r.period)))return series;
  const available=new Set(series.flatMap(s=>s.rows.filter(r=>r.value!==null&&(!populated||populated.has(r.period))).map(r=>r.year)));
  return series.map(s=>({...s,rows:s.rows.filter(r=>available.has(r.year))}));
}
function wrap(text,length=105){
  const lines=[''];
  for(const word of text.split(/\s+/)){if((lines.at(-1)+' '+word).length>length&&lines.at(-1))lines.push('');lines[lines.length-1]+=(lines.at(-1)?' ':'')+word;}
  return lines;
}
export function seriesChart({series,area,table,measure,date,groups,unit='Antal personer',includeHeading=true,includeDescriptions=true,layoutHeight}){
  if(series.length>7)throw new Error('Diagrammet kan visa högst sju linjer.');
  const caption=resultHeading({table,measure,groups});
  const geography=includeHeading?[table.level,resultAreaLabel({table,groups,area})].filter(Boolean).join(' · '):table.level;
  const titleLines=includeHeading?wrap(caption.title,62):[],selectionLines=includeHeading&&caption.selection?wrap(caption.selection,105):[];
  const headerShift=includeHeading?(titleLines.length-1)*27+selectionLines.length*20:0;
  const responsive=!includeHeading&&!includeDescriptions&&Number.isFinite(layoutHeight);
  const width=1000,left=88,right=250,top=(includeHeading?115:65)+headerShift;
  const footer=responsive?65:100;
  const plotHeight=responsive?Math.max(60,layoutHeight-top-footer):300,bottom=top+plotHeight;
  const rows=series[0].rows,start=rows[0].year,end=rows.at(-1).year;
  const values=series.flatMap(s=>s.rows.filter(r=>r.value!==null).map(r=>r.value));
  const max=Math.max(...values,1),min=Math.min(...values,0),magnitude=10**Math.floor(Math.log10(Math.max(max,-min))),limit=Math.ceil(max/magnitude*2)/2*magnitude,lower=Math.floor(min/magnitude*2)/2*magnitude;
  const x=year=>left+(year-start)/(end-start||1)*(width-left-right),y=value=>top+(limit-value)/(limit-lower)*plotHeight;
  const descriptions=includeDescriptions?series.flatMap((s,i)=>wrap(`${i+1}. ${s.name}: ${s.detail||''}`).map(text=>({text,index:i}))):[];
  const height=bottom+footer+descriptions.length*18;
  const header=titleLines.map((line,i)=>`<text x="${left}" y="${30+i*27}" font-size="22" font-weight="800">${esc(line)}</text>`).join('')+selectionLines.map((line,i)=>`<text x="${left}" y="${54+(titleLines.length-1)*27+i*20}" font-size="14" font-weight="700">${esc(line)}</text>`).join('');
  let svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" data-plot-top="${top}" data-plot-bottom="${bottom}" role="img" aria-label="${esc([caption.title,caption.selection,area].filter(Boolean).join(' · '))}" aria-describedby="chart-desc"><desc id="chart-desc">${series.length} grupper, ${periodOf(rows[0])}–${periodOf(rows.at(-1))}. ${esc(unit)}. Linjeavbrott betyder saknad uppgift. Exakta värden och urval finns i tabellen.</desc><rect width="${width}" height="${height}" fill="#ffffff"/><g font-family="Open Sans, Arial, sans-serif" fill="#1f1f1f">${header}<text x="${left}" y="${includeHeading?56+headerShift:24}" font-size="13">${esc(geography)} · ${periodOf(rows[0])}–${periodOf(rows.at(-1))}</text><text x="${left}" y="${includeHeading?88+headerShift:46}" font-size="12">${esc(unit)}</text>`;
  for(let i=0;i<=4;i++){const value=lower+(limit-lower)*i/4;svg+=`<line x1="${left}" y1="${y(value)}" x2="${width-right}" y2="${y(value)}" stroke="#d1d9dc"/><text x="${left-12}" y="${y(value)+5}" text-anchor="end" font-size="12">${esc(fmt(value))}</text>`;}
  const indices=[...new Set([0,Math.round((rows.length-1)/4),Math.round((rows.length-1)/2),Math.round(3*(rows.length-1)/4),rows.length-1])];
  for(const i of indices)svg+=`<text x="${x(rows[i].year)}" y="${bottom+28}" text-anchor="middle" font-size="12">${periodOf(rows[i])}</text>`;
  // Keep end labels apart while retaining the connection to each line.
  const endings=series.map((s,i)=>({i,last:s.rows.findLast(r=>r.value!==null)})).filter(s=>s.last).sort((a,b)=>y(a.last.value)-y(b.last.value));
  const labelGap=responsive?Math.min(48,plotHeight/Math.max(1,endings.length-1)):48;
  let previous=top-labelGap;
  for(const ending of endings){ending.labelY=Math.max(y(ending.last.value),previous+labelGap);previous=ending.labelY;}
  if(responsive){
    // Work backwards from the bottom so a crowded label column never pushes
    // the first area name above the plot into the subtitle.
    let next=bottom+labelGap;
    for(const ending of [...endings].reverse()){ending.labelY=Math.min(ending.labelY,next-labelGap);next=ending.labelY;}
  }else if(endings.length&&previous>bottom)for(const ending of endings)ending.labelY-=previous-bottom;
  for(const [i,s] of series.entries()){
    const color=colors[i],dash=dashes[i];let drawing=false,path='';
    let previousYear;
    for(const row of s.rows){if(row.value===null){drawing=false;continue;}if(row.period&&previousYear!==undefined&&row.year-previousYear>1/12+1e-8)drawing=false;path+=`${drawing?'L':'M'} ${x(row.year)} ${y(row.value)} `;drawing=true;previousYear=row.year;}
    svg+=`<path data-series="${i}" d="${path}" fill="none" stroke="${color}" stroke-width="2.5" stroke-dasharray="${dash}"/>`;
    const lastYear=endings.find(e=>e.i===i)?.last.year;
    for(const row of s.rows.filter(r=>r.value!==null))svg+=`<circle data-series="${i}" data-year="${row.year}" cx="${x(row.year)}" cy="${y(row.value)}" r="3" opacity="${row.year===lastYear?1:0}" data-endpoint="${row.year===lastYear}" fill="${color}" tabindex="0" role="img" aria-label="${esc(s.name)}, ${periodOf(row)}: ${esc(fmt(row.value))} ${esc(unit.toLowerCase().replace(/^antal /,''))}"><title>${esc(s.name)}, ${periodOf(row)}: ${esc(fmt(row.value))} ${esc(unit.toLowerCase().replace(/^antal /,''))}</title></circle>`;
    const ending=endings.find(e=>e.i===i);
    if(ending&&series.length>1){
      svg+='<g data-chart-ending="true">';
      svg+=`<path d="M ${x(ending.last.year)} ${y(ending.last.value)} L ${width-right+15} ${ending.labelY}" fill="none" stroke="${color}" stroke-dasharray="${dash}"/><text x="${width-right+22}" y="${ending.labelY+4}" font-size="12" font-weight="700" fill="${color}">`;
      wrap(`${i+1}. ${s.name}`,28).slice(0,3).forEach((line,j)=>{svg+=`<tspan x="${width-right+22}" dy="${j?14:0}">${esc(line)}</tspan>`;});svg+='</text></g>';
    }
  }
  descriptions.forEach(({text,index},i)=>{const cy=bottom+58+i*18;if(i===0||descriptions[i-1].index!==index)svg+=`<line x1="${left}" y1="${cy-4}" x2="${left+28}" y2="${cy-4}" stroke="${colors[index]}" stroke-width="3" stroke-dasharray="${dashes[index]}"/>`;svg+=`<text x="${left+38}" y="${cy}" font-size="12">${esc(text)}</text>`;});
  svg+=`<text x="${left}" y="${height-16}" font-size="12">Källa: Göteborgs Stads statistikdatabas · Hämtad ${esc(date)}</text></g></svg>`;
  return svg;
}

// Redraw the plot to fit the available shape; retain the SVG text proportions
// and leave the independent export image at its standard dimensions.
export function fitSeriesChart(container,options){
  let frame,lastHeight,lastTextScale=1;
  const finishEntrance=animateChartEntrance(container.querySelector('svg'));
  const viewport=container.querySelector('.chart-viewport');
  const update=()=>{
    cancelAnimationFrame(frame);
    frame=requestAnimationFrame(()=>{
      const svg=container.querySelector('svg');
      if(!svg||container.hidden)return;
      // Measure the allocated flex slot, never the SVG being regenerated.
      const bounds=viewport.getBoundingClientRect();
      if(!bounds.width||!bounds.height)return;
      const height=container.closest('.visual-dialog')?Math.round(1000*bounds.height/bounds.width):undefined;
      // Cap on-screen SVG typography at its native size (12–13 CSS px),
      // while allowing the plot to fill the larger viewport. Exports are separate.
      const textScale=height===undefined?1:Math.min(1,1000/bounds.width);
      if(height===lastHeight&&textScale===lastTextScale)return;
      lastHeight=height;lastTextScale=textScale;
      const focused=document.activeElement===svg;
      finishEntrance();
      svg.outerHTML=seriesChart({...options,includeHeading:false,includeDescriptions:false,layoutHeight:height});
      container.querySelector('.sr-only')?.remove();
      attachSeriesInteraction(container,options.series,options.unit);
      for(const text of container.querySelector('svg').querySelectorAll('text[font-size]')){
        text.style.fontSize=`${Number(text.getAttribute('font-size'))*textScale}px`;
      }
      if(focused)container.querySelector('svg').focus({preventScroll:true});
    });
  };
  const observer=new ResizeObserver(update);
  attachSeriesInteraction(container,options.series,options.unit);
  observer.observe(viewport);
  return ()=>{finishEntrance();observer.disconnect();cancelAnimationFrame(frame);};
}

export function attachSeriesInteraction(container,series,unit='Antal personer'){
  const svg=container.querySelector('svg');if(!svg)return;
  const rows=series[0].rows,left=88,right=750,top=Number(svg.dataset.plotTop||115),bottom=Number(svg.dataset.plotBottom||415);
  const ns='http://www.w3.org/2000/svg';
  const make=(tag,attributes)=>{const node=document.createElementNS(ns,tag);for(const [key,value] of Object.entries(attributes))node.setAttribute(key,value);return node;};
  const overlay=make('g',{'aria-hidden':'true','pointer-events':'none'});
  const guide=make('line',{y1:top,y2:bottom,stroke:'#3f5564','stroke-dasharray':'3 4'});
  const box=make('rect',{rx:8,fill:'#ffffff',stroke:'#d1d9dc','stroke-width':1});
  box.style.filter='drop-shadow(0 3px 5px rgb(31 31 31 / 16%))';
  const typography={fill:'#1f1f1f','font-family':'Open Sans, Arial, sans-serif'};
  const yearLabel=make('text',{...typography,'font-size':12,'font-weight':700});
  const labels=series.map(()=>make('text',{...typography,'font-size':11}));
  const swatches=series.map((_,i)=>make('line',{stroke:colors[i],'stroke-width':3,'stroke-dasharray':dashes[i]}));
  overlay.append(guide,box,yearLabel,...swatches,...labels);overlay.style.display='none';svg.append(overlay);
  const announcement=document.createElement('span');announcement.className='sr-only';announcement.setAttribute('role','status');container.append(announcement);
  const points=[...svg.querySelectorAll('circle[data-series]')],lines=[...svg.querySelectorAll('path[data-series]')];
  for(const point of points){point.removeAttribute('tabindex');point.querySelector('title')?.remove();}
  svg.setAttribute('tabindex','0');
  let active=-1;
  function clear(){
    active=-1;overlay.style.display='none';
    points.forEach(point=>{point.setAttribute('r',3);point.removeAttribute('stroke');point.removeAttribute('stroke-width');point.style.opacity='';});lines.forEach(line=>{line.style.opacity='';});
    announcement.textContent='';
  }
  function show(index){
    active=index;const year=rows[index].year;
    const x=left+(year-rows[0].year)/(rows.at(-1).year-rows[0].year||1)*(right-left);
    yearLabel.textContent=periodOf(rows[index]);
    labels.forEach((label,i)=>{const value=series[i].rows.find(row=>row.year===year)?.value;label.textContent=(series.length===1&&series[i].isDefaultName?'':series[i].name+': ')+(value==null?'Uppgift saknas':fmt(value)+' '+unit.toLowerCase().replace(/^antal /,''));});
    overlay.style.display='';
    const width=Math.max(100,...labels.map(label=>label.getComputedTextLength()+60)),height=36+series.length*20;
    const bx=Math.max(8,Math.min(992-width,x+width+16<992?x+16:x-width-16)),by=top+8;
    box.setAttribute('x',bx);box.setAttribute('y',by);box.setAttribute('width',width);box.setAttribute('height',height);
    yearLabel.setAttribute('x',bx+12);yearLabel.setAttribute('y',by+20);
    labels.forEach((label,i)=>{const cy=by+39+i*20;label.setAttribute('x',bx+43);label.setAttribute('y',cy);swatches[i].setAttribute('x1',bx+12);swatches[i].setAttribute('x2',bx+34);swatches[i].setAttribute('y1',cy-4);swatches[i].setAttribute('y2',cy-4);});
    guide.setAttribute('x1',x);guide.setAttribute('x2',x);
    points.forEach(point=>{const selected=Number(point.dataset.year)===year;point.setAttribute('r',selected?4:3);point.setAttribute('stroke',selected?'#ffffff':'none');point.setAttribute('stroke-width',selected?1.5:0);point.style.opacity=selected?'1':point.dataset.endpoint==='true'?'1':'0';});
    lines.forEach(line=>{line.style.opacity='.85';});
    if(document.activeElement===svg)announcement.textContent=periodOf(rows[index])+': '+labels.map(label=>label.textContent).join(' · ');
  }
  function inspect(event){
    const matrix=svg.getScreenCTM();if(!matrix)return;
    const point=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());
    if(point.x<left||point.x>right||point.y<top||point.y>bottom){clear();return;}
    const year=rows[0].year+(point.x-left)/(right-left)*(rows.at(-1).year-rows[0].year);
    let index=0;for(let i=1;i<rows.length;i++)if(Math.abs(rows[i].year-year)<Math.abs(rows[index].year-year))index=i;
    show(index);
  }
  svg.addEventListener('pointermove',inspect);svg.addEventListener('pointerdown',inspect);
  svg.addEventListener('pointerleave',clear);svg.addEventListener('pointercancel',clear);
  svg.addEventListener('focus',()=>show(rows.length-1));svg.addEventListener('blur',clear);
  svg.addEventListener('keydown',event=>{
    if(event.key==='Escape'){clear();return;}
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();show(event.key==='Home'?0:event.key==='End'?rows.length-1:Math.max(0,Math.min(rows.length-1,(active<0?0:active)+(event.key==='ArrowRight'?1:-1))));
  });
}
