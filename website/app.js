/* ================= APCS 學習站 前端邏輯 ================= */
// 判題引擎：Pyodide（把 CPython 編成 WebAssembly），程式直接在你的瀏覽器裡跑，
// 不會送到任何伺服器。第一次使用要下載約 10MB 的執行環境（需要網路），之後會被瀏覽器快取。
const PYODIDE_URL = "https://cdn.jsdelivr.net/npm/pyodide@314.0.6/";

/* ---------- 靜態 icon 注入 ---------- */
document.querySelectorAll("[data-icon]").forEach(el => el.insertAdjacentHTML("afterbegin", ICON(el.dataset.icon)));

/* ---------- 分頁切換 ---------- */
function switchTab(name) {
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("active", b.dataset.tab === name));
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.toggle("active", p.id === "tab-" + name));
}
document.querySelectorAll(".tab-btn").forEach(btn => btn.addEventListener("click", () => switchTab(btn.dataset.tab)));

/* ---------- 手機版目錄抽屜 ---------- */
function setNav(open) {
  const nav = document.getElementById("lesson-nav");
  const bd = document.getElementById("nav-backdrop");
  if (nav) nav.classList.toggle("open", open);
  if (bd) bd.classList.toggle("open", open);
}
document.getElementById("nav-toggle").addEventListener("click", () => {
  setNav(!document.getElementById("lesson-nav").classList.contains("open"));
});
document.getElementById("nav-backdrop").addEventListener("click", () => setNav(false));

/* ---------- 完成度（localStorage） ---------- */
const DONE = new Set(JSON.parse(localStorage.getItem("apcs.done") || "[]"));
function saveDone() { localStorage.setItem("apcs.done", JSON.stringify([...DONE])); syncTouch(); }
// 錯題本：記住答錯的選擇題（存 QUIZ 的索引）
const WRONG = new Set(JSON.parse(localStorage.getItem("apcs.wrong") || "[]"));
function saveWrong() { localStorage.setItem("apcs.wrong", JSON.stringify([...WRONG])); syncTouch(); }

/* ---------- 跨裝置同步：本機輔助狀態 ---------- */
// SM：程式碼各題與判題選擇的時間戳（合併時用來判斷誰新）
let SM = JSON.parse(localStorage.getItem("apcs.sync.meta") || "{}");
if (!SM.codeMeta) SM.codeMeta = {};
if (typeof SM.judgeT !== "number") SM.judgeT = 0;
function saveSM() { localStorage.setItem("apcs.sync.meta", JSON.stringify(SM)); }
// 已刪除筆記的墓碑（避免其他裝置把刪掉的筆記又同步回來）
let NOTES_DEL = new Set(JSON.parse(localStorage.getItem("apcs.notes.del") || "[]"));
function saveNotesDel() { localStorage.setItem("apcs.notes.del", JSON.stringify([...NOTES_DEL])); }
// 套用雲端資料期間不要反過來又觸發推送
let SYNC_APPLYING = false;
function syncTouch() {
  if (SYNC_APPLYING || typeof SYNC === "undefined") return;
  SYNC.schedulePush(syncPush);
}
function toggleDone(path) { DONE.has(path) ? DONE.delete(path) : DONE.add(path); saveDone(); refreshDone(); }
/* 所有可打勾的項目 key：50 天計畫的每一天 */
function allPaths() {
  return STUDY.days.map(dayKey);
}
function markBtnHTML(done) {
  return done ? ICON("check") + "<span>已完成（點此取消）</span>" : ICON("circle") + "<span>讀完了，標記完成</span>";
}
function refreshDone() {
  // 同步側邊欄與儀表板上所有帶 data-path 的元素
  document.querySelectorAll("[data-path]").forEach(el => {
    const on = DONE.has(el.dataset.path);
    if (el.classList.contains("wk-item")) el.classList.toggle("done", on);
    if (el.tagName === "A") el.classList.toggle("is-done", on);
    if (el.classList.contains("done-btn")) { el.classList.toggle("is-done", on); el.innerHTML = markBtnHTML(on); }
  });
  const total = allPaths().length;
  const done = allPaths().filter(p => DONE.has(p)).length;
  const ring = document.getElementById("prog-ring");
  if (ring) {
    const c = 2 * Math.PI * 26, frac = total ? done / total : 0;
    ring.querySelector(".bar").setAttribute("stroke-dashoffset", c * (1 - frac));
    ring.parentElement.querySelector(".pct").textContent = `${done}/${total}`;
  }
}

/* ================= 首頁 / 儀表板 ================= */
function tagClass(tag) {
  if (/衝刺|實戰/.test(tag)) return "hot";
  if (/應試|考前/.test(tag)) return "exam";
  return "teach";
}
function buildHome() {
  const cur = currentWeekId();
  const today = todayStr();
  const d = daysToExam();
  const total = allPaths().length, done = allPaths().filter(p => DONE.has(p)).length;
  const c = 2 * Math.PI * 26;
  const body = document.getElementById("home-body");

  const countTxt = d > 0 ? d : d === 0 ? "0" : "—";
  const hero = `
    <div class="hero">
      <div class="hero-count"><span class="big">${countTxt}</span><span class="lbl">${d >= 0 ? "天後應考" : "已過考試日"}</span></div>
      <div class="hero-info">
        <h1>APCS 初級・中級 · Python 自學站</h1>
        <p>考試日 ${STUDY.exam}。範圍依 APCS 官方「評量架構」編排：初級 7 單元、中級 5 單元、進階延伸 6 單元。每天約 30 分鐘，跟著下面的 50 天計畫走，一天一步。</p>
        <div class="hero-meta">
          <span class="hero-chip">${ICON("target", 15)} 初級＋中級題本</span>
          <span class="hero-chip">${ICON("calendar", 15)} ${cur ? "本週進度：" + cur : "共 8 週 / 50 天"}</span>
          <span class="hero-chip">${ICON("cap", 15)} 每天約 30 分鐘</span>
        </div>
      </div>
      <div class="progress-ring">
        <svg id="prog-ring" width="72" height="72" viewBox="0 0 72 72">
          <circle cx="36" cy="36" r="26" fill="none" stroke="rgba(255,255,255,.25)" stroke-width="7"/>
          <circle class="bar" cx="36" cy="36" r="26" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round"
            stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - (total ? done / total : 0))}"/>
        </svg>
        <span class="pct">${done}/${total}</span>
      </div>
    </div>`;

  const weekCards = STUDY.weeks.map(wk => {
    const isCur = wk.id === cur;
    const items = daysOfWeek(wk).map(day => {
      const key = dayKey(day);
      const isToday = day.d === today;
      // 當天任務不直接列出來（畫面太雜），改成滑鼠移上去看的提示
      const tip = attrEsc(day.tasks.map(t => "・" + t).join("\n"));
      return `<div class="wk-item day-item ${DONE.has(key) ? "done" : ""} ${isToday ? "is-today" : ""}"
                   data-path="${key}" ${day.p ? `data-open="${day.p}"` : ""} title="${tip}">
         <span class="tick" data-tick="1">${ICON("check", 14)}</span>
         <span class="wk-when day-when">${fmtDay(day.d)}<small>${day.w}</small></span>
         <span class="lbl">${day.t}${day.p ? ICON("book", 13) : ""}</span>
         ${isToday ? `<span class="wk-tag now">今天</span>` : ""}
       </div>`;
    }).join("");
    const tag = isCur ? `<span class="wk-tag now">本週</span>`
      : wk.tag ? `<span class="wk-tag ${tagClass(wk.tag)}">${wk.tag}</span>` : "";
    return `
      <div class="wk-card ${isCur ? "current" : ""}">
        <div class="wk-top">
          <div class="wk-badge">${wk.id}</div>
          <div><div class="wk-title">${wk.title}</div><div class="wk-date">${wk.range}・${daysOfWeek(wk).length} 天</div></div>
          ${tag}
        </div>
        <div class="wk-desc">${wk.desc}</div>
        <div class="wk-list">${items}</div>
      </div>`;
  }).join("");

  const links = `
    <div class="home-links">
      ${STUDY.extra.map(([label, path]) =>
        `<div class="home-link" data-open="${path}">${ICON("target")}${label}</div>`).join("")}
      <div class="home-link" data-tabjump="viz">${ICON("film")}互動動畫圖解</div>
      <div class="home-link" data-tabjump="quiz">${ICON("quiz")}觀念題自我檢測</div>
      <div class="home-link" data-tabjump="judge">${ICON("code")}線上寫 Python 判題</div>
      <div class="home-link" data-tabjump="cheat">${ICON("bulb")}考前速查・我的筆記</div>
    </div>`;

  body.innerHTML = hero +
    `<div class="section-head">${ICON("layers")} 50 天讀書計畫・共 8 週 <span class="muted">有書本圖示的可點開教材；點左邊方框標記今天做完了</span></div>` +
    `<div class="week-grid">${weekCards}</div>` +
    `<div class="section-head">${ICON("route")} 快速入口</div>` + links;

  // 事件：打開教材 / 勾選完成 / 跳分頁
  body.querySelectorAll(".day-item").forEach(it => it.addEventListener("click", e => {
    if (e.target.closest("[data-tick]")) { toggleDone(it.dataset.path); return; }
    if (it.dataset.open) openLesson(it.dataset.open);
  }));
  body.querySelectorAll(".home-link[data-open]").forEach(el => el.addEventListener("click", () => openLesson(el.dataset.open)));
  body.querySelectorAll("[data-tabjump]").forEach(el => el.addEventListener("click", () => switchTab(el.dataset.tabjump)));
  // 捲到今天那一列
  const todayEl = body.querySelector(".day-item.is-today");
  if (todayEl) setTimeout(() => todayEl.scrollIntoView({ block: "center", behavior: "smooth" }), 300);
}

