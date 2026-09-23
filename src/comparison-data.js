// Publicerade totaler hålls alltid åtskilda från summeringar av ettårsåldrar.
export const comparisonAges=[...Array.from({length:100},(_,i)=>String(i)),'100+'];
export const comparisonSexes=['all','men','women'];

export function completeSum(values){
  return values.length&&values.every(value=>Number.isFinite(value))?values.reduce((sum,value)=>sum+value,0):null;
}

export function comparisonValue(snapshot,{region,year,sex='all',measure='population',fromAge=0,toAge=100}={}){
  const area=snapshot.data[region],index=snapshot.years.indexOf(Number(year));
  if(!area||index<0||!comparisonSexes.includes(sex))throw Error('Okänd kommun, år eller kön.');
  const series=area[sex];
  if(measure==='dependencyRatio'){
    if(sex!=='all')throw Error('SCB:s försörjningskvot redovisas endast för båda könen.');
    return {value:area.dependencyRatio[index],unit:'personer per 100 personer 20–64 år',basis:'published'};
  }
  if(['population','growth','meanAge'].includes(measure)){
    return {value:series[measure][index],unit:measure==='meanAge'?'år':'personer',basis:'published'};
  }
  if(!['agePopulation','ageShare'].includes(measure))throw Error('Okänt mått.');
  if(!Number.isInteger(fromAge)||!Number.isInteger(toAge)||fromAge<0||toAge>100||fromAge>toAge)throw Error('Ogiltigt åldersintervall. 100 avser 100 år och äldre.');
  const total=series.population[index];
  const allAges=fromAge===0&&toAge===100;
  const count=allAges?total:completeSum(series.byAge[index].slice(fromAge,toAge+1));
  return {value:measure==='ageShare'?(count===null||total===null||total<=0?null:100*count/total):count,
    unit:measure==='ageShare'?'procent':'personer',basis:allAges?'published':'sum-of-single-ages',
    numerator:count,denominator:measure==='ageShare'?total:undefined,
    ckm:year>=2025,openTop:toAge===100};
}

// Läs dimensionsordningen ur svaret; SCB behöver inte återge urvalets ordning.
export function decodeScbDataset(dataset,selection){
  if(dataset.class!=='dataset'||!Array.isArray(dataset.id)||!Array.isArray(dataset.size)||dataset.id.length!==dataset.size.length)throw Error('Ogiltigt JSON-stat2-svar.');
  if(new Set(dataset.id).size!==dataset.id.length)throw Error('Dubblett av dimension.');
  const expectedIds=Object.keys(selection);
  if(expectedIds.length!==dataset.id.length||expectedIds.some(code=>!dataset.id.includes(code)))throw Error('Oväntade dimensioner i SCB-svaret.');
  const dimensions=dataset.id.map((code,i)=>{
    const index=dataset.dimension?.[code]?.category?.index;
    const entries=Array.isArray(index)?index.map((key,j)=>[key,j]):Object.entries(index||{});
    const values=entries.sort((a,b)=>a[1]-b[1]).map(([key,position],j)=>{
      if(position!==j)throw Error(`Felaktigt kategoriindex: ${code}`);return key;
    });
    if(values.length!==dataset.size[i]||new Set(values).size!==values.length||selection[code].length!==values.length||selection[code].some(value=>!values.includes(value)))throw Error(`Ofullständiga eller oväntade kategorier: ${code}`);
    return values;
  });
  const cells=dataset.size.reduce((a,b)=>a*b,1);
  if(!dataset.value||Array.isArray(dataset.value)&&dataset.value.length!==cells)throw Error('Fel antal celler.');
  if(Object.keys(dataset.value).some(key=>!/^\d+$/.test(key)||Number(key)>=cells))throw Error('Oväntat cellindex.');
  return Array.from({length:cells},(_,offset)=>{
    let remainder=offset;const key={};
    for(let i=dataset.id.length-1;i>=0;i--){key[dataset.id[i]]=dimensions[i][remainder%dataset.size[i]];remainder=Math.floor(remainder/dataset.size[i]);}
    const value=dataset.value[offset]??null;
    if(value!==null&&!Number.isFinite(value))throw Error('Ogiltigt statistikvärde.');
    const status=typeof dataset.status==='string'?dataset.status:dataset.status?.[offset];
    if(status&&value!==null)throw Error(`Värde med status ${status} behöver granskas.`);
    return {key,value,status:status||null};
  });
}
