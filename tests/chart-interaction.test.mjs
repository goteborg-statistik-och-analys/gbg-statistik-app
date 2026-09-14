import {test} from 'node:test';
import assert from 'node:assert/strict';
import {attachSeriesInteraction,seriesChart} from '../series-chart.js';

// Minimal SVG surface to exercise pointer, focus and keyboard events without a browser.
class Element {
  constructor(){this.attributes={};this.style={};this.children=[];this.events={};this.dataset={};this.textContent='';}
  setAttribute(key,value){this.attributes[key]=String(value);}
  removeAttribute(key){delete this.attributes[key];}
  append(...children){this.children.push(...children);}
  addEventListener(name,handler){this.events[name]=handler;}
  querySelector(){return null;}
  getComputedTextLength(){return this.textContent.length*7;}
}
test('Hover anywhere in the plot shows all series, including missing values, and restores styling on exit',()=>{
  const documentBefore=globalThis.document,pointBefore=globalThis.DOMPoint;
  try{
    globalThis.document={createElementNS:()=>new Element(),createElement:()=>new Element(),activeElement:null};
    globalThis.DOMPoint=class{constructor(x,y){this.x=x;this.y=y;}matrixTransform(){return this;}};
    const svg=new Element(),container=new Element();container.querySelector=()=>svg;
    const points=[2024,2025,2024].map(year=>{const p=new Element();p.dataset.year=String(year);return p;}),lines=[new Element(),new Element()];
    svg.querySelectorAll=selector=>selector.startsWith('circle')?points:lines;
    svg.getScreenCTM=()=>({inverse:()=>({})});
    const series=[{name:'Män',rows:[{year:2024,value:12},{year:2025,value:13}]},{name:'Kvinnor',rows:[{year:2024,value:20},{year:2025,value:null}]}];
    attachSeriesInteraction(container,series);
    const overlay=svg.children[0];
    svg.events.pointermove({clientX:740,clientY:300});
    assert.equal(overlay.style.display,'');
    assert.ok(overlay.children.some(n=>n.textContent==='Män: 13 personer'));
    assert.ok(overlay.children.some(n=>n.textContent==='Kvinnor: Uppgift saknas'));
    assert.equal(points[1].attributes.r,'7');assert.equal(points[0].style.opacity,'.25');assert.equal(lines[0].style.opacity,'.3');
    svg.events.pointerleave();assert.equal(overlay.style.display,'none');assert.equal(lines[0].style.opacity,'');assert.equal(points[1].attributes.r,'4');
    document.activeElement=svg;svg.events.focus();
    svg.events.keydown({key:'Home',preventDefault(){}});
    assert.ok(container.children[0].textContent.includes('2024'));
    svg.events.keydown({key:'Escape'});assert.equal(overlay.style.display,'none');
  }finally{globalThis.document=documentBefore;globalThis.DOMPoint=pointBefore;}
});
test('Exported chart includes a line-style legend even for a series with no values',()=>{
  const svg=seriesChart({series:[{name:'Män',detail:'Kön: Man',rows:[{year:2024,value:2},{year:2025,value:3}]},{name:'Kvinnor',detail:'Kön: Kvinna',rows:[{year:2024,value:null},{year:2025,value:null}]}],area:'Göteborg',table:{level:'Kommun'},measure:'Folkmängd',date:'2026-09-14'});
  assert.match(svg,/<line[^>]+stroke="#674b99"[^>]+stroke-dasharray="9 4"/);
  assert.ok(svg.includes('2. Kvinnor: Kön: Kvinna'));
});
