import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resultHeading,resultHeadingText,resultAreaLabel} from '../src/result-heading.js';
import {seriesChart,chartDescriptions} from '../src/series-chart.js';
const table={title:'Arbetssökande efter kategori och utbildningsnivå 2010-2025',level:'Stadsområde',metadata:{variables:[
  {code:'Område',values:['01 Nordost']},{code:'Utbildningsnivå',values:['Förgymnasial','Gymnasial']},{code:'Arbetssökandekategori',values:['Öppet arbetslösa','Övriga']},{code:'År',values:['2024','2025']}
]}};
const group={selections:{Område:['01 Nordost'],Utbildningsnivå:['Förgymnasial'],Arbetssökandekategori:['Öppet arbetslösa']}};
const result={table,groups:[group],measure:'Arbetssökande',area:'Nordost',date:'2026-09-16',series:[{name:'Nordost',detail:'Urval',rows:[{year:2024,value:100},{year:2025,value:110}]}]};
test('Responsive chart keeps axes, points and source inside short and tall viewports without changing exports',()=>{
  const exported=seriesChart(result);
  for(const height of [240,320,600]){
    const svg=seriesChart({...result,includeHeading:false,includeDescriptions:false,layoutHeight:height});
    assert.ok(svg.includes(`viewBox="0 0 1000 ${height}"`));
    const bottom=Number(svg.match(/data-plot-bottom="([^"]+)"/)[1]);
    assert.equal(bottom,height-65);
    for(const match of svg.matchAll(/<circle[^>]*cy="([^"]+)"/g))assert.ok(Number(match[1])>=65&&Number(match[1])<=bottom);
    for(const match of svg.matchAll(/<text[^>]*y="([^"]+)"/g))assert.ok(Number(match[1])>=0&&Number(match[1])<height);
    assert.match(svg,/>0<\/text>/);
    assert.match(svg,/Källa: Göteborgs Stads statistikdatabas/);
  }
  assert.equal(seriesChart({...result,layoutHeight:240}),exported);
});
test('Crowded end labels stay inside the plot on short screens',()=>{
  const series=Array.from({length:5},(_,i)=>({name:`Område ${i+1}`,rows:[{year:2024,value:90+i},{year:2025,value:100+i}]}));
  for(const layoutHeight of [240,320,450]){
    const svg=seriesChart({...result,series,includeHeading:false,includeDescriptions:false,layoutHeight});
    const bottom=layoutHeight-65;
    const labels=[...svg.matchAll(/<text x="772" y="([^"]+)"/g)].map(match=>Number(match[1])-4);
    assert.equal(labels.length,5);
    assert.ok(labels.every(y=>y>=65&&y<=bottom));
    const sorted=labels.toSorted((a,b)=>a-b);
    assert.ok(sorted.slice(1).every((y,i)=>y>sorted[i]));
  }
});
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
test('A single-series export visibly identifies the area and includes its complete selection',()=>{
  const single={...result,series:[{...result.series[0],name:'Grupp 1',detail:'Område: Nordost · Ålder: 18–29 år · Kön: Kvinnor'}]};
  const exported=seriesChart(single).split('<g font-family')[1];
  assert.match(exported,/>Stadsområde · Nordost · 2024–2025<\/text>/);
  assert.match(exported,/Område: Nordost · Ålder: 18–29 år · Kön: Kvinnor/);
  assert.match(exported,/Källa: Göteborgs Stads statistikdatabas/);
  const screen=seriesChart({...single,includeHeading:false,includeDescriptions:false}).split('<g font-family')[1];
  assert.doesNotMatch(screen,/Område: Nordost/);
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
