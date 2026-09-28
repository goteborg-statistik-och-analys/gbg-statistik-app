import {escapeXML as esc} from './core.js';
import {signed} from './comparison-chart.js';

// Fixed, symmetric breaks keep colours comparable when the municipal scope changes.
export function growthMapClasses(measure){
  const percent=measure==='growthRate',cut=percent?1:500,unit=percent?' %':' personer';
  return [
    {color:'#d24723',label:`Minskning större än ${cut}${unit}`,test:v=>v < -cut},
    {color:'#fbcfb9',label:`Minskning upp till ${cut}${unit}`,test:v=>v < 0},
    {color:'#d1d9dc',label:'Oförändrat',test:v=>v === 0},
    {color:'#c0e4f2',label:`Ökning upp till ${cut}${unit}`,test:v=>v <= cut},
    {color:'#3f5564',label:`Ökning större än ${cut}${unit}`,test:()=>true}
  ];
}
export function growthMapColor(value,measure){
  return Number.isFinite(value)?growthMapClasses(measure).find(c=>c.test(value)).color:'#ffffff';
}
export function municipalityLabel(row){return `${row.name}: ${signed(row.growth)} personer (${signed(row.growthRate,2)} %), ${row.startYear??2024}–${row.endYear??2025}`;}
export function growthMapSVG(geometry,rows,measure,{interactive=false,startYear=rows[0]?.startYear??2024,endYear=rows[0]?.endYear??2025}={}){
  const byCode=new Map(rows.map(row=>[row.code,row]));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${geometry.width}" height="${geometry.height}" viewBox="0 0 ${geometry.width} ${geometry.height}" role="${interactive?'group':'img'}" aria-label="Befolkningsförändring per kommun ${startYear}–${endYear}">${interactive?'':`<title>Befolkningsförändring per kommun ${startYear}–${endYear}</title>`}${geometry.features.map(feature=>{
    const row=byCode.get(feature.code),label=row?municipalityLabel(row):`${feature.name}: utanför urvalet eller uppgift saknas`;
    return `<path d="${feature.path}" fill="${growthMapColor(row?.[measure],measure)}" fill-rule="evenodd" stroke="#1f1f1f" stroke-width="0.45" vector-effect="non-scaling-stroke"${interactive&&row?` data-municipality="${feature.code}" tabindex="${feature.code===(byCode.has('1480')?'1480':rows[0]?.code)?0:-1}" role="button" aria-label="${esc(label)}"`:''}>${interactive?'':`<title>${esc(label)}</title>`}</path>`;
  }).join('')}</svg>`;
}
export function municipalityViewBox(full,box){
  const ratio=full.width/full.height;
  const width=Math.min(full.width,Math.max(full.width/10,box.width*2.8,box.height*2.8*ratio));
  const height=width/ratio;
  return [Math.max(0,Math.min(full.width-width,box.x+box.width/2-width/2)),Math.max(0,Math.min(full.height-height,box.y+box.height/2-height/2)),width,height];
}
export function attachGrowthMap(container,rows,onSelect){
  const byCode=new Map(rows.map(row=>[row.code,row]));
  const svg=container.querySelector('svg'),full={width:svg.viewBox.baseVal.width,height:svg.viewBox.baseVal.height};
  const paths=[...svg.querySelectorAll('[data-municipality]')];
  let frame;
  const moveView=(target,animate=true)=>{
    cancelAnimationFrame(frame);
    const from=svg.getAttribute('viewBox').split(/\s+/).map(Number);
    const finish=()=>svg.setAttribute('viewBox',target.join(' '));
    if(!animate||matchMedia('(prefers-reduced-motion: reduce)').matches){finish();return;}
    const start=performance.now();
    const step=now=>{
      if(!svg.isConnected)return;
      const t=Math.min(1,(now-start)/650),ease=t*t*(3-2*t);
      svg.setAttribute('viewBox',target.map((v,i)=>from[i]+(v-from[i])*ease).join(' '));
      if(t<1)frame=requestAnimationFrame(step);else finish();
    };
    frame=requestAnimationFrame(step);
  };
  const outline=document.createElementNS(svg.namespaceURI,'g');outline.setAttribute('aria-hidden','true');outline.setAttribute('pointer-events','none');svg.append(outline);
  const tooltip=document.createElement('div');tooltip.className='map-tooltip growth-map-tooltip';tooltip.hidden=true;tooltip.setAttribute('role','tooltip');container.append(tooltip);
  const hide=()=>{tooltip.hidden=true;};
  const show=(path,event)=>{
    const row=byCode.get(path.dataset.municipality);
    tooltip.innerHTML=`<b class="map-tooltip-title">${esc(row.name)} · ${row.startYear??2024}–${row.endYear??2025}</b><div><i style="background:${path.getAttribute('fill')}"></i>${signed(row.growth)} personer · ${signed(row.growthRate,2)} %</div>`;
    tooltip.hidden=false;
    const bounds=container.getBoundingClientRect(),p=path.getBoundingClientRect();
    const x=event?.clientX??p.left+p.width/2,y=event?.clientY??p.top+p.height/2;
    tooltip.style.left=`${Math.max(4,Math.min(bounds.width-tooltip.offsetWidth-4,x-bounds.left+16))}px`;
    tooltip.style.top=`${Math.max(4,Math.min(bounds.height-tooltip.offsetHeight-4,y-bounds.top-tooltip.offsetHeight-12))}px`;
  };
  const select=(path,{zoom=true,animate=true}={})=>{
    if(!path)return;
    hide();outline.replaceChildren();
    for(const item of paths){item.classList.toggle('is-selected',item===path);item.setAttribute('aria-pressed',String(item===path));item.tabIndex=item===path?0:-1;}
    for(const [color,width] of [['#ffffff',5],['#1f1f1f',2.5]]){
      const line=document.createElementNS(svg.namespaceURI,'path');
      for(const [key,value] of Object.entries({d:path.getAttribute('d'),fill:'none',stroke:color,'stroke-width':width,'vector-effect':'non-scaling-stroke'}))line.setAttribute(key,value);
      outline.append(line);
    }
    const bounds=path.getBBox(),view=zoom?municipalityViewBox(full,bounds):[0,0,full.width,full.height];
    moveView(view,animate);
    const label=document.createElementNS(svg.namespaceURI,'text');
    const fontSize=view[2]/32;
    for(const [key,value] of Object.entries({x:bounds.x+bounds.width/2,y:bounds.y+bounds.height/2-fontSize,'text-anchor':'middle','font-size':fontSize,'font-weight':700,'font-family':'Open Sans,Arial,sans-serif',fill:'#1f1f1f',stroke:'#ffffff','stroke-width':fontSize/3,'paint-order':'stroke'}))label.setAttribute(key,value);
    label.textContent=byCode.get(path.dataset.municipality).name;outline.append(label);
    onSelect(byCode.get(path.dataset.municipality),zoom);
  };
  for(const path of paths){
    // Clicking a shape must not trigger the browser's focus outline or scroll.
    path.addEventListener('pointerdown',event=>{if(event.pointerType==='mouse')event.preventDefault();});
    path.addEventListener('pointermove',event=>show(path,event));
    path.addEventListener('pointerleave',hide);
    path.addEventListener('focus',()=>show(path));
    path.addEventListener('blur',hide);
    path.addEventListener('click',()=>select(path));
    path.addEventListener('keydown',event=>{
      if(event.key==='Escape'){hide();return;}
      if(event.key==='Enter'||event.key===' '){event.preventDefault();select(path);return;}
      if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))return;
      event.preventDefault();
      const index=paths.indexOf(path),next=event.key==='Home'?0:event.key==='End'?paths.length-1:(index+(['ArrowLeft','ArrowUp'].includes(event.key)?-1:1)+paths.length)%paths.length;
      for(const item of paths)item.tabIndex=-1;paths[next].tabIndex=0;
      paths[next].focus({preventScroll:true});
    });
  }
  container.onpointerleave=hide;
  const choose=(code,options)=>select(paths.find(path=>path.dataset.municipality===code),options);
  choose.reset=({animate=true}={})=>{
    hide();outline.replaceChildren();
    for(const [index,path] of paths.entries()){path.classList.remove('is-selected');path.setAttribute('aria-pressed','false');path.tabIndex=index===0?0:-1;}
    moveView([0,0,full.width,full.height],animate);
    onSelect(null,false);
  };
  return choose;
}
