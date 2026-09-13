/* ================= 互動動畫 / 流程圖 ================= */
/* 每個 builder 吃一個 mount 容器，內部查詢一律用 mount.querySelector（class），
   所以同一頁可同時有多個實例（動畫分頁 + 內嵌教材）互不干擾。
   多數動畫右側附「同步程式碼面板」：播放到哪一步，就把對應的程式碼行 highlight 起來。 */
(function () {

  const esc = s => (s + "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const codeBlock = lines => lines.map((l, i) => `<span class="cl" data-line="${i}">${esc(l) || " "}</span>`).join("");

  /* ---- 通用步進播放器 ---- */
  function Stepper(stage, caption, render) {
    this.stage = stage; this.caption = caption; this.render = render;
    this.steps = []; this.i = 0; this.timer = null; this.codeEl = null;
  }
  Stepper.prototype.load = function (steps) { this.stop(); this.steps = steps; this.i = 0; this.draw(); };
  Stepper.prototype.draw = function () {
    const s = this.steps[this.i] || {};
    this.render(s, this.stage);
    this.caption.innerHTML = s.caption || "";
    if (this.codeEl) {
      const on = s.line == null ? [] : (Array.isArray(s.line) ? s.line : [s.line]);
      this.codeEl.querySelectorAll(".cl").forEach(el => el.classList.toggle("on", on.includes(+el.dataset.line)));
    }
    if (this.prog) this.prog.textContent = `步驟 ${this.i + 1} / ${this.steps.length}`;
  };
  Stepper.prototype.next = function () { if (this.i < this.steps.length - 1) { this.i++; this.draw(); } else this.stop(); };
  Stepper.prototype.prev = function () { if (this.i > 0) { this.i--; this.draw(); } };
  Stepper.prototype.reset = function () { this.stop(); this.i = 0; this.draw(); };
  Stepper.prototype.stop = function () { if (this.timer) { clearInterval(this.timer); this.timer = null; } if (this.playBtn) this.playBtn.innerHTML = ICON("play") + "自動播放"; };
  Stepper.prototype.toggle = function () {
    if (this.timer) { this.stop(); return; }
    this.playBtn.innerHTML = ICON("pause") + "暫停";
    this.timer = setInterval(() => { if (this.i < this.steps.length - 1) this.next(); else this.stop(); }, 850);
  };
  Stepper.prototype.bar = function () {
    const bar = document.createElement("div"); bar.className = "viz-ctrl";
    const mk = (html, f, cls) => { const b = document.createElement("button"); b.className = "btn" + (cls ? " " + cls : ""); b.innerHTML = html; b.onclick = f; return b; };
    bar.appendChild(mk(ICON("prev") + "上一步", () => { this.stop(); this.prev(); }));
    bar.appendChild(mk(ICON("next") + "下一步", () => { this.stop(); this.next(); }));
    this.playBtn = mk(ICON("play") + "自動播放", () => this.toggle(), "primary"); bar.appendChild(this.playBtn);
    bar.appendChild(mk(ICON("reset") + "重設", () => this.reset()));
    this.prog = document.createElement("span"); this.prog.className = "prog"; bar.appendChild(this.prog);
    return bar;
  };

  /* ---- 版面骨架（可選 code 面板） ---- */
  function scaffold(mount, title, desc, code) {
    mount.innerHTML = "";
    const box = document.createElement("div"); box.className = "viz-box";
    box.innerHTML = `<div class="viz-title">${title}</div><div class="viz-desc">${desc}</div>`;
    const inputs = document.createElement("div"); inputs.className = "viz-inputs";
    const main = document.createElement("div"); main.className = "viz-main";
    const stage = document.createElement("div"); stage.className = "viz-stage";
    main.appendChild(stage);
    let codeEl = null;
    if (code && code.length) {
      codeEl = document.createElement("pre"); codeEl.className = "viz-code";
      codeEl.innerHTML = codeBlock(code);
      main.appendChild(codeEl);
    }
    const caption = document.createElement("div"); caption.className = "viz-caption";
    box.append(inputs, main, caption);
    mount.appendChild(box);
    return { box, inputs, stage, caption, codeEl };
  }
  const parseNums = t => (t || "").trim().split(/[\s,]+/).map(Number).filter(x => !isNaN(x));
  function legend(box, items) {
    const l = document.createElement("div"); l.className = "viz-legend";
    l.innerHTML = items.map(([c, t]) => `<span><i class="swatch" style="background:${c}"></i>${t}</span>`).join("");
    box.appendChild(l);
  }
  function cellHTML(val, idx, cls, ptr) {
    return `<div class="cell ${cls || ""}">${idx != null ? `<span class="idx">${idx}</span>` : ""}${val}${ptr ? `<span class="ptr">${ptr}</span>` : ""}</div>`;
  }
  const fmtCells = (r, c) => `(${r},${c})`;
  const mkBtn = (inputs, label) => { const b = document.createElement("button"); b.className = "btn primary"; b.innerHTML = ICON("reset") + label; inputs.appendChild(b); return b; };
  const pill = (txt, ok) => `<span class="pill ${ok ? "ok" : "no"}">${txt}</span>`;

  /* ============ 二維陣列索引 ============ */
  function vizVec2d(mount) {
    const R = 3, C = 4;
    const code = [
      "a = [[0]*4 for _ in range(3)]",
      "for i in range(3):",
      "    for j in range(4):",
      "        a[i][j] = i * 4 + j",
    ];
    const { box, stage, caption, codeEl } = scaffold(mount, "單元 09 二維陣列：a[i][j] 怎麼走",
      "二維陣列就是「列 × 行」。看 row-major（一列走完換下一列）怎麼一格一格填。", code);
    const sp = new Stepper(stage, caption, render); sp.codeEl = codeEl;
    box.append(sp.bar());
    legend(box, [["#fb923c", "正在寫入 a[i][j]"], ["#93c5fd", "已填好"]]);
    const steps = [{ done: -1, caption: "宣告 a[3][4]：3 列、4 行，全部還沒填。", line: 0 }];
    for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) {
      const idx = i * C + j;
      steps.push({ done: idx, cur: [i, j], caption: `a[${i}][${j}] = ${i}×4 + ${j} = <b>${idx}</b>（第 ${i} 列、第 ${j} 行）`, line: 3 });
    }
    steps.push({ done: R * C, caption: "填完！二維其實是把每一列接起來的一維空間。", line: [1, 2, 3] });
    function render(s, stage) {
      let h = `<div class="grid2d">`;
      for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) {
        const idx = i * C + j; let cls = "cell2";
        if (s.cur && s.cur[0] === i && s.cur[1] === j) cls += " cur"; else if (idx < s.done) cls += " on";
        h += `<div class="${cls}"><span class="idx">a[${i}][${j}]</span>${idx < s.done || (s.cur && s.cur[0] === i && s.cur[1] === j) ? idx : ""}</div>`;
      }
      h += `</div>`;
      stage.innerHTML = h;
    }
    sp.load(steps);
  }

  /* ============ 複雜度直覺 ============ */
  function vizComplexity(mount) {
    const { box, inputs, stage, caption } = scaffold(mount, "單元 18 複雜度直覺：這個解法會不會太慢？",
      "電腦 1 秒約做 10⁸ 次運算。拉 N，看各種複雜度的運算量，超過 10⁸（紅色）就有 TLE 風險。");
    inputs.innerHTML = `N = <input type="range" class="cx-n" min="8" max="1000000" step="1" value="1000"><span class="cx-nv"></span>`;
    const $ = s => mount.querySelector(s);
    const sp = new Stepper(stage, caption, render);
    box.append(sp.bar());
    const BUDGET = 1e8;
    const rows = [
      ["O(1)", n => 1, "雜湊 / 公式直接算"],
      ["O(log N)", n => Math.ceil(Math.log2(n)), "二分搜尋"],
      ["O(N)", n => n, "掃一遍 / 前綴和"],
      ["O(N log N)", n => n * Math.ceil(Math.log2(n)), "排序 / 分治"],
      ["O(N²)", n => n * n, "雙層迴圈"],
      ["O(2^N)", n => (n <= 60 ? Math.pow(2, n) : Infinity), "枚舉所有子集"],
    ];
    const fmt = x => x === Infinity ? "天文數字" : x >= 1e12 ? (x / 1e12).toFixed(1) + " 兆" : x >= 1e8 ? (x / 1e8).toFixed(1) + "億" : x >= 1e4 ? (x / 1e4).toFixed(1) + " 萬" : Math.round(x).toString();
    function gen() {
      const n = +$(".cx-n").value; $(".cx-nv").textContent = " " + n.toLocaleString();
      const steps = [{ show: 0, n, caption: "由快到慢逐一揭曉，注意哪一條先破 10⁸ 這條線。" }];
      rows.forEach((r, i) => {
        const v = r[1](n); const ok = v <= BUDGET;
        steps.push({ show: i + 1, n, caption: `<b>${r[0]}</b>（${r[2]}）在 N=${n.toLocaleString()} 時約 <b>${fmt(v)}</b> 次 → ${ok ? pill("1 秒內可行", true) : pill("可能 TLE", false)}` });
      });
      sp.load(steps);
    }
    function render(s, stage) {
      const n = s.n;
      let h = `<div class="cx-list">`;
      rows.forEach((r, i) => {
        if (i >= s.show) { h += `<div class="cx-row muted"><span class="cx-lab">${r[0]}</span><span class="cx-bar-wrap"></span></div>`; return; }
        const v = r[1](n); const ok = v <= BUDGET;
        const frac = Math.max(.04, Math.min(1, Math.log10(v + 1) / Math.log10(1e18)));
        h += `<div class="cx-row"><span class="cx-lab">${r[0]}</span><span class="cx-bar-wrap"><i class="cx-bar ${ok ? "ok" : "no"}" style="width:${(frac * 100).toFixed(0)}%"></i></span><span class="cx-val ${ok ? "ok" : "no"}">${fmt(v)}</span></div>`;
      });
      h += `</div><div class="cx-budget">＝ 10⁸／秒 的預算線（超過就危險）</div>`;
      stage.innerHTML = h;
    }
    $(".cx-n").oninput = gen; gen();
  }

  /* ============ 選擇排序 ============ */
  function vizSort(mount) {
    const code = [
      "for i in range(n - 1):",
      "    m = i",
      "    for j in range(i+1, n):",
      "        if a[j] < a[m]: m = j",
      "    a[i], a[m] = a[m], a[i]",
    ];
    const { box, inputs, stage, caption, codeEl } = scaffold(mount, "單元 16 選擇排序：每輪挑最小的擺到前面",
      "把「找最小值 + 換到定位」重複做。綠色是已排好、藍色是本輪最小、黃色是正在比較。", code);
    inputs.innerHTML = `陣列 <input type="text" class="so-a" size="18" value="5 2 8 1 9 3">`;
    const btn = mkBtn(inputs, "重新產生");
    const $ = s => mount.querySelector(s);
    const sp = new Stepper(stage, caption, render); sp.codeEl = codeEl;
    box.append(sp.bar());
    legend(box, [["#dcfce7", "已排好"], ["#dbeafe", "本輪最小 m"], ["#fef9c3", "正在比較 j"]]);
    function gen() {
      const a = parseNums($(".so-a").value); const n = a.length;
      const steps = [{ a: a.slice(), sorted: 0, caption: "開始選擇排序。", line: 0 }];
      for (let i = 0; i < n; i++) {
        let m = i;
        steps.push({ a: a.slice(), sorted: i, i, m, caption: `第 ${i + 1} 輪：先假設最小是 a[${i}]=${a[i]}。`, line: 1 });
        for (let j = i + 1; j < n; j++) {
          const better = a[j] < a[m];
          steps.push({ a: a.slice(), sorted: i, i, m, j, caption: `比 a[${j}]=${a[j]} 和目前最小 a[${m}]=${a[m]}：${better ? "更小 → 換 m" : "沒更小"}`, line: 3 });
          if (better) m = j;
        }
        if (m !== i) { const t = a[i]; a[i] = a[m]; a[m] = t; }
        steps.push({ a: a.slice(), sorted: i + 1, i, m, swap: true, caption: `把最小值換到位置 ${i}，前 ${i + 1} 個排好了。`, line: 4 });
      }
      steps.push({ a: a.slice(), sorted: n, caption: `全部排好：${a.join(" ")}`, line: 5 });
      sp.load(steps);
    }
    function render(s, stage) {
      let h = `<div class="cells" style="margin-top:6px">`;
      s.a.forEach((v, j) => {
        let cls = "", ptr = "";
        if (j < s.sorted) cls = "a"; else if (j === s.m && s.m != null) cls = "mid"; else if (j === s.j) cls = "hl";
        if (j === s.i && s.i != null) ptr = "i"; if (j === s.j) ptr = (ptr ? ptr + "," : "") + "j";
        h += cellHTML(v, j, cls, ptr);
      });
      h += `</div>`;
      stage.innerHTML = h;
    }
    btn.onclick = gen; gen();
  }

  /* ============ 字母計數 ============ */
  function vizCharFreq(mount) {
    const code = [
      "cnt = [0] * 26",
      "for c in s:",
      "    cnt[ord(c) - ord('a')] += 1",
    ];
    const { box, inputs, stage, caption, codeEl } = scaffold(mount, "單元 10 字元：開 26 格數字母",
      "每個字元 c 用 c−'a' 對到 0~25 的桶子。看字串一個一個被丟進對應的桶。", code);
    inputs.innerHTML = `字串 <input type="text" class="cf-s" size="16" value="banana">`;
    const btn = mkBtn(inputs, "重新產生");
    const $ = s => mount.querySelector(s);
    const sp = new Stepper(stage, caption, render); sp.codeEl = codeEl;
    box.append(sp.bar());
    function gen() {
      const s = ($(".cf-s").value || "").toLowerCase().replace(/[^a-z]/g, "");
      const cnt = new Array(26).fill(0);
      const steps = [{ s, i: -1, cnt: cnt.slice(), caption: "26 個桶子全設 0。", line: 0 }];
      for (let i = 0; i < s.length; i++) {
        const k = s.charCodeAt(i) - 97; cnt[k]++;
        steps.push({ s, i, k, cnt: cnt.slice(), caption: `'${s[i]}' → 桶 ${k}（'${s[i]}'−'a'）→ cnt[${k}] 變成 ${cnt[k]}`, line: 2 });
      }
      let best = 0; for (let k = 1; k < 26; k++) if (cnt[k] > cnt[best]) best = k;
      steps.push({ s, i: s.length, cnt: cnt.slice(), best, caption: s.length ? `出現最多的是 '${String.fromCharCode(97 + best)}'，共 ${cnt[best]} 次。` : "空字串。", line: [1, 2] });
      sp.load(steps);
    }
    function render(s, stage) {
      let h = `<div class="cells" style="margin-bottom:16px">`;
      [...s.s].forEach((ch, j) => h += cellHTML(ch, null, j === s.i ? "hl" : (j < s.i ? "dim" : "")));
      h += `</div><div class="viz-sub">26 個桶（只顯示 a–z）</div><div class="buckets">`;
      for (let k = 0; k < 26; k++) {
        const active = k === s.k, isBest = k === s.best;
        h += `<div class="bucket ${active ? "hl" : ""} ${isBest ? "a" : ""} ${s.cnt[k] ? "" : "empty"}"><span class="bl">${String.fromCharCode(97 + k)}</span><span class="bv">${s.cnt[k]}</span></div>`;
      }
      h += `</div>`;
      stage.innerHTML = h;
    }
    btn.onclick = gen; gen();
  }

  /* ============ 遞迴：階乘 ============ */
  function vizRecursion(mount) {
    const code = [
      "def fact(n):",
      "    if n == 0: return 1      # 終止條件",
      "    return n * fact(n - 1)   # 規模縮小",
    ];
    const { box, inputs, stage, caption, codeEl } = scaffold(mount, "單元 14 遞迴：階乘的呼叫堆疊",
      "看 fact(n) 一路往下呼叫到 fact(0)（觸底），再一層層乘回來。", code);
    inputs.innerHTML = `n = <input type="range" class="rc-n" min="1" max="8" value="4"><span class="rc-nv">4</span>`;
    const btn = mkBtn(inputs, "重新產生");
    const $ = s => mount.querySelector(s);
    const sp = new Stepper(stage, caption, renderR); sp.codeEl = codeEl;
    box.append(sp.bar());
    legend(box, [["#fff7ed", "正在執行的呼叫"], ["#ecfdf3", "正在回傳"]]);
    $(".rc-n").oninput = e => $(".rc-nv").textContent = e.target.value;
    function gen() {
      const n = +$(".rc-n").value;
      const steps = []; const frames = [];
      for (let k = n; k >= 0; k--) {
        frames.push({ k });
        const snap = frames.map(f => ({ ...f, state: f.k === k ? "active" : "" }));
        steps.push({ frames: snap, line: k > 0 ? 2 : 1, caption: k > 0 ? `呼叫 fact(${k})：要先算 fact(${k - 1})，先把它壓進堆疊` : `觸底：fact(0) = 1` });
      }
      const val = []; val[0] = 1;
      steps.push({ frames: frames.map(f => ({ ...f, state: f.k === 0 ? "ret" : "", val: f.k === 0 ? 1 : undefined })), line: 1, caption: `fact(0) 回傳 1，開始一層層往回乘` });
      for (let k = 1; k <= n; k++) {
        val[k] = k * val[k - 1];
        const cur = frames.filter(f => f.k >= k).map(f => ({ ...f, state: f.k === k ? "ret" : "", val: f.k <= k ? val[f.k] : undefined }));
        steps.push({ frames: cur, line: 2, caption: `fact(${k}) = ${k} × fact(${k - 1}) = ${k} × ${val[k - 1]} = <b>${val[k]}</b>` });
      }
      steps.push({ frames: [{ k: n, state: "ret", val: val[n] }], line: 2, caption: `完成！fact(${n}) = <b>${val[n]}</b>` });
      sp.load(steps);
    }
    function renderR(s, stage) {
      if (!s.frames) return;
      let h = `<div class="frames">`;
      s.frames.forEach(f => {
        const txt = f.val !== undefined ? `fact(${f.k}) = ${f.val}` : `fact(${f.k})`;
        h += `<div class="frame ${f.state}">${txt}</div>`;
      });
      h += `</div><div class="viz-sub" style="margin-top:6px">↑ 上面是最新的呼叫（堆疊頂端）</div>`;
      stage.innerHTML = h;
    }
    btn.onclick = gen; gen();
  }

  /* ============ 堆疊：括號配對 ============ */
  function vizStack(mount) {
    const code = [
      "for c in s:",
      "    if 是左括號: stack.append(c)",
      "    elif stack 頂端配對: stack.pop()",
      "    else: return False",
      "return len(stack) == 0",
    ];
    const { box, inputs, stage, caption, codeEl } = scaffold(mount, "單元 15 堆疊：括號配對",
      "遇左括號 push、遇右括號和堆疊頂端配對。掃完堆疊要清空才合法。", code);
    inputs.innerHTML = `字串 <input type="text" class="bk-s" size="16" value="([{}])">`;
    const btn = mkBtn(inputs, "重新產生");
    const $ = s => mount.querySelector(s);
    const sp = new Stepper(stage, caption, renderB); sp.codeEl = codeEl;
    box.append(sp.bar());
    function gen() {
      const s = ($(".bk-s").value || "").replace(/[^()\[\]{}]/g, "");
      const open = "([{", pair = { ")": "(", "]": "[", "}": "{" };
      const st = []; const steps = [{ s, i: -1, stack: [], caption: "開始，堆疊是空的", line: 0 }];
      let ok = true, stop = false;
      for (let i = 0; i < s.length && !stop; i++) {
        const c = s[i];
        if (open.includes(c)) { st.push(c); steps.push({ s, i, stack: st.slice(), line: 1, caption: `遇到左括號 <b>${c}</b> → push 進堆疊` }); }
        else {
          if (st.length && st[st.length - 1] === pair[c]) { st.pop(); steps.push({ s, i, stack: st.slice(), line: 2, caption: `遇到 <b>${c}</b>，和頂端配對成功 → pop` }); }
          else { ok = false; stop = true; steps.push({ s, i, stack: st.slice(), bad: true, line: 3, caption: `遇到 <b>${c}</b>，頂端不匹配 → <b class="viz-no">No</b>` }); }
        }
      }
      if (ok) steps.push({ s, i: s.length, stack: st.slice(), done: true, line: 5, caption: st.length ? `掃完但堆疊還有剩 → <b class="viz-no">No</b>` : `掃完且堆疊清空 → <b class="viz-yes">Yes</b>` });
      sp.load(steps);
    }
    function renderB(s, stage) {
      if (s.s == null) return;
      let h = `<div class="cells" style="margin-bottom:20px">`;
      [...s.s].forEach((ch, j) => h += cellHTML(ch, null, j === s.i ? (s.bad ? "b" : "hl") : (j < s.i ? "dim" : "")));
      h += `</div><div style="display:flex;gap:24px;align-items:flex-end"><div><div class="viz-sub" style="margin-bottom:4px">堆疊（頂端在上）</div><div class="stackcol">`;
      s.stack.forEach(ch => h += `<div class="sitem">${ch}</div>`);
      if (!s.stack.length) h += `<div class="viz-empty">（空）</div>`;
      h += `</div></div></div>`;
      stage.innerHTML = h;
    }
    btn.onclick = gen; gen();
  }

  /* ============ 佇列 queue ============ */
  function vizQueue(mount) {
    const code = [
      "from collections import deque",
      "q = deque()",
      "q.append(x)      # 從尾端進",
      "f = q[0]         # 看最前面",
      "q.popleft()      # 從前端出",
    ];
    const { box, stage, caption, codeEl } = scaffold(mount, "單元 15 佇列 queue：先進先出（FIFO）",
      "排隊：新的人從尾端加入（push），先來的人從前端離開（pop）。BFS 就靠它。", code);
    const sp = new Stepper(stage, caption, render); sp.codeEl = codeEl;
    box.append(sp.bar());
    legend(box, [["#dcfce7", "剛 push 進來"], ["#fee2e2", "剛被 pop 出去"]]);
    const ops = [["push", 3], ["push", 1], ["push", 4], ["pop"], ["push", 5], ["pop"], ["pop"]];
    const q = []; const steps = [{ q: [], caption: "空佇列。", line: 0 }];
    ops.forEach(op => {
      if (op[0] === "push") { q.push(op[1]); steps.push({ q: q.slice(), justIn: q.length - 1, line: 1, caption: `push(${op[1]})：${op[1]} 從尾端進來` }); }
      else { const f = q.shift(); steps.push({ q: q.slice(), out: f, line: 3, caption: `pop()：最前面的 ${f} 離開（先進先出）` }); }
    });
    steps.push({ q: q.slice(), caption: `結束，佇列剩：${q.length ? q.join(" ") : "（空）"}`, line: 2 });
    function render(s, stage) {
      let h = `<div class="viz-sub">前端（出） →→→ 尾端（進）</div><div class="qrow">`;
      if (s.out !== undefined) h += `<div class="cell b" style="opacity:.55">${s.out}</div><div class="qsep">→出</div>`;
      s.q.forEach((v, j) => h += cellHTML(v, null, j === s.justIn ? "a" : ""));
      if (!s.q.length) h += `<div class="viz-empty">（空）</div>`;
      h += `</div>`;
      stage.innerHTML = h;
    }
    sp.load(steps);
  }

  /* ============ 四方向移動 ============ */
  function vizDir4(mount) {
    const code = [
      "dr = [-1, 1, 0, 0]",
      "dc = [0, 0, -1, 1]",
      "for k in range(4):",
      "    nr, nc = r + dr[k], c + dc[k]",
      "    if not (0 <= nr < R and 0 <= nc < C):",
      "        continue          # 出界",
      "    if g[nr][nc] == 1:",
      "        continue          # 牆",
      "    # 合法鄰居！",
    ];
    const { box, stage, caption, codeEl } = scaffold(mount, "單元 09 方向陣列：四方向移動與邊界檢查",
      "站在一格，用 dr/dc 試上下左右。出界或撞牆就跳過，剩下的才是能走的鄰居。", code);
    const sp = new Stepper(stage, caption, render); sp.codeEl = codeEl;
    box.append(sp.bar());
    legend(box, [["#fb923c", "目前位置"], ["#22c55e", "合法鄰居"], ["#ef4444", "出界/牆（跳過）"], ["#334155", "牆"]]);
    const g = [[0, 0, 0, 0, 0], [0, 1, 0, 1, 0], [0, 0, 0, 0, 0], [0, 1, 0, 1, 0], [0, 0, 0, 0, 0]];
    const R = 5, C = 5, r = 2, c = 2;
    const dr = [-1, 1, 0, 0], dc = [0, 0, -1, 1], nm = ["上", "下", "左", "右"];
    const steps = [{ tried: {}, caption: `站在中央 (${r},${c})，準備試四個方向。`, line: [0, 1] }];
    for (let k = 0; k < 4; k++) {
      const nr = r + dr[k], nc = c + dc[k];
      let verdict, cls, line;
      if (nr < 0 || nr >= R || nc < 0 || nc >= C) { verdict = "出界"; cls = "bad"; line = 4; }
      else if (g[nr][nc] === 1) { verdict = "是牆"; cls = "bad"; line = 5; }
      else { verdict = "可以走"; cls = "good"; line = 6; }
      const tried = {}; for (let kk = 0; kk <= k; kk++) { const r2 = r + dr[kk], c2 = c + dc[kk]; if (r2 >= 0 && r2 < R && c2 >= 0 && c2 < C) tried[r2 + "," + c2] = (kk < k ? "old" : cls); else tried["oob" + kk] = 1; }
      steps.push({ tried, cur: [nr, nc], caption: `方向「${nm[k]}」→ (${nr},${nc})：${verdict === "可以走" ? pill(verdict, true) : pill(verdict, false)}`, line });
    }
    function render(s, stage) {
      let h = `<div class="grid" style="grid-template-columns:repeat(${C},1fr);width:${C * 41}px">`;
      for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) {
        let cls = "gcell"; const key = i + "," + j;
        if (g[i][j] === 1) cls += " wall";
        if (i === r && j === c) cls += " current";
        else if (s.tried[key] === "good") cls += " ok-n";
        else if (s.tried[key] === "bad") cls += " bad-n";
        else if (s.tried[key] === "old") cls += " visited";
        h += `<div class="${cls}"></div>`;
      }
      h += `</div>`;
      stage.innerHTML = h;
    }
    sp.load(steps);
  }

  /* ============ 二分搜尋 ============ */
  function vizBin(mount) {
    const code = [
      "lo, hi = 0, n - 1",
      "while lo <= hi:",
      "    mid = (lo + hi) // 2",
      "    if a[mid] == t: return mid",
      "    elif a[mid] < t: lo = mid + 1",
      "    else: hi = mid - 1",
    ];
    const { box, inputs, stage, caption, codeEl } = scaffold(mount, "單元 17 二分搜尋",
      "在已排序陣列中，用 lo / mid / hi 每次把範圍砍一半。", code);
    inputs.innerHTML = `已排序陣列：<code>1 3 4 7 9 11 15 20 25</code>　找 <input type="number" class="bs-t" value="9" style="width:64px">`;
    const btn = mkBtn(inputs, "重新產生");
    const $ = s => mount.querySelector(s);
    const sp = new Stepper(stage, caption, renderBS); sp.codeEl = codeEl;
    box.append(sp.bar());
    legend(box, [["#dbeafe", "mid（正在比較）"], ["#ffffff", "仍在搜尋範圍"], ["#e5e7eb", "已排除（變淡）"]]);
    const a = [1, 3, 4, 7, 9, 11, 15, 20, 25];
    function gen() {
      const t = +$(".bs-t").value;
      let lo = 0, hi = a.length - 1; const steps = [];
      steps.push({ lo, hi, line: 0, caption: `搜尋範圍 [${lo}, ${hi}]，要找 ${t}` });
      let found = -1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (a[mid] === t) { steps.push({ lo, hi, mid, found: mid, line: 3, caption: `a[${mid}] = ${a[mid]} = 目標 → <b class="viz-yes">找到！在索引 ${mid}</b>` }); found = mid; break; }
        else if (a[mid] < t) { steps.push({ lo, hi, mid, line: 4, caption: `a[${mid}] = ${a[mid]} < ${t} → 目標在右半，lo = ${mid + 1}` }); lo = mid + 1; }
        else { steps.push({ lo, hi, mid, line: 5, caption: `a[${mid}] = ${a[mid]} > ${t} → 目標在左半，hi = ${mid - 1}` }); hi = mid - 1; }
      }
      if (found === -1) steps.push({ lo, hi, line: 1, caption: `範圍空了（lo > hi）→ <b class="viz-no">找不到 ${t}</b>` });
      sp.load(steps);
    }
    function renderBS(s, stage) {
      let h = `<div class="cells" style="margin-top:14px">`;
      a.forEach((v, j) => {
        let cls = "", ptr = "";
        if (j < s.lo || j > s.hi) cls = "dim";
        if (j === s.mid) cls = "mid";
        if (j === s.lo && j === s.hi) ptr = "lo=hi"; else if (j === s.lo) ptr = "lo"; else if (j === s.hi) ptr = "hi";
        if (j === s.mid) ptr = (ptr ? ptr + "," : "") + "mid";
        h += cellHTML(v, j, cls, ptr);
      });
      h += `</div>`;
      stage.innerHTML = h;
    }
    btn.onclick = gen; gen();
  }

  /* ============ 解題決策流程圖（互動） ============ */
  function vizFlow(mount) {
    const { box, stage, caption } = scaffold(mount, "解題決策流程圖",
      "考場上一題該怎麼推進？點任一步驟看重點。這條路線就是《考前檢查表》的解題流程。");
    const steps = [
      { t: "① 讀題、抄下輸入/輸出格式", d: "先把「輸入長怎樣、要輸出什麼」抄在草稿紙上，再對照範例。看不懂就先跳下一題。" },
      { t: "② 用範例資料在紙上跑一遍", d: "確認自己真的懂規則。流程模擬題最常見的錯不是寫錯程式，而是規則理解錯。" },
      { t: "③ 想清楚要維護哪些變數", d: "計數器？目前最大值？頭尾指標？先列出來再開始打字，寫到一半才想會卡住。", branch: true },
      { t: "③a 資料量小 → 最直接的寫法就好", d: "先求對再求快。能用雙層迴圈掃完就掃完，拿到分數最重要。", side: "yes" },
      { t: "③b 資料量大 → 換更快的做法", d: "對應本教材的工具：計數陣列取代重複掃描、排序後二分搜尋、用 dict 記已算過的結果。", side: "no" },
      { t: "④ 寫 code，先過範例", d: "先確保範例測資能過。過不了別急著送出，回頭檢查讀題與邊界。" },
      { t: "⑤ 自己造邊界/極端測資", d: "只有 1 筆、空輸入、全部相同、第一個與最後一個元素…這些最容易 WA。自己先打自己。" },
      { t: "⑥ 送出判題", d: "AC → 收下分數換下一題；WA/TLE → 照下面的順序除錯，別盲改。", branch: true },
      { t: "⑥a WA：先檢查讀題與輸出格式", d: "多半是題意理解錯、邊界沒處理、輸出的換行或空白不對。回到 ④、⑤。", side: "no" },
      { t: "⑥b TLE：多半是無窮迴圈或多掃了一輪", d: "檢查 while 的條件有沒有在變、遞迴有沒有終止條件；再看能不能少掃一遍。", side: "no" },
    ];
    let cur = 0;
    function render() {
      let h = `<div class="flow">`;
      steps.forEach((s, i) => {
        const cls = "flow-node" + (i === cur ? " on" : "") + (s.side ? " " + s.side : "") + (s.branch ? " branch" : "");
        h += `<div class="${cls}" data-i="${i}">${s.t}</div>`;
        if (!s.side && i < steps.length - 1 && !(steps[i + 1] && steps[i + 1].side)) h += `<div class="flow-arrow">${ICON("chevron", 20)}</div>`;
        if (s.branch) h += `<div class="flow-arrow">${ICON("chevron", 20)}</div>`;
      });
      h += `</div>`;
      stage.innerHTML = h;
      caption.innerHTML = `<b>${steps[cur].t}</b>：${steps[cur].d}`;
    }
    stage.addEventListener("click", e => {
      const n = e.target.closest(".flow-node"); if (!n) return;
      cur = +n.dataset.i; render();
    });
    box.append((() => { const p = document.createElement("div"); p.className = "viz-sub"; p.style.marginTop = "10px"; p.textContent = "提示：黃色是分歧點，往下有兩條路（夠快 / 不夠快、AC / WA·TLE）。"; return p; })());
    render();
  }

  /* ---- 註冊表 ---- */
  const REGISTRY = {
    vec2d: vizVec2d, complexity: vizComplexity, sort: vizSort, charfreq: vizCharFreq,
    recursion: vizRecursion, stack: vizStack, queue: vizQueue, dir4: vizDir4,
    binary: vizBin, flow: vizFlow,
  };
  const NAMES = [
    ["complexity", "初級 迴圈次數與複雜度直覺"],
    ["vec2d", "中級 二維陣列索引"],
    ["dir4", "中級 方向陣列：上下左右四鄰居"],
    ["charfreq", "中級 字串：26 格數字母"],
    ["recursion", "進階延伸 遞迴：階乘呼叫堆疊"],
    ["stack", "進階延伸 堆疊：括號配對"],
    ["queue", "進階延伸 佇列 queue（FIFO）"],
    ["sort", "進階延伸 選擇排序"],
    ["binary", "進階延伸 二分搜尋"],
    ["flow", "解題決策流程圖"],
  ];
  window.VIZ = {
    NAMES,
    mount(key, el) { el.innerHTML = ""; const f = REGISTRY[key]; if (f) f(el); },
  };
})();
