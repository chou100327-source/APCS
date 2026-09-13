/* ================= 跨裝置同步（client 端） =================
   單一使用者：每台裝置讀寫雲端同一份資料（後端見 /api/sync.js）。
   合併策略：
     - 完成度 done / 錯題 wrong：聯集（永遠不弄丟進度）
     - 筆記 notes：以 id 合併，編輯取較新的（u 較大），刪除用墓碑 notesDel
     - 判題程式碼 code、最後選的題目 judge：各取時間戳 t 較新者
   離線或雲端未設定時，一切照常存在本機，只是不上雲。
   （此檔只負責「傳輸 + 純合併」；接到 app 狀態的膠水在 app.js。） */
const SYNC = {
  API: "/api/sync",
  lastPullAt: 0,
  _t: null,

  async get() {
    const r = await fetch(this.API, { method: "GET", headers: { Accept: "application/json" }, cache: "no-store" });
    if (r.status === 503) { const e = new Error("not-configured"); e.notConfigured = true; throw e; }
    if (!r.ok) throw new Error("GET " + r.status);
    const j = await r.json();
    return j && j.data ? j.data : null;
  },

  async put(blob) {
    const r = await fetch(this.API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(blob),
    });
    if (r.status === 503) { const e = new Error("not-configured"); e.notConfigured = true; throw e; }
    if (!r.ok) throw new Error("PUT " + r.status);
    return true;
  },

  // 推送去抖：連續變更只在停手後推一次
  schedulePush(fn, ms) { clearTimeout(this._t); this._t = setTimeout(fn, ms || 1500); },

  // 純合併：a、b 對稱皆可，回傳合併後的 blob
  merge(a, b) {
    a = a || {}; b = b || {};
    const arr = (x) => (Array.isArray(x) ? x : []);
    const obj = (x) => (x && typeof x === "object" ? x : {});

    const done = [...new Set([...arr(a.done), ...arr(b.done)])];
    const wrong = [...new Set([...arr(a.wrong), ...arr(b.wrong)])];
    const notesDel = [...new Set([...arr(a.notesDel), ...arr(b.notesDel)])];
    const delSet = new Set(notesDel);

    // 筆記：同 id 取 u 較大者，最後濾掉已刪除、依 id（建立時間）新到舊排序
    const byId = new Map();
    [...arr(a.notes), ...arr(b.notes)].forEach((n) => {
      if (!n || n.id == null) return;
      const u = n.u || n.id;
      const prev = byId.get(n.id);
      if (!prev || u >= (prev.u || prev.id)) byId.set(n.id, { id: n.id, text: n.text, u });
    });
    const notes = [...byId.values()].filter((n) => !delSet.has(n.id)).sort((x, y) => y.id - x.id);

    // 程式碼：每題取 t 較大者
    const code = {};
    const ca = obj(a.code), cb = obj(b.code);
    new Set([...Object.keys(ca), ...Object.keys(cb)]).forEach((id) => {
      const ea = ca[id], eb = cb[id];
      if (ea && eb) code[id] = (ea.t || 0) >= (eb.t || 0) ? ea : eb;
      else code[id] = ea || eb;
    });

    // 最後選的題目：t 較大者
    const ja = obj(a.judge), jb = obj(b.judge);
    const judge = (ja.t || 0) >= (jb.t || 0) ? ja : jb;

    return { v: 1, done, wrong, notes, notesDel, code, judge, ts: Date.now() };
  },

  // 忽略 ts 比對兩份 blob 是否實質相同（決定要不要回推雲端）
  equal(a, b) {
    const pick = (x) => {
      x = x || {};
      return JSON.stringify({
        done: [...(x.done || [])].sort(),
        wrong: [...(x.wrong || [])].sort(),
        notes: (x.notes || []).map((n) => [n.id, n.text, n.u || n.id]).sort((p, q) => p[0] - q[0]),
        notesDel: [...(x.notesDel || [])].sort(),
        code: Object.keys(x.code || {}).sort().map((k) => [k, (x.code[k] || {}).text, (x.code[k] || {}).t]),
        judge: [(x.judge || {}).last, (x.judge || {}).t],
      });
    };
    return pick(a) === pick(b);
  },
};
