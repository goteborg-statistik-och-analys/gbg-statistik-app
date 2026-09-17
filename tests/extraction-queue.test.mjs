import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runExtraction} from '../extraction-queue.js';
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const flush=()=>new Promise(resolve=>setImmediate(resolve));

test('At most two requests run, and output retains query order',async()=>{
  const pending=Array.from({length:4},deferred),started=[];
  const done=runExtraction([0,1,2,3],i=>{started.push(i);return pending[i].promise;});
  assert.deepEqual(started,[0,1]);
  pending[1].resolve('B');await flush();assert.deepEqual(started,[0,1,2]);
  pending[2].resolve('C');await flush();assert.deepEqual(started,[0,1,2,3]);
  pending[3].resolve('D');pending[0].resolve('A');
  assert.deepEqual(await done,['A','B','C','D']);
});
test('Changed selection prevents queued work and discards pending results',async()=>{
  let current=true;const pending=deferred(),started=[];
  const done=runExtraction([0,1,2],i=>{started.push(i);return pending.promise;},{isCurrent:()=>current});
  current=false;pending.resolve('old');assert.equal(await done,null);assert.deepEqual(started,[0,1]);
});
test('Fatal errors stop queued work and propagate after pending work settles',async()=>{
  const pending=deferred(),started=[];
  const done=runExtraction([0,1,2],i=>{started.push(i);return i===0?Promise.reject(new Error('fatal')):pending.promise;});
  await flush();pending.resolve('ignored');await assert.rejects(done,/fatal/);assert.deepEqual(started,[0,1]);
});
test('Rate limiting pauses both workers, retries, and preserves order',async()=>{
  let time=0,attempts=0,notices=0;const other=deferred(),waiters=[],started=[];
  const done=runExtraction([0,1,2],i=>{started.push(i);if(i===0&&attempts++===0)throw new Error('Många uttag görs just nu.');return i===1?other.promise:Promise.resolve(i);},{now:()=>time,sleep:ms=>{assert.equal(ms,12000);const wait=deferred();waiters.push(wait);return wait.promise;},onRateLimit:()=>notices++});
  await flush();assert.deepEqual(started,[0]);assert.equal(notices,1);
  time=12000;waiters.forEach(wait=>wait.resolve());await flush();other.resolve(1);
  assert.deepEqual(await done,[0,1,2]);assert.equal(attempts,2);
});
test('Repeated rate limits stop after three attempts',async()=>{
  let time=0,attempts=0;
  await assert.rejects(runExtraction([0],async()=>{attempts++;throw new Error('Många uttag');},{now:()=>time,sleep:async ms=>{time+=ms;}}),/Många uttag/);
  assert.equal(attempts,3);
});
