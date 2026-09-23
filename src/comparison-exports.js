import {escapeXML as esc} from './core.js';
import {lineChart,palette,dashes} from './comparison-chart.js';
export {forecastCSV as comparisonCSV} from './forecast-exports.js';

export function comparisonExportRows(model){
  return [[model.title],[model.subtitle],['Enhet',model.unit],['Källa: SCB'],...model.notes.map(note=>[note]),[model.age?'Ålder':'År',...model.series.map(s=>s.name)],...model.labels.map((label,i)=>[label,...model.series.map(s=>s.values[i])])];
}
export async function comparisonExcel(model){
  const XLSX=await import('../vendor/xlsx.mjs'),rows=comparisonExportRows(model);
  const sheet=XLSX.utils.aoa_to_sheet(rows),book=XLSX.utils.book_new(),header=4+model.notes.length;
  sheet['!cols']=rows[header].map((_,i)=>({wch:i===0?16:26}));
  sheet['!autofilter']={ref:XLSX.utils.encode_range({s:{r:header,c:0},e:{r:rows.length-1,c:rows[header].length-1}})};
  XLSX.utils.book_append_sheet(book,sheet,'Göteborg i jämförelse');
  return XLSX.write(book,{bookType:'xlsx',type:'array',compression:true});
}
function wrap(text,length=120){const lines=[''];for(const word of text.split(/\s+/)){if((lines.at(-1)+' '+word).length>length&&lines.at(-1))lines.push('');lines[lines.length-1]+=(lines.at(-1)?' ':'')+word;}return lines;}
export function comparisonExportSVG(model){
  const heading=wrap(model.title,78),notes=model.notes.flatMap(note=>wrap(note));
  const top=72+heading.length*25+model.series.length*22,chartHeight=350,height=top+chartHeight+50+notes.length*17;
  const chart=lineChart({series:model.series,years:model.age?model.labels.map((_,i)=>i):model.labels.map(Number),labels:model.age?model.labels:undefined,title:model.title,unit:model.unit,width:1000,layoutHeight:chartHeight});
  const content=chart.slice(chart.indexOf('>')+1,chart.lastIndexOf('</svg>'));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 ${height}" width="1000" height="${height}" role="img" aria-label="${esc(model.title)}"><rect width="1000" height="${height}" fill="#fff"/><g font-family="Open Sans,Arial,sans-serif" fill="#1f1f1f">${heading.map((text,i)=>`<text x="30" y="${34+i*25}" font-size="22" font-weight="800">${esc(text)}</text>`).join('')}<text x="30" y="${42+heading.length*25}" font-size="13">${esc(model.subtitle)}</text>${model.series.map((s,i)=>`<line x1="30" x2="62" y1="${64+heading.length*25+i*22}" y2="${64+heading.length*25+i*22}" stroke="${palette[s.slot]}" stroke-width="3" stroke-dasharray="${dashes[s.slot]}"/><text x="72" y="${68+heading.length*25+i*22}" font-size="13">${esc(s.name)}</text>`).join('')}<g transform="translate(0,${top})">${content}</g><text x="30" y="${top+chartHeight+23}" font-size="12">Källa: SCB · ${esc(model.unit)}</text>${notes.map((note,i)=>`<text x="30" y="${top+chartHeight+44+i*17}" font-size="11">${esc(note)}</text>`).join('')}</g></svg>`;
}
