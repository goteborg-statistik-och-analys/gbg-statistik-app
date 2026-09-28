import {escapeXML as esc} from './core.js';
export const palette=['#3f5564','#008391','#674b99','#d24723','#1f1f1f'];
export const dashes=['','8 4','3 4','12 4 3 4','16 6'];
export const format=(value,digits=0)=>Number.isFinite(value)?new Intl.NumberFormat('sv-SE',{minimumFractionDigits:digits,maximumFractionDigits:digits}).format(value):'Uppgift saknas';
export const signed=(value,digits=0)=>Number.isFinite(value)?`${value>0?'+':''}${format(value,digits)}`:'Uppgift saknas';
export function symbol(x,y,slot,size=4){
  const common=`fill="${palette[slot]}" stroke="#fff" stroke-width="1"`;
  if(slot===1)return `<rect x="${x-size}" y="${y-size}" width="${size*2}" height="${size*2}" ${common}/>`;
  if(slot===2)return `<path d="M${x},${y-size-1} l${size+1},${size+1} l-${size+1},${size+1} l-${size+1},-${size+1} Z" ${common}/>`;
  if(slot===3)return `<path d="M${x},${y-size-1} l${size+1},${size*2+1} h-${size*2+2} Z" ${common}/>`;
  return `<circle cx="${x}" cy="${y}" r="${size}" ${common}/>`;
}
export function swatch(slot,dot=false){return `<svg viewBox="0 0 30 14" aria-hidden="true">${dot?symbol(15,7,slot):`<path d="M0 7 H30" stroke="${palette[slot]}" stroke-width="${slot===0?4:2.5}" stroke-dasharray="${dashes[slot]}"/>`}</svg>`;}
export function scaleLimits(values,fitYAxis=false){
  const finite=values.filter(Number.isFinite);
  if(!finite.length)return {low:0,high:1,step:.25};
  let min=Math.min(...finite),max=Math.max(...finite);
  if(fitYAxis){const margin=(max-min||Math.max(Math.abs(min),1))*.08;min-=margin;max+=margin;}
  else{min=Math.min(0,min);max=Math.max(0,max);}
  const span=max-min||1;
  const rough=span/4,base=10**Math.floor(Math.log10(rough)),factor=rough/base;
  const step=(factor<=1?1:factor<=2?2:factor<=2.5?2.5:factor<=5?5:10)*base;
  const low=Math.floor(min/step)*step,high=Math.ceil(max/step)*step;
  return {low,high:high>low?high:low+step,step};
}
export function lineChart({series,years,title,unit,width=900,digits=0,labels,layoutHeight,fitYAxis=false}){
  width=Math.max(280,Math.round(width));
  const height=layoutHeight??(width<500?290:330),left=width<500?62:78,right=width-24,top=30,bottom=height-(fitYAxis?60:42);
  const {low,high,step}=scaleLimits(series.flatMap(s=>s.values),fitYAxis);
  const axisNote=fitYAxis?`Anpassad y-axel${low>0||high<0?' · noll ingår inte':''}.`:'';
  const tickDigits=Math.max(0,-Math.floor(Math.log10(step)))+(step/10**Math.floor(Math.log10(step))===2.5?1:0);
  const x=year=>left+(year-years[0])/(years.at(-1)-years[0]||1)*(right-left),y=value=>bottom-(value-low)/(high-low)*(bottom-top);
  const axisUnit=unit==='Personer per 100 personer 20–64 år'?'Per 100 personer 20–64 år':unit;
  let svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" tabindex="0" aria-label="${esc(title)}. ${esc(unit)}. ${labels?esc(labels[0])+' till '+esc(labels.at(-1)):years[0]+' till '+years.at(-1)}. Använd vänster och höger pil för ${labels?'åldersgrupp':'år'}, Home och End för första och sista värdet. Exakta värden finns också i tabellen. ${axisNote}" data-left="${left}" data-right="${right}" data-top="${top}" data-bottom="${bottom}"><text x="${left}" y="16" font-size="12">${esc(axisUnit)}</text>`;
  for(let value=low;value<=high+step/10;value+=step){const yy=y(value);svg+=`<line x1="${left}" x2="${right}" y1="${yy}" y2="${yy}" stroke="${Math.abs(value)<step/100?'#3f5564':'#d1d9dc'}"/><text x="${left-9}" y="${yy+4}" text-anchor="end" font-size="11">${format(value,tickDigits)}</text>`;}
  const tickEvery=labels?(width<500?4:width<850?2:1):5;
  for(const [i,year] of years.entries()){if(labels?i%tickEvery!==0&&i!==years.length-1:year%5!==0&&year!==years.at(-1))continue;svg+=`<text x="${x(year)}" y="${bottom+25}" text-anchor="middle" font-size="11">${esc(labels?labels[i].replace(' år',''):String(year))}</text>`;}
  if(labels)svg+=`<text x="${right}" y="${height-2}" text-anchor="end" font-size="11">Ålder (år)</text>`;
  for(const [index,s] of series.entries()){let path='',drawing=false;for(let i=0;i<years.length;i++){const value=s.values[i];if(!Number.isFinite(value)){drawing=false;continue;}path+=`${drawing?'L':'M'}${x(years[i])},${y(value)} `;drawing=true;}svg+=`<path d="${path}" stroke="${palette[s.slot]}" stroke-width="${s.slot===0?3.5:2.5}" stroke-dasharray="${dashes[s.slot]}" fill="none" data-series="${index}"/>`;for(let i=0;i<years.length;i++){if(Number.isFinite(s.values[i]))svg+=`<circle data-series="${index}" data-year="${years[i]}" cx="${x(years[i])}" cy="${y(s.values[i])}" r="3" fill="${palette[s.slot]}" opacity="0" data-endpoint="false"/>`;}}
  if(axisNote)svg+=`<text x="${left}" y="${height-3}" font-size="11">${axisNote}</text>`;
  svg+='</svg>';
  return svg;
}
export function ageChart({series,groups,title,width=900,layoutHeight}){
  return lineChart({series,years:groups.map((_,i)=>i),labels:groups,title,unit:'Procent',width,layoutHeight});
}
