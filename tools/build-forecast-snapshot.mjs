import {readFile, writeFile, mkdir, rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as XLSX from '../vendor/xlsx.mjs';
import {decodePopulation} from '../src/forecast-data.js';

const catalog = JSON.parse(await readFile('data/search-catalog.json', 'utf8'));
const output = 'data/befolkningsprognos';
const staging = 'tmp/forecast-build';
await mkdir(staging, {recursive: true});
const fetchedAt = new Date().toISOString();
const hierarchyUrl = 'https://goteborg.se/wps/wcm/connect/d30328ca-09c0-447d-8f96-954445b47efc/Omr%C3%A5deslista%2B2025.xlsx?MOD=AJPERES';
const geographyUrl = 'https://goteborg.se/wps/portal?uri=gbglnk%3A2025112783636917';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function request(url, query) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(url, {signal: AbortSignal.timeout(60000), ...(query ? {method:'POST', headers:{'Content-Type':'text/plain;charset=UTF-8'}, body:JSON.stringify(query)} : {})});
    if (response.status === 429) { await sleep(10000); continue; }
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
    const result = await response.json();
    if (String(result.error).includes('429')) { await sleep(10000); continue; }
    if (result.error) throw new Error(JSON.stringify(result));
    return result;
  }
  throw new Error('Datakällan är överbelastad. Ingen ny version publicerades.');
}
const hierarchyResponse = await fetch(hierarchyUrl);
if (!hierarchyResponse.ok) throw new Error('Kunde inte hämta områdeshierarkin.');
const workbook = XLSX.read(await hierarchyResponse.arrayBuffer());
const hierarchyRows = XLSX.utils.sheet_to_json(workbook.Sheets['Alla områden'], {header:1});
const parents = new Map();
for (const row of hierarchyRows.slice(1)) {
  if (row[0] !== 'Ja' || !row[3] || !row[4]) continue;
  const code = String(row[3]).match(/^\d+/)?.[0];
  const parent = String(row[4]).match(/^SO (\d+)/)?.[1]?.padStart(2,'0');
  if (!code || !parent) throw new Error('Områdeshierarkins format har ändrats.');
  if (parents.has(code) && parents.get(code) !== parent) throw new Error('Motstridig områdeshierarki.');
  parents.set(code, parent);
}
const configs = [
  ['kommun', 'Kommun', 'ecb5d995cd5b', 'kommun'],
  ['stadsomraden', 'Stadsområde', 'ffeb99e7551d', '1fd9028b2039'],
  ['mellanomraden', 'Mellanområde', '640b3ee672be', 'mellan']
];
const manifest = {schemaVersion:1, fetchedAt, levels:{}};
const products = [];
for (const [level, label, forecastId, historyId] of configs) {
  const forecastTable = catalog.find(table => table.id === forecastId);
  const historyTable = catalog.find(table => table.id === historyId);
  const forecast = await request(forecastTable.url);
  const history = await request(historyTable.url);
  const forecastYears = forecast.variables.find(v => v.code === 'Prognosår').values.map(Number);
  const forecastStart = Math.min(...forecastYears);
  const historyYears = history.variables.find(v => v.code === 'År').values.map(Number).filter(year => year >= 2000 && year < forecastStart);
  const years = [...historyYears, ...forecastYears].sort((a,b) => a-b);
  if (years[0] !== 2000 || years.some((year,i) => i && year !== years[i-1]+1)) throw new Error('Historik/prognos innehåller ett årsgap.');
  const ageVariable = forecast.variables.find(v => v.code === 'Ålder');
  const ageCodes = ageVariable.values;
  const maxAge = ageCodes.length - 1;
  if (![99,100].includes(maxAge) || ageCodes.some((age,i) => parseInt(age,10) !== i)) throw new Error('Åldersindelningen har ändrats.');
  // Confirmed by the statistics owner on 2026-09-22: regional "99 år" means 99+.
  const openTop = true;
  const historyAges = history.variables.find(v => v.code === 'Ålder');
  if (ageCodes.some(age => !historyAges.values.includes(age))) throw new Error('Åldrar kan inte matchas mellan utfall och prognos.');
  const areaCodes = forecast.variables.find(v => v.code === 'Område')?.values || ['Göteborg'];
  const areas = areaCodes.filter(code => !code.startsWith('99 ')).map(value => {
    const code = level === 'kommun' ? '1480' : value.split(' ')[0];
    const parent = level === 'mellanomraden' ? parents.get(code) : undefined;
    if (level === 'mellanomraden' && !['01','02','03','04'].includes(parent)) throw new Error('Området saknar verifierad stadsområdestillhörighet: ' + value);
    return {code, name:value.replace(/^\d+ /,''), sourceCode:value, ...(parent ? {parent} : {})};
  });
  const data = {schemaVersion:1, level, label, fetchedAt, forecastTitle:forecast.title, forecastStart, historyEnd:historyYears.at(-1), maxAge, openTop, years, areas, values:{}, sources:[], hierarchyUrl, geographyUrl,
    notes:[
      'Båda könen. Folkmängd vid årets slut. Prognosen är en bedömning, inte ett utfall.',
      'Historikens källmetadata anger Västfolket 1984–2007 och SCB från 2008.',
      ...(level === 'kommun' ? [] : ['Historik och prognos hämtas ur samma geografiska nivå och matchas på områdeskod och namn. Full historisk gränsjämförbarhet har inte kunnat verifieras i tabellmetadata.','Ospecificerat Göteborg visas inte som ett valbart område.']),
      ...(maxAge === 99 ? ['Delområdesprognosens kategori 99 år omfattar 99 år och äldre, bekräftat av statistikansvarig 2026-09-22. Historikens 99 år och 100+ summeras till motsvarande grupp.'] : [])
    ]};
  const cells = new Map();
  for (const [type, table, metadata, selectedYears] of [['history',historyTable,history,historyYears],['forecast',forecastTable,forecast,forecastYears]]) {
    const queries = [], comments = [], sourceMetadata = [];
    // Small fixed-area chunks stay below the API's cell limit, also for long history.
    for (let offset = 0; offset < areas.length; offset += 3) {
      const selectedAreas = areas.slice(offset,offset+3);
      const selections = Object.fromEntries(metadata.variables.map(variable => {
        let values;
        if (variable.code === 'Ålder') values = type === 'history' && maxAge === 99 ? [...ageCodes, '100- år'] : ageCodes;
        else if (variable.code === 'Område') values = selectedAreas.map(area => area.sourceCode);
        else if (['År','Prognosår'].includes(variable.code)) values = selectedYears.map(String);
        else if (variable.code === 'Kön') {
          const total = variable.values.find(value => /^Totalt/.test(value));
          values = total ? [total] : variable.values;
          if (!total && values.length !== 2) throw new Error('Könsindelningen har ändrats.');
        } else throw new Error('Oväntad dimension: ' + variable.code);
        if (values.some(value => !variable.values.includes(value))) throw new Error('Urval saknas i källan: ' + variable.code);
        return [variable.code, values];
      }));
      const query = {query:Object.entries(selections).map(([code,values]) => ({code,selection:{filter:'item',values}})),response:{format:'json'}};
      const payload = await request(table.url,query);
      for (const [key,value] of decodePopulation(payload,selections)) {
        if (cells.has(key)) throw new Error('Överlappande utfall och prognos.');
        cells.set(key,value);
      }
      queries.push(query); comments.push(...(payload.comments || [])); sourceMetadata.push(...(payload.metadata || []));
      console.log(level, type, `${Math.min(offset+3,areas.length)}/${areas.length} områden`);
      await sleep(1200);
    }
    data.sources.push({type,title:metadata.title,url:table.url,webUrl:table.webUrl,queries,comments:[...new Map(comments.map(x => [JSON.stringify(x),x])).values()],metadata:[...new Map(sourceMetadata.map(x => [JSON.stringify(x),x])).values()]});
  }
  for (const area of areas) data.values[area.code] = years.map(year => ageCodes.map(age => {
    const key = JSON.stringify([area.sourceCode,year,age]);
    if (!cells.has(key)) throw new Error('En förväntad cell saknas: ' + key);
    const value = cells.get(key);
    if (year < forecastStart && maxAge === 99 && age === ageCodes.at(-1)) {
      const oldestKey = JSON.stringify([area.sourceCode,year,'100- år']);
      if (!cells.has(oldestKey)) throw new Error('Historikens 100+ saknas.');
      const oldest = cells.get(oldestKey);
      return value === null || oldest === null ? null : value + oldest;
    }
    return value;
  }));
  const body = JSON.stringify(data);
  const hash = createHash('sha256').update(body).digest('hex').slice(0,12);
  const file = `${level}-${hash}.json`;
  await writeFile(`${staging}/${file}`,body);
  products.push({file,body});
  manifest.levels[level] = {file,bytes:Buffer.byteLength(body),historyEnd:data.historyEnd,forecastStart,end:years.at(-1),areas:areas.length,maxAge};
}
// The manifest is switched last; failed builds cannot replace the working snapshot.
await mkdir(output,{recursive:true});
for (const {file,body} of products) await writeFile(`${output}/${file}`,body);
await writeFile(`${output}/metadata.next.json`,JSON.stringify(manifest,null,2)+'\n');
await rename(`${output}/metadata.next.json`,`${output}/metadata.json`);
console.log(JSON.stringify(manifest,null,2));