/* ================= 教材閱讀 ================= */
/* 側邊欄目錄：依「初級 / 中級 / 進階延伸」列出 18 個單元，最後放實作題與檢查表。
   每個單元標上計畫裡排定的日期，方便對照 50 天進度。 */
const NAV_SECTIONS = [
  { name: "初級題本範圍", note: "7 單元", dir: "../01-初級/", files: [
    ["01 輸入與輸出", "01-輸入與輸出.md"],
    ["02 資料型態與變數", "02-資料型態與變數.md"],
    ["03 算術運算", "03-算術運算.md"],
    ["04 邏輯運算", "04-邏輯運算.md"],
    ["05 位元運算", "05-位元運算.md"],
    ["06 條件判斷", "06-條件判斷.md"],
    ["07 迴圈", "07-迴圈.md"],
  ]},
  { name: "中級題本範圍", note: "5 單元", dir: "../02-中級/", files: [
    ["08 一維陣列與串列", "08-一維陣列與串列.md"],
    ["09 二維陣列", "09-二維陣列.md"],
    ["10 字元與編碼", "10-字元與編碼.md"],
    ["11 字串處理", "11-字串處理.md"],
    ["12 文字處理與流程模擬", "12-文字處理與流程模擬.md"],
  ]},
  { name: "進階延伸", note: "6 單元・行有餘力再讀", dir: "../03-進階延伸/", files: [
    ["13 函式", "13-函式.md"],
    ["14 遞迴", "14-遞迴.md"],
    ["15 堆疊與佇列", "15-堆疊與佇列.md"],
    ["16 排序演算法", "16-排序演算法.md"],
    ["17 搜尋演算法", "17-搜尋演算法.md"],
    ["18 時間複雜度", "18-時間複雜度.md"],
  ]},
];
/* 教材路徑 → 計畫中排定的日期與週次（取第一次出現的那天） */
function lessonDateMap() {
  const map = {};
  STUDY.days.forEach(day => {
    if (day.p && !map[day.p]) {
      const wk = STUDY.weeks.find(w => day.d >= w.start && day.d <= w.end);
      map[day.p] = (wk ? wk.id + "・" : "") + fmtDay(day.d);
    }
  });
  return map;
}
function buildLessonNav() {
  const nav = document.getElementById("lesson-nav");
  nav.innerHTML = "";
  const dates = lessonDateMap();
  NAV_SECTIONS.forEach(s => {
    const sec = document.createElement("div");
    sec.className = "sec";
    sec.innerHTML = `<span class="wk-dot">${s.files.length}</span>${s.name}<span class="sec-date">${s.note}</span>`;
    nav.appendChild(sec);
    s.files.forEach(([label, file]) => {
      const path = s.dir + file;
      nav.appendChild(navLink(label, path, "teach", dates[path] || ""));
    });
  });
  const sec = document.createElement("div"); sec.className = "sec"; sec.innerHTML = `${ICON("target", 16)}練習與應試`;
  nav.appendChild(sec);
  STUDY.extra.forEach(([label, path]) => nav.appendChild(navLink(label, path, "drill")));
  refreshDone();
}
function navLink(label, path, kind, date) {
  const a = document.createElement("a");
  a.className = kind === "drill" ? "drill" : "";
  a.dataset.path = path;
  a.innerHTML = `${ICON(kind === "drill" ? "pencil" : "book", 16).replace('class="ic"', 'class="ic li"')}<span class="li-label">${label}</span>${date ? `<span class="li-date">${date}</span>` : ""}<span class="li-check" title="標記完成"><span class="ck-off">${ICON("circle", 15)}</span><span class="ck-on">${ICON("check", 16)}</span></span>`;
  if (DONE.has(path)) a.classList.add("is-done");
  a.addEventListener("click", e => {
    if (e.target.closest(".li-check")) { e.preventDefault(); e.stopPropagation(); toggleDone(path); return; }
    openLesson(path);
  });
  return a;
}

