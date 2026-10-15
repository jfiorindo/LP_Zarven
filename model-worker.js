/* global importScripts */
'use strict';
importScripts('model-renderer.js?v=2');
const renderer = globalThis.ZarvenModelRenderer;
const scenes = new Map();
let logo;

// Probe worker-side support before the page transfers any visible canvas.
if (!new OffscreenCanvas(1, 1).getContext('2d')) throw new Error('Offscreen 2D unavailable');
globalThis.onmessage = ({ data }) => {
  if (data.type === 'init') scenes.set(data.id, renderer.create(data.canvas, data.kind));
  else if (data.type === 'logo') {
    logo?.close();
    logo = data.bitmap;
  } else if (data.type === 'draw') {
    for (const state of data.states) renderer.render(scenes.get(state.id), state, logo);
    globalThis.postMessage({ type: 'drawn', states: data.states.map(({ id, progress }) => ({ id, progress })) });
  }
};
globalThis.postMessage({ type: 'ready' });
