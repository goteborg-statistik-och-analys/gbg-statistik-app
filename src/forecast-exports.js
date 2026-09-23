export function forecastExportRows({data,series,title,age,subtitle,source,comparability,unit,calculation}){
  return [[title],...(age?[[age]]:[]),[subtitle],...(unit?[['Enhet',unit]]:[]),...(calculation?[[calculation]]:[]),[source],[comparability||''],...data.notes.map(note=>[note]),['År','Typ',...series.map(s=>s.name)],...data.years.map((year,i)=>[year,series[0].rows[i].type,...series.map(s=>s.rows[i].value)])];
}
export function forecastCSV(rows){
  const cell=value=>'"'+String(value??'').replaceAll('"','""')+'"';
  return '\uFEFF'+rows.map(row=>row.map(cell).join(';')).join('\r\n');
}
export async function forecastExcel(rows){
  const XLSX=await import('../vendor/xlsx.mjs');
  const sheet=XLSX.utils.aoa_to_sheet(rows),book=XLSX.utils.book_new();
  const header=rows.findIndex(row=>row[0]==='År'&&row[1]==='Typ');
  sheet['!cols']=rows[header].map((_,i)=>({wch:i===0?12:i===1?16:30}));
  sheet['!autofilter']={ref:XLSX.utils.encode_range({s:{r:header,c:0},e:{r:rows.length-1,c:rows[header].length-1}})};
  XLSX.utils.book_append_sheet(book,sheet,'Befolkningsprognos');
  return XLSX.write(book,{bookType:'xlsx',type:'array',compression:true});
}
