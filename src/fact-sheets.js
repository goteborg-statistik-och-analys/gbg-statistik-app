import {normalize} from './core.js';

export const publishedFactSheets=[{
  factSheet:'population-forecast',title:'Faktablad: Befolkningsprognos',href:'prognos.html',
  description:'Befolkningsprognos för Göteborg, stadsområden och mellanområden. Välj åldrar och områden.',
  levels:['Kommun','Stadsområde','Mellanområde']
},{
  factSheet:'municipality-comparison',title:'Faktablad: Göteborg i jämförelse',href:'jamforelse.html',
  description:'Jämför folkmängd, folkökning, åldersstruktur och försörjningskvot. Göteborg i fokus och tiolistor för senaste året.',
  levels:['Kommun']
}];

export function matchingFactSheets(text){
  const words=normalize(text).split(/[^a-z0-9]+/).filter(word=>word.length>=3);
  const terms={
    'population-forecast':['befolkningsprognos','kommunprognos','prognos','mellanomradesprognos','stadsomradesprognos'],
    'municipality-comparison':['jamforelse','jamfor','kommunjamforelse','befolkningstillvaxt','folkökning','forsorjningskvot']
  };
  return publishedFactSheets.filter(sheet=>words.some(word=>word.length>=(sheet.factSheet==='municipality-comparison'?4:3)&&['faktablad',...terms[sheet.factSheet]].map(normalize).some(term=>term.startsWith(word)||word===term+'en'||word===term+'er')));
}

export function filterFactSheets(sheets,{theme='',level=''}={}){
  return sheets.filter(sheet=>(!theme||theme==='Faktablad')&&(!level||sheet.levels.includes(level)));
}
