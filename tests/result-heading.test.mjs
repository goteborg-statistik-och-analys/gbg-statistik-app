import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resultHeading,resultHeadingText,resultAreaLabel} from '../result-heading.js';
import {seriesChart,chartDescriptions} from '../series-chart.js';
const table={title:'Arbetssökande efter kategori och utbildningsnivå 2010-2025',level:'Stadsområde',metadata:{variables:[
  {code:'Område',values:['01 Nordost']},{code:'Utbildningsnivå',values:['Förgymnasial','Gymnasial']},{code:'Arbetssökandekategori',values:['Öppet arbetslösa','Övriga']},{code:'År',values:['2024','2025']}
]}};
const group={selections:{Område:['01 Nordost'],Utbildningsnivå:['Förgymnasial'],Arbetssökandekategori:['Öppet arbetslösa']}};
const result={table,groups:[group],measure:'Arbetssökande',area:'Nordost',date:'2026-09-16',series:[{name:'Nordost',detail:'Urval',rows:[{year:2024,value:100},{year:2025,value:110}]}]};
test('The chart uses the table title and selected filters; only the export repeats the visible heading',()=>{
  assert.equal(resultHeadingText(result),'Arbetssökande efter kategori och utbildningsnivå · Utbildningsnivå: Förgymnasial · Arbetssökandekategori: Öppet arbetslösa');
  const exported=seriesChart(result),screen=seriesChart({...result,includeHeading:false});
  for(const phrase of ['Arbetssökande efter kategori och utbildningsnivå','Utbildningsnivå: Förgymnasial','Arbetssökandekategori: Öppet arbetslösa']){
    assert.ok(exported.slice(exported.indexOf('<g font-family')).includes(phrase));
    assert.ok(!screen.slice(screen.indexOf('<g font-family')).includes(phrase));
  }
  assert.match(screen,/Stadsområde · 2024–2025/);assert.match(screen,/>Antal personer<\/text>/);assert.doesNotMatch(screen,/>Antal personer · Nordost<\/text>/);
  assert.match(screen,/data-plot-top="65"/);assert.match(exported,/data-plot-top="135"/);
});
test('Comparison headings show shared filters without applying the first group to the others',()=>{
  const other={selections:{...group.selections,Utbildningsnivå:['Gymnasial']}};
  assert.equal(resultHeading({...result,groups:[group,other]}).selection,'Arbetssökandekategori: Öppet arbetslösa');
  assert.equal(resultHeading({...result,groups:[]}).selection,'');
});
test('Long series descriptions are available on demand while exports retain them',()=>{
  const series=[{...result.series[0],detail:'Unik urvalsbeskrivning A'},{...result.series[0],name:'Centrum',detail:'Unik urvalsbeskrivning B'}];
  const screen=seriesChart({...result,series,includeDescriptions:false});
  assert.doesNotMatch(screen,/Unik urvalsbeskrivning/);
  const exported=seriesChart({...result,series});
  assert.match(exported,/Unik urvalsbeskrivning A/);assert.match(exported,/Unik urvalsbeskrivning B/);
  const details=chartDescriptions(series);
  assert.match(details,/<summary>Visa urval per serie<\/summary>/);assert.doesNotMatch(details,/<details[^>]*\bopen\b/);
  assert.match(details,/Unik urvalsbeskrivning A/);assert.match(details,/Unik urvalsbeskrivning B/);
  assert.match(chartDescriptions([{...series[0],name:'<img>',detail:'A & B'}]),/&lt;img&gt;/);
});
test('Multiple selected areas produce a compact heading without changing the underlying selections',()=>{
  const multiple={...result,table:{...table,metadata:{variables:[{code:'Område',values:['01 Nordost','02 Centrum','99 Ospecificerat Göteborg']}] }},groups:[{selections:{Område:['01 Nordost','02 Centrum']}},{selections:{Område:['02 Centrum','99 Ospecificerat Göteborg']}}]};
  assert.equal(resultAreaLabel(multiple),'3 valda områden');
  assert.equal(resultAreaLabel(result),'Nordost');
  assert.equal(resultAreaLabel({...result,groups:[]}),result.area);
  assert.equal(multiple.groups[0].selections.Område.length,2);
});
test('The chart has an accessible name without a native SVG title hover popup',()=>{
  const svg=seriesChart(result);
  assert.doesNotMatch(svg,/<title id="chart-title"/);
  assert.match(svg,/role="img" aria-label="Arbetssökande efter kategori och utbildningsnivå/);
  assert.match(svg,/aria-describedby="chart-desc"/);
  assert.match(svg,/<desc id="chart-desc">/);
});
