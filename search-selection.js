import {normalize,labelOf,areaOf} from './core.js';
import {ageRangeValues,valueLabel} from './group-selection.js';
export function searchSelection(metadata,intent={}){
  const selections={},warnings=[];
  const area=areaOf(metadata);
  if(intent.areas?.length===1){
    const value=area?.values.find(value=>normalize(labelOf(valueLabel(area,value)))===intent.areas[0]);
    if(value)selections[area.code]=[value];else warnings.push('Området i sökningen finns inte i denna tabell. Välj område manuellt.');
  }
  if(intent.age){
    const v=metadata.variables.find(v=>v.code==='Ålder');
    try{if(!v)throw new Error('Tabellen saknar åldersindelning.');selections['Ålder']=ageRangeValues(v,...intent.age);}
    catch(error){warnings.push('Åldersurvalet kunde inte fyllas i: '+error.message);}
  }
  if(intent.sexes?.length===1){
    const v=metadata.variables.find(v=>v.code==='Kön');
    const value=v?.values.find(value=>(intent.sexes[0]==='female'?/^kvinn/:/^man$/).test(normalize(valueLabel(v,value))));
    if(value)selections['Kön']=[value];else warnings.push('Könet i sökningen finns inte som val i denna tabell.');
  }
  return {selections,warnings};
}
