import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {selectForecast, selectForecastGroups, forecastMeasureSeries, decodePopulation, numberOrNull, ageLabel, createSnapshotLoader} from '../src/forecast-data.js';
import {forecastChart} from '../src/forecast-chart.js';
import {forecastExportRows,forecastCSV,forecastExcel} from '../src/forecast-exports.js';
const directory=new URL('../data/befolkningsprognos/',import.meta.url);
const metadata=JSON.parse(await readFile(new URL('metadata.json',directory),'utf8'));
const snapshots=Object.fromEntries(await Promise.all(Object.entries(metadata.levels).map(async([level,entry])=>[level,JSON.parse(await readFile(new URL(entry.file,directory),'utf8'))])));

test('Annual change handles decline, missing years, zero denominators and forecast transition',()=>{
  const series=[{name:'Test',rows:[100,110,99,null,0,5].map((value,i)=>({year:2024+i,value,type:i<2?'Utfall':'Prognos'}))}];
  assert.deepEqual(forecastMeasureSeries(series,'change')[0].rows.map(r=>r.value),[null,10,-11,null,null,5]);
  assert.deepEqual(forecastMeasureSeries(series,'percent')[0].rows.map(r=>r.value),[null,10,-10,null,null,null]);
  assert.equal(forecastMeasureSeries(series,'change')[0].rows[2].type,'Prognos');
  assert.equal(forecastMeasureSeries(series),series);
  assert.equal(series[0].rows[2].value,99);
  assert.equal(forecastMeasureSeries([{rows:[{year:2024,value:1},{year:2026,value:2}]}],'change')[0].rows[1].value,null);
});

test('Declines and fractional percentages fit the plot and forecast label sits above it',()=>{
  const s=[{name:'Test',rows:[{year:2025,value:-0.35},{year:2026,value:0.15}]}];
  const svg=forecastChart(s,{title:'Årlig folkökning',subtitle:'Test',forecastStart:2026,source:'Källa',unit:'Procent',includeHeading:false});
  const top=Number(svg.match(/data-top="([^"]+)"/)[1]),bottom=Number(svg.match(/data-bottom="([^"]+)"/)[1]);
  const label=svg.match(/<text[^>]+y="([^"]+)"[^>]*font-weight="700">Prognos från 2026/);
  assert.ok(Number(label[1])<top);
  assert.match(svg,/−0,\d+ %/);
  for(const match of svg.matchAll(/<circle[^>]+cy="([^"]+)"/g))assert.ok(Number(match[1])>=top&&Number(match[1])<=bottom);
  assert.doesNotMatch(svg,/NaN|Infinity/);
});

test('Multiple age groups produce independently aggregated lines per selected area',()=>{
  const data=snapshots.stadsomraden,ranges=[[1,5],[6,15]];
  const series=selectForecastGroups(data,['01','02'],ranges);
  assert.equal(series.length,4);
  assert.equal(new Set(series.map(s=>s.name)).size,4);
  assert.deepEqual(series[0].rows,selectForecast(data,['01'],1,5)[0].rows);
  assert.deepEqual(series[2].rows,selectForecast(data,['01'],6,15)[0].rows);
  assert.deepEqual(selectForecastGroups(data,[],ranges),[]);
  assert.deepEqual(selectForecastGroups(data,['01'],[]),[]);
  assert.throws(()=>selectForecastGroups(data,['01','02','03','04'],ranges),/sju linjer/);
});

test('Excel and CSV preserve each age group, source, forecast status and missing values',async()=>{
  const data=snapshots.kommun,series=selectForecastGroups(data,['1480'],[[6,15],[16,18]]);
  series[0].rows[0].value=null;
  const rows=forecastExportRows({data,series,title:'Test',subtitle:'Två åldersgrupper',source:'Källa',comparability:'Områdesindelning'});
  const csv=forecastCSV(rows);
  assert.match(csv,/Göteborg · 6–15 år/);assert.match(csv,/Göteborg · 16–18 år/);
  assert.match(csv,/"2000";"Utfall";"";/);assert.match(csv,/"2026";"Prognos"/);
  const XLSX=await import('../vendor/xlsx.mjs'),book=XLSX.read(await forecastExcel(rows),{type:'array'});
  const exported=XLSX.utils.sheet_to_json(book.Sheets.Befolkningsprognos,{header:1,defval:null});
  const year=exported.find(row=>row[0]===2000);
  assert.equal(year[2],null);assert.equal(year[3],series[1].rows[0].value);
  assert.ok(exported.some(row=>row[0]==='Källa'));
});

