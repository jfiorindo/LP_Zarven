(() => {
  'use strict';
  const root = document.documentElement;
  const hero = document.querySelector('.hero');
  const visual = document.querySelector('.system-visual');
  const mobile = matchMedia('(max-width:980px)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const renderer = globalThis.ZarvenModelRenderer;
  if (!renderer) return;
  let enabled = true;
  // Every visit starts animated; pause applies only to the current page.
  const motionAllowed = () => enabled && !reduced.matches;
  root.dataset.scrollMotion = motionAllowed() ? 'on' : 'off';

  const clamp = (n, low = 0, high = 1) => Math.min(high, Math.max(low, n));
  const mix = (a, b, t) => a + (b - a) * t;
  const scenes = [];
  let frame = 0, previousTime = 0, needsMeasure = true, targetsDirty = true;
  let worker = null, workerReady = false, batchPending = false, startupTimer;
  const pending = new Map();
  let dpr = 1;

  function createScene(parent, className, type, before = null) {
    const wrapper = document.createElement('div');
    wrapper.className = className;
    wrapper.setAttribute('aria-hidden', 'true');
    const canvas = document.createElement('canvas');
    wrapper.append(canvas);
    parent.insertBefore(wrapper, before);
    const scene = {id:scenes.length, wrapper, canvas, type, width:0, height:0, top:0, current:0, target:0, drawn:NaN, force:true, visible:false};
    scenes.push(scene);
    return scene;
  }
  const primary = createScene(visual, 'model-stage', 'morph');
  if (!primary) return;
  hero.classList.add('model-enabled');
  createScene(document.querySelector('.process-intro'), 'process-model', 'process');

  const cards = [...document.querySelectorAll('.product-card')];
  cards.forEach((card, index) => {
    const replacement = createScene(card, 'assembly-art', index === 0 ? 'circuit' : 'devices', card.querySelector('.product-list'));
    if (replacement) card.querySelector('.tech-art')?.remove();
  });
  const final = document.querySelector('.final-inner');
  const logoScene = createScene(final, 'logo-assembly', 'logo', final.firstChild);
  const logo = new Image();
  let logoReady = false;
  logo.onload = () => { logoReady = true; sendLogo(); if (logoScene) logoScene.force = true; schedule(); };
  logo.src = document.querySelector('.brand img').src;

  const track = document.createElement('div');
  track.className = 'model-track'; track.setAttribute('aria-hidden', 'true'); visual.append(track);
  const trackFill = document.createElement('span');
  trackFill.className = 'model-track-fill'; track.append(trackFill);
  const markers = document.createElement('div');
  markers.className = 'model-markers'; primary.wrapper.append(markers);
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'model-motion-toggle'; visual.append(button);
  function updateButton() {
    const active = motionAllowed();
    button.textContent = active ? 'Pausar animação' : 'Ativar animação ao rolar';
    button.setAttribute('aria-label', active ? 'Pausar a transformação dos modelos ao rolar' : 'Ativar a transformação dos modelos ao rolar');
    button.disabled = reduced.matches;
    root.dataset.scrollMotion = active ? 'on' : 'off';
  }
  updateButton();
  button.addEventListener('click', () => {
    enabled = !enabled;
    updateButton();
    document.dispatchEvent(new Event('zarven:motionchange'));
    // Freeze artwork in place; changing this preference never changes page height.
    targetsDirty = true;
    schedule();
  });

  // The worker owns rasterization; at most one batch is in flight. Scroll bursts
  // replace pending states instead of queuing old frames and adding input latency.
  function stateFor(scene) {
    return { id:scene.id, width:scene.width, height:scene.height, dpr,
      progress:scene.current, desktop:!mobile.matches };
  }
  function draw(scene) {
    const state = stateFor(scene);
    if (workerReady) pending.set(scene.id, state);
    else if (scene.renderer) {
      renderer.render(scene.renderer, state, logoReady ? logo : null);
      scene.wrapper.dataset.progress=state.progress.toFixed(3);
    } else return;
    if (scene===primary) trackFill.style.transform=`scaleX(${state.progress})`;
    scene.drawn=scene.current;scene.force=false;
  }
  function flush() {
    if (!workerReady || batchPending || document.hidden || !pending.size) return;
    const states = [...pending.values()].filter(state => scenes[state.id].visible);
    pending.clear();
    if (!states.length) return;
    batchPending=true;
    worker.postMessage({type:'draw', states});
  }
  async function sendLogo() {
    if (!workerReady || !logoReady) return;
    try {
      const bitmap=await createImageBitmap(logo);
      if (!workerReady) { bitmap.close(); return; }
      worker.postMessage({type:'logo', bitmap}, [bitmap]);
      logoScene.force=true;schedule();
    } catch { useMainRenderer(); }
  }
  function useMainRenderer() {
    clearTimeout(startupTimer);
    worker?.terminate();worker=null;workerReady=false;batchPending=false;pending.clear();
    root.dataset.modelRenderer='main';
    for (const scene of scenes) {
      if (scene.transferred) {
        const canvas=scene.canvas.cloneNode();
        scene.canvas.replaceWith(canvas);scene.canvas=canvas;scene.transferred=false;
      }
      scene.renderer=renderer.create(scene.canvas, scene.type);
      scene.force=true;
    }
    needsMeasure=true;schedule();
  }
  function startRenderer() {
    if (!('Worker' in window) || !('transferControlToOffscreen' in HTMLCanvasElement.prototype) || !('createImageBitmap' in window) || location.protocol==='file:') {
      useMainRenderer();return;
    }
    try {
      worker=new Worker('model-worker.js?v=2');
      root.dataset.modelRenderer='starting';
      startupTimer=setTimeout(useMainRenderer, 2500);
      worker.onerror=event => { event.preventDefault();useMainRenderer(); };
      worker.onmessage=({data}) => {
        if (data.type==='ready') {
          clearTimeout(startupTimer);
          try {
            for (const scene of scenes) {
              const canvas=scene.canvas.transferControlToOffscreen();
              scene.transferred=true;
              worker.postMessage({type:'init', id:scene.id, kind:scene.type, canvas}, [canvas]);
            }
            workerReady=true;root.dataset.modelRenderer='worker';
            sendLogo();needsMeasure=true;schedule();
          } catch { useMainRenderer(); }
        } else if (data.type==='drawn') {
          for (const state of data.states) scenes[state.id].wrapper.dataset.progress=state.progress.toFixed(3);
          batchPending=false;flush();
        }
      };
    } catch { useMainRenderer(); }
  }

  // Cache document geometry outside the animation loop. No wheel interception,
  // scrolling writes, pinned panels or artificial scroll spacers.
  function documentTop(element) {
    let top=0;
    for(let node=element;node;node=node.offsetParent) top+=node.offsetTop;
    return top;
  }
  function measure() {
    dpr=Math.min(devicePixelRatio||1,mobile.matches?1.25:1.5);
    for(const scene of scenes) {
      scene.top=documentTop(scene.wrapper);
      const width=scene.wrapper.clientWidth, height=scene.wrapper.clientHeight;
      scene.force=true;
      scene.width=width;scene.height=height;
    }
    needsMeasure=false;targetsDirty=true;
  }

  function setTargets() {
    const y=scrollY, vh=innerHeight;
    for(const scene of scenes) {
      const wasVisible=scene.visible;
      scene.visible=scene.top+scene.height>y && scene.top<y+vh;
      if(scene.visible&&!wasVisible) scene.force=true;
      if(!motionAllowed()) {scene.target=scene.current;continue;}
      let start,end;
      if(scene===primary) {
        start=Math.max(0,scene.top+scene.height*.5-vh*.67);
        end=start+clamp(vh*.65,340,560)*renderer.heroTravelRatio;
      } else {
        start=scene.top-vh*.94;
        end=scene.top+scene.height*.5-vh*.5;
      }
      const p=clamp((y-start)/Math.max(1,end-start));
      scene.target=scene.type==='process'?mix(.5,1,p):p;
      // Off-screen models jump to the current target without spending frames.
      if(!scene.visible) scene.current=scene.target;
    }
    targetsDirty=false;
  }

  function schedule() {
    if(!frame&&!document.hidden) frame=requestAnimationFrame(tick);
  }
  function tick(now) {
    frame=0;
    if(document.hidden) {previousTime=0;return;}
    if(needsMeasure) measure();
    if(targetsDirty) setTargets();
    const dt=previousTime?clamp(now-previousTime,1,48):16.7;
    const follow=1-Math.exp(-dt/150);
    let unsettled=false;
    for(const scene of scenes) {
      if(!scene.visible||!scene.width||!scene.height) continue;
      if(motionAllowed()) {
        const delta=scene.target-scene.current;
        if(Math.abs(delta)>.0005) {scene.current+=delta*follow;unsettled=true;}
        else scene.current=scene.target;
      }
      if(scene.force||Math.abs(scene.current-scene.drawn)>.00005||Number.isNaN(scene.drawn)) draw(scene);
    }
    flush();
    if(unsettled) {previousTime=now;schedule();} else previousTime=0;
  }
  addEventListener('scroll',()=>{targetsDirty=true;schedule();},{passive:true});
  addEventListener('resize',()=>{needsMeasure=true;schedule();},{passive:true});
  if('ResizeObserver' in window) {
    const observer=new ResizeObserver(()=>{needsMeasure=true;schedule();});
    observer.observe(document.body);
    scenes.forEach(scene=>observer.observe(scene.wrapper));
  }
  if(document.fonts) document.fonts.ready.then(()=>{needsMeasure=true;schedule();});
  reduced.addEventListener('change', () => {
    updateButton();
    cancelAnimationFrame(frame);
    frame=0;previousTime=0;
    // Reduced motion shows a complete, static composition, including off-screen art.
    if(reduced.matches) scenes.forEach(scene => {
      scene.current=scene.target=scene.type==='morph'?0:1;
      scene.force=true;
    });
    targetsDirty=true;
    document.dispatchEvent(new Event('zarven:motionchange'));
    schedule();
  });
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden) {cancelAnimationFrame(frame);frame=0;previousTime=0;}
    else {needsMeasure=true;schedule();}
  });
  measure();setTargets();
  scenes.forEach(scene=>{
    if(!motionAllowed()) scene.current=scene.target=scene.type==='morph'?0:1;
    else if(scene.visible) scene.current=scene.target;
  });
  startRenderer();
  schedule();
})();
