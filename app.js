/* app.js — Fraud Detector explainer site.
 * The live score everywhere on this page comes from the REAL trained lexical
 * model (pwa_model.json + lexical.js), computed in the browser on the
 * anonymized text — the same inputs the extension's stack consumes. */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var MODEL = null, MARGIN = 0.08;

  /* ---------------- samples (verified against the real model) ---------------- */
  var SAMPLES = {
    en_fraud: "Congratulations! You have won a cash prize of Rs 50,000 in the lucky draw. Click http://claim-prize-now.xyz and share the OTP sent to your mobile to receive the amount today itself.",
    en_safe: "HDFC Bank: Rs. 2,500.00 debited from your A/c ending 4821 on 12-Nov-2026. Avl Bal: Rs. 18,240.55. If not you, call 1800-266-4332. Never share your OTP with anyone.",
    hi_fraud: "बधाई हो! आपने 25,000 रुपये का इनाम जीता है। अपना KYC तुरंत पूरा करें, वरना आपका खाता बंद हो जाएगा। लिंक पर क्लिक करें और OTP बताएं।",
    hi_safe: "आपका बिजली बिल 843 रुपये जमा हो गया है। धन्यवाद। अगला बिल अगले महीने आएगा।",
    te_fraud: "అభినందనలు! మీరు లాటరీలో ₹50,000 గెలిచారు. మీ ఖాతా బ్లాక్ కాకుండా ఉండాలంటే వెంటనే KYC పూర్తి చేసి OTP చెప్పండి.",
    te_safe: "మీ జియో నంబర్ రీఛార్జ్ విజయవంతంగా పూర్తయింది. ప్లాన్ చెల్లుబాటు 28 రోజులు. ధన్యవాదాలు.",
    te_hard: "SBI: మీ ఖాతా నంబర్ XX4521 నుండి Rs.1,200 డెబిట్ అయింది. బ్యాలెన్స్ Rs.9,540. మీరు చేయకపోతే 1800-1234 కి కాల్ చేయండి. OTP ని ఎవరితోనూ పంచుకోవద్దు."
  };

  /* ---------------- model ---------------- */
  fetch("pwa_model.json").then(function (r) { return r.json(); })
    .then(function (m) { MODEL = m; if (m.uncertainty_margin) MARGIN = m.uncertainty_margin; })
    .catch(function () { MODEL = null; });

  function runModel(raw) {
    var anon = window.FraudAnonymize ? window.FraudAnonymize(raw) : raw;
    var det = window.FraudDetectLanguage(raw);
    var cfg = MODEL.languages[det.head];
    var p = window.FraudLexical.probability(anon, cfg.hash);
    var thr = cfg.threshold;
    var zone = Math.abs(p - thr) <= MARGIN ? "uncertain" : (p > thr ? "fraud" : "safe");
    var feats = null;
    if (window.FraudFeatures && window.FraudPreprocess) {
      feats = window.FraudFeatures.extractStructFeatures(raw, window.FraudPreprocess.translateNativeDigits);
    }
    return { raw: raw, anon: anon, det: det, p: p, thr: thr, zone: zone, feats: feats };
  }

  function scriptMix(text) {
    var te = 0, hi = 0, lat = 0;
    for (var i = 0; i < text.length; i++) {
      var c = text.charCodeAt(i);
      if (c >= 0x0C00 && c <= 0x0C7F) te++;
      else if (c >= 0x0900 && c <= 0x097F) hi++;
      else if ((c >= 65 && c <= 90) || (c >= 97 && c <= 122)) lat++;
    }
    var tot = Math.max(1, te + hi + lat);
    return { Telugu: te / tot, Hindi: hi / tot, English: lat / tot };
  }

  /* ---------------- hero + journey neural nets ---------------- */
  var heroNN = null, journeyNN = null;
  if (window.FraudNN) {
    heroNN = window.FraudNN.attach($("nn-hero"), {});
    journeyNN = window.FraudNN.attach($("nn-journey"), {});
  }

  /* ---------------- reveal + counters ---------------- */
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
  }, { threshold: 0.12 });
  document.querySelectorAll(".reveal").forEach(function (el) { io.observe(el); });

  var counted = false;
  var cio = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting || counted) return; counted = true;
      document.querySelectorAll("[data-count]").forEach(function (el) {
        var target = parseInt(el.getAttribute("data-count"), 10), t0 = performance.now();
        (function step(t) {
          var k = Math.min(1, (t - t0) / 1300);
          el.textContent = Math.round(target * (1 - Math.pow(1 - k, 3))).toLocaleString("en-IN");
          if (k < 1) requestAnimationFrame(step);
        })(t0);
      });
    });
  }, { threshold: 0.4 });
  var heroEl = document.querySelector(".hero"); if (heroEl) cio.observe(heroEl);

  /* ---------------- dataset bars ---------------- */
  var DS = [
    { name: "English — 5,570", fraud: 2785, ham: 2785 },
    { name: "Hindi — 1,132", fraud: 566, ham: 566 },
    { name: "Telugu — 922", fraud: 461, ham: 461 }
  ];
  var dsHtml = "";
  DS.forEach(function (d) {
    var tot = d.fraud + d.ham;
    dsHtml += '<div class="lbar"><span>' + d.name + '</span><div class="track">' +
      '<div class="seg-f" data-w="' + (100 * d.fraud / tot) + '"></div>' +
      '<div class="seg-h" data-w="' + (100 * d.ham / tot) + '"></div></div>' +
      '<span style="color:#94a3b8">🔴 fraud · 🟢 genuine</span></div>';
  });
  $("dsBars").innerHTML = dsHtml;
  var dio = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.querySelectorAll("[data-w]").forEach(function (s) { s.style.width = s.getAttribute("data-w") + "%"; });
      dio.unobserve(e.target);
    });
  }, { threshold: 0.3 });
  dio.observe($("dsBars"));

  /* ---------------- samples wiring ---------------- */
  document.querySelectorAll("[data-sample]").forEach(function (b) {
    b.addEventListener("click", function () {
      var key = b.getAttribute("data-sample");
      $("j-text").value = SAMPLES[key];
      document.querySelectorAll("[data-sample]").forEach(function (x) { x.classList.toggle("active", x === b); });
      document.getElementById("journey").scrollIntoView({ behavior: "smooth" });
      if (key === "te_hard") setTimeout(function () { startJourney(); }, 500);
    });
  });

  /* ---------------- the journey ---------------- */
  var running = false;
  function wait(ms) { return new Promise(function (res) { setTimeout(res, ms); }); }
  function speed() { return parseFloat($("j-speed").value || "1"); }
  async function stageDelay(ms) { await wait(ms / speed()); }

  function setStage(i) {
    document.querySelectorAll(".pdot").forEach(function (d) {
      var s = parseInt(d.getAttribute("data-stage"), 10);
      d.classList.toggle("active", s === i);
      d.classList.toggle("done", s < i);
    });
    var stageNames = ["Message", "Preprocess", "Tokenize", "Language", "MuRIL embed", "Features", "Classify", "Verdict"];
    var lbl = $("j-step-label");
    if (lbl) lbl.textContent = "Stage " + (i + 1) + " of 8 — " + stageNames[i];
    for (var k = 0; k <= 7; k++) {
      var el = $("stage-" + k);
      el.classList.toggle("active", k === i);
      el.classList.toggle("done", k < i);
      if (k === i) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function renderAnon(anon) {
    var esc = anon.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    esc = esc.replace(/\[(PHONE|OTP|URL|ACCOUNT|UPI|EMAIL)\]/g, function (m, kind) {
      return '<span class="ph ' + kind + '">' + m + "</span>";
    });
    $("j-anon").innerHTML = esc;
  }

  function renderTokens(anon) {
    var words = anon.split(/\s+/).filter(Boolean).slice(0, 60);
    var html = '<span class="tok special">[CLS]</span>';
    words.forEach(function (w, wi) {
      var clean = w.replace(/[^\p{L}\p{N}\[\]]/gu, "");
      if (!clean) return;
      if (clean.length <= 5) { html += '<span class="tok" style="animation-delay:' + (wi * 45) + 'ms">' + clean + "</span>"; return; }
      var chunks = [];
      for (var i = 0; i < clean.length; i += 4) chunks.push(clean.slice(i, i + 4));
      chunks.forEach(function (c, ci) {
        html += '<span class="tok" style="animation-delay:' + (wi * 45 + ci * 30) + 'ms">' + (ci ? "##" : "") + c + "</span>";
      });
    });
    html += '<span class="tok special">[SEP]</span>';
    $("j-tokens").innerHTML = html;
  }

  function renderLang(raw, det) {
    var mix = scriptMix(raw);
    var rows = [["Telugu script", mix.Telugu], ["Devanagari (Hindi)", mix.Hindi], ["Latin (English)", mix.English]];
    $("j-lang").innerHTML = rows.map(function (r) {
      var win = (det.head === "Telugu" && r[0].indexOf("Telugu") === 0) ||
                (det.head === "Hindi" && r[0].indexOf("Devanagari") === 0) ||
                (det.head === "English" && r[0].indexOf("Latin") === 0);
      return '<div class="lbar lrow' + (win ? " win" : "") + '"><span class="lname">' + r[0] + '</span>' +
        '<div class="track"><div class="fill" data-w="' + Math.round(r[1] * 100) + '"></div></div>' +
        '<span>' + Math.round(r[1] * 100) + "%</span></div>";
    }).join("") + '<p class="stage-note" style="margin-top:6px">Detected: <b style="color:#4ade80">' +
      det.label + '</b> → the <b>' + det.head + '</b> classifier head will score this message.</p>';
    setTimeout(function () {
      $("j-lang").querySelectorAll(".fill").forEach(function (f) { f.style.width = f.getAttribute("data-w") + "%"; });
    }, 60);
  }

  function renderVec(raw) {
    var seed = 0; for (var i = 0; i < raw.length; i++) seed = (seed * 31 + raw.charCodeAt(i)) >>> 0;
    var rnd = function () { seed = (seed * 1103515245 + 12345) >>> 0; return (seed >>> 8) / 16777216; };
    var html = "";
    for (var j = 0; j < 96; j++) html += '<i style="height:' + (8 + Math.round(rnd() * 92)) + '%"></i>';
    $("j-vec").innerHTML = html;
  }

  var FEAT_LABELS = {
    has_url: "🔗 link present", n_urls: "🔗 link count", url_is_shortener: "🔗 shortener link",
    otp_is_requested: "🔢 OTP requested", mentions_otp: "🔢 OTP mentioned",
    mentions_prize: "🎁 prize lure", mentions_kyc: "🪪 KYC pressure",
    mentions_blocked: "⛔ block threat", mentions_click: "👆 “click” bait",
    has_phone: "📱 phone number", has_upi: "💸 UPI id", has_currency: "💰 money amount",
    has_amount: "💰 amount present", mentions_debit: "🏦 debit wording",
    mentions_do_not_share: "🛡️ “do not share” (genuine cue)", mentions_never_ask: "🛡️ “we never ask” (genuine cue)",
    has_long_digit_run: "🔢 long digit run", caps_ratio: "🔠 shouting caps", exclaim_count: "❗ exclamations"
  };
  function renderFeats(res) {
    var names = window.FraudFeatures.FEATURE_NAMES;
    var order = ["has_url", "url_is_shortener", "otp_is_requested", "mentions_otp", "mentions_prize",
      "mentions_kyc", "mentions_blocked", "mentions_click", "has_upi", "has_currency", "mentions_debit",
      "mentions_do_not_share", "mentions_never_ask", "has_long_digit_run", "exclaim_count"];
    var html = "";
    order.forEach(function (n, i) {
      var idx = names.indexOf(n), on = idx >= 0 && res.feats && res.feats[idx] > 0;
      html += '<span class="feat' + (on ? " on" : "") + '" style="transition-delay:' + (i * 60) + 'ms">' +
        (FEAT_LABELS[n] || n) + "</span>";
    });
    html += '<span class="feat">… + hashed word &amp; character n-grams (49,152 buckets)</span>';
    $("j-feats").innerHTML = html;
  }

  /* Step-by-step journey controller: Auto-play, or press Next stage by stage. */
  var J = { res: null, stage: -1 };
  function prepareJourney() {
    var raw = $("j-text").value.trim();
    if (!raw) return null;
    if (!MODEL) { alert("The model file is still loading — give it a second and try again."); return null; }
    J.res = runModel(raw);
    J.stage = -1;
    var v = $("j-verdict"); v.className = "verdict-card"; v.innerHTML = "";
    $("j-verdict-note").textContent = "";
    $("j-fill").style.width = "0%"; $("j-p").textContent = "—";
    document.querySelectorAll(".cloud-comment").forEach(function (c) { c.classList.remove("show"); });
    var lbl2 = $("j-step-label");
    if (lbl2) lbl2.textContent = "Press Next to begin the journey →";
    var nb = $("j-next"); if (nb) nb.textContent = "Next →";
    if (window.FD3D) window.FD3D.burst();
    return J.res;
  }

  function animateMeter(res) {
    var fill = $("j-fill"), pEl = $("j-p");
    $("j-band").style.left = Math.max(0, (res.thr - MARGIN) * 100) + "%";
    $("j-band").style.width = (MARGIN * 2 * 100) + "%";
    $("j-tick").style.left = "calc(" + (res.thr * 100) + "% - 1px)";
    $("j-thr-label").textContent = "threshold " + Math.round(res.thr * 100) + "% · band = uncertain";
    fill.style.width = "0%"; pEl.textContent = "0%";
    setTimeout(function () {
      fill.style.width = (res.p * 100) + "%";
      var t0 = performance.now(), dur = 1300;
      (function count(t) {
        var k = Math.min(1, (t - t0) / dur);
        pEl.textContent = Math.round(res.p * 100 * (1 - Math.pow(1 - k, 3))) + "% fraud probability";
        if (k < 1) requestAnimationFrame(count);
      })(t0);
    }, 120);
  }

  function showVerdict(res) {
    var v = $("j-verdict");
    var stamp = res.zone === "fraud" ? "⚠️ FRAUD" : res.zone === "safe" ? "✅ LIKELY SAFE" : "❓ UNCERTAIN";
    var expl = res.zone === "fraud"
      ? "The score cleared the " + res.det.label + " threshold (" + Math.round(res.thr * 100) + "%) with room to spare. In the extension, the panel warns the user and offers the official reporting routes."
      : res.zone === "safe"
      ? "The score stayed well below the " + res.det.label + " threshold (" + Math.round(res.thr * 100) + "%). Genuine-service cues (like “never share your OTP”) pull the score down — they are features, learned from real bank alerts."
      : "The score landed inside the ±" + Math.round(MARGIN * 100) + "-point uncertainty band around the threshold — the system refuses to guess and asks for a human look. Honest over confident.";
    v.className = "verdict-card show " + res.zone;
    v.innerHTML = '<span class="stamp">' + stamp + '</span><span class="vmeta">' +
      Math.round(res.p * 100) + "% fraud probability · " + res.det.label +
      " · lexical arm live on this page (the extension stacks MuRIL embeddings on top, so its exact score can differ slightly)</span>";
    $("j-verdict-note").textContent = expl;
    if (journeyNN) journeyNN.setVerdict(res.zone === "fraud" ? "FRAUD" : "SAFE", res.p);
    if (window.FD3D) window.FD3D.setVerdict(res.zone);
  }

  function renderStage(i) {
    var res = J.res; if (!res) return;
    J.stage = i; setStage(i); setCloud(i, res);
    var nb = $("j-next"); if (nb) nb.textContent = i >= 7 ? "↻ Start over" : "Next →";
    if (i === 0) { $("j-raw").textContent = res.raw; }
    else if (i === 1) renderAnon(res.anon);
    else if (i === 2) renderTokens(res.anon);
    else if (i === 3) renderLang(res.raw, res.det);
    else if (i === 4) { renderVec(res.raw); if (journeyNN) journeyNN.scan(function () {}); if (window.FD3D) window.FD3D.burst(); }
    else if (i === 5) renderFeats(res);
    else if (i === 6) animateMeter(res);
    else if (i === 7) showVerdict(res);
  }

  async function startJourney() {
    if (running) return;
    if (!prepareJourney()) return;
    running = true;
    var btn = $("j-run"); btn.disabled = true; btn.textContent = "⏳ Running…";
    var delays = [1100, 1700, 1900, 1600, 2300, 1800, 1900, 600];
    for (var i = 0; i <= 7; i++) { renderStage(i); await stageDelay(delays[i]); }
    btn.disabled = false; btn.textContent = "▶ Auto-play";
    running = false;
  }
  $("j-run").addEventListener("click", startJourney);
  $("j-next").addEventListener("click", function () {
    if (running) return;
    if (!J.res || J.stage >= 7) { if (!prepareJourney()) return; renderStage(0); return; }
    renderStage(J.stage + 1);
  });
  $("j-prev").addEventListener("click", function () {
    if (running || !J.res || J.stage <= 0) return;
    renderStage(J.stage - 1);
  });

  /* Cloud comments: a presenter-style bubble pops in on each stage. */
  document.querySelectorAll(".stage").forEach(function (st) {
    var d = document.createElement("div");
    d.className = "cloud-comment";
    st.insertBefore(d, st.children[1]);
  });
  function cloudText(i, res) {
    switch (i) {
      case 0: return "📩 Meet the suspect. Read it like a scammer wrote it — a prize, urgency, a link, and an OTP request.";
      case 1: {
        var n = (res.anon.match(/\[(PHONE|OTP|URL|ACCOUNT|UPI|EMAIL)\]/g) || []).length;
        return "🧹 Cleaned! " + n + " private detail" + (n === 1 ? "" : "s") + " hidden behind placeholders — the real numbers never reach the model.";
      }
      case 2: return "🔤 Words break into sub-words — that's how the model reads Telugu and Hindi words it has never seen whole.";
      case 3: return "🌐 The script gives it away: this one is " + res.det.label + ". Each language gets its own scoring head.";
      case 4: return "🧠 MuRIL just turned meaning into 768 numbers. The same meaning in any of our 3 languages lands at nearby numbers.";
      case 5: {
        var names = window.FraudFeatures.FEATURE_NAMES, on = 0;
        ["has_url", "otp_is_requested", "mentions_prize", "mentions_kyc", "mentions_blocked", "mentions_click", "has_upi", "mentions_do_not_share"].forEach(function (nm) {
          var ix = names.indexOf(nm); if (ix >= 0 && res.feats && res.feats[ix] > 0) on++;
        });
        return "🚩 " + on + " of the headline signals fired on this message — every lit chip is really in the text, not decoration.";
      }
      case 6: return "🎯 Everything is weighed together — watch where the score lands against the " + res.det.label + " threshold (" + Math.round(res.thr * 100) + "%).";
      case 7: return res.zone === "fraud" ? "🚨 FRAUD. In the real product, this warning appears before the user can click anything."
        : res.zone === "safe" ? "✅ LIKELY SAFE — and notice how the genuine-service cues helped pull the score down."
        : "🤔 Too close to call. The system asks a human instead of guessing — by design.";
    }
    return "";
  }
  function setCloud(i, res) {
    document.querySelectorAll(".stage").forEach(function (st, k) {
      var c = st.querySelector(".cloud-comment");
      if (c && k === i) { c.textContent = cloudText(i, res); c.classList.add("show"); }
    });
  }

  /* ---------------- exploded view: component details ---------------- */
  var PARTS = {
    dataset: { t: "🗄️ Dataset — the fuel", s: ["7,624 messages", "EN 5,570 · HI 1,132 · TE 922", "1:1 fraud : genuine"],
      b: "Real Indian messages collected from government/TRAI advisories, Truecaller reports, consumer complaints and news quotes. Fraud requires a real scam cue; awareness posts are genuine class. 5,555 rows are real; 2,069 are flagged paraphrases of real seeds. Near-duplicate <b>skeletons</b> are grouped so copies can’t straddle train and test." },
    preprocess: { t: "🧹 Preprocessing — clean & anonymize", s: ["NFC normalize", "native digits → ASCII", "[PHONE] [OTP] [URL] [ACCOUNT] [UPI] [EMAIL]"],
      b: "One function, used identically in training and prediction: normalize Unicode, convert Telugu/Devanagari digits, replace every private identifier with a placeholder. The model learns the <i>shape</i> of scams and never sees a real OTP or phone number — privacy by construction, and no train/serve skew." },
    tokenizer: { t: "🔤 Tokenizer — WordPiece", s: ["197,285-token vocabulary", "max length 128", "[CLS] / [SEP]"],
      b: "MuRIL’s WordPiece tokenizer splits text into sub-word pieces — vital for Indian languages, where one word carries many suffixes. Frequent words stay whole; rare words break into pieces the model still understands." },
    muril: { t: "🧠 MuRIL — the neural network", s: ["12 transformer layers", "768 hidden size", "12 attention heads", "~237M parameters", "17 Indian languages + English"],
      b: "Google’s MuRIL (Multilingual Representations for Indian Languages), pre-trained on Wikipedia, Common Crawl, the PMINDIA corpus and Dakshina — including transliterated text. We keep it <b>frozen</b> and mean-pool its token vectors into a 768-number embedding: all of its language knowledge, none of the overfitting risk of fine-tuning on 7,624 rows. Flip the <b>X-ray</b> switch to see the layers. For the browser, it is int8-quantized to 239 MB and runs in ONNX Runtime Web." },
    features: { t: "🧮 Features — lexical + structured", s: ["word n-grams 2¹⁴", "char n-grams 2¹⁵", "30 structured signals"],
      b: "Two cheaper views of the same message: hashed word/character n-grams catch scam phrasing and spelling tricks in any script; 30 hand-built signals measure links, OTP pressure, prize lures, block threats, digit runs and genuine-service cues like “do not share”. On this website, the lexical arm alone computes the live score." },
    classifier: { t: "⚖️ Classifier — stacked logistic regression", s: ["one head per language", "synthetic weight 0.5", "class weights, no SMOTE"],
      b: "A logistic regression per language stacks the three views — MuRIL embedding + lexical hashes + structured signals — into one probability. Seven classifier families raced for this job; logistic regression won on precision and honesty. Training uses 5-fold stratified group cross-validation, augmentation after the split, and real-only evaluation." },
    threshold: { t: "🎚️ Thresholds — per-language, with an uncertainty band", s: ["EN 0.40 · HI 0.51 · TE 0.36 (full stack)", "±0.08 band → UNCERTAIN"],
      b: "Each language head carries its own decision threshold, tuned on out-of-fold scores. Within ±8 points of it, the product says <b>UNCERTAIN — needs review</b> instead of forcing a verdict. Calibrated humility beats confident errors, especially for Telugu and Hindi where real data is thinner." },
    runtime: { t: "🧩 Extension runtime — on-device", s: ["Manifest V3", "ONNX Runtime Web (offscreen)", "239 MB int8 model", "zero uploads by default"],
      b: "The shipped product is a Chrome/Edge extension: select text, right-click, drag-and-drop, or the popup — the panel on this very page is its web edition. Inference runs in a hidden offscreen document on the user’s machine. Updates to the trained heads arrive as a small config file; the big encoder is never re-downloaded." },
    feedback: { t: "🔁 Feedback loop — corrections → retraining", s: ["local adapter: instant", "sharing: opt-in, default OFF", "promotion: gated, never automatic"],
      b: "“It’s fraud / It’s safe” instantly adjusts a small personal adapter. Users who opt in send the <i>anonymized</i> correction to a private inbox; scheduled retraining builds a challenger model that ships only if it beats the champion on fixed gates (per-language F1, precision floors, challenge-set accuracy). The model improves from real corrections — under supervision, not blindly." }
  };
  var detail = $("partDetail");
  function selectPart(key) {
    var p = PARTS[key]; if (!p) return;
    document.querySelectorAll(".part").forEach(function (el) { el.classList.toggle("sel", el.getAttribute("data-part") === key); });
    detail.innerHTML = "<h3>" + p.t + "</h3><div>" + p.s.map(function (x) { return '<span class="spec">' + x + "</span>"; }).join("") + "</div><p>" + p.b + "</p>";
    if (window.FD3D) window.FD3D.select(key);
  }
  document.querySelectorAll(".part").forEach(function (el) {
    el.addEventListener("click", function () { selectPart(el.getAttribute("data-part")); });
  });
  selectPart("muril");

  var range = $("explodeRange"), stageEl = $("explodeStage");
  function applySpread() {
    var v = parseInt(range.value, 10) / 100;
    stageEl.style.setProperty("--spread", v);
    if (window.FD3D) window.FD3D.setExplode(v);
  }
  range.addEventListener("input", applySpread); applySpread();

  /* X-ray: build the 12 layer strips */
  var xl = $("xrayLayers"), xh = "";
  for (var li = 0; li < 12; li++) xh += '<i style="animation-delay:' + (li * 90) + 'ms"></i>';
  xl.innerHTML = xh;
  $("xrayToggle").addEventListener("change", function (e) {
    document.querySelector('.part[data-part="muril"]').classList.toggle("xray", e.target.checked);
    if (window.FD3D) window.FD3D.setXray(e.target.checked);
  });
  window.FD_selectPart = selectPart;

  /* ---------------- extension popup: web edition ---------------- */
  var btn2 = $("fd-float-btn"), panel = $("fd-panel"), overlay = $("fd-drop-overlay");
  var popupOn = true;
  try { popupOn = localStorage.getItem("fdPopup") !== "off"; } catch (e) {}
  $("popupToggle").checked = popupOn;
  function applyPopup() {
    btn2.classList.toggle("hidden", !popupOn);
    if (!popupOn) panel.classList.remove("open");
  }
  applyPopup();
  $("popupToggle").addEventListener("change", function (e) {
    popupOn = e.target.checked;
    try { localStorage.setItem("fdPopup", popupOn ? "on" : "off"); } catch (err) {}
    applyPopup();
    if (popupOn) panel.classList.add("open");
  });

  /* drag the floating button (same behaviour as the extension) */
  var dragMoved = false;
  (function () {
    var sx = 0, sy = 0, ox = 0, oy = 0, dragging = false;
    function down(e) {
      var p = e.touches ? e.touches[0] : e;
      sx = p.clientX; sy = p.clientY;
      var r = btn2.getBoundingClientRect(); ox = r.left; oy = r.top;
      dragging = true; dragMoved = false;
    }
    function move(e) {
      if (!dragging) return;
      var p = e.touches ? e.touches[0] : e;
      var dx = p.clientX - sx, dy = p.clientY - sy;
      if (Math.abs(dx) + Math.abs(dy) > 6) { dragMoved = true; btn2.classList.add("fd-dragging"); }
      if (!dragMoved) return;
      btn2.style.left = Math.min(innerWidth - 60, Math.max(4, ox + dx)) + "px";
      btn2.style.top = Math.min(innerHeight - 60, Math.max(4, oy + dy)) + "px";
      btn2.style.right = "auto"; btn2.style.bottom = "auto";
      panel.style.right = "20px"; panel.style.bottom = "88px";
      if (e.cancelable) e.preventDefault();
    }
    function up() { dragging = false; btn2.classList.remove("fd-dragging"); }
    btn2.addEventListener("mousedown", down); btn2.addEventListener("touchstart", down, { passive: true });
    document.addEventListener("mousemove", move); document.addEventListener("touchmove", move, { passive: false });
    document.addEventListener("mouseup", up); document.addEventListener("touchend", up);
  })();
  btn2.addEventListener("click", function () {
    if (dragMoved) { dragMoved = false; return; }
    panel.classList.toggle("open");
  });
  $("fd-close").addEventListener("click", function () { panel.classList.remove("open"); });

  var cloudTimer = null;
  function showFdCloud(res) {
    var c = $("fd-cloud"); if (!c) return;
    c.className = "fd-cloud show " + res.zone;
    c.textContent = res.zone === "fraud" ? "⚠️ " + Math.round(res.p * 100) + "% fraud chance — don't click anything, don't share any OTP!"
      : res.zone === "safe" ? "✅ Looks safe — " + Math.round(res.p * 100) + "% fraud chance. Still, never share an OTP with anyone."
      : "❓ Uncertain (" + Math.round(res.p * 100) + "%) — verify this one independently before acting.";
    if (cloudTimer) clearTimeout(cloudTimer);
    cloudTimer = setTimeout(function () { c.classList.remove("show"); }, 5000);
  }

  function popupCheck(text) {
    var box = $("fd-result");
    if (!text) {
      box.className = "fd-result show unavailable";
      box.innerHTML = '<div class="fd-verdict">Paste a message first</div><div class="fd-meta">Copy any SMS, WhatsApp or email text into the box, then tap Check.</div>';
      return;
    }
    if (!MODEL) {
      box.className = "fd-result show unavailable";
      box.innerHTML = '<div class="fd-verdict">⛔ MODEL UNAVAILABLE</div><div class="fd-meta">The model file is still loading in this page. Wait a second and try again — no verdict is shown rather than a guess.</div>';
      return;
    }
    var res = runModel(text);
    var conf = Math.round(res.p * 100);
    var title = res.zone === "fraud" ? "⚠️ Likely FRAUD" : res.zone === "safe" ? "✅ Likely SAFE" : "❓ UNCERTAIN — NEEDS REVIEW";
    var advice = res.zone === "fraud"
      ? "Do not click links, share OTPs or pay anything. Verify via the official app/number. Report: call 1930 or use cybercrime.gov.in."
      : res.zone === "safe"
      ? "No strong scam signals found. Stay alert anyway — never share an OTP with anyone who asks."
      : "Signals are mixed. Treat links and payment requests with suspicion and verify independently.";
    box.className = "fd-result show " + res.zone;
    box.innerHTML = '<div class="fd-verdict">' + title + '</div>' +
      '<div class="fd-bar"><div style="width:' + conf + '%"></div></div>' +
      '<div class="fd-meta">Fraud chance: <b>' + conf + '%</b> · Language: ' + res.det.label +
      ' · Threshold: ' + Math.round(res.thr * 100) + '%<br>' + advice + '</div>' +
      '<div class="fd-feedback"><span>Model got it wrong?</span>' +
      '<button class="fd-fb-btn" data-fix="fraud">It’s fraud</button>' +
      '<button class="fd-fb-btn" data-fix="ham">It’s safe</button></div>' +
      '<div class="fd-learn-note" id="fd-learn-note"></div>';
    showFdCloud(res);
    box.querySelectorAll("[data-fix]").forEach(function (b) {
      b.addEventListener("click", function () {
        $("fd-learn-note").textContent = "✓ Noted on this page — in the extension, this correction also teaches your personal model instantly.";
      });
    });
  }
  $("fd-check").addEventListener("click", function () { popupCheck($("fd-text").value.trim()); });

  /* drag & drop into the panel + page-wide drop (same as the extension) */
  var dropBox = $("fd-drop");
  function wireDrop(el, onText) {
    ["dragenter", "dragover"].forEach(function (ev) { el.addEventListener(ev, function (e) { e.preventDefault(); el.classList.add("fd-over"); }); });
    ["dragleave", "drop"].forEach(function (ev) { el.addEventListener(ev, function (e) { e.preventDefault(); el.classList.remove("fd-over"); }); });
    el.addEventListener("drop", function (e) {
      var t = e.dataTransfer && e.dataTransfer.getData("text/plain");
      if (t) onText(t.trim());
    });
  }
  wireDrop(dropBox, function (t) { $("fd-text").value = t; popupCheck(t); });
  var dragDepth = 0;
  document.addEventListener("dragenter", function (e) {
    if (!popupOn || !e.dataTransfer || Array.prototype.indexOf.call(e.dataTransfer.types || [], "text/plain") < 0) return;
    dragDepth++; overlay.classList.add("show"); btn2.classList.add("fd-dragging");
  });
  document.addEventListener("dragleave", function () {
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) { overlay.classList.remove("show"); btn2.classList.remove("fd-dragging"); }
  });
  document.addEventListener("drop", function (e) {
    dragDepth = 0; overlay.classList.remove("show"); btn2.classList.remove("fd-dragging");
    if (!popupOn) return;
    if (panel.contains(e.target) || btn2.contains(e.target)) return;
    var t = e.dataTransfer && e.dataTransfer.getData("text/plain");
    if (t && t.trim().length >= 8) {
      e.preventDefault();
      panel.classList.add("open");
      $("fd-text").value = t.trim();
      popupCheck(t.trim());
    }
  });
  document.addEventListener("dragover", function (e) { e.preventDefault(); });
})();