test('Snapshot files match the manifest and cover every expected area, year and age',async()=>{
  for(const [level,entry] of Object.entries(metadata.levels)){
    const body=await readFile(new URL(entry.file,directory));
    assert.equal(body.length,entry.bytes);
    assert.ok(entry.file.includes(createHash('sha256').update(body).digest('hex').slice(0,12)));
    const data=snapshots[level];
    assert.equal(data.fetchedAt,metadata.fetchedAt);
    assert.equal(data.years[0],2000);
    assert.equal(data.years.at(-1),level==='kommun'?2050:2033);
    assert.equal(data.areas.length,{kommun:1,stadsomraden:4,mellanomraden:36}[level]);
    assert.equal(new Set(data.areas.map(a=>a.code)).size,data.areas.length);
    for(const area of data.areas){
      assert.equal(data.values[area.code].length,data.years.length);
      for(const row of data.values[area.code]){
        assert.equal(row.length,data.maxAge+1);
        assert.ok(row.every(value=>value===null||Number.isFinite(value)&&value>=0));
      }
    }
  }
});

test('Area hierarchy selects the seven North-East areas, never the whole city',()=>{
  const north=snapshots.mellanomraden.areas.filter(area=>area.parent==='01');
  assert.deepEqual(north.map(a=>a.code),['10','11','12','13','14','15','16']);
  assert.equal(selectForecast(snapshots.mellanomraden,north.map(a=>a.code),6,15).length,7);
  assert.throws(()=>selectForecast(snapshots.mellanomraden,snapshots.mellanomraden.areas.slice(0,8).map(a=>a.code),0,99),/sju/);
});

test('Published municipal totals and 99+ normalization agree with source control values',()=>{
  const data=snapshots.kommun;
  const all=selectForecast(data,['1480'],0,100)[0];
  // Independent API controls, 2026-09-22, with age/gender omitted (source-side totals).
  assert.equal(all.rows.find(row=>row.year===2025).value,613276);
  assert.equal(all.rows.find(row=>row.year===2025).type,'Utfall');
  assert.equal(all.rows.find(row=>row.year===2026).type,'Prognos');
  const region=snapshots.stadsomraden;
  const oldest=selectForecast(region,['01','02'],99,99);
  assert.equal(oldest[0].rows.find(row=>row.year===2025).value,11+18);
  assert.equal(oldest[1].rows.find(row=>row.year===2025).value,40+69);
  assert.ok(region.sources.find(s=>s.type==='history').queries.every(q=>q.query.find(d=>d.code==='Ålder').selection.values.includes('100- år')));
  assert.match(region.notes.join(' '),/99 år och äldre/);
  assert.equal(ageLabel(0,99,99),'Alla åldrar');
  assert.equal(ageLabel(85,99,99),'85 år och äldre');
  assert.equal(ageLabel(99,99,100),'99 år');
});

test('Aggregation preserves missing cells and rejects invalid ranges',()=>{
  const data={maxAge:2,forecastStart:2026,years:[2025,2026],areas:[{code:'a',name:'Test'}],values:{a:[[1,0,null],[2,3,4]]}};
  assert.deepEqual(selectForecast(data,['a'],0,2)[0].rows.map(r=>r.value),[null,9]);
  assert.deepEqual(selectForecast(data,['a'],0,1)[0].rows.map(r=>r.value),[1,5]);
  assert.throws(()=>selectForecast(data,['a'],2,1));
  assert.throws(()=>selectForecast(data,['a'],0,3));
  assert.throws(()=>selectForecast(data,['a'],.5,1));
  for(const value of ['', '..', '.', null])assert.equal(numberOrNull(value),null);
  assert.equal(numberOrNull('0'),0);
  assert.throws(()=>numberOrNull('oops'));
});

