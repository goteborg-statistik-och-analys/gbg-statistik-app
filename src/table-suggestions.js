import {findTables} from './search.js';
import {groupTables,levelLabels} from './catalog-groups.js';
import {normalize} from './core.js';
import {matchingFactSheets} from './fact-sheets.js';

export function suggestedFactSheets(text){
  const query=normalize(text),suggestions=[...matchingFactSheets(text)];
  const age=query.match(/\b(\d{1,3})\s*[-–−]\s*(\d{1,3})\s*-?\s*ar(?:ing(?:ar|arna)?|iga)?\b/);
  if(age&&Number(age[1])<=Number(age[2])&&Number(age[2])<=120){
    suggestions.push({title:`Faktablad: ${Number(age[1])}–${Number(age[2])}-åringar`,factSheet:'hub-facts-age'});
  }
  const words=query.split(/[^a-z0-9]+/).filter(word=>word.length>=3);
  const topics=[['jämlikhet',['jamlikhet','jamlikt','jamlika']],['segregation',['segregation','segregationen']],['arbetsmarknad',['arbetsmarknad','arbetsmarknaden']]];
  for(const [topic,variants] of topics){
    if(words.some(word=>variants.some(variant=>variant.startsWith(word))))suggestions.push({title:`Faktablad: ${topic}`,factSheet:'hub-facts-topic'});
  }
  return suggestions;
}

export function suggestedTables(text,catalog){
  if(text.trim())return groupTables(findTables(text,catalog).tables).slice(0,6);
  // Prefer tables available in the app, then spread the initial suggestions across subjects.
  const candidates=groupTables([...catalog.filter(table=>table.kind==='population'),...catalog.filter(table=>table.kind&&table.kind!=='population'),...catalog.filter(table=>!table.kind)]);
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

export function initTableSuggestions(input,getCatalog,onSelect,onSelectGroup,onSelectFactSheet){
  const form=input.closest('form');
  const panel=document.createElement('div');panel.className='table-suggestions';panel.hidden=true;
  const heading=document.createElement('p');heading.className='suggestions-heading';
  const list=document.createElement('div');list.id='table-suggestions';list.setAttribute('role','listbox');list.setAttribute('aria-label','Sökförslag');
  panel.append(heading,list);form.append(panel);
  input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-controls',list.id);input.setAttribute('aria-expanded','false');
  let matches=[],active=-1;
  function close(){panel.hidden=true;active=-1;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');}
  function highlight(index){
    active=index;
    const options=[...list.querySelectorAll('[role="option"]')];
    options.forEach((option,i)=>option.setAttribute('aria-selected',String(i===active)));
    if(active<0)input.removeAttribute('aria-activedescendant');
    else{input.setAttribute('aria-activedescendant',options[active].id);options[active].scrollIntoView({block:'nearest'});}
  }
  function select(index){const table=matches[index];if(!table)return;close();if(table.factSheet)onSelectFactSheet(table);else if(table.tables)onSelectGroup(table);else onSelect(table);}
  function refresh(){
    if(document.activeElement!==input)return;
    const groups=suggestedTables(input.value,getCatalog());
    const factSheets=suggestedFactSheets(input.value);
    matches=[...factSheets,...groups.flatMap(group=>[group,...group.tables])];active=-1;input.removeAttribute('aria-activedescendant');list.replaceChildren();
    heading.textContent=matches.length?(factSheets.length?'Faktablad och upp till 6 tabellförslag · Enter söker alla tabeller':input.value.trim()?'Upp till 6 tabellförslag · Tryck Enter för alla träffar':'Upp till 6 tabellförslag'):'Inga tabellförslag. Prova ett annat sökord eller tryck Enter för att söka.';
    let index=0;
    factSheets.forEach(sheet=>{
      const optionIndex=index++;
      const section=document.createElement('div');section.className='table-suggestion-group';
      const option=document.createElement('div');option.id=`fact-option-${optionIndex}`;option.className='table-option table-option-title table-group-choice';option.tabIndex=-1;
      option.setAttribute('role','option');option.setAttribute('aria-selected','false');
      option.setAttribute('aria-label',sheet.title+(sheet.href?'. Öppna faktabladet':', kommande. Läs om funktionen'));
      const title=document.createElement('span');title.textContent=sheet.title;
      option.append(title);
      if(!sheet.href){const badge=document.createElement('span');badge.className='fact-suggestion-badge';badge.textContent='Kommande';option.append(badge);}
      option.addEventListener('click',()=>select(optionIndex));section.append(option);list.append(section);
    });
    groups.forEach((group,groupIndex)=>{
      const section=document.createElement('div');section.className='table-suggestion-group';section.setAttribute('role','group');
      const title=document.createElement('span');title.id=`table-group-${groupIndex}`;title.className='table-option-title';title.textContent=group.title;
      const titleIndex=index++;
      title.classList.add('table-option','table-group-choice');title.tabIndex=-1;title.setAttribute('role','option');title.setAttribute('aria-selected','false');
      title.setAttribute('aria-label',`${group.title}, visa i Utforska statistiken och välj geografi`);
      title.title='Visa i Utforska statistiken och välj geografi';
      title.addEventListener('click',()=>select(titleIndex));
      section.setAttribute('aria-labelledby',title.id);
      const levels=document.createElement('div');levels.className='table-suggestion-levels';
      section.append(title,levels);list.append(section);
      group.tables.forEach(table=>{
        const optionIndex=index++;
        const option=document.createElement('div');option.id=`table-option-${optionIndex}`;option.className='table-option';option.tabIndex=-1;option.setAttribute('role','option');option.setAttribute('aria-selected','false');
        option.textContent=(levelLabels[table.level]||table.level)+(table.kind?'':' ↗');
        option.setAttribute('aria-label',`${table.title}, ${levelLabels[table.level]||table.level}${table.kind?'':', öppnas i ny flik'}`);
        option.addEventListener('click',()=>select(optionIndex));levels.append(option);
      });
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
