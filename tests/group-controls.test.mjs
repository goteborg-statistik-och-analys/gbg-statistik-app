import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initGroupControls} from '../group-controls.js';
class Element {
  get options(){return this.children;}
  constructor(tag){this.tag=tag;this.children=[];this.events={};this.attributes={};this.value='';this.checked=false;this.textContent='';}
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=nodes;}
  add(option){this.append(option);if(this.children.length===1)this.value=option.value;}
  setAttribute(key,value){this.attributes[key]=value;}
  removeAttribute(key){delete this.attributes[key];}
  addEventListener(event,fn){(this.events[event]??=[]).push(fn);}
  dispatchEvent(event){for(const fn of this.events[event.type]||[])fn(event);}
  focus(){document.activeElement=this;}
}
function walk(node){return [node,...node.children.flatMap(walk)];}
function setup(run){
  const oldDocument=globalThis.document,oldOption=globalThis.Option;
  try{
    globalThis.document={createElement:tag=>new Element(tag),createTextNode:text=>{const n=new Element('text');n.textContent=text;return n;}};
    globalThis.Option=class extends Element{constructor(text,value){super('option');this.textContent=text;this.value=value;}};
    run();
  }finally{globalThis.document=oldDocument;globalThis.Option=oldOption;}
}
const metadata={variables:[{code:'Kön',values:['Man','Kvinna','Båda kön']},{code:'Arbetssökandekategori',values:['Öppet arbetslösa','Ej arbetssökande']},{code:'År',values:['2025']}]};
test('All categories and separate reporting remain distinct from a summed total',()=>setup(()=>{
  const container=new Element('div'),controls=initGroupControls(container,metadata);
  const all=walk(container).find(n=>n.textContent==='Välj alla');all.dispatchEvent({type:'click'});
  const report=walk(container).find(n=>n.id==='report-0-0');report.value='separate';report.dispatchEvent({type:'change'});
  clickCheck(walk(container).find(n=>n.value==='Öppet arbetslösa'));
  assert.deepEqual(controls.read()[0].selections.Kön,['Man','Kvinna']);assert.deepEqual(controls.read()[0].separate,['Kön']);
  clickCheck(walk(container).find(n=>n.id==='group-0-dimension-0-total'));
  assert.deepEqual(controls.read()[0].separate,[]);assert.deepEqual(controls.read()[0].selections.Kön,['Båda kön']);
}));
function clickCheck(node,checked=true){node.checked=checked;node.dispatchEvent({type:'change'});}
test('Restricted measures enforce separate reporting and months remain time points',()=>setup(()=>{
  const container=new Element('div');
  let controls=initGroupControls(container,metadata,()=>undefined,{}, {noSum:['Arbetssökandekategori'],additive:true});
  const report=walk(container).find(n=>n.id==='report-0-1');assert.equal(report.value,'separate');assert.equal(report.options[0].disabled,true);
  assert.equal(walk(container).find(n=>n.id==='group-0-dimension-1-total').disabled,true);
  controls=initGroupControls(container,{variables:[{code:'Månad',values:['Januari','Februari']},{code:'År',values:['2025']}]},()=>undefined,{}, {monthly:true,additive:true});
  clickCheck(walk(container).find(n=>n.id==='group-0-dimension-0-total'));
  assert.deepEqual(controls.read()[0].separate,[]);assert.deepEqual(controls.read()[0].selections.Månad,['Januari','Februari']);
  assert.equal(walk(container).find(n=>n.id==='report-0-0').disabled,true);
}));
test('Default selection requires an active choice in every filter and has no global total mode',()=>setup(()=>{
  const container=new Element('div'),controls=initGroupControls(container,metadata);
  const mode=walk(container).find(n=>n.id==='group-mode');assert.deepEqual(mode.children.map(n=>n.value),['sum','compare']);assert.equal(mode.value,'sum');
  assert.throws(()=>controls.read(),/välj Kön/);
  const sexTotal=walk(container).find(n=>n.id==='group-0-dimension-0-total');
  clickCheck(sexTotal);assert.throws(()=>controls.read(),/Arbetssökandekategori/);
  const category=walk(container).find(n=>n.value==='Öppet arbetslösa');clickCheck(category);
  assert.deepEqual(controls.read()[0].selections,{Kön:['Båda kön'],Arbetssökandekategori:['Öppet arbetslösa']});
  const man=walk(container).find(n=>n.value==='Man');clickCheck(man);assert.equal(sexTotal.checked,false);
  assert.deepEqual(controls.read()[0].selections.Kön,['Man']);
  clickCheck(sexTotal);assert.equal(man.checked,false);
  assert.equal(walk(container).filter(n=>n.tag==='input'&&n.value==='Båda kön').length,0);
  mode.value='compare';mode.dispatchEvent({type:'change'});assert.throws(()=>controls.read(),/Grupp 2/);
  mode.value='sum';mode.dispatchEvent({type:'change'});assert.equal(controls.read().length,1);
}));
test('Search presets fill only the requested filters; area totals use the city without double counting',()=>setup(()=>{
  const container=new Element('div'),m={variables:[{code:'Område',values:['101 A','102 B','Göteborg']},...metadata.variables]};
  const controls=initGroupControls(container,m,()=> '101 A',{Kön:['Kvinna']});
  assert.throws(()=>controls.read(),/Område/);
  clickCheck(walk(container).find(n=>n.id==='group-0-dimension-0-total'));
  assert.throws(()=>controls.read(),/Arbetssökandekategori/);
  clickCheck(walk(container).find(n=>n.value==='Öppet arbetslösa'));
  assert.deepEqual(controls.read()[0].selections,{Område:['Göteborg'],Kön:['Kvinna'],Arbetssökandekategori:['Öppet arbetslösa']});
}));
