import {mkdir,readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const directory='data/goteborg-jamforelse';
const base='https://api.scb.se/OV0104/v1/doris/sv/ssd/BE/BE0101/BE0101A/';
const municipalities=JSON.parse(await readFile(`${directory}/municipalities.json`,'utf8'));
const metadata={};
for(const id of ['BefolkningNy','BefolkningCKM']){
  const response=await fetch(base+id,{signal:AbortSignal.timeout(60000)});
  if(!response.ok)throw Error(`SCB ${id}: HTTP ${response.status}`);
  metadata[id]=await response.json();
}
const variable=(id,code)=>metadata[id].variables.find(v=>v.code===code);
const label=(id,code,value)=>{const v=variable(id,code);assert.ok(v,`Saknad variabel ${code}`);const i=v.values.indexOf(value);assert.ok(i>=0,`Saknad kod ${id}/${code}/${value}`);return v.valueTexts[i];};
for(const area of municipalities.areas){
  for(const id of Object.keys(metadata))assert.equal(label(id,'Region',area.code),area.name);
}
assert.equal(new Set(municipalities.areas.map(a=>a.code)).size,municipalities.areas.length);
const ages=Array.from({length:100},(_,i)=>String(i));
for(const code of ages)assert.equal(label('BefolkningNy','Alder',code),label('BefolkningCKM','Alder',code));
assert.equal(label('BefolkningNy','Alder','100+'),label('BefolkningCKM','Alder','100+1'));
for(const sex of ['1','2'])assert.equal(label('BefolkningNy','Kon',sex),label('BefolkningCKM','Kon',sex));
assert.equal(label('BefolkningNy','ContentsCode','BE0101N1'),'Folkmängd');
assert.equal(label('BefolkningCKM','ContentsCode','000007ME'),'Folkmängd');
for(const year of Array.from({length:25},(_,i)=>String(2000+i)))label('BefolkningNy','Tid',year);
label('BefolkningCKM','Tid','2025');
const overlap=variable('BefolkningNy','Tid').values.filter(y=>variable('BefolkningCKM','Tid').values.includes(y));
const differences={};
for(const code of ['Civilstand','Alder','Kon','ContentsCode','Tid']){
  const old=variable('BefolkningNy',code),current=variable('BefolkningCKM',code);
  differences[code]={historicalOnly:old.values.filter(v=>!current.values.includes(v)),currentOnly:current.values.filter(v=>!old.values.includes(v))};
}
const report={checkedAt:new Date().toISOString(),status:'Metadata verifierade för tabellparet. Värdekontroller redovisas separat i snapshotens granskningsfil.',
  municipalities:municipalities.areas.length,groups:Object.fromEntries(['A1','B3','GR'].map(g=>[g,municipalities.areas.filter(a=>a.groups.includes(g)).length])),
  startYear:2000,historicalLastYear:2024,currentYears:variable('BefolkningCKM','Tid').values,overlappingYears:overlap,
  checks:['Kommunernas koder och namn matchar båda tabellerna','Ettårsåldrar 0–99 har samma koder och etiketter','100+ och 100+1 har samma åldersetikett','Kön 1 och 2 har samma etiketter','Valt tabellinnehåll är Folkmängd i båda tabellerna','Alla år 2000–2024 samt 2025 finns'],
  differences,
  limitations:['Inga överlappande år: ingen direkt kontroll av samma års värden mellan tabellerna.',
    'Från 2025 innehåller publicerade uppgifter CKM-osäkerhet. Summor av delar behöver inte motsvara publicerade totaler.',
    'Uppsala: Knivsta bildades 2003-01-01. Historiken är inte omräknad till en fast kommunindelning.',
    'Samma SKR-grupper från 2023 används för urvalet under hela perioden.'],
  sources:Object.keys(metadata).map(id=>({id,url:base+id})),metadata};
await mkdir(directory,{recursive:true});
await writeFile(`${directory}/source-validation.json`,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,metadata:undefined,differences:undefined},null,2));
