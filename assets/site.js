// Skyscraper landing page: build timeline (scroll plays the film), services, areas, menu, gallery.
(() => {
  const d = document;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const portrait = matchMedia('(max-width: 899px)');
  const conn = navigator.connection || {};
  const hh = () => parseFloat(getComputedStyle(d.documentElement).getPropertyValue('--hh')) * 16 || 72;

  // Build timeline. Scroll position drives the film; when the visitor stops, the page moves
  // itself forward at real speed until they scroll again (the kwcarwash.com reel pattern).
  // Without JS or with reduced motion it stays a still panel plus a list of the 5 stages.
  const tl = d.querySelector('.tl');
  if (tl && !reduce.matches && !conn.saveData && !/2g$/.test(conn.effectiveType || '')) {
    const panel = tl.querySelector('.tl__panel');
    const stages = [...tl.querySelectorAll('.tl__stage')];
    const fills = [...tl.querySelectorAll('.tl__fill')];
    const n = stages.length;
    const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);
    let v = null, url = '', mode = '', dur = 0, cur = -1, travel = 0, queued = false;
    tl.classList.add('is-scrub');

    const remeasure = () => { travel = tl.offsetHeight - (innerHeight - hh()); };
    const progress = () => (travel > 0 ? clamp((hh() - tl.getBoundingClientRect().top) / travel, 0, 1) : 0);

    // One seek at a time: keep only the latest wanted time and issue it when the last seek lands.
    let wanted = null, seeking = false, guard = null;
    const seekDone = () => { clearTimeout(guard); guard = null; seeking = false; pump(); };
    const pump = () => {
      if (wanted === null || !v) { seeking = false; return; }
      const t = wanted; wanted = null;
      if (Math.abs(v.currentTime - t) < 0.03) { seeking = false; return; }
      seeking = true;
      guard = setTimeout(seekDone, 220); // a dropped seek must never wedge the scrubber
      try { if (v.fastSeek) v.fastSeek(t); else v.currentTime = t; } catch (e) { seekDone(); }
    };
    const seekTo = (t) => { wanted = t; if (!seeking) pump(); };

    const render = () => {
      queued = false;
      const p = progress(), x = p * n, i = Math.min(n - 1, Math.floor(x));
      fills.forEach((f, j) => f.style.setProperty('--f', j < i ? 1 : j > i ? 0 : Math.min(1, x - i)));
      if (i !== cur) { stages.forEach((s, j) => s.classList.toggle('is-on', j === i)); cur = i; }
      if (v && dur) seekTo(p * (dur - 0.05));
    };
    const queue = () => { if (!queued) { queued = true; requestAnimationFrame(render); } };

    const load = async () => {
      const m = portrait.matches ? 'm' : 'd';
      if (m === mode) return;
      mode = m;
      try {
        const res = await fetch(panel.dataset[m]);
        if (!res.ok) throw new Error(res.status);
        const blob = await res.blob();
        if (mode !== m) return;
        const nv = d.createElement('video');
        nv.muted = true; nv.playsInline = true; nv.preload = 'auto';
        nv.setAttribute('muted', ''); nv.setAttribute('playsinline', ''); nv.setAttribute('aria-hidden', 'true');
        const nu = URL.createObjectURL(blob);
        nv.addEventListener('loadedmetadata', () => { dur = nv.duration; nv.currentTime = Math.max(0.05, progress() * (dur - 0.05)); }, { once: true });
        nv.addEventListener('seeked', () => { panel.classList.add('is-live'); seekDone(); });
        nv.src = nu;
        panel.insertBefore(nv, panel.querySelector('.tl__scrim'));
        if (v) { v.remove(); URL.revokeObjectURL(url); }
        v = nv; url = nu; wanted = null; seeking = false;
      } catch (e) { mode = ''; }
    };
    new IntersectionObserver((es, o) => { if (es.some((e) => e.isIntersecting)) { o.disconnect(); load(); } }, { rootMargin: '800px 0px' }).observe(tl);
    portrait.addEventListener('change', () => { remeasure(); if (v) load(); queue(); });
    addEventListener('scroll', queue, { passive: true });
    addEventListener('resize', () => { remeasure(); queue(); }, { passive: true });

    // iOS only paints seeked frames after one play() from a user gesture.
    const prime = () => {
      if (!v) return;
      removeEventListener('touchstart', prime);
      const p = v.play();
      if (p) p.then(() => { v.pause(); queue(); }).catch(() => {});
    };
    addEventListener('touchstart', prime, { passive: true });

    // Progress bar segments jump to their stage.
    tl.querySelectorAll('.tl__seg').forEach((b, j) => b.addEventListener('click', () => {
      lastInput = Date.now();
      scrollTo({ top: tl.offsetTop - hh() + ((j + 0.02) / n) * travel, behavior: 'smooth' });
    }));

    // Idle auto-advance. It drives the scroll, not the video clock, so the pinned section and the
    // film never disagree. Any real input hands control back; our own scrollBy is not input.
    let lastInput = 0, raf = null, prev = 0, expectedY = 0;
    const IDLE_MS = 120;
    ['wheel', 'touchstart', 'touchmove', 'keydown', 'pointerdown'].forEach((e) => addEventListener(e, () => { lastInput = Date.now(); }, { passive: true }));
    const autoStep = (now) => {
      raf = null;
      const dt = prev ? Math.min((now - prev) / 1000, 0.1) : 0;
      prev = now;
      const p = progress();
      const idle = Date.now() - lastInput > IDLE_MS;
      const settled = Math.abs(scrollY - expectedY) <= 3; // not still coasting from a flick
      if (idle && settled && p > 0 && p < 1 && !d.hidden && travel > 0 && dur) {
        const dy = (travel / dur) * dt;
        if (dy > 0) scrollBy({ top: dy, behavior: 'instant' });
      }
      expectedY = scrollY;
      schedule();
    };
    const schedule = () => { if (raf === null) raf = requestAnimationFrame(autoStep); };
    new IntersectionObserver((es) => {
      if (es[0].isIntersecting) { prev = 0; expectedY = scrollY; schedule(); }
      else if (raf !== null) { cancelAnimationFrame(raf); raf = null; }
    }, { threshold: 0 }).observe(tl);

    remeasure();
    render();
  }

  // Services: one slice open at a time, opens on hover on desktop.
  const slices = [...d.querySelectorAll('.slice')];
  const wide = matchMedia('(min-width: 900px)');
  const hover = matchMedia('(hover: hover) and (pointer: fine)');
  slices.forEach((s) => {
    let t;
    s.querySelector('summary').addEventListener('click', (e) => { if (wide.matches && s.open) e.preventDefault(); });
    s.addEventListener('toggle', () => { if (s.open) slices.forEach((o) => { if (o !== s) o.open = false; }); });
    s.addEventListener('pointerenter', () => { if (wide.matches && hover.matches && !s.open) t = setTimeout(() => { s.open = true; }, 140); });
    s.addEventListener('pointerleave', () => clearTimeout(t));
  });

  // Areas: tabs switch the row, arrows scroll it.
  const tabs = [...d.querySelectorAll('.areas__tab')];
  const panels = [...d.querySelectorAll('.areas__panel')];
  const select = (t) => {
    tabs.forEach((x) => { const on = x === t; x.setAttribute('aria-selected', on); x.tabIndex = on ? 0 : -1; });
    panels.forEach((p) => { p.hidden = p.id !== t.getAttribute('aria-controls'); });
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(t));
    t.addEventListener('keydown', (e) => {
      const rtl = d.dir === 'rtl', k = e.key;
      const step = k === 'ArrowRight' ? (rtl ? -1 : 1) : k === 'ArrowLeft' ? (rtl ? 1 : -1) : 0;
      if (!step) return;
      const nt = tabs[(i + step + tabs.length) % tabs.length];
      select(nt); nt.focus();
    });
  });
  d.querySelectorAll('.areas__nav').forEach((b) => b.addEventListener('click', () => {
    const row = d.querySelector('.areas__panel:not([hidden]) .areas__row');
    if (!row) return;
    const fwd = b.classList.contains('next') ? 1 : -1;
    row.scrollBy({ left: fwd * (d.dir === 'rtl' ? -1 : 1) * row.clientWidth * 0.8 });
  }));

  // Header services menu: "Services" is a link; the arrow button opens the list (hover opens it on desktop).
  const menu = d.querySelector('.menu');
  if (menu) {
    const btn = menu.querySelector('.menu__btn');
    const set = (on) => { menu.classList.toggle('is-open', on); btn.setAttribute('aria-expanded', on); };
    btn.addEventListener('click', (e) => { e.stopPropagation(); set(!menu.classList.contains('is-open')); });
    d.addEventListener('click', (e) => { if (!menu.contains(e.target)) set(false); });
    d.addEventListener('keydown', (e) => { if (e.key === 'Escape') set(false); });
  }

  // Services page: the service name is a link; the +/- button opens its sub-services.
  d.querySelectorAll('.acc__tog').forEach((b) => b.addEventListener('click', () => {
    const list = d.getElementById(b.getAttribute('aria-controls'));
    const on = b.getAttribute('aria-expanded') !== 'true';
    b.setAttribute('aria-expanded', on); list.hidden = !on;
  }));

  // Service pages: the steps fill in one by one and the price gauges grow when their section comes into view.
  const steps = d.querySelector('.steps__list');
  if (steps && 'IntersectionObserver' in window) {
    const lis = [...steps.children];
    new IntersectionObserver((es, o) => {
      if (!es[0].isIntersecting) return;
      o.disconnect();
      lis.forEach((li, i) => setTimeout(() => li.classList.add('is-on'), reduce.matches ? 0 : i * 280));
    }, { threshold: 0.4 }).observe(steps);
  }
  const price = d.querySelector('.price');
  if (price && 'IntersectionObserver' in window) {
    new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { o.disconnect(); price.classList.add('is-on'); } }, { threshold: 0.3 }).observe(price);
  } else if (price) price.classList.add('is-on');

  // Service slider: arrow buttons scroll by one card.
  d.querySelectorAll('.sidx').forEach((sec) => {
    const tr = sec.querySelector('.sidx__track');
    const go = (dir) => { const li = tr.querySelector('li'); const step = li ? li.getBoundingClientRect().width + 16 : tr.clientWidth * 0.8; tr.scrollBy({ left: dir * step * (d.dir === 'rtl' ? -1 : 1) }); };
    sec.querySelector('.sl-prev')?.addEventListener('click', () => go(-1));
    sec.querySelector('.sl-next')?.addEventListener('click', () => go(1));
  });

  // Gallery photos open in a lightbox.
  const lb = d.querySelector('.lb');
  if (lb && lb.showModal) {
    const img = lb.querySelector('img');
    d.querySelectorAll('.tile__open').forEach((b) => b.addEventListener('click', () => {
      img.src = b.dataset.full; img.alt = b.querySelector('img').alt; lb.showModal();
    }));
    lb.querySelector('.lb__x').addEventListener('click', () => lb.close());
    lb.addEventListener('click', (e) => { if (e.target === lb) lb.close(); });
  }

  // Gallery videos load only when played.
  d.querySelectorAll('.tile__play').forEach((b) => b.addEventListener('click', () => {
    const v = b.parentNode.querySelector('video');
    v.controls = true; v.play(); b.hidden = true;
  }));
})();

// video posters load when the gallery is near the viewport, not during the first paint
(function(){var v=document.querySelectorAll("video[data-poster]");if(!v.length)return;var io=new IntersectionObserver(function(es){es.forEach(function(e){if(!e.isIntersecting)return;e.target.poster=e.target.dataset.poster;io.unobserve(e.target);});},{rootMargin:"400px"});v.forEach(function(x){io.observe(x);});})();
