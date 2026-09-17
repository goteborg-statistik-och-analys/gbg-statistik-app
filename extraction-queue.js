// Keep responses in query order even when requests finish out of order.
export async function runExtraction(jobs,load,{isCurrent=()=>true,onRateLimit=()=>{},sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),now=()=>Date.now()}={}){
  const results=new Array(jobs.length);
  let cursor=0,failed=false,pauseUntil=0;
  const active=()=>!failed&&isCurrent();
  async function worker(){
    while(active()&&cursor<jobs.length){
      const index=cursor++;
      try{
        for(let attempt=0;attempt<3;attempt++){
          while(active()&&pauseUntil>now())await sleep(pauseUntil-now());
          if(!active())return;
          try{
            const value=await load(jobs[index]);
            if(!active())return;
            results[index]=value;
            break;
          }catch(error){
            if(!active())return;
            if(!error.message?.startsWith('Många uttag')||attempt===2)throw error;
            // Both workers respect the same cooldown after a rate limit.
            pauseUntil=now()+12000;
            onRateLimit();
          }
        }
      }catch(error){failed=true;throw error;}
    }
  }
  const workers=await Promise.allSettled(Array.from({length:Math.min(2,jobs.length)},worker));
  const failure=workers.find(worker=>worker.status==='rejected');
  if(failure)throw failure.reason;
  return isCurrent()?results:null;
}
