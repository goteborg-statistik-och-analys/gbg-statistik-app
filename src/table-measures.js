// Explicit measure definitions. Unknown tables remain external until reviewed.
export function tableMeasure(table){
  if(table.measure)return table.measure;
  return {label:table.kind==='education'?(table.title.startsWith('Gymnasie')?'Gymnasiebehörighet':'Högsta utbildningsnivå'):'Folkmängd',unit:'Antal personer',additive:true};
}
export function reviewedCountMeasure(table){
  if(table.subject==='Utbildning'){
    if(/^Högsta utbildningsnivå(?=,| |$)/.test(table.title))return {label:'Högsta utbildningsnivå',unit:'Antal personer',additive:true};
    if(/^Gymnasiebehörighet\b/.test(table.title))return {label:'Gymnasiebehörighet',unit:'Antal personer',additive:true};
    if(/^Högskolebehörighet\b/.test(table.title))return {label:'Högskolebehörighet',unit:'Antal personer',additive:true};
    if(/^Antal barn 0-17 år efter föräldrars utbildningsnivå(?=,| |$)/.test(table.title))return {label:'Barn efter föräldrars utbildningsnivå',unit:'Antal barn',additive:true};
  }
  if(table.subject==='Befolkning'){
    if(/^Befolkningstäthet/.test(table.title))return {label:'Befolkningstäthet',unit:'Personer per km² landyta',additive:false};
    if(/prognos/i.test(table.title))return {label:'Prognostiserad folkmängd',unit:'Antal personer',additive:true,forecast:true};
    if(/^Folkmängd månadsvis/.test(table.title))return {label:'Folkmängd per månad',unit:'Antal personer',additive:true,monthly:true};
    const migration=table.metadata?.variables.find(v=>['Flyttyp','Typ av flyttning','Flyttkategori'].includes(v.code));
    if(migration)return {label:'Flyttningar',unit:'Antal flyttningar',additive:true,allowNegative:true,noSum:[migration.code]};
    if(/^Folkmängdsförändring/.test(table.title))return {label:'Folkmängdsförändring',unit:'Antal personer',additive:true,allowNegative:true};
    if(/^Antal hushåll/.test(table.title))return {label:'Hushåll',unit:'Antal hushåll',additive:true};
    if(/^Födda/.test(table.title))return {label:'Födda',unit:'Antal barn',additive:true};
    if(/^Avlidna/.test(table.title))return {label:'Avlidna',unit:'Antal personer',additive:true};
    if(/^Trångbodda/.test(table.title))return {label:'Personer efter trångboddhet',unit:'Antal personer',additive:true};
    if(/^(Folkmängd|Befolkningen|Antal personer)/.test(table.title))return {label:'Folkmängd',unit:'Antal personer',additive:true};
  }
  if(table.subject==='Bostäder och byggande'&&/^(Bostadsbestånd|Specialbostäder|Färdigställda bostäder|Nybygg)/.test(table.title))return {label:/^(Färdigställda|Nybygg)/.test(table.title)?'Färdigställda bostäder':table.title.startsWith('Special')?'Specialbostäder':'Bostadsbestånd',unit:'Antal bostäder',additive:true,allowNegative:true};
  if(table.subject==='Arbetsmarknad'){
    if(/^Unga som varken arbetar eller studerar/.test(table.title))return {label:'Unga efter arbete och studier',unit:'Antal personer',additive:true};
    if(/^Antal arbetsställen/.test(table.title))return {label:'Arbetsställen',unit:'Antal arbetsställen',additive:true};
    const match=table.title.match(/^(Arbetssökande|Öppet arbetslösa|Dagbefolkning|Arbetspendling|Förvärvsarbetande|Sysselsatta|Syselsatta)\b/);
    if(match){
      const categories=(table.metadata?.variables||[]).flatMap(v=>v.valueTexts||[]).join(' ');
      const broader=/Ej (?:förvärvsarbetande|sysselsatt)/i.test(categories);
      const label=broader?'Personer efter sysselsättning':/Ej arbetssökande/i.test(categories)?'Personer efter arbetssökandekategori':match[1]==='Syselsatta'?'Sysselsatta':match[1];
      return {label,unit:'Antal personer',additive:true};
    }
  }
  return null;
}