function openLesson(path) {
  switchTab("read");
  const a = document.querySelector(`#lesson-nav a[data-path="${cssEsc(path)}"]`);
  loadLesson(path, a);
}
function cssEsc(s) { return (window.CSS && CSS.escape) ? CSS.escape(s) : s.replace(/["\\]/g, "\\$&"); }

async function loadLesson(path, aEl) {
  setNav(false); // 手機版：選了就把抽屜收起來
  document.querySelectorAll("#lesson-nav a").forEach(a => a.classList.remove("active"));
  if (aEl) aEl.classList.add("active");
  const content = document.getElementById("lesson-content");
  content.innerHTML = '<div class="loading">載入中…</div>';
  try {
    const res = await fetch(encodeURI(path));
    if (!res.ok) throw new Error("HTTP " + res.status);
    const md = await res.text();
    let html = window.marked ? (marked.parse ? marked.parse(md) : marked(md)) : escapeHtml(md);
    html = cleanEmoji(html);
    content.innerHTML = `<div class="lesson-inner">${html}</div>`;
    const inner = content.querySelector(".lesson-inner");
    setupInlineQuizzes(inner);   // 先把 ```quiz 區塊換成互動選擇題（免得被當一般程式碼）
    inner.querySelectorAll("pre").forEach(setupCodeWalkthrough);
    embedViz(path, inner);
    addLessonActions(path, inner);
    content.scrollTop = 0;
  } catch (e) {
    content.innerHTML =
      `<div class="reader-empty"><p class="tip">${ICON("warn")}讀取失敗：${escapeHtml(String(e.message))}。<br>
      最可能是用了 <code>file://</code> 直接開頁；請在專案根目錄執行
      <code>python3 -m http.server 8000</code> 後開 <code>http://localhost:8000/website/</code></p></div>`;
  }
}

/* 在教材上下各放一顆「標記完成」按鈕 */
function addLessonActions(path, inner) {
  const make = bottom => {
    const bar = document.createElement("div"); bar.className = "lesson-actions" + (bottom ? " bottom" : "");
    const b = document.createElement("button"); b.className = "btn done-btn"; b.dataset.path = path;
    if (DONE.has(path)) b.classList.add("is-done");
    b.innerHTML = markBtnHTML(DONE.has(path));
    b.onclick = () => toggleDone(path);
    bar.appendChild(b); return bar;
  };
  const h1 = inner.querySelector("h1");
  if (h1) h1.after(make(false)); else inner.prepend(make(false));
  inner.appendChild(make(true));
}

/* 依課題把互動動畫塞進內文（放在觀念講解之後、模板碼之前） */
function makeVizWrap(key) {
  const wrap = document.createElement("div");
  wrap.className = "inline-viz";
  wrap.innerHTML = `<div class="inline-viz-head">${ICON("film")}<span>互動動畫：邊讀邊操作</span><span class="badge">可拖動 / 逐步播放</span></div>`;
  const mountEl = document.createElement("div");
  wrap.appendChild(mountEl);
  return { wrap, mountEl };
}
function embedViz(path, inner) {
  if (!window.VIZ) return;
  // 1) 行內標記 [[viz:KEY]]：在教材指定位置嵌入指定動畫（一篇可放多個）
  inner.querySelectorAll("p").forEach(p => {
    const m = (p.textContent || "").trim().match(/^\[\[viz:(\w+)\]\]$/);
    if (!m) return;
    const { wrap, mountEl } = makeVizWrap(m[1]);
    p.parentNode.replaceChild(wrap, p);
    VIZ.mount(m[1], mountEl);
  });
  // 2) 舊機制：整篇對應一個 viz（LESSON_VIZ），插在第二個 h2 前
  const key = LESSON_VIZ[path];
  if (!key) return;
  const { wrap, mountEl } = makeVizWrap(key);
  const h2s = inner.querySelectorAll("h2");
  if (h2s.length >= 2) h2s[1].parentNode.insertBefore(wrap, h2s[1]);
  else inner.appendChild(wrap);
  VIZ.mount(key, mountEl);
}

function escapeHtml(s) {
  return s.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}
/* 要塞進 HTML 屬性值（如 title="…"）的字串 */
function attrEsc(s) {
  return escapeHtml(s || "").replace(/"/g, "&quot;");
}
/* 從解說文字裡抽出 [[viz:KEY]] 標記：回傳去掉標記的文字，與要嵌的動畫 key（沒有則 null）。
   測驗解說與教材共用同一個標記慣例。 */
function extractVizKey(s) {
  let viz = null;
  const text = (s || "").replace(/\[\[viz:(\w+)\]\]/, (_, k) => { viz = k; return ""; }).trim();
  return { text, viz };
}
/* 產生「展開動畫」按鈕 + 收合的動畫容器：預設收起，按鈕按下才展開，第一次展開才載入動畫。
   回傳的元素上掛一個 reset()，可把它收回初始（收合）狀態。測驗解說共用。 */
function makeVizToggle(key) {
  const box = document.createElement("div");
  box.className = "viz-toggle-box";
  const btn = document.createElement("button");
  btn.type = "button"; btn.className = "viz-toggle-btn";
  btn.innerHTML = ICON("film", 15) + `<span class="vt-label">展開動畫解說</span>`;
  const mount = document.createElement("div");
  mount.className = "viz-toggle-mount"; mount.style.display = "none";
  let mounted = false, open = false;
  const setOpen = o => {
    open = o;
    mount.style.display = o ? "block" : "none";
    box.classList.toggle("open", o);
    btn.querySelector(".vt-label").textContent = o ? "收合動畫" : "展開動畫解說";
    if (o && !mounted && window.VIZ) { VIZ.mount(key, mount); mounted = true; }
  };
  btn.addEventListener("click", () => setOpen(!open));
  box.append(btn, mount);
  box.reset = () => setOpen(false);
  return box;
}

/* 內嵌選擇題：把教材裡的 ```quiz 區塊轉成可點選的互動題。
   作者語法（放在 markdown 的 ```quiz ... ``` 之間）：
     Q: 問題文字（可用反引號寫行內程式，如 `sum += x`）
     * 正確選項
     - 錯誤選項
     - 錯誤選項
     E: 答對／答錯後顯示的解說
   一個區塊可放多題，每題用一行新的「Q:」開始。 */
function fmtInline(s) {
  return escapeHtml(s).replace(/`([^`]+)`/g, "<code>$1</code>");
}
function parseQuizBlock(text) {
  const qs = []; let cur = null;
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\s+$/, "");
    if (/^\s*Q:/.test(line)) { cur = { q: line.replace(/^\s*Q:\s?/, ""), opts: [], exp: "" }; qs.push(cur); }
    else if (cur && /^\s*[*\-]\s+/.test(line)) {
      cur.opts.push({ text: line.replace(/^\s*[*\-]\s+/, ""), correct: /^\s*\*/.test(line) });
    }
    else if (cur && /^\s*E:/.test(line)) { cur.exp = line.replace(/^\s*E:\s?/, ""); }
    else if (cur && line.trim() && cur.opts.length === 0) { cur.q += " " + line.trim(); } // 問題續行
    else if (cur && line.trim() && cur.exp) { cur.exp += " " + line.trim(); }             // 解說續行
  }
  return qs.filter(q => q.opts.length >= 2);
}
function setupInlineQuizzes(inner) {
  inner.querySelectorAll("pre > code.language-quiz").forEach(code => {
    const pre = code.parentElement;
    const questions = parseQuizBlock(code.textContent);
    if (!questions.length) return;
    const box = document.createElement("div");
    box.className = "iq-box";
    box.innerHTML = `<div class="iq-head">${ICON("quiz", 17)}<span>小測驗：點選你的答案</span></div>`;
    questions.forEach(qd => box.appendChild(buildInlineQuiz(qd)));
    pre.replaceWith(box);
  });
}
function buildInlineQuiz(qd) {
  const card = document.createElement("div");
  card.className = "iq";
  const opts = qd.opts.map((o, i) =>
    `<button class="iq-opt" data-correct="${o.correct ? 1 : 0}">
       <span class="lt">${String.fromCharCode(65 + i)}</span><span class="iq-otext">${fmtInline(o.text)}</span>
       <span class="iq-mark">${ICON("check", 16)}${ICON("x", 16)}</span>
     </button>`).join("");
  const { text: expText, viz } = extractVizKey(qd.exp);
  card.innerHTML =
    `<div class="iq-q">${fmtInline(qd.q)}</div>
     <div class="iq-opts">${opts}</div>
     ${expText ? `<div class="iq-exp">${ICON("bulb", 16)}<span>${fmtInline(expText)}</span></div>` : ""}
     <button class="iq-retry">${ICON("reset", 14)}<span>再試一次</span></button>`;
  const optEls = [...card.querySelectorAll(".iq-opt")];
  const exp = card.querySelector(".iq-exp");
  const retry = card.querySelector(".iq-retry");
  // 動畫用「展開按鈕」包起來，插在解說之後、再試一次之前；答完才顯示按鈕
  let vizBox = null;
  if (viz) { vizBox = makeVizToggle(viz); vizBox.style.display = "none"; card.insertBefore(vizBox, retry); }
  optEls.forEach(btn => btn.addEventListener("click", () => {
    if (card.classList.contains("answered")) return;
    card.classList.add("answered");
    const right = btn.dataset.correct === "1";
    btn.classList.add(right ? "picked-right" : "picked-wrong");
    optEls.forEach(b => { if (b.dataset.correct === "1") b.classList.add("is-correct"); });
    card.classList.add(right ? "ok" : "bad");
    if (exp) exp.style.display = "flex";
    if (vizBox) vizBox.style.display = "block";
    retry.style.display = "inline-flex";
  }));
  retry.addEventListener("click", () => {
    card.classList.remove("answered", "ok", "bad");
    optEls.forEach(b => b.classList.remove("picked-right", "picked-wrong", "is-correct"));
    if (exp) exp.style.display = "none";
    if (vizBox) { vizBox.style.display = "none"; vizBox.reset(); }
    retry.style.display = "none";
  });
  return card;
}

/* 逐行走讀：一句話說明某行在做什麼（優先用程式碼自己的 # 註解，否則用啟發式判斷） */
function explainLine(line) {
  const raw = (line || "").trim();
  // 拆出行內 # 註解，當「補充意圖」，不直接拿它當整句解釋（字串裡的 # 不算）
  let ci = -1, q = null;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (q) { if (ch === q) q = null; }
    else if (ch === '"' || ch === "'") q = ch;
    else if (ch === "#") { ci = i; break; }
  }
  const cm = ci >= 0 ? raw.slice(ci + 1).trim() : "";
  const t = (ci >= 0 ? raw.slice(0, ci) : raw).trim();
  let base = "";
  if (!t) base = cm ? "" : "空行（排版用，不執行）";
  else if (/^(import|from)\s/.test(t)) base = "匯入模組：把要用到的工具載進來";
  else if (/^def\s+(\w+)/.test(t)) base = `定義函式 ${t.match(/^def\s+(\w+)/)[1]}()，呼叫它才會執行裡面的內容`;
  else if (/^class\s/.test(t)) base = "定義類別";
  else if (/=\s*int\s*\(\s*input\s*\(/.test(t)) base = "讀入一行並轉成整數";
  else if (/map\s*\(\s*int\s*,\s*input\s*\(\)\.split\(\)/.test(t)) base = "讀入一行、用空白切開，每個都轉成整數";
  else if (/\binput\s*\(/.test(t)) base = "從輸入讀進一行（拿到的是字串）";
  else if (/^print\s*\(|\bprint\s*\(/.test(t)) base = "把結果輸出";
  else if (/^for\s+.+\s+in\s+range\s*\(/.test(t)) base = "for 迴圈：照 range 產生的數字重複執行";
  else if (/^for\s+.+\s+in\s/.test(t)) base = "for 迴圈：把後面的東西一個一個取出來處理";
  else if (/^while\b/.test(t)) base = "while 迴圈：條件成立就一直做";
  else if (/^if\b/.test(t)) base = "條件判斷：成立才做裡面的事";
  else if (/^elif\b/.test(t)) base = "上面的條件不成立時，再檢查這個條件";
  else if (/^else\b/.test(t)) base = "以上條件都不成立時走這裡";
  else if (/^try\b|^except\b|^finally\b/.test(t)) base = "例外處理：把可能出錯的情況接住";
  else if (/^return\b/.test(t)) base = "回傳值並結束這個函式";
  else if (/^break\b/.test(t)) base = "跳出整個迴圈";
  else if (/^continue\b/.test(t)) base = "跳過本輪剩下的程式，直接進下一輪";
  else if (/^global\b/.test(t)) base = "宣告要修改的是全域變數";
  else if (/\.append\s*\(/.test(t)) base = "在串列尾端加一個元素（堆疊的 push）";
  else if (/\.pop\s*\(\s*\)/.test(t)) base = "取出並移除最後一個元素（堆疊的 pop）";
  else if (/\.popleft\s*\(/.test(t)) base = "取出並移除最前面的元素（佇列的 dequeue）";
  else if (/\.sort\s*\(|\bsorted\s*\(/.test(t)) base = "排序";
  // 同時指派多個變數（含交換寫法）
  else if (/^[\w\[\]\.]+\s*,\s*[\w\[\]\.]+\s*=(?!=)/.test(t)) base = "一次指派多個變數（右邊會先整包算好）";
  else if (/^[\w.]+(\[[^\]]*\])+\s*=(?!=)/.test(t)) base = "把算好的值存進這個位置";
  else if (/^\w+\s*(\+|-|\*|\/\/?|%|\*\*)=/.test(t)) base = "把運算結果存回原本的變數";
  else if (/^\w+\s*=(?!=)/.test(t)) base = "計算並存到變數";
  else base = "執行這一行";
  // 有註解就當補充意圖接在後面；沒有 base（例如整行只有註解）才單獨用註解
  if (cm) return base ? `${base}（${cm}）` : cm;
  return base;
}
function setupCodeWalkthrough(pre) {
  const code = pre.querySelector("code");
  if (!code || pre.dataset.walk) return;
  pre.dataset.walk = "1";
  const raw = code.textContent.replace(/\n+$/, "");
  const lines = raw.split("\n");
  code.classList.add("hljs");
  code.innerHTML = lines.map(l => `<span class="ln">${(l.trim() === "") ? " " : (window.hljs ? hljs.highlight(l, { language: "python" }).value : escapeHtml(l))}</span>`).join("");
  const wrap = document.createElement("div"); wrap.className = "code-wrap";
  pre.parentNode.insertBefore(wrap, pre); wrap.appendChild(pre);
  const btn = document.createElement("button"); btn.className = "code-walk-btn"; btn.innerHTML = ICON("play", 14) + "逐行走讀"; wrap.appendChild(btn);
  const panel = document.createElement("div"); panel.className = "code-explain";
  panel.innerHTML = `<div class="ce-head"></div><div class="ce-text"></div><div class="ce-ctrl"></div>`;
  wrap.appendChild(panel);
  const lnEls = [...code.querySelectorAll(".ln")];
  const head = panel.querySelector(".ce-head"), text = panel.querySelector(".ce-text"), ctrl = panel.querySelector(".ce-ctrl");
  // 一行一行往下讀，說明每行在做什麼（想看真的執行結果，請用「程式判題」分頁跑一次）
  const steps = lines.map((_, i) => ({ line: i, note: explainLine(lines[i]) }));
  head.textContent = "逐行順讀：一行一句話說明（想看實際執行結果請到「程式判題」分頁跑）";
  let cur = 0, on = false;
  const mk = (html, f) => { const b = document.createElement("button"); b.className = "btn"; b.innerHTML = html; b.onclick = f; return b; };
  const prog = document.createElement("span"); prog.className = "prog";
  ctrl.append(mk(ICON("prev") + "上一步", () => go(cur - 1)), mk(ICON("next") + "下一步", () => go(cur + 1)), mk(ICON("x") + "結束", stop), prog);
  function draw() {
    const st = steps[cur], ln = lines[st.line] || "";
    lnEls.forEach((e, i) => e.classList.toggle("dbg-current", i === st.line));
    text.innerHTML = `<b>第 ${st.line + 1} 行</b>　<code class="ce-code">${escapeHtml(ln.trim() || "（空行）")}</code><br>→ ${escapeHtml(st.note)}`;
    prog.textContent = `${cur + 1} / ${steps.length}`;
    if (lnEls[st.line]) lnEls[st.line].scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
  function go(i) { if (i < 0 || i >= steps.length) return; cur = i; draw(); }
  function stop() { on = false; wrap.classList.remove("walking"); lnEls.forEach(e => e.classList.remove("dbg-current")); }
  function start() { on = true; cur = 0; wrap.classList.add("walking"); draw(); }
  btn.onclick = () => on ? stop() : start();
}

/* 把教材內文裡少數裝飾性 emoji 換成與全站一致的線條 icon（★☆ 難度、→ 箭頭、✓ 等有意義的符號保留不動） */
const EMOJI_ICON = { "💡": "bulb", "⚠️": "warn", "⚠": "warn", "✅": "check", "⛔": "x", "📖": "book", "💻": "code", "📝": "pencil", "👉": "arrow", "🎬": "film", "🎯": "target", "👋": "" };
function cleanEmoji(html) {
  return html.replace(/💡|⚠️|⚠|✅|⛔|📖|💻|📝|👉|🎬|🎯|👋/g, m => {
    const k = EMOJI_ICON[m];
    return k ? `<span class="md-ic ${k === "warn" ? "warn" : ""}">${ICON(k, 16)}</span>` : "";
  });
}

/* ================= 選擇題測驗 ================= */
let quizState = [];
function initQuiz() {
  const weekSel = document.getElementById("quiz-week");
  [...new Set(QUIZ.map(q => q.w))].forEach(w => {
    const o = document.createElement("option"); o.value = w; o.textContent = w; weekSel.appendChild(o);
  });
  const wrongOpt = document.createElement("option"); wrongOpt.value = "wrong"; weekSel.appendChild(wrongOpt);
  updateWrongCount();
  document.getElementById("quiz-start").addEventListener("click", startQuiz);
  document.getElementById("quiz-submit").addEventListener("click", gradeQuiz);
  document.getElementById("quiz-list").innerHTML =
    `<div class="quiz-hint">${ICON("quiz", 34)}選一個範圍，按「開始 / 重新出題」，每次會從該範圍<b>隨機抽 ${QUIZ_DRAW} 題並打亂選項順序</b>，交卷即時對答案與看解析。答錯的題會自動進「錯題重練」。</div>`;
}
function updateWrongCount() {
  const opt = document.querySelector('#quiz-week option[value="wrong"]');
  if (opt) opt.textContent = `錯題重練（${WRONG.size}）`;
}
const QUIZ_DRAW = 15;               // 每次隨機抽幾題（不足就全出）
function shuffled(arr) {            // Fisher-Yates
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
/* 把一題的選項順序打亂，並把正解索引跟著搬到新位置 */
function shuffleOptions(q) {
  const idx = shuffled(q.o.map((_, i) => i));
  return { ...q, o: idx.map(i => q.o[i]), a: idx.indexOf(q.a) };
}
function startQuiz() {
  const wk = document.getElementById("quiz-week").value;
  let pool = QUIZ.map((q, i) => ({ q, gi: i }))
    .filter(o => wk === "wrong" ? WRONG.has(o.gi) : (wk === "all" || o.q.w === wk));
  // 隨機抽題 + 打亂選項：同一個範圍重複測不會拿到一模一樣的考卷
  pool = shuffled(pool).slice(0, QUIZ_DRAW);
  quizState = pool.map(o => ({ q: shuffleOptions(o.q), gi: o.gi, sel: -1 }));
  document.getElementById("quiz-score").textContent = "";
  if (!pool.length) {
    document.getElementById("quiz-list").innerHTML =
      `<div class="quiz-hint">${ICON("check", 34)}${wk === "wrong" ? "目前沒有錯題，先去各週作答吧！" : "這個範圍沒有題目。"}</div>`;
    document.getElementById("quiz-submit").style.display = "none";
    return;
  }
  renderQuiz();
  document.getElementById("quiz-submit").style.display = "";
}
function renderQuiz() {
  const list = document.getElementById("quiz-list");
  list.innerHTML = "";
  quizState.forEach((st, qi) => {
    const card = document.createElement("div");
    card.className = "q-card";
    card.innerHTML = `<div class="q-title">${qi + 1}. ${st.q.q}<span class="q-week">[${st.q.w}]</span></div>`;
    st.q.o.forEach((opt, oi) => {
      const div = document.createElement("div");
      div.className = "q-opt";
      div.innerHTML = `<span class="lt">${String.fromCharCode(65 + oi)}.</span><span>${opt}</span>`;
      div.addEventListener("click", () => {
        if (card.dataset.graded) return;
        st.sel = oi;
        card.querySelectorAll(".q-opt").forEach(o => o.classList.remove("sel"));
        div.classList.add("sel");
      });
      card.appendChild(div);
    });
    const { text, viz } = extractVizKey(st.q.e);
    const ex = document.createElement("div");
    ex.className = "q-explain";
    ex.innerHTML = ICON("bulb") + "<span>" + text + "</span>";
    card.appendChild(ex);
    if (viz) {
      const vt = makeVizToggle(viz);
      vt.style.display = "none";           // 對完答案才顯示「展開動畫」按鈕
      card.appendChild(vt);
      st._vizToggle = vt;
    } else { st._vizToggle = null; }
    list.appendChild(card);
  });
}
function gradeQuiz() {
  let correct = 0;
  const cards = document.querySelectorAll("#quiz-list .q-card");
  quizState.forEach((st, qi) => {
    const card = cards[qi];
    card.dataset.graded = "1";
    const opts = card.querySelectorAll(".q-opt");
    opts.forEach((o, oi) => {
      o.classList.remove("sel");
      if (oi === st.q.a) o.classList.add("correct");
      if (oi === st.sel && st.sel !== st.q.a) o.classList.add("wrong");
    });
    if (st.sel === st.q.a) { correct++; WRONG.delete(st.gi); }
    else WRONG.add(st.gi);           // 答錯（含未作答）記進錯題本
    card.querySelector(".q-explain").classList.add("show");
    // 對完答案才顯示「展開動畫」按鈕；動畫在按下展開時才載入
    if (st._vizToggle) st._vizToggle.style.display = "block";
  });
  saveWrong();
  updateWrongCount();
  const total = quizState.length;
  const pct = total ? Math.round(correct / total * 100) : 0;
  document.getElementById("quiz-score").textContent = `得分：${correct} / ${total}（${pct}%）`;
}

/* ================= 程式判題 ================= */
let currentProblem = null;
const codeKey = p => "apcs.code." + p.id;
function saveCode() {
  if (currentProblem) {
    localStorage.setItem(codeKey(currentProblem), document.getElementById("code-editor").value);
    SM.codeMeta[currentProblem.id] = Date.now(); saveSM();
    syncTouch();
  }
}
function updateGutter() {
  const ta = document.getElementById("code-editor"), g = document.getElementById("code-gutter");
  if (!ta || !g) return;
  const n = ta.value.split("\n").length;
  let h = ""; for (let i = 1; i <= n; i++) h += i + "\n";
  g.textContent = h;
  g.scrollTop = ta.scrollTop;
}
function syncEditorScroll() {
  const ta = document.getElementById("code-editor"), hl = document.querySelector(".editor-hl"), g = document.getElementById("code-gutter");
  if (ta && hl) { hl.scrollTop = ta.scrollTop; hl.scrollLeft = ta.scrollLeft; }
  if (ta && g) g.scrollTop = ta.scrollTop;
}
// 把 textarea 內容同步到底下的語法上色層（VS Code Dark+）
function highlightEditor() {
  const ta = document.getElementById("code-editor"), code = document.getElementById("code-hl");
  if (!ta || !code) return;
  code.textContent = ta.value + "\n";           // 補一個換行，最後一行才顯示
  if (window.hljs) { code.removeAttribute("data-highlighted"); code.className = "language-python"; try { hljs.highlightElement(code); } catch (e) {} }
  updateGutter();
  syncEditorScroll();
}
// 編輯器按鍵：Tab 四格、括號自動補齊、自動縮排
function onEditorKey(e, ed) {
  const s = ed.selectionStart, en = ed.selectionEnd, v = ed.value;
  const pair = { "(": ")", "[": "]", "{": "}" }, closers = ")]}";
  const apply = (nv, caret) => { ed.value = nv; ed.selectionStart = ed.selectionEnd = caret; saveCode(); highlightEditor(); };
  if (e.key === "Tab") { e.preventDefault(); apply(v.slice(0, s) + "    " + v.slice(en), s + 4); return; }
  if (s !== en) return;                                   // 有選取時用預設行為
  if (pair[e.key]) { e.preventDefault(); apply(v.slice(0, s) + e.key + pair[e.key] + v.slice(s), s + 1); return; }
  if (closers.includes(e.key) && v[s] === e.key) { e.preventDefault(); ed.selectionStart = ed.selectionEnd = s + 1; return; } // 跳過已補的右括號
  if (e.key === '"') { e.preventDefault(); if (v[s] === '"') ed.selectionStart = ed.selectionEnd = s + 1; else apply(v.slice(0, s) + '""' + v.slice(s), s + 1); return; }
  if (e.key === "Backspace" && pair[v[s - 1]] && v[s] === pair[v[s - 1]]) { e.preventDefault(); apply(v.slice(0, s - 1) + v.slice(s + 1), s - 1); return; } // 刪空的成對括號
  if (e.key === "Enter") {
    const ls = v.lastIndexOf("\n", s - 1) + 1;
    const indent = (v.slice(ls, s).match(/^[ \t]*/) || [""])[0];
    if (v[s - 1] === "{" && v[s] === "}") { e.preventDefault(); apply(v.slice(0, s) + "\n" + indent + "    \n" + indent + v.slice(s), s + 1 + indent.length + 4); return; }
    if (indent) { e.preventDefault(); apply(v.slice(0, s) + "\n" + indent + v.slice(s), s + 1 + indent.length); return; }
  }
}
function initJudge() {
  const sel = document.getElementById("problem-select");
  PROBLEMS.forEach((p, i) => { const o = document.createElement("option"); o.value = i; o.textContent = p.title; sel.appendChild(o); });
  sel.addEventListener("change", () => { selectProblem(+sel.value); SM.judgeT = Date.now(); saveSM(); syncTouch(); });
  let last = +(localStorage.getItem("apcs.judge.last") || 0);
  if (!(last >= 0 && last < PROBLEMS.length)) last = 0;
  sel.value = last;
  selectProblem(last);
  document.getElementById("btn-run").addEventListener("click", onRun);
  document.getElementById("btn-judge").addEventListener("click", onJudge);
  document.getElementById("btn-reset").addEventListener("click", () => {
    if (currentProblem) { document.getElementById("code-editor").value = STUB; saveCode(); highlightEditor(); }
  });
  document.getElementById("file-upload").addEventListener("change", onUpload);
  const ed = document.getElementById("code-editor");
  ed.addEventListener("input", () => { saveCode(); highlightEditor(); });   // 邊打邊存＋即時上色
  ed.addEventListener("scroll", syncEditorScroll);
  ed.addEventListener("keydown", e => onEditorKey(e, ed));
}
function selectProblem(i) {
  currentProblem = PROBLEMS[i];
  localStorage.setItem("apcs.judge.last", i);
  document.getElementById("problem-statement").innerHTML = currentProblem.statement +
    `<h3>測資組數</h3><p>此題共 ${currentProblem.tests.length} 組測資，全過才算 AC。</p>`;
  const saved = localStorage.getItem(codeKey(currentProblem));
  document.getElementById("code-editor").value = (saved != null && saved !== "") ? saved : STUB;
  highlightEditor();
  document.getElementById("run-output").textContent = "按「執行」或「判題」看結果。";
}
function onUpload(e) {
  const f = e.target.files[0]; if (!f) return;
  const reader = new FileReader();
  reader.onload = ev => { document.getElementById("code-editor").value = ev.target.result; saveCode(); highlightEditor(); };
  reader.readAsText(f); e.target.value = "";
}
function norm(s) {
  return (s || "").replace(/\r\n/g, "\n").split("\n").map(l => l.replace(/[ \t]+$/, "")).join("\n").replace(/\n+$/, "");
}
/* ---------- Pyodide：在瀏覽器裡跑 Python ---------- */
let pyodideReady = null;          // Promise，確保只載入一次
function loadPy(onProgress) {
  if (pyodideReady) return pyodideReady;
  if (typeof loadPyodide !== "function") {
    return Promise.reject(new Error("Python 執行環境沒載入成功（可能是離線或被擋）"));
  }
  if (onProgress) onProgress("第一次使用要下載 Python 執行環境（約 10MB），請稍候…");
  pyodideReady = loadPyodide({ indexURL: PYODIDE_URL }).catch(e => {
    pyodideReady = null;          // 失敗就清掉，下次還能重試
    throw e;
  });
  return pyodideReady;
}
/* 跑一份 Python 程式碼，把 stdin 當成輸入、收集 stdout / stderr。
   做法：把 input() 換成從預先切好的行陣列依序取值，print 的輸出收進 list。
   TIME_LIMIT 用「執行行數上限」模擬，避免無窮迴圈把分頁卡死。 */
const PY_HARNESS = `
import sys, io, builtins

def __apcs_run(src, stdin_text, line_budget):
    lines = stdin_text.split("\\n")
    if lines and lines[-1] == "":
        lines.pop()
    pos = [0]
    def _input(prompt=""):
        if pos[0] >= len(lines):
            raise EOFError("EOF when reading a line")
        s = lines[pos[0]]
        pos[0] += 1
        return s
    out = io.StringIO()
    err = io.StringIO()
    steps = [0]
    def _trace(frame, event, arg):
        steps[0] += 1
        if steps[0] > line_budget:
            raise TimeoutError("__APCS_TLE__")
        return _trace
    g = {"__name__": "__main__", "input": _input}
    old_in, old_out, old_err = builtins.input, sys.stdout, sys.stderr
    sys.stdout, sys.stderr = out, err
    builtins.input = _input
    verdict = "OK"
    try:
        sys.settrace(_trace)
        exec(compile(src, "<你的程式>", "exec"), g)
    except TimeoutError:
        verdict = "TLE"
    except SyntaxError as e:
        verdict = "SYNTAX"
        err.write("第 %s 行：%s\\n%s" % (e.lineno, e.msg, (e.text or "").rstrip()))
    except EOFError:
        verdict = "EOF"
        err.write("程式想再讀一筆輸入，但輸入已經沒有資料了（檢查是不是多讀了一次 input()）")
    except BaseException:
        import traceback
        verdict = "RE"
        tb = traceback.format_exc()
        # 只留使用者程式那段，砍掉這個 harness 的雜訊
        keep = [ln for ln in tb.split("\\n") if "__apcs_run" not in ln and "harness" not in ln]
        err.write("\\n".join(keep).strip())
    finally:
        sys.settrace(None)
        sys.stdout, sys.stderr = old_out, old_err
        builtins.input = old_in
    return [verdict, out.getvalue(), err.getvalue()]
`;
const LINE_BUDGET = 8000000;      // 約可跑幾百萬行，正常解法綽綽有餘，無窮迴圈才會撞到
async function runPython(code, stdin, onProgress) {
  const py = await loadPy(onProgress);
  if (!py.__apcsReady) { py.runPython(PY_HARNESS); py.__apcsReady = true; }
  const fn = py.globals.get("__apcs_run");
  let res;
  try {
    res = fn(code, stdin || "", LINE_BUDGET);
  } finally { fn.destroy && fn.destroy(); }
  const arr = res.toJs ? res.toJs() : res;
  if (res.destroy) res.destroy();
  const [verdict, stdout, stderr] = arr;
  return { verdict, stdout, stderr };
}
function setBusy(b) { document.getElementById("btn-run").disabled = b; document.getElementById("btn-judge").disabled = b; }
/* 執行時發生的各種狀況，轉成看得懂的說明 */
const VERDICT_MSG = {
  SYNTAX: ["v-ce", "warn", "語法錯誤", "Python 連跑都跑不起來。看下面指出的行號，最常見是少了冒號、縮排不一致、括號沒關。"],
  TLE: ["v-re", "clock", "執行逾時 (TLE)", "程式跑太久了，通常是無窮迴圈：while 忘了讓條件變化，或遞迴沒有終止條件。"],
  EOF: ["v-re", "warn", "輸入不夠讀 (EOF)", "程式呼叫 input() 的次數比實際輸入的行數多。檢查讀取次數對不對。"],
  RE: ["v-re", "x", "執行時錯誤 (RE)", "程式中途炸掉了，下面是 Python 的錯誤訊息。"],
};
function offlineHint(msg) {
  return `<span class="verdict v-re">${ICON("x")}無法執行：${escapeHtml(String(msg))}</span>\n\n` +
    `Python 執行環境要從網路下載一次（之後會被瀏覽器快取）。請確認有網路連線，或稍後再試。\n` +
    `若你用的是 App 內建瀏覽器，可能不支援 WebAssembly，請改用 Safari 或 Chrome 開啟。`;
}
async function onRun() {
  const code = document.getElementById("code-editor").value;
  const stdin = document.getElementById("stdin-box").value;
  const out = document.getElementById("run-output");
  out.textContent = "執行中…";
  setBusy(true);
  try {
    const r = await runPython(code, stdin, msg => { out.textContent = msg; });
    if (r.verdict !== "OK") {
      const [cls, ic, title, hint] = VERDICT_MSG[r.verdict] || VERDICT_MSG.RE;
      out.innerHTML = `<span class="verdict ${cls}">${ICON(ic)}${title}</span>\n${hint}\n\n` +
        escapeHtml(r.stderr || "") +
        (r.stdout ? "\n\n── 中斷前已印出的內容 ──\n" + escapeHtml(r.stdout) : "");
    } else {
      out.innerHTML = "── 標準輸出 ──\n" + escapeHtml(r.stdout || "(空)") +
        (r.stderr ? "\n\n── 標準錯誤 ──\n" + escapeHtml(r.stderr) : "");
    }
  } catch (e) {
    out.innerHTML = offlineHint(e.message);
  } finally { setBusy(false); }
}
async function onJudge() {
  const code = document.getElementById("code-editor").value;
  const out = document.getElementById("run-output");
  const tests = currentProblem.tests;
  setBusy(true);
  out.innerHTML = "判題中…";
  try {
    let passed = 0, lines = [];
    for (let i = 0; i < tests.length; i++) {
      out.innerHTML = `判題中… (${i + 1}/${tests.length})`;
      const r = await runPython(code, tests[i].in, msg => { out.textContent = msg; });
      if (r.verdict === "SYNTAX") {
        const [cls, ic, title, hint] = VERDICT_MSG.SYNTAX;
        out.innerHTML = `<span class="verdict ${cls}">${ICON(ic)}${title}</span>\n${hint}\n\n` + escapeHtml(r.stderr || "");
        setBusy(false); return;
      }
      let verdict, cls;
      if (r.verdict === "TLE") { verdict = "TLE"; cls = "case-fail"; }
      else if (r.verdict === "EOF" || r.verdict === "RE") { verdict = "RE"; cls = "case-fail"; }
      else if (norm(r.stdout) === norm(tests[i].out)) { verdict = "AC"; cls = "case-pass"; passed++; }
      else { verdict = "WA"; cls = "case-fail"; }
      let detail = "";
      if (verdict !== "AC") {
        detail = `\n  輸入：${escapeHtml(oneLine(tests[i].in))}` +
                 `\n  期望：${escapeHtml(oneLine(tests[i].out))}` +
                 `\n  你的：${escapeHtml(oneLine(r.stdout || r.stderr || ""))}`;
      }
      lines.push(`<div class="case-line ${cls}">測資 #${i + 1}：${verdict}${detail}</div>`);
    }
    const allAC = passed === tests.length;
    const banner = allAC
      ? `<span class="verdict v-ac">${ICON("check")}AC　通過 ${passed}/${tests.length} 組</span>`
      : `<span class="verdict v-wa">${ICON("x")}未全過　通過 ${passed}/${tests.length} 組</span>`;
    out.innerHTML = banner + "\n\n" + lines.join("");
  } catch (e) {
    out.innerHTML = offlineHint(e.message);
  } finally { setBusy(false); }
}
function oneLine(s) { s = (s || "").replace(/\n/g, "⏎"); return s.length > 80 ? s.slice(0, 80) + "…" : s; }

/* ================= 動畫圖解分頁 ================= */
function initViz() {
  const sel = document.getElementById("viz-select");
  const host = document.getElementById("viz-host");
  if (!sel || !host || !window.VIZ) return;
  // 動畫名稱前綴就是所屬範圍，例如「初級 迴圈與複雜度」
  const order = ["初級", "中級", "進階延伸"], groups = {};
  VIZ.NAMES.forEach(([key, name]) => {
    const g = order.find(o => name.startsWith(o)) || "其他";
    (groups[g] = groups[g] || []).push([key, name]);
  });
  [...order, "其他"].forEach(g => {
    if (!groups[g]) return;
    const og = document.createElement("optgroup"); og.label = g;
    groups[g].forEach(([key, name]) => {
      const o = document.createElement("option"); o.value = key;
      o.textContent = name.replace(/^(初級|中級|進階延伸)\s+/, "");
      og.appendChild(o);
    });
    sel.appendChild(og);
  });
  sel.onchange = () => VIZ.mount(sel.value, host);
  VIZ.mount(VIZ.NAMES[0][0], host);
}

/* ================= 考前速查 · 我的筆記 ================= */
function initCheat() {
  const chips = document.getElementById("cheat-chips");
  const body = document.getElementById("cheat-body");
  if (!chips || !body || typeof CHEAT === "undefined") return;

  chips.innerHTML = CHEAT.map(g => `<button class="cheat-chip" data-go="cg-${g.id}">${g.name}</button>`).join("");
  body.innerHTML = CHEAT.map(g => `
    <div class="cheat-group" id="cg-${g.id}">
      <div class="cheat-gtitle">${g.name}</div>
      ${g.items.map(it => it.c
    ? `<div class="cheat-item">
             <div class="cheat-itop"><span class="cheat-t">${escapeHtml(it.t)}</span>
               <button class="cheat-copy" title="複製">${ICON("code", 14)}<span>複製</span></button></div>
             <pre class="cheat-code"><code class="language-python">${escapeHtml(it.c)}</code></pre>
           </div>`
    : `<div class="cheat-item tip">${ICON("warn", 15)}<div><span class="cheat-t">${escapeHtml(it.t)}</span><p>${escapeHtml(it.d)}</p></div></div>`
  ).join("")}
    </div>`).join("");

  body.querySelectorAll("pre.cheat-code code").forEach(c => { if (window.hljs) try { hljs.highlightElement(c); } catch (e) {} });

  chips.querySelectorAll("[data-go]").forEach(b => b.addEventListener("click", () => {
    const el = document.getElementById(b.dataset.go);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }));

  body.querySelectorAll(".cheat-copy").forEach(btn => btn.addEventListener("click", async () => {
    const code = btn.closest(".cheat-item").querySelector("code").textContent;
    const s = btn.querySelector("span"), old = s.textContent;
    try { await navigator.clipboard.writeText(code); } catch (e) { }
    btn.classList.add("copied"); s.textContent = "已複製";
    setTimeout(() => { btn.classList.remove("copied"); s.textContent = old; }, 1200);
  }));

  const addBtn = document.getElementById("note-add-btn");
  const inp = document.getElementById("note-input");
  if (addBtn) addBtn.addEventListener("click", addNote);
  if (inp) inp.addEventListener("keydown", e => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") addNote(); });
  renderNotes();
}

/* 我的筆記（localStorage，最新的加在最上面） */
let NOTES = JSON.parse(localStorage.getItem("apcs.notes") || "[]");
NOTES.forEach(n => { if (n.u == null) n.u = n.id; });   // 舊資料補上更新時間戳（給同步合併用）
function saveNotes() { localStorage.setItem("apcs.notes", JSON.stringify(NOTES)); syncTouch(); }
function addNote() {
  const inp = document.getElementById("note-input");
  const text = (inp.value || "").trim();
  if (!text) return;
  const now = Date.now();
  NOTES.unshift({ id: now, text, u: now });   // 加到最上面
  saveNotes(); inp.value = ""; renderNotes();
}
function deleteNote(id) {
  NOTES = NOTES.filter(n => n.id !== id);
  NOTES_DEL.add(id); saveNotesDel();           // 留墓碑：別台裝置才不會又同步回來
  saveNotes(); renderNotes();
}
function renderNotes() {
  const list = document.getElementById("notes-list");
  if (!list) return;
  if (!NOTES.length) {
    list.innerHTML = `<div class="notes-empty">${ICON("pencil", 22)}<p>還沒有筆記。把自己整理的重點、老是忘記的語法、常踩的坑寫上去，新增後會顯示在這裡（最新的在最上面）。</p></div>`;
    return;
  }
  list.innerHTML = NOTES.map(n => `
    <div class="note-card" data-id="${n.id}">
      <div class="note-text">${escapeHtml(n.text)}</div>
      <div class="note-actions">
        <button class="note-edit" data-id="${n.id}">${ICON("pencil", 14)}<span>編輯</span></button>
        <button class="note-del" data-id="${n.id}">${ICON("x", 14)}<span>刪除</span></button>
      </div>
    </div>`).join("");
  list.querySelectorAll(".note-del").forEach(b => b.addEventListener("click", () => deleteNote(Number(b.dataset.id))));
  list.querySelectorAll(".note-edit").forEach(b => b.addEventListener("click", () => editNote(Number(b.dataset.id))));
}
function editNote(id) {
  const n = NOTES.find(x => x.id === id); if (!n) return;
  const card = document.querySelector(`.note-card[data-id="${id}"]`); if (!card) return;
  card.innerHTML = `<textarea class="note-edit-area"></textarea>
    <div class="note-actions">
      <button class="note-save btn primary">${ICON("check", 14)}<span>儲存</span></button>
      <button class="note-cancel btn">取消</button>
    </div>`;
  const ta = card.querySelector(".note-edit-area");
  ta.value = n.text; ta.focus();
  card.querySelector(".note-save").addEventListener("click", () => {
    const v = ta.value.trim(); if (v) { n.text = v; n.u = Date.now(); saveNotes(); } renderNotes();
  });
  card.querySelector(".note-cancel").addEventListener("click", renderNotes);
}

/* ================= 跨裝置同步：接上本站狀態 ================= */
// 把本機所有要同步的東西打包成一份 blob
function syncCollect() {
  const code = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.indexOf("apcs.code.") === 0) {
      const id = k.slice(10);                       // "apcs.code." 長度 = 10
      code[id] = { text: localStorage.getItem(k) || "", t: SM.codeMeta[id] || 0 };
    }
  }
  return {
    v: 1,
    done: [...DONE],
    wrong: [...WRONG],
    notes: NOTES.map(n => ({ id: n.id, text: n.text, u: n.u || n.id })),
    notesDel: [...NOTES_DEL],
    code,
    judge: { last: +(localStorage.getItem("apcs.judge.last") || 0), t: SM.judgeT || 0 },
    ts: Date.now(),
  };
}
// 把合併後的 blob 寫回本機＋記憶體＋畫面
function syncApply(m) {
  SYNC_APPLYING = true;
  try {
    DONE.clear(); (m.done || []).forEach(p => DONE.add(p)); saveDone();
    WRONG.clear(); (m.wrong || []).forEach(w => WRONG.add(w)); saveWrong();
    NOTES = (m.notes || []).map(n => ({ id: n.id, text: n.text, u: n.u || n.id }));
    NOTES_DEL = new Set(m.notesDel || []); saveNotesDel(); saveNotes();
    const mc = m.code || {};
    Object.keys(mc).forEach(id => {
      const e = mc[id]; if (!e) return;
      localStorage.setItem("apcs.code." + id, e.text || "");
      SM.codeMeta[id] = e.t || 0;
    });
    if (m.judge && m.judge.last != null) {
      localStorage.setItem("apcs.judge.last", m.judge.last);
      SM.judgeT = m.judge.t || SM.judgeT;
    }
    saveSM();
  } finally { SYNC_APPLYING = false; }

  // 重繪
  refreshDone();
  if (typeof updateWrongCount === "function") updateWrongCount();
  renderNotes();
  // 若目前開著的題目其程式碼被雲端更新，且使用者沒在打字，就重載編輯器
  if (currentProblem) {
    const ed = document.getElementById("code-editor");
    const saved = localStorage.getItem("apcs.code." + currentProblem.id);
    if (ed && saved != null && document.activeElement !== ed && saved !== ed.value) {
      ed.value = saved; if (typeof highlightEditor === "function") highlightEditor();
    }
  }
}
function setSyncStatus(kind) {
  const el = document.getElementById("sync-status");
  if (!el) return;
  const map = {
    idle:    ["sync-idle",    "同步"],
    syncing: ["sync-syncing", "同步中…"],
    ok:      ["sync-ok",      "已同步 ☁"],
    off:     ["sync-off",     "離線・暫存本機"],
    noconf:  ["sync-off",     "未啟用雲端（本機）"],
  };
  const [cls, txt] = map[kind] || map.idle;
  el.className = "notes-hint " + cls;
  el.textContent = txt;
}
async function syncPush() {
  if (typeof SYNC === "undefined") return;
  try {
    setSyncStatus("syncing");
    await SYNC.put(syncCollect());
    setSyncStatus("ok");
  } catch (e) {
    setSyncStatus(e && e.notConfigured ? "noconf" : "off");
  }
}
async function syncPull(silent) {
  if (typeof SYNC === "undefined") return;
  try {
    if (!silent) setSyncStatus("syncing");
    const cloud = await SYNC.get();
    const local = syncCollect();
    const merged = SYNC.merge(cloud, local);
    syncApply(merged);
    // 合併後若和雲端不同（例如首次、或聯集後變多），回推一次讓雲端收斂
    if (!SYNC.equal(merged, cloud)) await SYNC.put(merged);
    SYNC.lastPullAt = Date.now();
    setSyncStatus("ok");
  } catch (e) {
    setSyncStatus(e && e.notConfigured ? "noconf" : "off");
  }
}
function syncInit() {
  if (typeof SYNC === "undefined") return;
  const el = document.getElementById("sync-status");
  if (el) el.addEventListener("click", () => syncPull(false));   // 點狀態列＝立即同步
  syncPull(false);                                               // 開站先拉一次
  // 切回本分頁 / 視窗重新聚焦時，再拉一次抓別台的更新（節流 15 秒）
  const maybePull = () => {
    if (document.visibilityState !== "visible") return;
    if (Date.now() - (SYNC.lastPullAt || 0) < 15000) return;
    syncPull(true);
  };
  window.addEventListener("focus", maybePull);
  document.addEventListener("visibilitychange", maybePull);
}

