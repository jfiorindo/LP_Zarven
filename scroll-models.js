(() => {
  'use strict';
  const root = document.documentElement;
  const hero = document.querySelector('.hero');
  const visual = document.querySelector('.system-visual');
  const mobile = matchMedia('(max-width:980px)');
  let enabled = true;
  try { enabled = localStorage.getItem('zarven-scroll-motion') !== 'off'; } catch (_) {}
  root.dataset.scrollMotion = enabled ? 'on' : 'off';

  const clamp = (n, low = 0, high = 1) => Math.min(high, Math.max(low, n));
  const mix = (a, b, t) => a + (b - a) * t;
  const ease = t => t * t * (3 - 2 * t);
  const scenes = [];
  let frame = 0, previousTime = 0, needsMeasure = true, targetsDirty = true;

  function createScene(parent, className, type, before = null) {
    const wrapper = document.createElement('div');
    wrapper.className = className;
    wrapper.setAttribute('aria-hidden', 'true');
    const canvas = document.createElement('canvas');
    wrapper.append(canvas);
    parent.insertBefore(wrapper, before);
    const ctx = canvas.getContext('2d');
    if (!ctx) { wrapper.remove(); return null; }
    const scene = {wrapper, canvas, ctx, type, width:0, height:0, top:0, current:0, target:0, drawn:NaN, force:true, visible:false};
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
  logo.onload = () => { logoReady = true; if (logoScene) logoScene.force = true; schedule(); };
  logo.src = document.querySelector('.brand img').src;

  const track = document.createElement('div');
  track.className = 'model-track'; track.setAttribute('aria-hidden', 'true'); visual.append(track);
  const markers = document.createElement('div');
  markers.className = 'model-markers'; primary.wrapper.append(markers);
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'model-motion-toggle'; visual.append(button);
  function updateButton() {
    button.textContent = enabled ? 'Pausar animação' : 'Ativar animação ao rolar';
    button.setAttribute('aria-label', enabled ? 'Pausar a transformação dos modelos ao rolar' : 'Ativar a transformação dos modelos ao rolar');
  }
  updateButton();
  button.addEventListener('click', () => {
    enabled = !enabled;
    root.dataset.scrollMotion = enabled ? 'on' : 'off';
    try { localStorage.setItem('zarven-scroll-motion', enabled ? 'on' : 'off'); } catch (_) {}
    updateButton();
    // Freeze artwork in place; changing this preference never changes page height.
    targetsDirty = true;
    schedule();
  });

  // Reuse geometry and face records across frames to avoid allocation spikes.
  const CORNERS = [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];
  const FACES = [[0,1,2,3],[4,7,6,5],[0,4,5,1],[3,2,6,7],[1,5,6,2],[0,3,7,4]];
  const NORMALS = [[0,0,-1],[0,0,1],[0,-1,0],[0,1,0],[1,0,0],[-1,0,0]];
  const morphStates = new Float32Array(125 * 15);
  for (let i = 0; i < 125; i++) {
    const x = i % 5 - 2, y = Math.floor(i / 5) % 5 - 2, z = Math.floor(i / 25) - 2;
    const angle = i * 2.3999632297, sy = 1 - 2 * (i + .5) / 125, radius = Math.sqrt(1 - sy * sy);
    const a = (i % 5) / 5 * Math.PI * 2, b = Math.floor(i / 5) / 25 * Math.PI * 2;
    const band = i % 3, t = Math.floor(i / 3) / 41;
    morphStates.set([
      x * .43, y * .43, z * .43,
      x * .7 + Math.sin(i * 7) * .4, y * .7 + Math.cos(i * 3) * .4, z * .7 + Math.sin(i * 5) * .4,
      Math.cos(angle) * radius * 1.28, sy * 1.28, Math.sin(angle) * radius * 1.28,
      (1 + .36 * Math.cos(a)) * Math.cos(b), .36 * Math.sin(a), (1 + .36 * Math.cos(a)) * Math.sin(b),
      band === 1 ? mix(1,-1,t) : mix(-1,1,t), band === 0 ? -1 : band === 1 ? mix(-1,1,t) : 1, Math.sin(i * 2) * .08
    ], i * 15);
  }

  // Cuboids: center x/y/z, width/height/depth, material (dark, cyan, pale).
  const circuitParts = [
    [0,0,.14,1,.78,.18,0], [0,0,-.04,.67,.48,.14,1],
    [-1.18,-.66,.05,.42,.36,.17,0], [1.18,-.66,.05,.42,.36,.17,0],
    [-1.18,.66,.05,.42,.36,.17,0], [1.18,.66,.05,.42,.36,.17,0],
    [-1.18,-.66,-.05,.19,.13,.06,2], [1.18,-.66,-.05,.19,.13,.06,1],
    [-1.18,.66,-.05,.19,.13,.06,1], [1.18,.66,-.05,.19,.13,.06,2]
  ];
  for (let i = 0; i < 5; i++) {
    circuitParts.push([-.36 + i * .18,-.49,.08,.07,.17,.06,2],[-.36 + i * .18,.49,.08,.07,.17,.06,2]);
  }
  const deviceParts = [
    [0,-.12,.1,2.42,1.5,.15,0], [0,-.13,-.005,2.2,1.27,.04,0],
    [-.57,-.42,-.04,.79,.29,.045,2], [.56,-.35,-.04,.74,.49,.045,1],
    [-.66,.18,-.04,.54,.25,.045,1], [0,.18,-.04,.54,.25,.045,0], [.66,.18,-.04,.54,.25,.045,2],
    [-.63,-.13,-.04,.68,.045,.05,1],
    [0,.84,.18,.17,.48,.14,0], [0,1.08,.06,1.03,.09,.5,0],
    [1.12,.38,-.26,.48,.94,.12,0], [1.12,.19,-.34,.35,.31,.04,1],
    [1.12,.46,-.34,.29,.035,.04,2], [1.12,.56,-.34,.29,.035,.04,2]
  ];

  function initMesh(scene, count) {
    scene.boxes = new Float32Array(count * 7);
    scene.xyz = new Float32Array(count * 24);
    scene.xy = new Float32Array(count * 16);
    scene.faceRecords = Array.from({length:count * 6}, (_, i) => ({box:Math.floor(i / 6), face:i % 6, depth:0}));
    scene.sorted = [];
  }
  scenes.forEach(scene => {
    if (scene.type === 'morph' || scene.type === 'process') initMesh(scene,125);
    if (scene.type === 'circuit') initMesh(scene,circuitParts.length);
    if (scene.type === 'devices') initMesh(scene,deviceParts.length);
    if (!enabled && scene.type !== 'morph') scene.current = 1;
  });

  function fillMorph(scene, progress) {
    const m = clamp(progress) * 4, from = Math.min(3, Math.floor(m)), t = ease(m - from);
    const side = mix(.33,.17,Math.min(1,m));
    for (let i = 0; i < 125; i++) {
      const src = i * 15 + from * 3, dst = i * 7;
      for (let j = 0; j < 3; j++) scene.boxes[dst+j] = mix(morphStates[src+j],morphStates[src+3+j],t);
      scene.boxes[dst+3] = scene.boxes[dst+4] = scene.boxes[dst+5] = side;
      scene.boxes[dst+6] = i % 11 === 0 ? 2 : 1;
    }
  }

  function fillAssembly(scene, parts, progress) {
    for (let i = 0; i < parts.length; i++) {
      const source = parts[i], dst = i * 7;
      const settle = ease(clamp(progress * 1.25 - (i % 4) * .06));
      const distance = 1 - settle;
      scene.boxes[dst] = source[0] + Math.sin(i * 2.4 + .7) * distance * .95;
      scene.boxes[dst+1] = source[1] + Math.cos(i * 2.1) * distance * .75;
      scene.boxes[dst+2] = source[2] + Math.sin(i * 3.7) * distance * .85;
      for (let j = 3; j < 7; j++) scene.boxes[dst+j] = source[j];
    }
  }

  function renderMesh(scene, progress, light = false) {
    const ctx = scene.ctx, w = scene.width, h = scene.height;
    const assembly = scene.type === 'circuit' || scene.type === 'devices';
    const ry = assembly ? mix(-.38,.16,progress) : mix(.52,-.12,progress) + Math.sin(progress*Math.PI)*.5;
    const rx = scene.type === 'circuit' ? -.47 : assembly ? -.12 : -.28 + Math.sin(progress*Math.PI)*.2;
    const cy = Math.cos(ry), sy = Math.sin(ry), cx = Math.cos(rx), sx = Math.sin(rx);
    const scale = Math.min(w,h) * (assembly ? .34 : .25);
    const centerX = w * .5;
    const heroShift = scene.type === 'morph' && window.innerWidth > 980 ? .2 * progress : 0;
    const centerY = h * (scene.type === 'devices' ? .46 : .5 + heroShift);
    const visibleFaces = [];
    const colors = [];
    for (let f = 0; f < 6; f++) {
      const normal = NORMALS[f];
      const nz = -normal[0]*sy + normal[2]*cy;
      const vy = normal[1]*cx - nz*sx, vz = normal[1]*sx + nz*cx;
      if (vz >= 0) continue;
      visibleFaces.push(f);
      const shade = -vy*7 - vz*10;
      colors[f] = light
        ? ['hsl(181 44% 18%)','hsl(178 70% '+(27+shade)+'%)','hsl(173 78% '+(36+shade)+'%)']
        : ['hsl(187 44% '+(11+shade*.5)+'%)','hsl(181 62% '+(30+shade)+'%)','hsl(174 81% '+(50+shade)+'%)'];
    }
    const boxes = scene.boxes, xyz = scene.xyz, xy = scene.xy;
    scene.sorted.length = 0;
    for (let i = 0; i < boxes.length / 7; i++) {
      const base = i*7;
      for (let c = 0; c < 8; c++) {
        const corner = CORNERS[c];
        const x = boxes[base]+corner[0]*boxes[base+3]*.5;
        const y = boxes[base+1]+corner[1]*boxes[base+4]*.5;
        const z = boxes[base+2]+corner[2]*boxes[base+5]*.5;
        const xx = x*cy+z*sy, zz = -x*sy+z*cy;
        const yy = y*cx-zz*sx, depth = y*sx+zz*cx, perspective = 4.7/(4.7+depth);
        const v = i*24+c*3, p = i*16+c*2;
        xyz[v] = xx; xyz[v+1] = yy; xyz[v+2] = depth;
        xy[p] = centerX+xx*scale*perspective; xy[p+1] = centerY+yy*scale*perspective;
      }
      for (const f of visibleFaces) {
        const record = scene.faceRecords[i*6+f], face = FACES[f];
        record.depth = (xyz[i*24+face[0]*3+2]+xyz[i*24+face[1]*3+2]+xyz[i*24+face[2]*3+2]+xyz[i*24+face[3]*3+2])*.25;
        scene.sorted.push(record);
      }
    }
    const project = (x,y,z) => {
      const xx=x*cy+z*sy, zz=-x*sy+z*cy, yy=y*cx-zz*sx, d=y*sx+zz*cx, k=4.7/(4.7+d);
      return [centerX+xx*scale*k,centerY+yy*scale*k];
    };
    if (scene.type === 'circuit') {
      ctx.lineWidth = 1.2;
      const alpha = clamp(progress*1.8-.45);
      ctx.strokeStyle = 'rgba(99,244,237,'+(alpha*.75)+')';
      for (let i = 0; i < 4; i++) {
        const x = i%2 ? 1.18 : -1.18, y = i<2 ? -.66 : .66;
        const path = [[x,y,.08],[x*.6,y,.08],[x*.35,0,.08],[0,0,.08]];
        ctx.beginPath();
        path.forEach((v,j) => { const q=project(...v); j?ctx.lineTo(...q):ctx.moveTo(...q); });
        ctx.stroke();
        const t = (progress*2+i*.23)%1, q = project(mix(x,0,t),mix(y,0,t),.05);
        ctx.globalAlpha = alpha; ctx.fillStyle='#a0fff3'; ctx.beginPath(); ctx.arc(...q,2.2,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1;
      }
    }
    scene.sorted.sort((a,b) => b.depth-a.depth);
    ctx.lineWidth = .5;
    ctx.strokeStyle = light ? '#087e7955' : '#99fff34a';
    for (const record of scene.sorted) {
      const face = FACES[record.face], offset = record.box*16;
      ctx.beginPath();
      for (let j=0;j<4;j++) {const n=offset+face[j]*2; j?ctx.lineTo(xy[n],xy[n+1]):ctx.moveTo(xy[n],xy[n+1]);}
      ctx.closePath(); ctx.fillStyle=colors[record.face][boxes[record.box*7+6]]; ctx.fill();ctx.stroke();
    }
    if (!assembly) {
      ctx.beginPath();
      for (let i=0;i<=64;i++) {const a=i/64*Math.PI*2, q=project(Math.cos(a)*1.8,Math.sin(a)*.15,Math.sin(a)*1.8);i?ctx.lineTo(...q):ctx.moveTo(...q);}
      ctx.strokeStyle=light?'#007e7730':'#63f4ed35'; ctx.lineWidth=1;ctx.stroke();
    }
  }

  function renderLogo(scene, progress) {
    if (!logoReady) return;
    const ctx=scene.ctx, size=Math.min(scene.width*.76,scene.height*.88), width=size, height=size*358/455;
    const x=(scene.width-width)/2, y=(scene.height-height)/2;
    for(let row=0;row<4;row++) for(let col=0;col<6;col++) {
      const i=row*6+col, t=ease(clamp(progress*1.16-(i%3)*.05)), scatter=1-t;
      const sw=455/6, sh=358/4, dw=width/6, dh=height/4;
      ctx.save();
      ctx.translate(x+(col+.5)*dw+Math.sin(i*2.4)*scatter*48,y+(row+.5)*dh+Math.cos(i*2.9)*scatter*35);
      ctx.rotate(Math.sin(i*1.7)*scatter*.65);
      ctx.drawImage(logo,102+col*sw,175+row*sh,sw,sh,-dw/2,-dh/2,dw+.4,dh+.4);
      ctx.restore();
    }
    const gradient=ctx.createLinearGradient(0,y,scene.width,y+height);
    gradient.addColorStop(0,'#e7fffa'); gradient.addColorStop(.5,'#63f4ed');gradient.addColorStop(1,'#16aeb1');
    ctx.globalCompositeOperation='source-in';ctx.fillStyle=gradient;ctx.fillRect(0,0,scene.width,scene.height);ctx.globalCompositeOperation='source-over';
  }

  function draw(scene) {
    scene.ctx.clearRect(0,0,scene.width,scene.height);
    const p=scene.current;
    if (scene.type==='logo') renderLogo(scene,p);
    else {
      if (scene.type==='morph' || scene.type==='process') fillMorph(scene,p);
      else fillAssembly(scene,scene.type==='circuit'?circuitParts:deviceParts,p);
      renderMesh(scene,p,scene.type==='process');
    }
    scene.wrapper.dataset.progress=p.toFixed(3);
    if(scene===primary) visual.style.setProperty('--scene-progress',p);
    scene.drawn=p;scene.force=false;
  }

  // Cache document geometry outside the animation loop. No wheel interception,
  // scrolling writes, pinned panels or artificial scroll spacers.
  function documentTop(element) {
    let top=0;
    for(let node=element;node;node=node.offsetParent) top+=node.offsetTop;
    return top;
  }
  function measure() {
    const dpr=Math.min(devicePixelRatio||1,mobile.matches?1.25:1.5);
    for(const scene of scenes) {
      scene.top=documentTop(scene.wrapper);
      const width=scene.wrapper.clientWidth, height=scene.wrapper.clientHeight;
      const bitmapWidth=Math.round(width*dpr),bitmapHeight=Math.round(height*dpr);
      if(scene.canvas.width!==bitmapWidth||scene.canvas.height!==bitmapHeight) {
        scene.canvas.width=bitmapWidth;scene.canvas.height=bitmapHeight;
        scene.ctx.setTransform(dpr,0,0,dpr,0,0);scene.force=true;
      }
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
      if(!enabled) {scene.target=scene.current;continue;}
      let start,end;
      if(scene===primary) {
        start=Math.max(0,scene.top+scene.height*.5-vh*.67);
        end=start+clamp(vh*.32,220,320);
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
    const follow=1-Math.exp(-dt/85);
    let unsettled=false;
    for(const scene of scenes) {
      if(!scene.visible||!scene.width||!scene.height) continue;
      if(enabled) {
        const delta=scene.target-scene.current;
        if(Math.abs(delta)>.0005) {scene.current+=delta*follow;unsettled=true;}
        else scene.current=scene.target;
      }
      if(scene.force||Math.abs(scene.current-scene.drawn)>.00005||Number.isNaN(scene.drawn)) draw(scene);
    }
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
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden) {cancelAnimationFrame(frame);frame=0;previousTime=0;}
    else {needsMeasure=true;schedule();}
  });
  measure();setTargets();
  scenes.forEach(scene=>{if(scene.visible){scene.current=scene.target;draw(scene);}});
  schedule();
})();
