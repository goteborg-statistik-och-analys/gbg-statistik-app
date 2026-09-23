import {comparisonExportRows,comparisonCSV,comparisonExcel,comparisonExportSVG} from './comparison-exports.js';
const icon=path=>`<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"/></svg>`;
const downloadIcon=icon('M10 2v10m-3-3 3 3 3-3M4 12v4h12v-4');
export function factSheetActions(id){return `<div class="downloads fact-actions"><div class="fact-export"><button type="button" class="secondary" data-action="menu" aria-expanded="false" aria-controls="${id}-exports">${downloadIcon}<span>Ladda ner</span>${icon('m6 8 4 4 4-4')}</button><div id="${id}-exports" class="fact-export-options" hidden>${[['csv','CSV'],['xlsx','Excel'],['png','PNG'],['svg','SVG'],['print','Skriv ut']].map(([action,label])=>`<button type="button" class="secondary" data-action="${action}">${action==='print'?icon('M5 6V2h10v4M5 14H2V7h16v7h-3M5 11h10v7H5Z'):downloadIcon}<span>${label}</span></button>`).join('')}</div></div><button type="button" class="secondary visual-expand" data-action="expand" aria-haspopup="dialog" aria-controls="comparison-dialog">${icon('M7 3H3v4m10-4h4v4M3 13v4h4m10-4v4h-4M3 3l5 5m9-5-5 5M3 17l5-5m9 5-5-5')}<span>Förstora</span></button></div>`;}
export function initFactSheetActions({getModel,redraw}){
  const dialog=document.createElement('dialog');dialog.id='comparison-dialog';dialog.className='help-dialog visual-dialog';dialog.setAttribute('aria-labelledby','comparison-dialog-title');
  dialog.innerHTML=`<div class="help-dialog-heading"><h2 id="comparison-dialog-title">Förstorad vy</h2><button type="button" class="visual-close" aria-label="Stäng förstorad vy" autofocus>${icon('m5 5 10 10M15 5 5 15')}</button></div><div class="visual-dialog-content"></div>`;
  document.body.append(dialog);let placeholder,panel,opener;
  const closeMenus=()=>{for(const menu of document.querySelectorAll('.fact-export-options'))menu.hidden=true;for(const button of document.querySelectorAll('[data-action="menu"]'))button.setAttribute('aria-expanded','false');};
  const download=(body,type,extension,id)=>{const url=URL.createObjectURL(new Blob([body],{type})),a=document.createElement('a');a.href=url;a.download=`goteborg-jamforelse-${id}.${extension}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  dialog.querySelector('.visual-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{placeholder.replaceWith(panel);opener.hidden=false;document.documentElement.classList.remove('visual-open');redraw(panel.id);opener.focus({preventScroll:true});});
  dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){const open=document.querySelector('.fact-export-options:not([hidden])');if(open){event.preventDefault();const toggle=open.parentElement.querySelector('[data-action="menu"]');closeMenus();toggle.focus();}}});
  document.addEventListener('click',async event=>{
    const button=event.target.closest('.fact-actions [data-action]');if(!event.target.closest('.fact-export'))closeMenus();if(!button)return;
    const target=button.closest('.comparison-panel'),id=target.id,action=button.dataset.action;
    if(action==='menu'){const menu=target.querySelector('.fact-export-options'),open=menu.hidden;closeMenus();menu.hidden=!open;button.setAttribute('aria-expanded',String(open));return;}
    closeMenus();
    if(action==='expand'){panel=target;opener=button;placeholder=document.createComment('fact-sheet-chart');panel.before(placeholder);dialog.querySelector('.visual-dialog-content').append(panel);button.hidden=true;dialog.showModal();document.documentElement.classList.add('visual-open');redraw(id);return;}
    if(action==='print'){if(dialog.open)dialog.close();window.print();return;}
    const model=getModel(id);if(!model)return;
    const status=target.querySelector('.fact-action-status');status.textContent='';
    try{
      if(action==='csv')download(comparisonCSV(comparisonExportRows(model)),'text/csv;charset=utf-8','csv',id);
      else if(action==='xlsx')download(await comparisonExcel(model),'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','xlsx',id);
      else{
        const svg=comparisonExportSVG(model);
        if(action==='svg')download(svg,'image/svg+xml;charset=utf-8','svg',id);
        if(action==='png'){
          const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
          try{await document.fonts.ready;const image=new Image();image.src=url;await image.decode();const canvas=document.createElement('canvas');canvas.width=2000;canvas.height=Math.round(2000*image.height/image.width);canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error();download(blob,'image/png','png',id);}finally{URL.revokeObjectURL(url);}
        }
      }
    }catch{status.textContent='Filen kunde inte skapas. Försök igen.';}
  });
  window.addEventListener('resize',()=>{if(dialog.open)redraw(panel.id);});
}
