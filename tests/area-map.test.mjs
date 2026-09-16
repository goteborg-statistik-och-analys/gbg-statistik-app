import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {areaCode,mapSeries,mapScale,mapColor,mapValues,mapSVG,mountAreaMap,attachMapTooltip,mapHeading,mapUnavailableReason} from '../area-map.js';
import {planGroups} from '../group-selection.js';
import {detailedSeries} from '../detailed-results.js';

const geometry=JSON.parse(await readFile(new URL('../data/stadsomraden-map.json',import.meta.url),'utf8'));
const table={kind:'count',level:'Stadsområde',measure:{additive:true},metadata:{variables:[
  {code:'Område',values:['01','02','03','04','99'],valueTexts:['Nordost','Centrum','Sydväst','Hisingen','Ospecificerat Göteborg']},
  {code:'Kön',values:['Man','Kvinna']},{code:'År',values:['2024','2025']}
]}};
const groups=planGroups(table,'01',2024,2025,[{name:'',separate:['Område'],selections:{Område:['01','02','03','04','99'],Kön:['Man','Kvinna']}}]);
const payload={columns:[{code:'Område',type:'d'},{code:'Kön',type:'d'},{code:'År',type:'t'},{code:'Antal',type:'c'}],data:['01','02','03','04','99'].flatMap((a,i)=>['Man','Kvinna'].flatMap(sex=>['2024','2025'].map(year=>({key:[a,sex,year],values:[String(i===4?999999:(i+1)*100+(year==='2025'?50:0))]}))))};
const result={table,groups,series:detailedSeries(payload,groups[0].query,groups[0],table),measure:'Folkmängd',unit:'Antal personer',date:'2026-09-16'};
test('Map heading identifies the table and selected categories without implying the total population',()=>{
  const housing={...result,table:{...table,title:'Folkmängd efter bostadens upplåtelseform 2015-2025',metadata:{variables:[...table.metadata.variables,{code:'Upplåtelseform',values:['A','B','C'],valueTexts:['Äganderätt','Bostadsrätt','Hyresrätt']}] }},groups:[{...groups[0],selections:{...groups[0].selections,Upplåtelseform:['A']}}]};
  assert.deepEqual(mapHeading(housing),{title:'Folkmängd efter bostadens upplåtelseform',selection:'Upplåtelseform: Äganderätt'});
  const mapped=mapSeries(housing);
  for(const includeNotes of [false,true]){
    const svg=mapSVG(housing,geometry,mapped,2025,mapScale(mapped),{includeNotes});
    const header=svg.slice(0,svg.indexOf('<g transform='));
    assert.match(header,/Folkmängd efter bostadens upplåtelseform/);assert.match(header,/Upplåtelseform: Äganderätt/);assert.match(header,/Stadsområden · 2025/);
    const visibleHeader=header.slice(header.indexOf('<g fill='));
    assert.match(visibleHeader,/Folkmängd efter bostadens upplåtelseform/);assert.match(visibleHeader,/Upplåtelseform: Äganderätt/);
  }
  housing.groups[0].selections.Upplåtelseform=['A','B'];
  assert.equal(mapHeading(housing).selection,'Upplåtelseform: Äganderätt, Bostadsrätt');
  housing.groups[0].selections.Kön=['Kvinna'];
  assert.equal(mapHeading(housing).selection,'Kön: Kvinna · Upplåtelseform: Äganderätt, Bostadsrätt');
  housing.groups[0].selections={...groups[0].selections,Upplåtelseform:['A','B','C']};
  assert.equal(mapHeading(housing).selection,'');
});

