let entranceId=0;

// A horizontal reveal preserves dashed lines and gaps in missing data.
// Only the live chart is animated; exported SVGs stay complete.
export function animateChartEntrance(svg){
  const motion=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  const marks=svg?[...svg.querySelectorAll('[data-series]')]:[];
  if(!marks.length||motion?.matches)return ()=>{};
  const endings=[...svg.querySelectorAll('[data-chart-ending]')];
  const ns='http://www.w3.org/2000/svg';
  const clip=document.createElementNS(ns,'clipPath');
  const rect=document.createElementNS(ns,'rect');
  const id=`chart-entrance-${++entranceId}`;
  clip.setAttribute('id',id);
  clip.setAttribute('clipPathUnits','userSpaceOnUse');
  rect.setAttribute('x','80');rect.setAttribute('y','0');
  rect.setAttribute('width','0');rect.setAttribute('height',svg.viewBox.baseVal.height);
  clip.append(rect);svg.append(clip);
  for(const mark of marks)mark.setAttribute('clip-path',`url(#${id})`);
  for(const ending of endings)ending.style.visibility='hidden';
  let frame,start,finished=false;
  const events=['pointermove','pointerdown','focus'];
  function finish(){
    if(finished)return;
    finished=true;cancelAnimationFrame(frame);
    for(const mark of marks)mark.removeAttribute('clip-path');
    for(const ending of endings)ending.style.visibility='';
    clip.remove();
    for(const event of events)svg.removeEventListener(event,finish);
    motion?.removeEventListener('change',finish);
  }
  function draw(time){
    start??=time;
    const progress=Math.max(0,Math.min(1,(time-start-150)/900));
    rect.setAttribute('width',String(680*progress));
    if(progress===1)finish();
    else frame=requestAnimationFrame(draw);
  }
  for(const event of events)svg.addEventListener(event,finish);
  motion?.addEventListener('change',finish);
  frame=requestAnimationFrame(draw);
  return finish;
}
