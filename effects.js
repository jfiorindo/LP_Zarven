(() => {
  'use strict';
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const visual = document.querySelector('.system-visual');
  const hero = document.querySelector('.hero');
  const cards = [...document.querySelectorAll('.product-card')];
  const header = document.getElementById('header');
  const progress = document.getElementById('scroll-progress');
  const counters = [...document.querySelectorAll('[data-count]')];
  const zones = [...document.querySelectorAll('section, .ticker')];
  const supportsScrollTimeline = CSS.supports('animation-timeline', 'scroll(root block)');
  const nativeProgress = () => supportsScrollTimeline && !reduced.matches;
  const observeHeader = 'IntersectionObserver' in window;

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

  // Native scrolling: one scheduled progress update per frame, no pointer loop.
  let frame = 0;
  let scrollRange = Math.max(1, root.scrollHeight - innerHeight);
  function schedule() { if (!frame && !document.hidden) frame = requestAnimationFrame(update); }
  function update() {
    frame = 0;
    if (!observeHeader) header.classList.toggle('scrolled', scrollY > 24);
    if (!nativeProgress()) progress.style.transform = `scaleX(${Math.min(1, Math.max(0, scrollY / scrollRange))})`;
  }
  addEventListener('scroll', () => { if (!nativeProgress() || !observeHeader) schedule(); }, {passive:true});
  function measure() {
    if (!nativeProgress()) scrollRange = Math.max(1, root.scrollHeight - innerHeight);
    schedule();
  }
  addEventListener('resize', measure, {passive:true});
  if ('ResizeObserver' in window) new ResizeObserver(measure).observe(document.body);

  let counted = false, counterFrame = 0;
  function finishCounters() { cancelAnimationFrame(counterFrame); counters.forEach(el => el.textContent = el.dataset.count); }
  function count() {
    if (counted) return;
    counted = true;
    if (reduced.matches || root.dataset.scrollMotion === 'off' || document.hidden) { finishCounters(); return; }
    const start = performance.now();
    function tick(now) {
      const t = Math.min(1, (now - start) / 1200);
      counters.forEach(el => el.textContent = Math.round(Number(el.dataset.count) * (1 - (1 - t) ** 3)));
      if (t < 1) counterFrame = requestAnimationFrame(tick);
    }
    counterFrame = requestAnimationFrame(tick);
  }
  let revealObserver;
  if ('IntersectionObserver' in window) {
    const sentinel = decoration('header-sentinel', '', document.body, true);
    new IntersectionObserver(([entry]) => header.classList.toggle('scrolled', !entry.isIntersecting)).observe(sentinel);
    root.classList.add('effects-ready');
    const zoneObserver = new IntersectionObserver(entries => entries.forEach(entry => entry.target.classList.toggle('motion-active', entry.isIntersecting)));
    zones.forEach(zone => zoneObserver.observe(zone));
    // Small per-row stagger, including the diagnostic cards (not their wrapper).
    document.querySelector('.problem-grid').classList.remove('reveal');
    document.querySelectorAll('.problem-card').forEach((el, index) => {
      el.classList.add('reveal');
      el.dataset.delay = String(index % 2);
    });
    revealObserver = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('visible'); revealObserver.unobserve(entry.target); }
    }), {threshold:0, rootMargin:'0px 0px -12px 0px'});
    document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
    const counterObserver = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) count();
      else if (counted) finishCounters();
    }, {threshold:.2});
    counterObserver.observe(visual);
    const links = [...document.querySelectorAll('.site-nav a')];
    const navObserver = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) links.forEach(link => {
        const active = link.hash === '#' + entry.target.id;
        link.classList.toggle('active', active);
        if (active) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }), {rootMargin:'-25% 0px -60%'});
    document.querySelectorAll('section[id]').forEach(el => navObserver.observe(el));
  } else {
    document.querySelectorAll('.reveal').forEach(el => el.classList.add('visible'));
    count();
  }
  // The heading remains readable even if JS/observers are unavailable.
  if (!reduced.matches && !location.hash && scrollY < 24) hero.classList.add('hero-enter');
  hero.addEventListener('animationend', event => {
    if (event.target.matches('.hero-actions')) hero.classList.remove('hero-enter');
  });
  document.addEventListener('focusin', event => {
    const reveal = event.target.closest('.reveal');
    if (reveal) { reveal.classList.add('visible'); revealObserver?.unobserve(reveal); }
    hero.classList.remove('hero-enter');
  });
  document.querySelectorAll('.faq-item').forEach(item => item.addEventListener('toggle', () => {
    if (item.open) document.querySelectorAll('.faq-item[open]').forEach(other => { if (other !== item) other.open = false; });
    measure();
  }));
  function motionPreference() {
    root.classList.toggle('native-scroll-progress', nativeProgress());
    if (nativeProgress()) progress.style.removeProperty('transform');
    measure();
    if (reduced.matches) {
      finishCounters();
      hero.classList.remove('hero-enter');
      document.querySelectorAll('.reveal').forEach(el => el.classList.add('visible'));
      revealObserver?.disconnect();
    }
  }
  reduced.addEventListener('change', motionPreference);
  document.addEventListener('zarven:motionchange', () => {
    if (root.dataset.scrollMotion === 'off') finishCounters();
  });
  document.addEventListener('visibilitychange', () => {
    root.classList.toggle('page-hidden', document.hidden);
    if (document.hidden) { cancelAnimationFrame(frame); frame = 0; if (counted) finishCounters(); }
    else measure();
  });
  motionPreference(); measure();
})();
