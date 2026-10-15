import { chromium } from 'playwright';
import fs from 'node:fs';
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const results=[];
 try {
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'no-preference'});
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  await cdp.send('Performance.enable');
  await page.addInitScript(()=>{
   window.rafCosts=[];window.longTasks=[];
   const original=requestAnimationFrame;
   window.requestAnimationFrame=callback=>original.call(window,time=>{const start=performance.now();callback(time);window.rafCosts.push(performance.now()-start);});
   new PerformanceObserver(list=>window.longTasks.push(...list.getEntries().map(e=>e.duration))).observe({type:'longtask'});
  });
  await page.goto(process.env.PREVIEW_URL || 'http://localhost:3000');await page.waitForTimeout(1800);
  const before=(await cdp.send('Performance.getMetrics')).metrics;
  const sample=await page.evaluate(async()=>{
   window.rafCosts=[];window.longTasks=[];
   const intervals=[];let last=performance.now();
   const range=document.documentElement.scrollHeight-innerHeight;
   for(let i=0;i<240;i++){
    await new Promise(requestAnimationFrame);const now=performance.now();intervals.push(now-last);last=now;
    scrollTo({top:range*i/239,behavior:'instant'});
   }
   await new Promise(resolve=>setTimeout(resolve,1000));
   const p95=a=>a.sort((a,b)=>a-b)[Math.floor(a.length*.95)]||0;
   return {frameP95:p95(intervals),rafP95:p95(window.rafCosts),longTasks:window.longTasks.length,maxTask:Math.max(0,...window.longTasks)};
  });
  const after=(await cdp.send('Performance.getMetrics')).metrics;
  for(const name of ['TaskDuration','ScriptDuration','LayoutDuration','RecalcStyleDuration'])sample[name]=+(1000*(after.find(m=>m.name===name).value-before.find(m=>m.name===name).value)).toFixed(1);
  results.push({width,cpu:4,...sample});await page.close();
 }
 } finally { await browser.close(); }
 fs.mkdirSync('.qa', { recursive: true }); fs.writeFileSync('.qa/motion-profile.json',JSON.stringify(results,null,2));console.log(results);
})();