test('Source decoding sums genders without replacing missing values with zero',()=>{
  const columns=['Ålder','Kön','År'].map(code=>({code,type:'d'})).concat({code:'Folkmängd',type:'c'});
  const query={'Ålder':['99 år'],'Kön':['Man','Kvinna'],'År':['2025']};
  const payload={columns,data:[{key:['99 år','Man','2025'],values:['3']},{key:['99 år','Kvinna','2025'],values:['4']}]};
  assert.deepEqual([...decodePopulation(payload,query).values()],[7]);
  payload.data[1].values=['..'];assert.deepEqual([...decodePopulation(payload,query).values()],[null]);
  assert.throws(()=>decodePopulation({...payload,data:payload.data.slice(0,1)},query),/Ofullständigt/);
  assert.throws(()=>decodePopulation({...payload,data:[payload.data[0],payload.data[0]]},query),/Dubblett/);
});

test('Repeated and concurrent level loads share one fetch; a failed load can be retried',async()=>{
  const calls=[];
  let fail=true;
  const load=createSnapshotLoader(async url=>{
    calls.push(url);
    if(url.endsWith('metadata.json'))return {ok:true,json:async()=>metadata};
    if(fail){fail=false;return {ok:false};}
    return {ok:true,json:async()=>snapshots.kommun};
  });
  await assert.rejects(load('kommun'));
  const [a,b]=await Promise.all([load('kommun'),load('kommun')]);
  assert.equal(a,b);
  await load('kommun');
  assert.equal(calls.length,3);
});

test('Chart separates forecast from observation and does not connect missing years',()=>{
  const s=[{name:'Test & område',rows:[{year:2024,value:2},{year:2025,value:null},{year:2026,value:4},{year:2027,value:5}]}];
  const svg=forecastChart(s,{title:'Befolkning',subtitle:'Alla åldrar',forecastStart:2026,source:'Källa'});
  assert.match(svg,/data-kind="forecast"[^>]*stroke-dasharray="7 5"/);
  assert.match(svg,/data-kind="history"/);
  assert.match(svg,/circle data-series="0" data-year="2026"/);
  assert.doesNotMatch(svg,/circle data-series="0" data-year="2025"/);
  assert.match(svg,/Test &amp; område/);
  assert.doesNotMatch(svg,/NaN|undefined/);
  const forecastPath=svg.match(/data-kind="forecast" d="([^"]+)"/)[1];
  assert.ok(forecastPath.startsWith(' M')||forecastPath.startsWith('M'));
});

test('Enlarged forecast uses available height while exports retain their standard layout',()=>{
  const series=selectForecast(snapshots.kommun,['1480'],0,100);
  const options={title:'Folkmängd',subtitle:'Alla åldrar',forecastStart:2026,source:'Källa'};
  for(const height of [260,700]){
    const svg=forecastChart(series,{...options,includeHeading:false,layoutHeight:height});
    assert.match(svg,new RegExp('viewBox="0 0 1000 '+height+'"'));
    assert.match(svg,new RegExp('data-bottom="'+(height-44)+'"'));
    assert.match(svg,/data-chart-ending="true"/);
    assert.doesNotMatch(svg,/clip-path|chart-entrance/);
  }
  assert.match(forecastChart(series,options),/viewBox="0 0 1000 490"/);
});

test('Forecast has a compact label margin, explicit age heading and no final-value label',()=>{
  const series=selectForecast(snapshots.kommun,['1480'],6,15);
  const svg=forecastChart(series,{title:'Folkmängd',age:'6–15 år',subtitle:'Göteborg · 2000–2050',forecastStart:2026,source:'Källa'});
  assert.match(svg,/font-weight="700">Ålder: 6–15 år<\/text>/);
  assert.ok(Number(svg.match(/data-right="(\d+)"/)[1])>=880);
  const ending=svg.match(/<g data-chart-ending="true">([\s\S]*?)<\/g>/)[1];
  assert.match(ending,/Göteborg/);
  assert.equal((ending.match(/<tspan/g)||[]).length,1);
  assert.match(ending,/font-size="11"/);
});
