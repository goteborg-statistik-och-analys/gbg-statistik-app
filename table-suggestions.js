import {findTables} from './search.js';

export function suggestedTables(text,catalog){
  if(text.trim())return findTables(text,catalog).tables.slice(0,6);
  // Prefer tables available in the app, then spread the initial suggestions across subjects.
  const candidates=[...catalog.filter(table=>table.kind==='population'),...catalog.filter(table=>table.kind&&table.kind!=='population'),...catalog.filter(table=>!table.kind)];
  const selected=[],subjects=new Set(),titles=new Set();
  for(const table of candidates){
    if(subjects.has(table.subject))continue;
    selected.push(table);subjects.add(table.subject);titles.add(table.title);
    if(selected.length===6)return selected;
  }
  for(const table of candidates){
    if(titles.has(table.title))continue;
    selected.push(table);titles.add(table.title);
    if(selected.length===6)break;
  }
  return selected;
}

export function initTableSuggestions(input,getCatalog,onSelect){
  const form=input.closest('form');
  const panel=document.createElement('div');panel.className='table-suggestions';panel.hidden=true;
  const heading=document.createElement('p');heading.className='suggestions-heading';
  const list=document.createElement('div');list.id='table-suggestions';list.setAttribute('role','listbox');list.setAttribute('aria-label','Tabellförslag');
  panel.append(heading,list);form.append(panel);
  input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-controls',list.id);input.setAttribute('aria-expanded','false');
  let matches=[],active=-1;
  function close(){panel.hidden=true;active=-1;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');}
  function highlight(index){
    active=index;
    [...list.children].forEach((option,i)=>option.setAttribute('aria-selected',String(i===active)));
    if(active<0)input.removeAttribute('aria-activedescendant');
    else{input.setAttribute('aria-activedescendant',list.children[active].id);list.children[active].scrollIntoView({block:'nearest'});}
  }
  function select(index){const table=matches[index];if(!table)return;close();onSelect(table);}
  function refresh(){
    if(document.activeElement!==input)return;
    matches=suggestedTables(input.value,getCatalog());active=-1;input.removeAttribute('aria-activedescendant');list.replaceChildren();
    heading.textContent=matches.length?(input.value.trim()?'Matchande tabeller':'Förslag på tabeller'):'Inga tabellförslag. Prova ett annat sökord eller tryck Enter för att söka.';
    matches.forEach((table,index)=>{
      const option=document.createElement('div');option.id=`table-option-${index}`;option.className='table-option';option.tabIndex=-1;option.setAttribute('role','option');option.setAttribute('aria-selected','false');
      const title=document.createElement('span');title.className='table-option-title';title.textContent=table.title;
      const detail=document.createElement('span');detail.className='table-option-detail';detail.textContent=`${table.subject} · ${table.level}${table.kind?'':' · Öppnas i ny flik ↗'}`;
      option.append(title,detail);option.addEventListener('click',()=>select(index));list.append(option);
    });
    panel.hidden=false;input.setAttribute('aria-expanded','true');
  }
  input.addEventListener('focus',refresh);input.addEventListener('click',refresh);input.addEventListener('input',refresh);
  input.addEventListener('blur',event=>{if(!panel.contains(event.relatedTarget))close();});
  panel.addEventListener('mousedown',event=>event.preventDefault());
  input.addEventListener('keydown',event=>{
    if(event.isComposing)return;
    if(event.key==='Escape'){if(!panel.hidden){event.preventDefault();close();}return;}
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){
      event.preventDefault();if(panel.hidden)refresh();if(!matches.length)return;
      highlight(event.key==='ArrowDown'?(active+1)%matches.length:(active<0?matches.length-1:(active-1+matches.length)%matches.length));
    }else if(event.key==='Enter'&&!panel.hidden&&active>=0){event.preventDefault();select(active);}
    else if(event.key==='Tab')close();
  });
  form.addEventListener('submit',close);
  document.addEventListener('pointerdown',event=>{if(!form.contains(event.target))close();});
  return {close,refresh};
}
