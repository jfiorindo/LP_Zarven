// Shared renderer for the worker and the compatible main-thread fallback.
(() => {
  'use strict';
  const clamp = (n, low = 0, high = 1) => Math.min(high, Math.max(low, n));
  const mix = (a, b, t) => a + (b - a) * t;
  const ease = t => t * t * (3 - 2 * t);
  // The Hero takes the shorter cube → sphere → Z route. Each leg keeps its
  // original scroll distance; the process illustration retains all its stages.
  const HERO_STATES = [0, 2, 4];
  const FULL_STATES = [0, 1, 2, 3, 4];
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
  function create(canvas, type) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D unavailable');
    const scene = { canvas, ctx, type, width: 0, height: 0 };
    if (type === 'morph' || type === 'process') initMesh(scene, 125);
    if (type === 'circuit') initMesh(scene, circuitParts.length);
    if (type === 'devices') initMesh(scene, deviceParts.length);
    return scene;
  }

  function fillMorph(scene, progress) {
    const stages = scene.type === 'morph' ? HERO_STATES : FULL_STATES;
    const segments = stages.length - 1;
    const m = clamp(progress) * segments, segment = Math.min(segments - 1, Math.floor(m)), t = ease(m - segment);
    const side = mix(.33,.17,Math.min(1,m));
    for (let i = 0; i < 125; i++) {
      const src = i * 15 + stages[segment] * 3, next = i * 15 + stages[segment + 1] * 3, dst = i * 7;
      for (let j = 0; j < 3; j++) scene.boxes[dst+j] = mix(morphStates[src+j],morphStates[next+j],t);
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
    const heroShift = scene.type === 'morph' && scene.desktop ? .2 * progress : 0;
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

  function renderLogo(scene, progress, logo) {
    if (!logo) return;
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

  function render(scene, state, logo) {
    const { width, height, dpr, progress, desktop } = state;
    const bitmapWidth = Math.round(width * dpr), bitmapHeight = Math.round(height * dpr);
    if (scene.canvas.width !== bitmapWidth || scene.canvas.height !== bitmapHeight) {
      scene.canvas.width = bitmapWidth;
      scene.canvas.height = bitmapHeight;
      scene.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    scene.width = width; scene.height = height; scene.desktop = desktop;
    scene.ctx.clearRect(0, 0, width, height);
    if (scene.type === 'logo') renderLogo(scene, progress, logo);
    else {
      if (scene.type === 'morph' || scene.type === 'process') fillMorph(scene, progress);
      else fillAssembly(scene, scene.type === 'circuit' ? circuitParts : deviceParts, progress);
      renderMesh(scene, progress, scene.type === 'process');
    }
  }
  globalThis.ZarvenModelRenderer = { create, render,
    heroTravelRatio: (HERO_STATES.length - 1) / (FULL_STATES.length - 1) };
})();