test('Separate area results retain source codes, map all four areas and exclude unspecified from scale',()=>{
  for(const [raw,code] of [['01 Nordost','1'],['02 Centrum','2'],['03 Sydväst','3'],['04 Hisingen','4'],['99 Ospecificerat Göteborg','99'],['1 Nordost','1']])assert.equal(areaCode(raw),code);
  assert.equal(areaCode('Centrum'),'');
  const series=mapSeries(result);
  assert.deepEqual([...series.keys()],['1','2','3','4']);
  assert.equal(series.get('1').rows[0].value,200);
  const scale=mapScale(series);assert.equal(scale.max,900);
  assert.equal(mapValues(geometry,series,2025).find(f=>f.code==='01').value,300);
  assert.equal(result.series.length,5); // Chart and data exports remain complete.
  assert.deepEqual(geometry.features.map(f=>f.code).sort(),['01','02','03','04']);
  assert.ok(geometry.features.every(f=>f.path.startsWith('M')&&f.path.endsWith('Z')&&!f.path.includes('NaN')));
  assert.equal(geometry.year,2026);
});
test('Eligibility excludes other geographies, separate categories, duplicate areas, multiple selections and monthly data',()=>{
  assert.equal(mapSeries({...result,table:{...table,level:'Primärområde'}}),null);
  assert.equal(mapSeries({...result,groups:[{...groups[0],separate:['Område','Kön']}]}),null);
  assert.equal(mapSeries({...result,groups:[{...groups[0],separate:[]}]}),null);
  assert.equal(mapSeries({...result,groups:[...groups,...groups]}),null);
  assert.equal(mapSeries({...result,series:[...result.series,result.series[0]]}),null);
  assert.equal(mapSeries({...result,table:{...table,measure:{monthly:true}}}),null);
});
test('Unavailable maps explain the specific constraint and the required selection',()=>{
  assert.match(mapUnavailableReason({...result,table:{...table,level:'Primärområde'}}),/Stadsområde/);
  assert.match(mapUnavailableReason({...result,table:{...table,measure:{monthly:true}}}),/årsdata.*månadsdata/);
  assert.match(mapUnavailableReason({...result,groups:[...groups,...groups]}),/en urvalsgrupp/);
  assert.match(mapUnavailableReason({...result,groups:[{...groups[0],separate:[]}]}),/Visa varje kategori separat för Område/);
  const reason=mapUnavailableReason({...result,groups:[{...groups[0],separate:['Område','Kön']}]});
  assert.match(reason,/Kön separat/);assert.match(reason,/Summera valda/);
});
test('Map distinguishes zero, missing values and unselected areas; a single year is supported',()=>{
  const series=new Map([['1',{rows:[{year:2025,value:0}]}],['2',{rows:[{year:2025,value:null}]}]]);
  const values=mapValues(geometry,series,2025);
  assert.equal(values.find(f=>f.code==='01').state,'value');
  assert.equal(values.find(f=>f.code==='02').state,'missing');
  assert.equal(values.find(f=>f.code==='03').state,'outside');
  assert.deepEqual(mapScale(series),{min:0,max:0});
  const svg=mapSVG(result,geometry,series,2025,mapScale(series));
  assert.match(svg,/Nordost: 0 Antal personer/);assert.match(svg,/Centrum: Uppgift saknas/);
  assert.match(svg,/Sydväst: Ingår inte i urvalet/);assert.match(svg,/2026, samma gränser för alla år/);
  assert.equal((svg.match(/data-map-label=/g)||[]).length,4);
  assert.match(svg,/Värden per stadsområde/);
  const onScreen=mapSVG(result,geometry,series,2025,mapScale(series),{includeNotes:false});
  assert.doesNotMatch(onScreen,/Källa:|Områdesgränser:/);
  assert.match(svg,/Källa:/);
  assert.deepEqual(mapScale(new Map([['1',{rows:[{year:2025,value:null}]}]])),null);
});

