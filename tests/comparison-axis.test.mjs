import {test} from 'node:test';
import assert from 'node:assert/strict';
import {scaleLimits,lineChart} from '../src/comparison-chart.js';
import {comparisonExportSVG} from '../src/comparison-exports.js';

test('Fitted scales reveal small changes and keep all series within padded limits',()=>{
  const values=[40.1,40.2,40.3,null,41.4];
  const normal=scaleLimits(values),fit=scaleLimits(values,true);
  assert.equal(normal.low,0);
  assert.ok(fit.low>0&&fit.low<40.1&&fit.high>41.4);
  assert.ok(fit.high-fit.low<normal.high-normal.low);
  const wider=scaleLimits([...values,25,60],true);
  assert.ok(wider.low<25&&wider.high>60);
});
test('Scales handle negatives, zero crossings, constant series and missing data',()=>{
  for(const values of [[-40,-39],[-2,3],[40,40],[0,0],[null,NaN]]){
    for(const fitted of [false,true]){
      const {low,high,step}=scaleLimits(values,fitted);
      assert.ok(Number.isFinite(low)&&Number.isFinite(high)&&high>low&&step>0);
      for(const value of values.filter(Number.isFinite))assert.ok(value>=low&&value<=high);
      if(!fitted)assert.ok(low<=0&&high>=0);
    }
  }
  assert.ok(scaleLimits([-40,-39],true).high<0);
});
test('Fitted chart and exported chart use identical geometry and visible axis disclosure',()=>{
  const model={title:'Medelålder',subtitle:'2024–2025',labels:[2024,2025],series:[{name:'Göteborg',slot:0,values:[40.1,40.2]}],unit:'År',fitYAxis:true,notes:[]};
  const chart=lineChart({...model,years:model.labels,labels:undefined,width:1000,layoutHeight:350});
  const exported=comparisonExportSVG(model);
  assert.match(chart,/Anpassad y-axel · noll ingår inte/);
  assert.match(exported,/Anpassad y-axel · noll ingår inte/);
  const path=chart.match(/<path d="([^"]+)"/)[1];
  assert.ok(exported.includes(`d="${path}"`));
  const normal=lineChart({...model,years:model.labels,labels:undefined,fitYAxis:false});
  assert.doesNotMatch(normal,/Anpassad y-axel|NaN|Infinity/);
  assert.doesNotMatch(chart,/NaN|Infinity/);
});
