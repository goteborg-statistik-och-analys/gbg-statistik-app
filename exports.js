import {csv,periodOf} from './core.js';
import {resultGrid} from './detailed-results.js';

export const sourceName='Göteborgs Stads statistikdatabas';
export function resultCSV(result){
  if(result.series?.some(s=>Object.keys(s.dimensions||{}).length)){
    const grid=resultGrid(result),quote=value=>'"'+String(value??'').replace(/"/g,'""')+'"';
    return '\uFEFF'+[[...grid.headers,'Källa','Hämtad','Anmärkningar'],...grid.rows.map(row=>[...row,sourceName,result.date,result.notes])].map(row=>row.map(quote).join(';')).join('\r\n');
  }
  if(result.series){
    const quote=value=>'"'+String(value).replace(/"/g,'""')+'"';
    const rows=[[result.rows[0]?.period?'Period':'År','Område',result.measure,'Enhet','Grupp','Urval','Källa','Hämtad','Anmärkningar'],...result.series.flatMap(s=>s.rows.map(r=>[periodOf(r),s.area||result.area,r.value===null?'':r.value,(result.unit||'Antal personer'),s.name,s.detail,sourceName,result.date,result.notes]))];
    return '\uFEFF'+rows.map(row=>row.map(quote).join(';')).join('\r\n');
  }
  return csv(result.rows,result.area,sourceName,result.date,result.measure,result.detail,result.notes,result.unit||'Antal personer');
}

export async function resultExcel(result){
  const XLSX=await import('./vendor/xlsx.mjs');
  if(result.series?.some(s=>Object.keys(s.dimensions||{}).length)){
    const grid=resultGrid(result);
    const sheet=XLSX.utils.aoa_to_sheet([['Statistik',result.measure],['Källa',sourceName],['Tabell',result.table.title],['Urval',result.detail],['Hämtad',new Date(`${result.date}T00:00:00Z`)],['Anmärkningar',result.notes||''],['Saknade värden','Tomma dataceller betyder att uppgift saknas.'],[],grid.headers,...grid.rows],{cellDates:true,dateNF:'yyyy-mm-dd'});
    const column=XLSX.utils.encode_col(grid.headers.length-1);
    sheet['!cols']=grid.headers.map(h=>({wch:h==='Urval'?80:h==='År'?10:26}));sheet['!autofilter']={ref:`A9:${column}${9+grid.rows.length}`};
    for(let i=0;i<grid.rows.length;i++)if(sheet[`${column}${i+10}`])sheet[`${column}${i+10}`].z='#,##0';
    const workbook=XLSX.utils.book_new();XLSX.utils.book_append_sheet(workbook,sheet,'Statistik');return XLSX.write(workbook,{bookType:'xlsx',type:'array',compression:true});
  }
  const data=result.series?result.series.flatMap(s=>s.rows.map(row=>[periodOf(row),s.area||result.area,row.value,(result.unit||'Antal personer'),s.name,s.detail])):result.rows.map(row=>[periodOf(row),result.area,row.value,(result.unit||'Antal personer')]);
  const sheet=XLSX.utils.aoa_to_sheet([
    ['Statistik',`${result.measure} i ${result.area}`],
    ['Källa',sourceName],
    ['Tabell',result.table.title],
    ['Urval',result.detail],
    ['Hämtad',new Date(`${result.date}T00:00:00Z`)],
    ['Anmärkningar',result.notes||''],
    ['Saknade värden','Tomma dataceller betyder att uppgift saknas.'],
    [],
    [result.rows[0]?.period?'Period':'År','Område',result.measure,'Enhet',...(result.series?['Grupp','Urval']:[])],
    ...data
  ],{cellDates:true,dateNF:'yyyy-mm-dd'});
  sheet['!cols']=[{wch:22},{wch:85},{wch:32},{wch:20},{wch:30},{wch:85}];
  sheet['!autofilter']={ref:`A9:${result.series?'F':'D'}${9+data.length}`};
  for(let i=0;i<data.length;i++)if(sheet[`C${i+10}`])sheet[`C${i+10}`].z='#,##0';
  const workbook=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook,sheet,'Statistik');
  return XLSX.write(workbook,{bookType:'xlsx',type:'array',compression:true});
}
