export function initHelpDialog(dialog,closeButton,doc=document){
  let opener;
  const content=dialog.querySelector('.help-dialog-content');
  doc.addEventListener('click',event=>{
    const trigger=event.target.closest('[data-help-topic]');if(!trigger)return;
    event.preventDefault();
    if(!dialog.open){opener=trigger;dialog.showModal();doc.documentElement.classList.add('help-open');}
    const topic=trigger.dataset.helpTopic&&doc.getElementById(trigger.dataset.helpTopic);
    if(topic&&dialog.contains(topic)){
      topic.querySelector('h3').focus({preventScroll:true});topic.scrollIntoView({block:'start',behavior:'instant'});
    }else{
      content.scrollTop=0;doc.getElementById('help-title').focus({preventScroll:true});
    }
  });
  closeButton.addEventListener('click',()=>dialog.close());
  // Escape and focus containment are provided by the native modal dialog.
  dialog.addEventListener('close',()=>{doc.documentElement.classList.remove('help-open');opener?.focus({preventScroll:true});});
  dialog.addEventListener('click',event=>{
    if(event.target!==dialog)return;
    const box=dialog.getBoundingClientRect();
    if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)dialog.close();
  });
}
