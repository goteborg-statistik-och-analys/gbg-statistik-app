const format=new Intl.NumberFormat('sv-SE');
export function attachChartInteraction(container,rows){
  const svg=container.querySelector('svg');
  if(!svg||rows.length<2)return;
  const ns='http://www.w3.org/2000/svg';
  const make=(tag,attributes)=>{const node=document.createElementNS(ns,tag);for(const [key,value] of Object.entries(attributes))node.setAttribute(key,value);return node;};
  const overlay=make('g',{'aria-hidden':'true','pointer-events':'none'});
  const box=make('rect',{height:52,rx:8,fill:'#ffffff',stroke:'#d1d9dc','stroke-width':.5});
  box.style.filter='drop-shadow(0 3px 5px rgb(31 31 31 / 16%))';
  const typography={fill:'#1f1f1f','font-family':'Open Sans, Arial, sans-serif'};
  const yearLabel=make('text',{...typography,'font-size':11});
  const label=make('text',{...typography,'font-size':16,'font-weight':700});
  const unit=make('text',{...typography,'font-size':11});
  overlay.append(box,yearLabel,label,unit);overlay.style.display='none';svg.append(overlay);
  const points=[...svg.querySelectorAll('circle')],lines=[...svg.querySelectorAll('path')];
  points.forEach(point=>point.querySelector('title')?.remove());
  const values=new Map();let pointIndex=0;
  for(const row of rows)if(row.value!==null)values.set(row.year,points[pointIndex++]);
  svg.setAttribute('tabindex','0');
  const announcement=document.createElement('span');announcement.className='sr-only';announcement.setAttribute('role','status');container.append(announcement);
  let activeIndex=-1;
  function clear(){
    activeIndex=-1;overlay.style.display='none';
    points.forEach(point=>{point.setAttribute('r',4);point.style.opacity='';});
    lines.forEach(line=>{line.style.opacity='';});
  }
  function show(index){
    if(index===activeIndex)return;
    activeIndex=index;
    const row=rows[index],point=values.get(row.year),x=88+(row.year-rows[0].year)/(rows.at(-1).year-rows[0].year)*877;
    const description=`${row.year}: ${row.value===null?'Uppgift saknas':`${format.format(row.value)} personer`}`;
    points.forEach(item=>{item.setAttribute('r',item===point?7:4);item.style.opacity=item===point?'1':'.25';});
    lines.forEach(line=>{line.style.opacity='.3';});
    overlay.style.display='';yearLabel.textContent=row.year;
    label.textContent=row.value===null?'Uppgift saknas':format.format(row.value);unit.textContent=row.value===null?'':'personer';
    const valueWidth=label.getComputedTextLength(),width=Math.max(yearLabel.getComputedTextLength(),valueWidth+(unit.textContent?6+unit.getComputedTextLength():0))+24;
    const bx=x+width+14<985?x+14:x-width-14,by=point?Math.max(125,Number(point.getAttribute('cy'))-62):145;
    box.setAttribute('width',width);box.setAttribute('x',bx);box.setAttribute('y',by);
    yearLabel.setAttribute('x',bx+12);yearLabel.setAttribute('y',by+17);
    label.setAttribute('x',bx+12);label.setAttribute('y',by+38);
    unit.setAttribute('x',bx+18+valueWidth);unit.setAttribute('y',by+38);
    if(document.activeElement===svg)announcement.textContent=description;
  }
  function inspect(event){
    const matrix=svg.getScreenCTM();if(!matrix)return;
    const point=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());
    if(point.y<125||point.y>385||point.x<88||point.x>965){clear();return;}
    const year=rows[0].year+(point.x-88)/877*(rows.at(-1).year-rows[0].year);
    let closest=0;for(let i=1;i<rows.length;i++)if(Math.abs(rows[i].year-year)<Math.abs(rows[closest].year-year))closest=i;
    show(closest);
  }
  svg.addEventListener('pointermove',inspect);svg.addEventListener('pointerdown',inspect);
  svg.addEventListener('pointerleave',clear);
  svg.addEventListener('pointercancel',clear);
  svg.addEventListener('keydown',event=>{
    if(event.key==='Escape'){clear();return;}
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();
    show(event.key==='Home'?0:event.key==='End'?rows.length-1:Math.max(0,Math.min(rows.length-1,(activeIndex<0?0:activeIndex)+(event.key==='ArrowRight'?1:-1))));
  });
  svg.addEventListener('focus',()=>show(rows.length-1));svg.addEventListener('blur',clear);
}
