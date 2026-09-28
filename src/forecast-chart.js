import {escapeXML as esc} from './core.js';
import {attachSeriesInteraction} from './series-chart.js';
import {animateChartEntrance} from './chart-animation.js';
export const forecastColors = ['#3f5564','#008391','#674b99','#d24723','#008767','#d53878','#ffcd37'];
const fmt = value => new Intl.NumberFormat('sv-SE',{maximumFractionDigits:0}).format(value);
export function forecastChart(series, {title, subtitle, age, forecastStart, source, unit='Antal personer',includeHeading=true,layoutHeight}) {
  if (!series.length) return '';
  const wrap=(text,length)=>{const lines=[''];for(const word of text.split(' ')){if((lines.at(-1)+' '+word).length>length)lines.push('');lines[lines.length-1]+=(lines.at(-1)?' ':'')+word;}return lines;};
  const ageLines=age?wrap('Ålder: '+age,110):[],ageHeight=includeHeading?ageLines.length*18:0;
  const labelLines=series.map(s=>wrap(s.name,24));
  const labelWidth=Math.min(190,Math.max(100,...labelLines.flat().map(line=>line.length*6+36)));
  const left=88, right=1000-labelWidth, top=includeHeading?72+ageHeight:30, width=1000;
  const height=!includeHeading&&Number.isFinite(layoutHeight)?Math.max(180,layoutHeight):includeHeading?490+ageHeight:380;
  const bottom=height-(includeHeading?112:44);
  const years=series[0].rows.map(row=>row.year), first=years[0], last=years.at(-1);
  const values=series.flatMap(s=>s.rows.filter(r=>r.value!==null).map(r=>r.value));
  const maximum=Math.max(0,...values),minimum=Math.min(0,...values);
  const magnitude=10**Math.floor(Math.log10(Math.max(maximum,-minimum)||1));
  const tickUnit=unit==='Procent'?magnitude/10:Math.max(1,magnitude/10);
  const limit=Math.ceil(maximum/(4*tickUnit))*4*tickUnit||(minimum<0?0:4*tickUnit);
  const lower=Math.floor(minimum/(4*tickUnit))*4*tickUnit;
  const format=value=>unit==='Procent'?new Intl.NumberFormat('sv-SE',{maximumFractionDigits:2}).format(value)+' %':fmt(value);
  const x=year=>left+(year-first)/(last-first||1)*(right-left), y=value=>bottom-(value-lower)/(limit-lower)*(bottom-top);
  const path=rows=>{let drawing=false;return rows.map(row=>{if(row.value===null){drawing=false;return '';}const command=drawing?'L':'M';drawing=true;return `${command}${x(row.year).toFixed(2)},${y(row.value).toFixed(2)}`;}).join(' ');};
  let svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" tabindex="0" aria-label="${esc(title+'. '+(age?'Ålder: '+age+'. ':'')+subtitle+'. Heldraget: utfall. Streckat: prognos. Exakta värden finns i tabellen.')}" data-left="${left}" data-right="${right}" data-top="${top}" data-bottom="${bottom}"><rect width="${width}" height="${height}" fill="#fff"/><g font-family="Open Sans, Arial, sans-serif" fill="#1f1f1f">`;
  if(includeHeading)svg+=`<text x="${left}" y="24" font-size="17" font-weight="800">${esc(title)}</text>`+ageLines.map((line,i)=>`<text x="${left}" y="${46+i*18}" font-size="12" font-weight="700">${esc(line)}</text>`).join('')+`<text x="${left}" y="${46+ageHeight}" font-size="12">${esc(subtitle)}</text>`;
  for(let i=0;i<=4;i++){const value=lower+(limit-lower)*i/4;svg+=`<line x1="${left}" x2="${right}" y1="${y(value)}" y2="${y(value)}" stroke="#d1d9dc"/><text x="${left-12}" y="${y(value)+4}" text-anchor="end" font-size="12">${format(value)}</text>`;}
  if(lower<0&&limit>0)svg+=`<line x1="${left}" x2="${right}" y1="${y(0)}" y2="${y(0)}" stroke="#3f5564"/>`;
  const ticks=[...new Set([first,...years.filter(year=>year%5===0&&year<last-1),last])];
  for(const year of ticks)svg+=`<text x="${x(year)}" y="${bottom+26}" text-anchor="middle" font-size="12">${year}</text>`;
  // Start the dashed segment at the last observed point, so the transition is explicit.
  const boundary=x(forecastStart-1);
  svg+=`<line x1="${boundary}" x2="${boundary}" y1="${top}" y2="${bottom}" stroke="#3f5564" stroke-dasharray="2 5"/><text x="${Math.min(boundary+7,right-115)}" y="${top-8}" font-size="10" font-weight="700">Prognos från ${forecastStart}</text>`;
  const endings=series.map((s,i)=>({i,row:s.rows.findLast(row=>row.value!==null)})).filter(e=>e.row).sort((a,b)=>y(a.row.value)-y(b.row.value));
  let previous=top-42;
  for(const e of endings){e.labelY=Math.max(y(e.row.value),previous+42);previous=e.labelY;}
  let next=bottom+42;for(const e of [...endings].reverse()){e.labelY=Math.min(e.labelY,next-42);next=e.labelY;}
  series.forEach((s,i)=>{
    const color=forecastColors[i];
    svg+=`<path data-kind="history" d="${path(s.rows.filter(row=>row.year<forecastStart))}" fill="none" stroke="${color}" stroke-width="2.5" data-series="${i}"/><path data-kind="forecast" d="${path(s.rows.filter(row=>row.year>=forecastStart-1))}" fill="none" stroke="${color}" stroke-width="2.5" stroke-dasharray="7 5" data-series="${i}"/>`;
    const e=endings.find(e=>e.i===i);if(!e)return;
    for(const row of s.rows.filter(r=>r.value!==null))svg+=`<circle data-series="${i}" data-year="${row.year}" cx="${x(row.year)}" cy="${y(row.value)}" r="3" opacity="${row.year===e.row.year?1:0}" data-endpoint="${row.year===e.row.year}" fill="${color}"/>`;
    svg+=`<g data-chart-ending="true"><path d="M${x(e.row.year)},${y(e.row.value)} L${right+12},${e.labelY}" fill="none" stroke="${color}"/><text x="${right+18}" y="${e.labelY+3}" font-size="11" font-weight="600">${labelLines[i].map((line,j)=>`<tspan x="${right+18}" dy="${j?13:0}">${esc(line)}</tspan>`).join('')}</text></g>`;
  });
  if(includeHeading){
    svg+=`<text x="${left}" y="${bottom+53}" font-size="10">${esc(unit)} · Heldraget: utfall · Streckat: prognos</text>`;
    wrap(source,132).forEach((line,i)=>{svg+=`<text x="${left}" y="${bottom+75+i*16}" font-size="10">${esc(line)}</text>`;});
  }
  return svg+'</g></svg>';
}

