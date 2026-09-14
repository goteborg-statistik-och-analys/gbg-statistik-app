import {areaOf} from './core.js';
import {groupDimensions,totalValues,categoryValues,valueLabel,ageBounds,ageRangeValues} from './group-selection.js';

export function initGroupControls(container,metadata,getArea,initial={},measure={}){
  container.replaceChildren();container.className='group-controls';
  const area=areaOf(metadata);
  const dimensions=[...(area?[area]:[]),...groupDimensions(metadata)];
  let nextId=0;
  const modeLabel=document.createElement('label');modeLabel.htmlFor='group-mode';modeLabel.textContent='Hur vill du visa statistiken?';
  const mode=document.createElement('select');mode.id='group-mode';
  for(const [value,label] of [['sum','Välj urval'],['compare','Jämför egna grupper']])mode.add(new Option(label,value));
  const help=document.createElement('p');help.className='selection-note';
  const cards=document.createElement('div');cards.className='selection-groups';
  const add=document.createElement('button');add.type='button';add.className='secondary';add.textContent='+ Lägg till grupp';
  container.append(modeLabel,mode,help,cards,add);
  const editors=[];
  function changed(){container.dispatchEvent(new Event('input',{bubbles:true}));}
  function createGroup(){
    const id=nextId++,card=document.createElement('fieldset');card.className='selection-group';
    const legend=document.createElement('legend');legend.textContent=`Grupp ${id+1}`;
    const nameLabel=document.createElement('label');nameLabel.htmlFor=`group-name-${id}`;nameLabel.textContent='Namn på gruppen';
    const name=document.createElement('input');name.id=nameLabel.htmlFor;name.type='text';name.maxLength=60;name.placeholder='Till exempel kvinnor eller 1–5 år';
    const remove=document.createElement('button');remove.type='button';remove.className='secondary';remove.textContent='Ta bort grupp';
    const fields=document.createElement('div');fields.className='group-dimensions';card.append(legend,nameLabel,name,fields,remove);
    const reports=[];
    const readers=dimensions.map((v,vi)=>{
      const field=document.createElement('fieldset');field.className='dimension-choice';
      const caption=document.createElement('legend');caption.textContent=v.text||v.code;
      const all=totalValues(v),seed=id===0?initial[v.code]:undefined;
      const monthly=measure.monthly&&v.code==='Månad';
      const restricted=!monthly&&(measure.additive===false||measure.noSum?.includes(v.code));
      const totalLabel=document.createElement('label');totalLabel.className='check-label';
      const total=document.createElement('input');total.type='checkbox';total.id=`group-${id}-dimension-${vi}-total`;
      total.checked=Boolean(seed&&seed.length===all.length&&all.every(value=>seed.includes(value)));
      total.disabled=restricted&&all.length>1;if(total.disabled)total.checked=false;
      totalLabel.append(total,document.createTextNode(monthly?'Alla månader (över tid)':total.disabled?'Totalt kan inte beräknas för detta filter':'Totalt'));
      const summary=document.createElement('p');summary.className='selection-note';summary.id=`group-${id}-dimension-${vi}-summary`;summary.setAttribute('aria-live','polite');field.setAttribute('aria-describedby',summary.id);
      const reportLabel=document.createElement('label');reportLabel.textContent='Redovisning';
      const report=document.createElement('select');report.id=`report-${id}-${vi}`;reportLabel.htmlFor=report.id;
      report.add(new Option('Summera valda','sum'));report.add(new Option('Visa varje kategori separat','separate'));report.disabled=v.values.length===1;reports.push({code:v.code,report});
      if(restricted){report.options[0].disabled=true;report.value='separate';}
      if(monthly){report.options[0].text='Månader över tid';report.value='sum';report.disabled=true;}
      report.addEventListener('change',()=>{if(report.value==='separate'&&total.checked){total.checked=false;const values=categoryValues(v);checks.forEach(c=>{c.checked=values.includes(c.value);});}updateSummary();});
      const choices=document.createElement('div');choices.className='category-list';choices.append(totalLabel);
      const checks=v.values.filter(value=>!(all.length===1&&all[0]===value)).map((value,i)=>{
        const label=document.createElement('label');label.className='check-label';
        const input=document.createElement('input');input.type='checkbox';input.value=value;input.checked=!total.checked&&(seed?.includes(value)||false);
        input.id=`group-${id}-dimension-${vi}-${i}`;label.append(input,document.createTextNode(valueLabel(v,value)));choices.append(label);return input;
      });
      function updateSummary(){
        const count=checks.filter(c=>c.checked).length;
        summary.textContent=monthly?'Varje vald månad blir en tidpunkt. Månader summeras aldrig.':total.checked?'Totalt valt – omfattar alla kategorier i detta filter.':count?`${count} kategorier valda${count>1?(report.value==='separate'?' – redovisas separat':' – summeras inom gruppen'):''}`:restricted?'Välj kategori. Flera val redovisas separat och summeras inte.':'Välj Totalt eller minst en kategori.';
        field.removeAttribute('aria-invalid');
      }
      total.addEventListener('change',()=>{if(total.checked){checks.forEach(c=>{c.checked=false;});report.value=restricted?'separate':'sum';}updateSummary();});
      for(const check of checks)check.addEventListener('change',()=>{if(check.checked)total.checked=false;updateSummary();});
      const picker=document.createElement('div');
      if(v.values.some(value=>ageBounds(valueLabel(v,value)))){
        const range=document.createElement('div');range.className='age-range';
        const inputs=['Från ålder','Till ålder'].map((text,index)=>{
          const label=document.createElement('label');label.textContent=text;
          const input=document.createElement('input');input.type='number';input.min=0;input.max=150;input.id=`age-${id}-${vi}-${index}`;label.htmlFor=input.id;label.append(input);range.append(label);return input;
        });
        const apply=document.createElement('button');apply.type='button';apply.className='filter-action';apply.textContent='Välj intervallet';
        const error=document.createElement('p');error.className='range-error';error.setAttribute('role','status');
        apply.addEventListener('click',()=>{
          try{
            const values=ageRangeValues(v,...inputs.map(input=>input.value===''?NaN:Number(input.value)));
            total.checked=values.length===all.length&&all.every(value=>values.includes(value));
            if(total.checked)report.value='sum';
            checks.forEach(check=>{check.checked=!total.checked&&values.includes(check.value);});error.textContent='';updateSummary();changed();
          }catch(e){error.textContent=e.message;}
        });
        total.addEventListener('change',()=>{if(total.checked){inputs.forEach(input=>{input.value='';});error.textContent='';}});
        range.append(apply);picker.append(range,error);
      }
      const clear=document.createElement('button');clear.type='button';clear.className='filter-action';clear.textContent='Rensa';
      const chooseAll=document.createElement('button');chooseAll.type='button';chooseAll.className='filter-action';chooseAll.textContent='Välj alla';chooseAll.hidden=checks.length===0;
      chooseAll.addEventListener('click',()=>{total.checked=false;const values=categoryValues(v);checks.forEach(c=>{c.checked=values.includes(c.value);});updateSummary();changed();});
      clear.addEventListener('click',()=>{total.checked=false;checks.forEach(c=>{c.checked=false;});updateSummary();changed();});
      picker.append(chooseAll,clear);field.append(caption,reportLabel,report,summary,picker,choices);fields.append(field);updateSummary();
      return ()=>{
        const values=total.checked?all:checks.filter(c=>c.checked).map(c=>c.value);
        if(!values.length){field.setAttribute('aria-invalid','true');summary.textContent='Du behöver välja Totalt eller minst en kategori.';total.focus();throw new Error(`Grupp ${editors.findIndex(e=>e.card===card)+1}: välj ${v.text||v.code} innan du hämtar statistiken.`);}
        return [v.code,values];
      };
    });
    const editor={card,remove,name,nameLabel,legend,read:()=>({name:mode.value==='compare'?name.value:'',selections:Object.fromEntries(readers.map(read=>read())),separate:reports.filter(r=>r.report.value==='separate').map(r=>r.code)})};
    remove.addEventListener('click',()=>{editors.splice(editors.indexOf(editor),1);card.remove();sync();changed();add.focus();});
    editors.push(editor);cards.append(card);return editor;
  }
  function sync(){
    const compare=mode.value==='compare';add.hidden=!compare;add.disabled=editors.length>=7;
    editors.forEach((editor,i)=>{editor.card.hidden=!compare&&i>0;editor.card.disabled=!compare&&i>0;editor.name.hidden=!compare;editor.name.disabled=!compare;editor.nameLabel.hidden=!compare;editor.remove.hidden=!compare||editors.length<=2;editor.legend.textContent=compare?`Grupp ${i+1}`:'Ditt urval';});
    help.textContent=compare?'Varje grupp blir en egen linje. Välj Totalt eller kategorier i varje filter för varje grupp. Flera val inom en grupp summeras. Högst sju grupper.':'Välj Totalt eller minst en kategori i varje filter. Välj hur varje filter redovisas: summerat eller som separata kategorier. Välj alla tar med delkategorierna utan en extra total. Totalt är ett aktivt val och omfattar även kategorier som ”Ej sysselsatt” om de ingår i filtret.';
  }
  mode.addEventListener('change',()=>{if(mode.value==='compare'&&editors.length<2)createGroup();sync();});
  add.addEventListener('click',()=>{const editor=createGroup();sync();changed();editor.name.focus();});
  createGroup();sync();
  return {read:()=>(mode.value==='compare'?editors:editors.slice(0,1)).map(editor=>editor.read())};
}