/* ================= 考試計時器（浮動） ================= */
function initTimer() {
  const el = document.createElement("div");
  el.className = "exam-timer"; el.id = "exam-timer";
  el.innerHTML =
    `<button class="timer-toggle" title="考試計時器（模擬考用）">${ICON("clock", 22)}</button>
     <div class="timer-panel">
       <div class="timer-head">考試計時器</div>
       <div class="timer-display">120:00</div>
       <div class="timer-btns">
         <button class="btn primary timer-start">開始</button>
         <button class="btn timer-reset">歸零</button>
       </div>
       <div class="timer-hint">模擬考用：120 分鐘倒數，計時不中斷</div>
     </div>`;
  document.body.appendChild(el);
  const TOTAL = 120 * 60;
  let remain = TOTAL, timer = null, running = false;
  const disp = el.querySelector(".timer-display");
  const startBtn = el.querySelector(".timer-start");
  const fmt = s => String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
  function draw() { disp.textContent = remain <= 0 ? "時間到！" : fmt(remain); disp.classList.toggle("done", remain <= 0); }
  function stop() { running = false; startBtn.textContent = "開始"; startBtn.classList.add("primary"); if (timer) { clearInterval(timer); timer = null; } }
  function start() { if (running || remain <= 0) return; running = true; startBtn.textContent = "暫停"; startBtn.classList.remove("primary"); timer = setInterval(() => { remain--; draw(); if (remain <= 0) stop(); }, 1000); }
  el.querySelector(".timer-toggle").onclick = () => el.classList.toggle("open");
  startBtn.onclick = () => running ? stop() : start();
  el.querySelector(".timer-reset").onclick = () => { stop(); remain = TOTAL; draw(); };
  draw();
}

/* ================= 啟動 ================= */
buildHome();
buildLessonNav();
initQuiz();
initJudge();
initViz();
initCheat();
initTimer();
syncInit();
