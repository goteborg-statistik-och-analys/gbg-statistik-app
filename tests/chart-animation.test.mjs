import {test} from 'node:test';
import assert from 'node:assert/strict';
import {animateChartEntrance} from '../src/chart-animation.js';

test('Entrance reveals all series together, restores labels, and respects reduced motion and interaction',()=>{
  const saved={document:globalThis.document,matchMedia:globalThis.matchMedia,requestAnimationFrame:globalThis.requestAnimationFrame,cancelAnimationFrame:globalThis.cancelAnimationFrame};
  const element=()=>({attributes:{},style:{},events:{},children:[],setAttribute(k,v){this.attributes[k]=v;},removeAttribute(k){delete this.attributes[k];},append(n){this.children.push(n);},remove(){this.removed=true;},addEventListener(k,v){this.events[k]=v;},removeEventListener(k){delete this.events[k];}});
  try{
    let tick,cancelled=false;
    const motion={...element(),matches:false};
    globalThis.matchMedia=()=>motion;
    globalThis.document={createElementNS:()=>element()};
    globalThis.requestAnimationFrame=fn=>{tick=fn;return 1;};
    globalThis.cancelAnimationFrame=()=>{cancelled=true;};
    const marks=[element(),element()],ending=element(),svg=element();
    marks[1].setAttribute('stroke-dasharray','9 4');
    svg.viewBox={baseVal:{height:465}};
    svg.querySelectorAll=selector=>selector==='[data-series]'?marks:[ending];
    const finish=animateChartEntrance(svg),clip=svg.children[0],rect=clip.children[0];
    assert.equal(ending.style.visibility,'hidden');
    assert.equal(marks[0].attributes['clip-path'],marks[1].attributes['clip-path']);
    tick(0);tick(150);assert.equal(rect.attributes.width,'0');
    tick(600);assert.equal(rect.attributes.width,'340');
    tick(1050);assert.equal(ending.style.visibility,'');
    assert.equal(marks[0].attributes['clip-path'],undefined);
    assert.equal(marks[1].attributes['stroke-dasharray'],'9 4');
    assert.ok(clip.removed&&cancelled);finish();
    animateChartEntrance(svg);svg.events.focus();
    assert.equal(marks[0].attributes['clip-path'],undefined);
    assert.equal(ending.style.visibility,'');
    motion.matches=true;
    const before=svg.children.length;animateChartEntrance(svg);
    assert.equal(svg.children.length,before);
    motion.matches=false;animateChartEntrance(svg);motion.events.change();
    assert.equal(marks[0].attributes['clip-path'],undefined);
  }finally{Object.assign(globalThis,saved);}
});