test('Map tooltip shows area, year, value and unit, supports focus and Escape, and stays within the map',()=>{
  class Element{
    constructor(){this.children=[];this.events={};this.style={};this.dataset={};this.attributes={};this.offsetWidth=180;this.offsetHeight=60;}
    append(...items){this.children.push(...items);}
    setAttribute(key,value){this.attributes[key]=value;}
    removeAttribute(key){delete this.attributes[key];}
    addEventListener(event,fn){this.events[event]=fn;}
    getBoundingClientRect(){return {left:0,top:0,width:400,height:300};}
  }
  const saved=globalThis.document;globalThis.document={createElement:()=>new Element()};
  try{
    const canvas=new Element(),path=new Element();
    Object.assign(canvas,{clientWidth:400,clientHeight:300,scrollLeft:0,scrollTop:0});canvas.querySelectorAll=()=>[path];
    path.dataset={mapName:'Nordost',mapValue:'109 989',mapUnit:'personer'};
    attachMapTooltip(canvas,2025);const tooltip=canvas.children[0];
    assert.equal(tooltip.hidden,true);
    path.events.pointermove({clientX:398,clientY:2});
    assert.equal(tooltip.hidden,false);assert.equal(tooltip.children[0].textContent,'Nordost · 2025');assert.equal(tooltip.children[1].textContent,'109 989');assert.equal(tooltip.children[2].textContent,' personer');
    assert.equal(tooltip.style.left,'212px');assert.equal(tooltip.style.top,'8px');
    path.events.keydown({key:'Escape'});assert.equal(tooltip.hidden,true);assert.equal(path.attributes['data-active'],undefined);
    path.events.focus({});assert.equal(tooltip.hidden,false);
    path.events.blur();assert.equal(tooltip.hidden,true);
    path.dataset.mapValue='Uppgift saknas';path.dataset.mapUnit='';path.events.pointerdown({clientX:10,clientY:100});assert.equal(tooltip.children[1].textContent,'Uppgift saknas');assert.equal(tooltip.children[2].textContent,'');
    canvas.onpointerleave();assert.equal(tooltip.hidden,true);
  }finally{globalThis.document=saved;}
});
test('Continuous colors cover negative and positive values over the full period',()=>{
  const series=new Map([['1',{rows:[{year:2024,value:-100},{year:2025,value:100}]}]]);
  const scale=mapScale(series);
  assert.equal(scale.min,-100);assert.equal(mapColor(-100,scale),'#c0e4f2');assert.equal(mapColor(100,scale),'#3f5564');assert.notEqual(mapColor(-50,scale),mapColor(0,scale));assert.notEqual(mapColor(0,scale),mapColor(50,scale));
  assert.equal(scale.max,100);
});
test('Latest-year scale ignores earlier extremes, preserves values and clamps colors outside its range',()=>{
  const series=new Map([['1',{rows:[{year:2000,value:10},{year:2025,value:100}]}],['2',{rows:[{year:2000,value:1000},{year:2025,value:200}]}],['3',{rows:[{year:2025,value:null}]}]]);
  assert.deepEqual(mapScale(series),{min:10,max:1000});
  const locked=mapScale(series,2025);assert.deepEqual(locked,{min:100,max:200});
  assert.equal(mapColor(10,locked),mapColor(100,locked));assert.equal(mapColor(1000,locked),mapColor(200,locked));
  const svg=mapSVG(result,geometry,series,2000,locked,{scaleYear:2025});
  assert.match(svg,/Skala låst till 2025/);assert.match(svg,/Värden utanför skalan får ändfärger/);assert.match(svg,/Nordost: 10 Antal personer/);
  assert.doesNotMatch(svg,/foreignObject|map-scale-lock/);
  assert.equal(mapScale(series,2026),null);
  const constant={min:100,max:100};assert.equal(mapColor(0,constant),'#c0e4f2');assert.equal(mapColor(200,constant),'#3f5564');assert.notEqual(mapColor(100,constant),mapColor(200,constant));
  const constantSVG=mapSVG(result,geometry,series,2000,constant,{scaleYear:2025});assert.match(constantSVG,/&lt; 100/);assert.match(constantSVG,/&gt; 100/);assert.doesNotMatch(constantSVG,/NaN/);
});

