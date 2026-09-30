(() => {
  'use strict';
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover:hover) and (pointer:fine) and (min-width:981px)');
  const visual = document.querySelector('.system-visual');
  const hero = document.querySelector('.hero');
  const cards = [...document.querySelectorAll('.product-card')];
  const header = document.getElementById('header');
  const progress = document.getElementById('scroll-progress');
  const counters = [...document.querySelectorAll('[data-count]')];
  const zones = [...document.querySelectorAll('section, .ticker')];

  function decoration(className, markup, parent, prepend = false) {
    const element = document.createElement('div');
    element.className = className;
    element.setAttribute('aria-hidden', 'true');
    element.innerHTML = markup;
    prepend ? parent.prepend(element) : parent.append(element);
    return element;
  }
  decoration('orbital-field', '<i class="orbital-ring"></i><i class="orbital-ring"></i><i class="orbital-ring"></i>', visual, true);
  const circuit = `<svg viewBox="0 0 420 154" focusable="false">
    <path class="circuit-wire" d="M42 36H112L153 77H180M42 118H112L153 77M240 77H266L307 36H378M266 77L307 118H378"/>
    <path class="circuit-packet" pathLength="100" d="M42 36H112L153 77H180"/>
    <path class="circuit-packet late" pathLength="100" d="M42 118H112L153 77H180"/>
    <path class="circuit-packet" pathLength="100" d="M240 77H266L307 118H378"/>
    <path class="circuit-packet late" pathLength="100" d="M240 77H266L307 36H378"/>
    <g class="circuit-node"><rect x="26" y="22" width="32" height="28" rx="7"/><rect x="26" y="104" width="32" height="28" rx="7"/><rect x="362" y="22" width="32" height="28" rx="7"/><rect x="362" y="104" width="32" height="28" rx="7"/></g>
    <rect class="chip-core core-halo" x="180" y="47" width="60" height="60" rx="15"/>
    <rect class="chip-core" x="180" y="47" width="60" height="60" rx="15"/>
    <path d="M200 62H221L200 91H221" fill="none" stroke="#63f4ed" stroke-width="3"/>
    <g stroke="#63f4ed" fill="none"><path d="M36 36h12M42 30v12M37 113l10 10m0-10-10 10M371 36l5 5 8-10M370 118h16"/></g>
  </svg>`;
  const browser = `<svg viewBox="0 0 420 154" focusable="false">
    <rect class="browser-frame" x="91" y="17" width="238" height="124" rx="9"/>
    <path d="M91 37H329" stroke="#63f4ed30"/>
    <g fill="#63f4ed"><circle cx="104" cy="27" r="2"/><circle cx="112" cy="27" r="2" opacity=".5"/><circle cx="120" cy="27" r="2" opacity=".3"/></g>
    <rect class="browser-block" x="105" y="50" width="121" height="39" rx="4"/>
    <path d="M116 62H189M116 73H163" stroke="#63f4ed70" stroke-width="3"/>
    <rect class="browser-accent" x="242" y="50" width="72" height="39" rx="4" opacity=".6"/>
    <rect class="browser-block" x="105" y="101" width="61" height="25" rx="4"/><rect class="browser-block" x="179" y="101" width="61" height="25" rx="4"/><rect class="browser-block" x="253" y="101" width="61" height="25" rx="4"/>
    <path class="browser-sweep" d="M105 45H314" stroke="#9bfff5" stroke-width="2"/>
    <rect class="browser-frame" x="302" y="69" width="42" height="76" rx="7"/><rect class="browser-accent" x="308" y="80" width="30" height="23" rx="3" opacity=".7"/>
    <path d="M310 112H336M310 119H329" stroke="#63f4ed50" stroke-width="2"/>
  </svg>`;
  [circuit, browser].forEach((markup, index) => {
    const art = decoration('tech-art', markup, cards[index]);
    cards[index].insertBefore(art, cards[index].querySelector('.product-list'));
  });
  decoration('horizon', '<div class="horizon-disc"></div>', document.querySelector('.final-cta'), true);

  // One scheduled update for scroll/pointer bursts, no idle render loop.
  let frame = 0, pointer = null, scrollDirty = true;
  let scrollRange = Math.max(1, root.scrollHeight - innerHeight);
  function schedule() { if (!frame && !document.hidden) frame = requestAnimationFrame(update); }
  function resetTilt(element) {
    ['--parallax-x','--parallax-y','--tilt-x','--tilt-y','--card-x','--card-y','--card-light-x','--card-light-y'].forEach(key => element.style.removeProperty(key));
  }
  function update() {
    frame = 0;
    if (scrollDirty) {
      header.classList.toggle('scrolled', scrollY > 24);
      progress.style.transform = `scaleX(${Math.min(1, Math.max(0, scrollY / scrollRange))})`;
      scrollDirty = false;
    }
    if (pointer && !reduced.matches && fine.matches) {
      const {element, x, y} = pointer;
      const rect = element.getBoundingClientRect();
      const px = Math.max(0, Math.min(1, (x - rect.left) / rect.width));
      const py = Math.max(0, Math.min(1, (y - rect.top) / rect.height));
      if (element === hero) {
        visual.style.setProperty('--parallax-x', `${(px - .5) * 12}px`);
        visual.style.setProperty('--parallax-y', `${(py - .5) * 9}px`);
        visual.style.setProperty('--tilt-y', `${(px - .5) * 3}deg`);
        visual.style.setProperty('--tilt-x', `${(py - .5) * -3}deg`);
      } else {
        element.style.setProperty('--card-x', `${(py - .5) * -4}deg`);
        element.style.setProperty('--card-y', `${(px - .5) * 4}deg`);
        element.style.setProperty('--card-light-x', `${px * 100}%`);
        element.style.setProperty('--card-light-y', `${py * 100}%`);
      }
    }
    pointer = null;
  }
  addEventListener('scroll', () => { scrollDirty = true; schedule(); }, {passive:true});
  function measure() { scrollRange = Math.max(1, root.scrollHeight - innerHeight); scrollDirty = true; schedule(); }
  addEventListener('resize', measure, {passive:true});
  if ('ResizeObserver' in window) new ResizeObserver(measure).observe(document.body);
  [hero, ...cards].forEach(element => {
    element.addEventListener('pointermove', event => {
      if (reduced.matches || !fine.matches || hero.classList.contains('model-enabled')) return;
      pointer = {element, x:event.clientX, y:event.clientY}; schedule();
    }, {passive:true});
    element.addEventListener('pointerleave', () => { pointer = null; resetTilt(element === hero ? visual : element); });
  });

  let counted = false, counterFrame = 0;
  function finishCounters() { cancelAnimationFrame(counterFrame); counters.forEach(el => el.textContent = el.dataset.count); }
  function count() {
    if (counted) return;
    counted = true;
    if (reduced.matches || document.hidden) { finishCounters(); return; }
    const start = performance.now();
    function tick(now) {
      const t = Math.min(1, (now - start) / 1200);
      counters.forEach(el => el.textContent = Math.round(Number(el.dataset.count) * (1 - (1 - t) ** 3)));
      if (t < 1) counterFrame = requestAnimationFrame(tick);
    }
    counterFrame = requestAnimationFrame(tick);
  }
  if ('IntersectionObserver' in window) {
    root.classList.add('effects-ready');
    const zoneObserver = new IntersectionObserver(entries => entries.forEach(entry => entry.target.classList.toggle('motion-active', entry.isIntersecting)));
    zones.forEach(zone => zoneObserver.observe(zone));
    const revealObserver = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('visible'); revealObserver.unobserve(entry.target); }
    }), {threshold:.08});
    document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
    const counterObserver = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) count();
      else if (counted) finishCounters();
    }, {threshold:.2});
    counterObserver.observe(visual);
    const links = [...document.querySelectorAll('.site-nav a')];
    const navObserver = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) links.forEach(link => link.classList.toggle('active', link.hash === '#' + entry.target.id));
    }), {rootMargin:'-25% 0px -60%'});
    document.querySelectorAll('section[id]').forEach(el => navObserver.observe(el));
  } else {
    document.querySelectorAll('.reveal').forEach(el => el.classList.add('visible'));
    count();
  }
  document.querySelectorAll('.faq-item').forEach(item => item.addEventListener('toggle', () => {
    if (item.open) document.querySelectorAll('.faq-item[open]').forEach(other => { if (other !== item) other.open = false; });
    measure();
  }));
  function motionPreference() {
    if (reduced.matches) { finishCounters(); document.querySelectorAll('.reveal').forEach(el => el.classList.add('visible')); }
    resetTilt(visual); cards.forEach(resetTilt);
  }
  reduced.addEventListener('change', motionPreference);
  fine.addEventListener('change', motionPreference);
  document.addEventListener('visibilitychange', () => {
    root.classList.toggle('page-hidden', document.hidden);
    if (document.hidden) { cancelAnimationFrame(frame); frame = 0; if (counted) finishCounters(); }
    else measure();
  });
  motionPreference(); measure();
})();
