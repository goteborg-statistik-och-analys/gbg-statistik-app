import {periodGrowth} from './comparison-indicators.js';
import {completeSum} from './comparison-data.js';

// SCB's metropolitan boundaries, effective since 2005, fixed for all displayed periods.
export const metropolitanSource='https://www.scb.se/contentassets/c4b8142033a9440ca53725ca32321a74/storstadsomr.pdf';
export const metropolitanRegions=[
  {name:'Göteborgsregionen',city:'Göteborg',center:'1480',codes:['1440','1489','1480','1401','1384','1482','1441','1462','1481','1402','1415','1419','1407']},
  {name:'Stockholmsregionen',city:'Stockholm',center:'0180',codes:['0127','0162','0125','0136','0126','0123','0186','0182','0188','0140','0192','0128','0191','0163','0184','0180','0183','0181','0138','0160','0114','0139','0115','0187','0120','0117']},
  {name:'Malmöregionen',city:'Malmö',center:'1280',codes:['1231','1285','1267','1261','1262','1281','1280','1264','1230','1263','1287','1233']}
];
export function metropolitanGrowth(context,period=1){
  const byCode=new Map(context.ranking.map(row=>[row.code,row]));
  const summarize=(name,codes,kind)=>{
    const rows=codes.map(code=>byCode.get(code));
    const population=completeSum(rows.map(row=>row?.population));
    const baseline=completeSum(codes.map(code=>period===1?byCode.get(code)?.populationPrevious:context.periodBaselines?.[code]?.[context.year-period]));
    const publishedGrowth=completeSum(rows.map(row=>row?.growth));
    return {name,codes,kind,...periodGrowth(population,baseline,publishedGrowth,period)};
  };
  return [
    ...metropolitanRegions.map(r=>summarize(r.city,[r.center],'city')),
    ...metropolitanRegions.map(r=>summarize(`${r.name} exkl. ${r.city}`,r.codes.filter(code=>code!==r.center),'region'))
  ];
}