test('Map controls switch views, move between actual years, update exports and clean up',async()=>{
  class Element{
    constructor(){this.children=[];this.events={};this.attributes={};this.hidden=false;}
    append(...nodes){this.children.push(...nodes);}
    prepend(...nodes){this.children.unshift(...nodes);}
    insertBefore(node){this.children.push(node);}
    setAttribute(key,value){this.attributes[key]=value;}
    addEventListener(event,handler){this.events[event]=handler;}
    querySelectorAll(){return [];}
    querySelector(selector){
      if(selector!=='#map-scale-lock'||!this.innerHTML?.includes('id="map-scale-lock"'))return null;
      if(this.lockHTML!==this.innerHTML){this.lockHTML=this.innerHTML;this.lock=new Element();this.lock.checked=this.innerHTML.includes('checked="checked"');}
      return this.lock;
    }
    remove(){this.removed=true;}
    async fire(event){await this.events[event]?.();}
  }
  const oldDocument=globalThis.document,oldFetch=globalThis.fetch;
  globalThis.document={createElement:()=>new Element()};
  globalThis.fetch=async()=>({ok:true,json:async()=>geometry});
  try{
    const panel=new Element(),chart=new Element(),chooser=new Element(),heading=new Element();
    let svg='diagram',draws=0;
    const dispose=mountAreaMap({result:{...result,rows:result.series[0].rows},panel,chart,chooser,heading,drawChart:()=>{draws++;svg='diagram';},setExport:value=>{svg=value;}});
    const [toggle,mapPanel]=panel.children,[diagram,map]=toggle.children;
    assert.equal(mapPanel.hidden,true);
    await map.fire('click');
    assert.equal(chart.hidden,true);assert.equal(chooser.hidden,true);assert.equal(mapPanel.hidden,false);
    assert.equal(map.attributes['aria-pressed'],'true');assert.match(svg,/Stadsområden · 2025/);
    const controls=mapPanel.children[1],[,previous,slider,next,year]=controls.children;
    assert.equal(year.textContent,'2025');assert.equal(next.disabled,true);
    await previous.fire('click');assert.equal(year.textContent,'2024');assert.equal(previous.disabled,true);assert.match(svg,/Stadsområden · 2024/);
    slider.value='1';await slider.fire('input');assert.equal(year.textContent,'2025');
    let lock=mapPanel.children[0].querySelector('#map-scale-lock');lock.checked=true;await lock.fire('change');assert.match(svg,/Skala låst till 2025/);
    await previous.fire('click');assert.match(svg,/Stadsområden · 2024/);assert.match(svg,/Skala låst till 2025/);
    lock=mapPanel.children[0].querySelector('#map-scale-lock');assert.equal(lock.checked,true);lock.checked=false;await lock.fire('change');assert.match(svg,/Samma skala för alla valda år/);
    await diagram.fire('click');assert.equal(chart.hidden,false);assert.equal(mapPanel.hidden,true);assert.equal(svg,'diagram');assert.equal(draws,1);
    dispose();assert.equal(toggle.removed,true);assert.equal(mapPanel.removed,true);
    const singleSeries=result.series.map(s=>({...s,rows:[s.rows[1]]}));
    const singlePanel=new Element();singlePanel.hidden=true;
    const disposeSingle=mountAreaMap({result:{...result,series:singleSeries,rows:singleSeries[0].rows},panel:singlePanel,chart,chooser,heading,drawChart:()=>{},setExport:value=>{svg=value;}});
    assert.equal(singlePanel.hidden,false);assert.equal(singlePanel.children[1].children[1].hidden,true);
    await singlePanel.children[0].children[1].fire('click');assert.match(svg,/Stadsområden · 2025/);
    disposeSingle();
    const unavailablePanel=new Element();let changedExport=false;
    const disposeUnavailable=mountAreaMap({result:{...result,groups:[{...groups[0],separate:['Område','Kön']}],rows:result.series[0].rows},panel:unavailablePanel,chart,chooser,heading,drawChart:()=>{},setExport:()=>{changedExport=true;}});
    const [unavailableToggle,explanation]=unavailablePanel.children,[diagramButton,mapButton]=unavailableToggle.children;
    assert.equal(mapButton.className,'is-unavailable');assert.equal(explanation.hidden,true);
    await mapButton.fire('click');assert.equal(explanation.hidden,false);assert.match(explanation.children[0].textContent,/Kön separat/);
    assert.equal(explanation.children[1].attributes['data-help-topic'],'help-maps');
    assert.equal(mapButton.attributes['aria-expanded'],'true');assert.equal(mapButton.attributes['aria-pressed'],'false');assert.equal(chart.hidden,false);assert.equal(changedExport,false);
    await diagramButton.fire('click');assert.equal(explanation.hidden,true);assert.equal(mapButton.attributes['aria-expanded'],'false');
    disposeUnavailable();assert.equal(explanation.removed,true);assert.equal(unavailableToggle.removed,true);
  }finally{globalThis.document=oldDocument;globalThis.fetch=oldFetch;}
});
