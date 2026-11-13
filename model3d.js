/* model3d.js — Interactive 3D exploded view of the Fraud Detector system.
 * Three.js scene: the pipeline as a machine on a bench. Orbit to rotate,
 * scroll to zoom, the page slider explodes the components apart, X-ray makes
 * the MuRIL casing transparent to reveal its 12 transformer layers, and
 * clicking a component selects it (the detail card below follows). */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

(function () {
  "use strict";
  var wrap = document.getElementById("c3d-wrap");
  var canvas = document.getElementById("c3d");
  if (!wrap || !canvas) return;

  var PART_DEFS = [
    { key: "dataset",    label: "Dataset",     color: 0x0ea5e9 },
    { key: "preprocess", label: "Preprocess",  color: 0x38bdf8 },
    { key: "tokenizer",  label: "Tokenizer",   color: 0x22d3ee },
    { key: "muril",      label: "MuRIL",       color: 0xa78bfa },
    { key: "features",   label: "Features",    color: 0xf59e0b },
    { key: "classifier", label: "Classifier",  color: 0xf472b6 },
    { key: "threshold",  label: "Threshold",   color: 0xfbbf24 },
    { key: "runtime",    label: "Extension",   color: 0x34d399 },
    { key: "feedback",   label: "Feedback",    color: 0x4ade80 }
  ];

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
  } catch (e) {
    wrap.innerHTML = '<div class="c3d-fallback">3D view needs WebGL — the component explorer below works without it.</div>';
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  var scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x070d1a, 18, 34);
  var camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(7.5, 4.6, 9.5);

  var controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 0.4, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 5; controls.maxDistance = 22;
  controls.maxPolarAngle = Math.PI * 0.55;
  controls.autoRotate = true; controls.autoRotateSpeed = 0.7;
  canvas.addEventListener("pointerdown", function () { controls.autoRotate = false; }, { once: true });

  scene.add(new THREE.AmbientLight(0xbfd4ff, 0.55));
  var key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(6, 10, 6); scene.add(key);
  var rim = new THREE.DirectionalLight(0x38bdf8, 0.7); rim.position.set(-8, 4, -6); scene.add(rim);
  var lampLight = new THREE.PointLight(0x94a3b8, 0, 9); lampLight.position.set(7.6, 2.4, 0); scene.add(lampLight);

  /* bench */
  var bench = new THREE.Mesh(
    new THREE.BoxGeometry(15.5, 0.35, 4.6),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.85, metalness: 0.25 }));
  bench.position.y = -1.05; scene.add(bench);
  var benchTrim = new THREE.Mesh(
    new THREE.BoxGeometry(15.5, 0.07, 4.6),
    new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.4, metalness: 0.4, emissive: 0x1d4ed8, emissiveIntensity: 0.25 }));
  benchTrim.position.y = -0.85; scene.add(benchTrim);

  function labelSprite(text, color) {
    var c = document.createElement("canvas"); c.width = 320; c.height = 88;
    var g = c.getContext("2d");
    g.fillStyle = "rgba(2,6,23,0.82)";
    g.strokeStyle = color; g.lineWidth = 3;
    g.beginPath(); g.roundRect(6, 6, 308, 76, 18); g.fill(); g.stroke();
    g.fillStyle = "#e2e8f0"; g.font = "700 40px system-ui, sans-serif";
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(text, 160, 46);
    var tex = new THREE.CanvasTexture(c);
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    sp.scale.set(1.9, 0.52, 1);
    return sp;
  }

  function stdMat(color, extra) {
    return new THREE.MeshStandardMaterial(Object.assign(
      { color: color, roughness: 0.38, metalness: 0.35 }, extra || {}));
  }

  var parts = [];        // {group, home, dir, key, mats:[], muril?:{casing, plates}}
  var clickTargets = []; // meshes with userData.key

  PART_DEFS.forEach(function (def, i) {
    var group = new THREE.Group();
    var x = (i - 4) * 1.62;
    group.position.set(x, 0.15, 0);
    var mats = [];
    function add(mesh) { mesh.userData.key = def.key; group.add(mesh); clickTargets.push(mesh); return mesh; }

    if (def.key === "dataset") {
      for (var d = 0; d < 3; d++) {
        var disc = add(new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.16, 36), stdMat(def.color)));
        disc.position.y = -0.28 + d * 0.3; mats.push(disc.material);
      }
    } else if (def.key === "muril") {
      var casing = add(new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.3, 1.15),
        new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.85 })));
      mats.push(casing.material);
      var plates = [];
      for (var p = 0; p < 12; p++) {
        var plate = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.055, 0.92),
          new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0ea5e9, emissiveIntensity: 0.25, roughness: 0.3, metalness: 0.4 }));
        plate.position.y = -0.55 + p * 0.1; plate.userData.key = def.key;
        group.add(plate); plates.push(plate); clickTargets.push(plate);
      }
      group.userData.muril = { casing: casing, plates: plates };
    } else if (def.key === "feedback") {
      var torus = add(new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.15, 18, 40), stdMat(def.color)));
      torus.rotation.x = 0.4; mats.push(torus.material);
      var core = add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 16), stdMat(0xe2e8f0, { emissive: def.color, emissiveIntensity: 0.5 })));
      mats.push(core.material);
    } else if (def.key === "threshold") {
      var post = add(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.7, 20), stdMat(0x64748b)));
      post.position.y = -0.25; mats.push(post.material);
      var dial = add(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.16, 36), stdMat(def.color)));
      dial.rotation.x = Math.PI / 2.6; dial.position.y = 0.28; mats.push(dial.material);
      var needle = add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.34, 0.05), stdMat(0xef4444, { emissive: 0xef4444, emissiveIntensity: 0.6 })));
      needle.position.set(0.1, 0.42, 0.16); needle.rotation.z = -0.5; mats.push(needle.material);
    } else if (def.key === "runtime") {
      var win = add(new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.95, 0.14), stdMat(def.color)));
      mats.push(win.material);
      var bar = add(new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.18, 0.15), stdMat(0x0f172a)));
      bar.position.y = 0.4; mats.push(bar.material);
      var shield = add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 14), stdMat(0xe2e8f0, { emissive: def.color, emissiveIntensity: 0.55 })));
      shield.position.set(0, -0.08, 0.12); mats.push(shield.material);
    } else {
      var box = add(new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.95, 1.05), stdMat(def.color)));
      mats.push(box.material);
      var cap = add(new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.14, 1.1), stdMat(0xe2e8f0, { roughness: 0.5 })));
      cap.position.y = 0.54; mats.push(cap.material);
    }

    var label = labelSprite(def.label, "#" + def.color.toString(16).padStart(6, "0"));
    label.position.y = 1.25; group.add(label);

    scene.add(group);
    parts.push({
      key: def.key, group: group, mats: mats,
      home: new THREE.Vector3(x, 0.15, 0),
      dir: new THREE.Vector3((i - 4) * 0.5, (i % 2 === 0 ? 1.05 : -0.45), ((i * 7) % 3 - 1) * 1.15)
    });
  });

  /* verdict lamp at the output end */
  var lamp = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 18),
    new THREE.MeshStandardMaterial({ color: 0x94a3b8, emissive: 0x94a3b8, emissiveIntensity: 0.35, roughness: 0.3 }));
  lamp.position.set(7.6, 1.1, 0); scene.add(lamp);
  var lampPost = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 1.9, 12), stdMat(0x475569));
  lampPost.position.set(7.6, 0.05, 0); scene.add(lampPost);

  /* flow line + pulses along the (moving) parts */
  var flowMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.35 });
  var flowGeo = new THREE.BufferGeometry();
  var flowPos = new Float32Array(parts.length * 3);
  flowGeo.setAttribute("position", new THREE.BufferAttribute(flowPos, 3));
  scene.add(new THREE.Line(flowGeo, flowMat));

  var pulses = [];
  var pulseGeo = new THREE.SphereGeometry(0.075, 12, 10);
  for (var pi = 0; pi < 16; pi++) {
    var pm = new THREE.Mesh(pulseGeo, new THREE.MeshBasicMaterial({ color: 0x7dd3fc }));
    scene.add(pm);
    pulses.push({ mesh: pm, t: pi / 16 });
  }
  var pulseSpeed = 0.055, speedBoost = 0;

  function pulsePoint(t, out) {
    var seg = Math.min(parts.length - 2, Math.floor(t * (parts.length - 1)));
    var lt = t * (parts.length - 1) - seg;
    out.lerpVectors(parts[seg].group.position, parts[seg + 1].group.position, lt);
    out.y += Math.sin(lt * Math.PI) * 0.35 + 0.1;
    return out;
  }

  /* state */
  var explodeTarget = 0.65, explodeCur = 0.65, xray = false, selected = "muril";
  var tmpV = new THREE.Vector3();

  function applySelection() {
    parts.forEach(function (p) {
      var on = p.key === selected;
      p.mats.forEach(function (m) {
        if ("emissive" in m) { m.emissive = new THREE.Color(on ? 0x0ea5e9 : 0x000000); m.emissiveIntensity = on ? 0.45 : 0; }
      });
      p.group.scale.setScalar(on ? 1.13 : 1);
    });
  }
  applySelection();

  /* raycast click (not drag) */
  var ray = new THREE.Raycaster(), ptr = new THREE.Vector2(), downPos = null;
  canvas.addEventListener("pointerdown", function (e) { downPos = [e.clientX, e.clientY]; });
  canvas.addEventListener("pointerup", function (e) {
    if (!downPos) return;
    var moved = Math.hypot(e.clientX - downPos[0], e.clientY - downPos[1]); downPos = null;
    if (moved > 6) return;
    var r = canvas.getBoundingClientRect();
    ptr.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    ptr.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    ray.setFromCamera(ptr, camera);
    var hits = ray.intersectObjects(clickTargets, false);
    if (hits.length && hits[0].object.userData.key && window.FD_selectPart) {
      window.FD_selectPart(hits[0].object.userData.key);
    }
  });

  function resize() {
    var w = wrap.clientWidth, h = wrap.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(wrap);
  resize();

  var clock = new THREE.Clock();
  function tick() {
    requestAnimationFrame(tick);
    var dt = Math.min(clock.getDelta(), 0.05);
    var t = clock.elapsedTime;

    explodeCur += (explodeTarget - explodeCur) * Math.min(1, dt * 5);
    parts.forEach(function (p, i) {
      tmpV.copy(p.dir).multiplyScalar(explodeCur * 1.5);
      p.group.position.copy(p.home).add(tmpV);
      p.group.position.y += Math.sin(t * 1.2 + i * 1.1) * 0.045;
      p.group.rotation.y = Math.sin(t * 0.4 + i) * 0.06;
      var mu = p.group.userData.muril;
      if (mu) mu.plates.forEach(function (pl, j) { pl.rotation.y = t * 0.25 + j * 0.12; });
    });

    for (var i = 0; i < parts.length; i++) {
      flowPos[i * 3] = parts[i].group.position.x;
      flowPos[i * 3 + 1] = parts[i].group.position.y + 0.1;
      flowPos[i * 3 + 2] = parts[i].group.position.z;
    }
    flowGeo.attributes.position.needsUpdate = true;

    var sp = pulseSpeed + speedBoost;
    speedBoost = Math.max(0, speedBoost - dt * 0.25);
    pulses.forEach(function (pu) {
      pu.t = (pu.t + sp * dt) % 1;
      pulsePoint(pu.t, pu.mesh.position);
      var s = 0.8 + Math.sin(t * 6 + pu.t * 20) * 0.25;
      pu.mesh.scale.setScalar(s);
    });

    lamp.material.emissiveIntensity = 0.3 + Math.sin(t * 2.2) * 0.12;
    controls.update();
    renderer.render(scene, camera);
  }
  tick();

  /* public API used by app.js */
  window.FD3D = {
    setExplode: function (v) { explodeTarget = v; },
    setXray: function (on) {
      xray = on;
      parts.forEach(function (p) {
        var mu = p.group.userData.muril; if (!mu) return;
        mu.casing.material.opacity = on ? 0.07 : 0.85;
        mu.plates.forEach(function (pl) { pl.material.emissiveIntensity = on ? 0.95 : 0.25; });
      });
    },
    select: function (keyName) { selected = keyName; applySelection(); },
    burst: function () { speedBoost = 0.55; },
    setVerdict: function (zone) {
      var col = zone === "fraud" ? 0xef4444 : zone === "safe" ? 0x22c55e : 0xf59e0b;
      lamp.material.color.setHex(col); lamp.material.emissive.setHex(col);
      lampLight.color.setHex(col); lampLight.intensity = 14;
      setTimeout(function () { lampLight.intensity = 4; }, 1600);
    }
  };
})();
