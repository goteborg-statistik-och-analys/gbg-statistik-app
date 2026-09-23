// Pure helpers shared by the snapshot builder, the page and its tests.
export function numberOrNull(value) {
  if (value === null || value === undefined || String(value).trim() === '' || ['..', '.', ':', '-'].includes(String(value))) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new Error('Ogiltigt befolkningsvärde: ' + value);
  return number;
}

export function decodePopulation(payload, selections) {
  const dimensions = payload.columns.filter(column => column.type !== 'c');
  const cells = new Map();
  const expected = Object.values(selections).reduce((n, values) => n * values.length, 1);
  if (payload.data.length !== expected) throw new Error(`Ofullständigt uttag: ${payload.data.length} av ${expected} rader.`);
  const seen = new Set();
  for (const row of payload.data) {
    const signature = JSON.stringify(row.key);
    if (seen.has(signature)) throw new Error('Dubblett i datauttaget.');
    seen.add(signature);
    const key = Object.fromEntries(dimensions.map((column, i) => [column.code, row.key[i]]));
    for (const [code, values] of Object.entries(selections)) if (!values.includes(key[code])) throw new Error('Oväntad kategori: ' + code);
    if (row.values.length !== 1) throw new Error('Förväntade ett befolkningsmått.');
    const id = JSON.stringify([key['Område'] || 'Göteborg', Number(key['År'] || key['Prognosår']), key['Ålder']]);
    const value = numberOrNull(row.values[0]);
    const previous = cells.get(id);
    cells.set(id, previous === null || value === null ? null : (previous || 0) + value);
  }
  return cells;
}

export function ageLabel(from, to, openTopAge = 100) {
  if (from === 0 && to === openTopAge) return 'Alla åldrar';
  if (to === openTopAge) return `${from} år och äldre`;
  return from === to ? `${from} år` : `${from}–${to} år`;
}

export function selectForecast(data, codes, from, to) {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to > data.maxAge || from > to) throw new Error('Välj ett giltigt åldersintervall.');
  if (codes.length > 7) throw new Error('Välj högst sju områden åt gången.');
  return codes.map(code => {
    const area = data.areas.find(area => area.code === code);
    if (!area) throw new Error('Okänt område.');
    return {code, name: area.name, rows: data.years.map((year, index) => {
      const cells = data.values[code][index].slice(from, to + 1);
      const value = cells.length !== to - from + 1 || cells.some(value => value === null) ? null : cells.reduce((sum, value) => sum + value, 0);
      return {year, value, type: year < data.forecastStart ? 'Utfall' : 'Prognos'};
    })};
  });
}

export function selectForecastGroups(data,codes,ranges){
  if(codes.length*ranges.length>7)throw new Error('Välj högst sju linjer totalt (områden × åldersgrupper).');
  return ranges.flatMap(([from,to])=>selectForecast(data,codes,from,to).map(s=>({...s,age:ageLabel(from,to,data.maxAge),name:ranges.length>1?s.name+' · '+ageLabel(from,to,data.maxAge):s.name})));
}

export const forecastMeasures={
  population:{title:'Folkmängd och befolkningsprognos',unit:'Antal personer',note:''},
  change:{title:'Årlig folkökning och befolkningsprognos',unit:'Antal personer',note:'Förändring jämfört med föregående år. Negativa värden betyder folkminskning. Första året saknar jämförelseår i underlaget.'},
  percent:{title:'Årlig folkökning i procent och befolkningsprognos',unit:'Procent',note:'Procentuell förändring jämfört med föregående år. Första året, saknade uppgifter och jämförelsevärdet noll ger Uppgift saknas.'}
};
export function forecastMeasureSeries(series,mode='population'){
  if(!forecastMeasures[mode])throw new Error('Okänt visningsläge.');
  if(mode==='population')return series;
  return series.map(s=>({...s,rows:s.rows.map((row,i)=>{
    const previous=s.rows[i-1];
    const available=previous&&previous.year===row.year-1&&previous.value!==null&&row.value!==null;
    const value=!available||mode==='percent'&&previous.value===0?null:mode==='percent'?(row.value-previous.value)/previous.value*100:row.value-previous.value;
    return {...row,value};
  })}));
}

export function createSnapshotLoader(fetcher = fetch) {
  let manifest;
  const cache = new Map();
  return async function load(level) {
    if (!cache.has(level)) {
      const promise = (async () => {
        manifest ||= fetcher('./data/befolkningsprognos/metadata.json', {cache: 'no-cache'}).then(response => {
          if (!response.ok) throw new Error('Kunde inte läsa prognosens versionsinformation.');
          return response.json();
        }).catch(error => { manifest = undefined; throw error; });
        const metadata = await manifest;
        const entry = metadata.levels[level];
        if (!entry) throw new Error('Prognosnivån saknas.');
        const response = await fetcher('./data/befolkningsprognos/' + entry.file);
        if (!response.ok) throw new Error('Kunde inte läsa prognosunderlaget.');
        const data = await response.json();
        if (data.schemaVersion !== 1 || data.level !== level || data.fetchedAt !== metadata.fetchedAt) throw new Error('Prognosunderlagets version stämmer inte.');
        return data;
      })();
      cache.set(level, promise);
      promise.catch(() => cache.delete(level));
    }
    return cache.get(level);
  };
}
