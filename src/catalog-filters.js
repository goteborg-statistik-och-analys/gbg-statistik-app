export const themeOf=table=>table.subject==='Inkomster'?'Inkomst':table.subject;
export const catalogThemes=catalog=>[...new Set(catalog.map(themeOf).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'sv'));
export const browseTables=catalog=>[...catalog].sort((a,b)=>Number(Boolean(b.kind))-Number(Boolean(a.kind)));
export function filterTables(tables,{level='',theme='',readyOnly=false}={}){
  return tables.filter(table=>(!level||table.level===level)&&(!theme||themeOf(table)===theme)&&(!readyOnly||Boolean(table.kind)));
}
