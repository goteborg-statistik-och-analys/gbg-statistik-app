import {alignVisualHeadings} from './result-heading.js';

export function initVisualDialog(panel,doc=document){
  alignVisualHeadings(panel);
  const trigger=doc.createElement('button');
  trigger.type='button';trigger.className='secondary visual-expand';
  trigger.setAttribute('aria-label','Förstora diagram eller karta');
  trigger.setAttribute('aria-haspopup','dialog');
  trigger.setAttribute('aria-controls','visual-dialog');
  trigger.title='Förstora';
  trigger.innerHTML='<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3H3v4m10-4h4v4M3 13v4h4m10-4v4h-4M3 3l5 5m9-5-5 5M3 17l5-5m9 5-5-5"/></svg><span>Förstora</span>';
  panel.querySelector('.downloads').append(trigger);
  const dialog=doc.createElement('dialog');
  dialog.id='visual-dialog';dialog.className='help-dialog visual-dialog';
  dialog.setAttribute('aria-labelledby','visual-dialog-title');
  dialog.innerHTML='<div class="help-dialog-heading"><h2 id="visual-dialog-title">Förstorad vy</h2><button type="button" class="visual-close" aria-label="Stäng förstorad vy" autofocus><svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15"/></svg></button></div><div class="visual-dialog-content"></div>';
  doc.body.append(dialog);
  const content=dialog.querySelector('.visual-dialog-content');
  let placeholder;
  trigger.addEventListener('click',()=>{
    if(dialog.open)return;
    // Move the live panel so selections, exports and pointer handlers stay intact.
    placeholder=doc.createComment('visual-panel');panel.before(placeholder);
    content.append(panel);trigger.hidden=true;
    doc.documentElement.classList.add('visual-open');dialog.showModal();
  });
  dialog.querySelector('.visual-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{
    placeholder.replaceWith(panel);trigger.hidden=false;
    doc.documentElement.classList.remove('visual-open');
    trigger.focus({preventScroll:true});
  });
  dialog.addEventListener('click',event=>{
    if(event.target!==dialog)return;
    const box=dialog.getBoundingClientRect();
    if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)dialog.close();
  });
}
