/* Theme toggle and the precessing top in the hero. No dependencies. */

(function () {
  var root = document.documentElement;
  var meta = document.querySelector('meta[name="theme-color"]');
  var button = document.getElementById('theme-toggle');
  var BAR = { dark: '#121826', light: '#f3f5f9' };

  function apply(theme, save) {
    root.setAttribute('data-theme', theme);
    if (meta) meta.setAttribute('content', BAR[theme]);
    if (button) {
      button.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    }
    if (save) {
      try { localStorage.setItem('theme', theme); } catch (e) {}
    }
    window.dispatchEvent(new Event('themechange'));
  }

  apply(root.getAttribute('data-theme') === 'light' ? 'light' : 'dark', false);

  if (button) {
    button.addEventListener('click', function () {
      apply(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark', true);
    });
  }
})();

/* A heavy symmetric top on a fixed pivot, integrated from the Lagrangian
   (theta = tilt from vertical, phi = precession, psi = spin).
   p_psi and p_phi are conserved, so
     I1 * theta'' = (p_phi - p_psi cos t)(p_phi cos t - p_psi) / (I1 sin^3 t) + M g l sin t
   and phi' = (p_phi - p_psi cos t) / (I1 sin^2 t). The wobble in theta is nutation.
   Moving the mouse across the canvas pokes the tip: the push along the tilt changes
   theta', the push around the axis changes phi' (and so p_phi). */

(function () {
  var cv = document.getElementById('top');
  if (!cv || !cv.getContext) return;

  var ctx = cv.getContext('2d');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var I1 = 1, I3 = 0.55, SPIN = 15;       // moments of inertia, spin rate about the axis
  var PSI = I3 * SPIN;                    // p_psi
  var MGL = 8.25;                         // M g l (slow precession is about MGL / PSI = 1 rad/s)
  var DAMP = 0.12;                        // pivot friction on theta'
  var TMIN = 0.12, TMAX = 1.25;

  var th = 0.5, thd = 0, phi = 0, psi = 0.3;
  var pphi = PSI * Math.cos(th);
  var pphiBase = pphi;

  var W = 0, H = 0, dpr = 1;
  var VIEW = 0.62, ca = Math.cos(VIEW), sa = Math.sin(VIEW);
  var trail = [];
  var C = {};
  var visible = true, running = false, last = 0;

  function phiDot() { var s = Math.sin(th); return (pphi - PSI * Math.cos(th)) / (I1 * s * s); }

  function step(dt) {
    var s = Math.sin(th), c = Math.cos(th);
    var acc = (pphi - PSI * c) * (pphi * c - PSI) / (I1 * s * s * s) + MGL * s - DAMP * thd;
    thd += acc * dt / I1;
    th += thd * dt;
    if (th < TMIN) { th = TMIN; if (thd < 0) thd = 0; }
    if (th > TMAX) { th = TMAX; if (thd > 0) thd = 0; }
    var pd = phiDot();
    phi += pd * dt;
    psi += (PSI / I3 - pd * Math.cos(th)) * dt;
    pphi += (pphiBase - pphi) * 0.1 * dt;   // slow recovery so a poked top does not run away
  }

  function advance(dt) {
    var n = Math.max(1, Math.round(dt * 240));
    for (var i = 0; i < n; i++) step(dt / n);
    var st = Math.sin(th);
    trail.push([st * Math.cos(phi), st * Math.sin(phi), Math.cos(th)]);
    if (trail.length > 260) trail.shift();
  }

  function readColors() {
    var cs = getComputedStyle(document.documentElement);
    ['ink', 'accent-text', 'warm', 'line-strong', 'faint', 'bg-raise', 'bg'].forEach(function (k) {
      C[k] = cs.getPropertyValue('--' + k).trim();
    });
  }

  function resize() {
    var r = cv.getBoundingClientRect();
    if (!r.width) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!running) draw();
  }

  function scale() { return Math.min(W, H) * 0.5; }
  function project(p) {
    var s = scale();
    return [W / 2 + s * p[0], H * 0.74 - s * (p[2] * ca + p[1] * sa)];
  }
  function add(o, u, a, v, b) { return [o[0] + a * u[0] + b * v[0], o[1] + a * u[1] + b * v[1], o[2] + a * u[2] + b * v[2]]; }

  function stroke(pts, color, width, alpha, dash) {
    ctx.beginPath();
    for (var i = 0; i < pts.length; i++) {
      var q = project(pts[i]);
      if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]);
    }
    ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = width;
    ctx.setLineDash(dash || []); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
  }
  function ring(o, u, v, r, n) {
    var pts = [];
    for (var i = 0; i <= n; i++) { var a = i / n * Math.PI * 2; pts.push(add(o, u, Math.cos(a) * r, v, Math.sin(a) * r)); }
    return pts;
  }
  function dot(p, r, color) {
    var q = project(p); ctx.beginPath(); ctx.arc(q[0], q[1], r, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
  }

  function draw() {
    if (!W) return;
    ctx.clearRect(0, 0, W, H);
    var st = Math.sin(th), ct = Math.cos(th), sp = Math.sin(phi), cp = Math.cos(phi);
    var a = [st * cp, st * sp, ct];
    var e1 = [-sp, cp, 0], e2 = [-ct * cp, -ct * sp, st];     // unit vectors in the disc plane
    var X = [1, 0, 0], Y = [0, 1, 0], O = [0, 0, 0];

    // floor, vertical axis, and the cone the spin axis sweeps out
    stroke(ring(O, X, Y, 0.8, 90), C['line-strong'], 1, 1);
    stroke([O, [0, 0, 1.2]], C.faint, 1, 0.8, [3, 5]);
    stroke(ring([0, 0, ct], X, Y, st, 72), C['accent-text'], 1.25, 0.3, [4, 5]);

    // tip trail (the loops are nutation)
    for (var i = 1; i < trail.length; i++) stroke([trail[i - 1], trail[i]], C['accent-text'], 2.2, i / trail.length * 0.9);

    // disc centred on the axis; the axis runs from the pivot through the disc centre to the tip
    var d = 0.62, r = 0.36, ctr = [a[0] * d, a[1] * d, a[2] * d];
    var rim = ring(ctr, e1, e2, r, 72);
    stroke([O, ctr], C.ink, 3, 1);                      // lower axis, seen through the disc

    ctx.beginPath();
    for (var j = 0; j < rim.length; j++) { var p = project(rim[j]); if (j) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }
    ctx.closePath();
    ctx.globalAlpha = 0.6; ctx.fillStyle = C['bg-raise']; ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.stroke();

    for (var m = 0; m < 3; m++) {
      var u = psi + m * Math.PI * 2 / 3;
      stroke([ctr, add(ctr, e1, Math.cos(u) * r, e2, Math.sin(u) * r)], C.faint, 1.5, 1);
    }
    dot(add(ctr, e1, Math.cos(psi) * r, e2, Math.sin(psi) * r), 4.5, C.warm);

    // upper axis: leaves the disc at its centre and runs out to the tip
    stroke([ctr, a], C.ink, 3, 1);
    dot(ctr, 3, C.ink);
    dot(a, 5, C['accent-text']);
    dot(O, 3.5, C.ink);
  }

  function frame(now) {
    if (!running) return;
    var dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    advance(dt);
    draw();
    requestAnimationFrame(frame);
  }
  function start() {
    if (running || reduce || !visible || document.hidden) return;
    running = true; last = performance.now(); requestAnimationFrame(frame);
  }
  function stop() { running = false; }

  readColors();
  if (reduce) for (var n = 0; n < 150; n++) advance(1 / 60);
  resize();
  window.addEventListener('themechange', function () { readColors(); if (!running) draw(); });
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(cv); else window.addEventListener('resize', resize);

  if (!reduce) {
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (e) { visible = e[0].isIntersecting; if (visible) start(); else stop(); }).observe(cv);
    }
    document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else start(); });

    var lx = null, ly = null;
    cv.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      if (lx !== null) {
        var s = scale();
        var wx = (e.clientX - lx) / s, wy = -(e.clientY - ly) / (s * sa);     // push on the tip, floor plane
        var radial = wx * Math.cos(phi) + wy * Math.sin(phi);
        var around = -wx * Math.sin(phi) + wy * Math.cos(phi);
        thd += Math.max(-1.5, Math.min(1.5, radial * 6));
        var pd = phiDot() + Math.max(-1.5, Math.min(1.5, around * 3 / Math.max(Math.sin(th), 0.3)));
        pphi = I1 * Math.sin(th) * Math.sin(th) * pd + PSI * Math.cos(th);
      }
      lx = e.clientX; ly = e.clientY;
    });
    cv.addEventListener('pointerleave', function () { lx = ly = null; });
    start();
  }
})();

/* Photo lightbox on the photography page. */

(function () {
  var lb = document.getElementById('lightbox');
  if (!lb || !lb.showModal) return;
  var img = lb.querySelector('img'), cap = lb.querySelector('p');
  document.querySelectorAll('.masonry a').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      img.src = a.getAttribute('href');
      img.alt = a.querySelector('img').alt;
      cap.textContent = a.getAttribute('data-cap');
      lb.showModal();
    });
  });
  lb.addEventListener('click', function (e) { if (e.target !== img) lb.close(); });
})();
