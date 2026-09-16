import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initHelpDialog} from '../help-dialog.js';

test('Help opens at the overview or requested topic and restores the triggering control on close',()=>{
  const events={},dialogEvents={},buttonEvents={},classes=new Set();
  const content={scrollTop:200},title={focus(){this.focused=true;}},topicHeading={focus(){this.focused=true;}};
  const topic={querySelector:()=>topicHeading,scrollIntoView(){this.scrolled=true;}};
  const dialog={open:false,querySelector:()=>content,contains:node=>node===topic,
    addEventListener:(name,fn)=>{dialogEvents[name]=fn;},showModal(){this.open=true;},close(){this.open=false;dialogEvents.close();},
    getBoundingClientRect:()=>({left:10,right:600,top:10,bottom:600})};
  const closeButton={addEventListener:(name,fn)=>{buttonEvents[name]=fn;}};
  const doc={addEventListener:(name,fn)=>{events[name]=fn;},getElementById:id=>id==='help-title'?title:id==='help-maps'?topic:null,
    documentElement:{classList:{add:name=>classes.add(name),remove:name=>classes.delete(name)}}};
  initHelpDialog(dialog,closeButton,doc);
  const trigger={dataset:{helpTopic:''},focus(){this.focused=true;}};
  const click=()=>events.click({target:{closest:()=>trigger},preventDefault(){}});
  click();assert.equal(dialog.open,true);assert.equal(content.scrollTop,0);assert.equal(title.focused,true);assert.ok(classes.has('help-open'));
  buttonEvents.click();assert.equal(dialog.open,false);assert.equal(trigger.focused,true);assert.ok(!classes.has('help-open'));
  trigger.dataset.helpTopic='help-maps';click();assert.equal(topicHeading.focused,true);assert.equal(topic.scrolled,true);
  dialogEvents.click({target:dialog,clientX:30,clientY:30});assert.equal(dialog.open,true);
  dialogEvents.click({target:dialog,clientX:2,clientY:2});assert.equal(dialog.open,false);assert.ok(!classes.has('help-open'));
  click();dialog.close();assert.equal(trigger.focused,true);assert.ok(!classes.has('help-open'));
});