export function attachForecastInteraction(container,series,unit='Antal personer'){
  attachSeriesInteraction(container,series,unit,{palette:forecastColors,lineDashes:[]});
}

export function fitForecastChart(container,series,options){
  let frame,lastHeight;
  const finish=animateChartEntrance(container.querySelector('svg'));
  attachForecastInteraction(container,series,options.unit);
  const observer=new ResizeObserver(()=>{
    cancelAnimationFrame(frame);
    frame=requestAnimationFrame(()=>{
      const bounds=container.getBoundingClientRect();
      if(!bounds.width||!bounds.height)return;
      const height=container.closest('.visual-dialog')?Math.round(1000*bounds.height/bounds.width):undefined;
      if(height===lastHeight)return;
      lastHeight=height;finish();
      const focused=document.activeElement===container.querySelector('svg');
      container.innerHTML=forecastChart(series,{...options,includeHeading:false,layoutHeight:height??options.layoutHeight});
      attachForecastInteraction(container,series,options.unit);
      // Match the app's enlarged chart typography rather than scaling up labels.
      const scale=height===undefined?1:Math.min(1,1000/bounds.width);
      for(const text of container.querySelectorAll('text[font-size]'))text.style.fontSize=`${Number(text.getAttribute('font-size'))*scale}px`;
      if(focused)container.querySelector('svg').focus({preventScroll:true});
    });
  });
  observer.observe(container);
  return ()=>{finish();observer.disconnect();cancelAnimationFrame(frame);};
}
