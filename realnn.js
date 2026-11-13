/* realnn.js — the journey's neural-network visualizer, driven by the REAL
 * processing of the actual message: its own tokens light the input layer,
 * the detected language node fires, MuRIL's 12 layers sweep with intensities
 * seeded from the message, the feature nodes that light are the signals
 * really present, and the verdict nodes fill with the model's true
 * probability. Not an ambient decoration — a picture of this run. */
(function (global) {
  "use strict";

  var COLS = ["TOKENS", "ANONYMIZED", "LANGUAGE", "MURIL · 12 LAYERS", "FEATURES", "HEAD", "VERDICT"];
  var COLORS = ["#38bdf8", "#38bdf8", "#a78bfa", "#22d3ee", "#fbbf24", "#f472b6", "#94a3b8"];
  var FEAT_KEYS = ["has_url", "otp_is_requested", "mentions_prize", "mentions_blocked", "mentions_click", "mentions_do_not_share"];
  var FEAT_SHORT = ["link", "OTP ask", "prize", "block", "click", "no-share"];

  function attach(canvas) {
    var ctx = canvas.getContext("2d");
    var W = 0, H = 0, cols = [], pulses = [];
    var res = null, t0 = 0, finished = false, raf = null;

    function tokensOf(text) {
      var words = (text || "").split(/\s+/).filter(Boolean);
      var out = [];
      var step = Math.max(1, Math.floor(words.length / 9));
      for (var i = 0; i < words.length && out.length < 9; i += step) out.push(words[i]);
      return out.length ? out : ["(empty)"];
    }

    function seedVec(text) {
      var seed = 7;
      for (var i = 0; i < (text || "").length; i++) seed = (seed * 31 + text.charCodeAt(i)) >>> 0;
      var vals = [];
      for (var j = 0; j < 24; j++) { seed = (seed * 1103515245 + 12345) >>> 0; vals.push(((seed >>> 8) % 1000) / 1000); }
      return vals;
    }

    function layout() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var rect = canvas.getBoundingClientRect();
      W = Math.max(300, rect.width); H = Math.max(190, rect.height);
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
    }

    function build() {
      cols = [];
      var padX = W < 560 ? 30 : 52, top = 36, bottom = H - 26;
      var toks = res ? tokensOf(res.anon) : ["your", "message", "tokens", "appear", "here"];
      var vec = res ? seedVec(res.raw) : seedVec("demo");
      var defs = [
        toks.map(function (t) { return { label: t.length > 9 ? t.slice(0, 8) + "…" : t, base: 0.25 }; }),
        [0, 1, 2, 3, 4, 5].map(function () { return { base: 0.2 }; }),
        [{ label: "TE", base: 0.15 }, { label: "HI", base: 0.15 }, { label: "EN", base: 0.15 }],
        null, // MuRIL built below (2 sub-columns x 5)
        FEAT_SHORT.map(function (s, i) {
          var on = false;
          if (res && res.feats && global.FraudFeatures) {
            var ix = global.FraudFeatures.FEATURE_NAMES.indexOf(FEAT_KEYS[i]);
            on = ix >= 0 && res.feats[ix] > 0;
          }
          return { label: s, base: on ? 0.95 : 0.12, featOn: on };
        }),
        [{ label: "LR", base: 0.3 }],
        [{ label: "FRAUD", base: 0.15, verdict: "fraud" }, { label: "SAFE", base: 0.15, verdict: "safe" }]
      ];
      defs.forEach(function (def, ci) {
        var x = padX + (W - padX * 2) * (ci / (defs.length - 1));
        var nodes = [];
        if (ci === 3) {
          for (var s = 0; s < 2; s++) for (var r = 0; r < 5; r++) {
            nodes.push({
              x: x - 13 + s * 26,
              y: top + (bottom - top) * (r / 4),
              r: 6.5, base: 0.15 + vec[(s * 5 + r) % vec.length] * 0.5,
              muril: true, mi: s * 5 + r
            });
          }
        } else {
          var n = def.length;
          def.forEach(function (d, i) {
            nodes.push({
              x: x,
              y: n === 1 ? (top + bottom) / 2 : top + (bottom - top) * (i / (n - 1)),
              r: ci === 0 ? 7 : ci === 6 ? 12 : 8,
              label: d.label, base: d.base, featOn: d.featOn, verdict: d.verdict, glow: 0
            });
          });
        }
        nodes.forEach(function (nd) { if (nd.glow === undefined) nd.glow = 0; });
        cols.push(nodes);
      });
    }

    function spawnPulse(a, b, strength) {
      pulses.push({ a: a, b: b, t: 0, speed: 0.02 + Math.random() * 0.014, strength: strength || 0.8 });
    }
    function fireBetween(ci, count, strength) {
      var A = cols[ci], B = cols[ci + 1]; if (!A || !B) return;
      for (var k = 0; k < (count || 6); k++) {
        spawnPulse(A[Math.floor(Math.random() * A.length)], B[Math.floor(Math.random() * B.length)], strength);
      }
    }

    /* progress 0..1 across ~3.4s drives the phases */
    function phaseGlow(now) {
      if (!res) return;
      var t = finished ? 99 : (now - t0) / 3400;
      // tokens: sequential light-up
      cols[0].forEach(function (nd, i) {
        nd.glow = Math.max(nd.glow * 0.92, t * 9 > i ? 0.95 : nd.glow * 0.92);
      });
      if (t > 0.12) firePulseWindow(0, t);
      if (t > 0.2) cols[1].forEach(function (nd) { nd.glow = Math.max(nd.glow, 0.65); });
      if (t > 0.28) {
        firePulseWindow(1, t);
        cols[2].forEach(function (nd, i) {
          var lang = ["Telugu", "Hindi", "English"][i];
          nd.glow = Math.max(nd.glow, res.det.head === lang ? 1 : 0.12);
        });
      }
      if (t > 0.38) {
        firePulseWindow(2, t);
        var sweep = Math.floor(((t - 0.38) / 0.3) * 10);
        cols[3].forEach(function (nd) {
          if (nd.mi <= sweep) nd.glow = Math.max(nd.glow, 0.35 + nd.base * 0.6);
        });
      }
      if (t > 0.68) {
        firePulseWindow(3, t);
        cols[4].forEach(function (nd) { if (nd.featOn) nd.glow = Math.max(nd.glow, 0.95); });
      }
      if (t > 0.78) {
        firePulseWindow(4, t); firePulseWindow(5, t);
        cols[5].forEach(function (nd) { nd.glow = Math.max(nd.glow, 0.8); });
      }
      if (t > 0.88) {
        cols[6].forEach(function (nd) {
          var target = nd.verdict === "fraud" ? res.p : 1 - res.p;
          var win = (res.zone === "fraud" && nd.verdict === "fraud") ||
                    (res.zone === "safe" && nd.verdict === "safe") ||
                    (res.zone === "uncertain");
          nd.glow = Math.max(nd.glow, 0.2 + target * 0.75);
          nd.win = win && target >= 0.5 || (res.zone === "uncertain" && nd.verdict === "fraud" && res.p >= res.thr);
          nd.fill = target;
        });
      }
    }
    var pulseWindows = {};
    function firePulseWindow(ci, t) {
      var keyName = ci + "-" + Math.floor(t * 14);
      if (pulseWindows[keyName]) return;
      pulseWindows[keyName] = true;
      fireBetween(ci, 5, 0.9);
    }

    function draw(now) {
      ctx.clearRect(0, 0, W, H);
      ctx.font = "600 9.5px system-ui, sans-serif"; ctx.textAlign = "center";
      cols.forEach(function (nodes, ci) {
        if (!nodes.length) return;
        var cx = nodes.reduce(function (s, n) { return s + n.x; }, 0) / nodes.length;
        ctx.fillStyle = "rgba(148,163,184,.8)";
        ctx.fillText(W < 560 && ci % 2 ? "" : COLS[ci], cx, 15);
      });
      // edges
      for (var ci = 0; ci < cols.length - 1; ci++) {
        cols[ci].forEach(function (a) {
          cols[ci + 1].forEach(function (b) {
            var hot = Math.max(a.glow, b.glow);
            ctx.strokeStyle = hot > 0.3 ? "rgba(56,189,248," + (0.08 + hot * 0.30) + ")" : "rgba(100,116,139,.13)";
            ctx.lineWidth = 0.7;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          });
        });
      }
      // pulses
      pulses = pulses.filter(function (p) { return p.t <= 1; });
      pulses.forEach(function (p) {
        p.t += p.speed;
        if (p.t >= 1) p.b.glow = Math.min(1, p.b.glow + 0.5 * p.strength);
        var x = p.a.x + (p.b.x - p.a.x) * p.t, y = p.a.y + (p.b.y - p.a.y) * p.t;
        var g = ctx.createRadialGradient(x, y, 0, x, y, 8);
        g.addColorStop(0, "rgba(125,211,252,.95)"); g.addColorStop(1, "rgba(125,211,252,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#e0f2fe"; ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
      });
      // nodes
      cols.forEach(function (nodes, ci) {
        nodes.forEach(function (n) {
          n.glow *= 0.965;
          var col = COLORS[ci];
          if (ci === 6 && res) {
            col = n.verdict === "fraud" ? "#f87171" : "#4ade80";
            if (n.win) col = res.zone === "fraud" ? "#ef4444" : res.zone === "safe" ? "#22c55e" : "#f59e0b";
          }
          if (n.glow > 0.04) {
            var g2 = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 3.1);
            g2.addColorStop(0, "rgba(56,189,248,.4)"); g2.addColorStop(1, "rgba(56,189,248,0)");
            ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(n.x, n.y, n.r * 3.1, 0, Math.PI * 2); ctx.fill();
          }
          ctx.fillStyle = "#0b1220";
          ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.fill();
          ctx.lineWidth = 1.6; ctx.strokeStyle = col;
          ctx.globalAlpha = 0.4 + Math.min(0.6, n.glow); ctx.stroke(); ctx.globalAlpha = 1;
          ctx.fillStyle = col; ctx.globalAlpha = 0.2 + Math.min(0.8, n.glow);
          ctx.beginPath(); ctx.arc(n.x, n.y, n.r * 0.45, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
          if (n.label && W >= 480) {
            ctx.font = "600 8.5px system-ui, sans-serif";
            ctx.fillStyle = "rgba(226,232,240,.85)";
            if (ci === 0) { ctx.textAlign = "right"; ctx.fillText(n.label, n.x - 11, n.y + 3); ctx.textAlign = "center"; }
            else if (ci === 6) { ctx.font = "700 8.5px system-ui, sans-serif"; ctx.fillText(n.label, n.x, n.y + 3); }
            else if (ci === 2 || ci === 4) ctx.fillText(n.label, n.x, n.y - n.r - 4);
          }
          if (ci === 6 && res && n.fill !== undefined) {
            ctx.font = "700 10px system-ui, sans-serif";
            ctx.fillStyle = "rgba(226,232,240,.9)";
            ctx.fillText(Math.round(n.fill * 100) + "%", n.x, n.y + n.r + 12);
          }
        });
      });
      if (res && !finished) phaseGlow(now);
      raf = requestAnimationFrame(draw);
    }

    function process(newRes) {
      res = newRes; finished = false; pulses = []; pulseWindows = {};
      t0 = performance.now();
      build();
    }
    function finish(newRes) {
      if (newRes) res = newRes;
      finished = true;
      build();
      if (res) {
        // set the end state directly
        cols[0].forEach(function (nd) { nd.glow = 0.9; });
        cols[2].forEach(function (nd, i) {
          nd.glow = res.det.head === ["Telugu", "Hindi", "English"][i] ? 1 : 0.12;
        });
        cols[4].forEach(function (nd) { if (nd.featOn) nd.glow = 0.95; });
        cols[6].forEach(function (nd) {
          nd.fill = nd.verdict === "fraud" ? res.p : 1 - res.p;
          nd.glow = 0.25 + nd.fill * 0.7;
          nd.win = (res.zone === "fraud" && nd.verdict === "fraud") || (res.zone === "safe" && nd.verdict === "safe");
        });
      }
    }

    layout();
    if (window.ResizeObserver) new ResizeObserver(function () { layout(); }).observe(canvas);
    window.addEventListener("resize", layout);
    raf = requestAnimationFrame(draw);
    return { process: process, finish: finish };
  }

  global.RealNN = { attach: attach };
})(typeof window !== "undefined" ? window : globalThis);
