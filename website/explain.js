/* ================= 逐行走讀：把一行 Python 拆開講清楚 =================
   EXPLAIN.line(lines, i) → { sum, points[], ctx }
     sum    一句話總結這行在做什麼
     points 拆開說明每個部分（HTML，程式碼片段已跳脫）
     ctx    這行屬於哪個迴圈／條件／函式底下
   只做靜態說明，不會真的執行程式。看不懂的寫法會退回比較一般的說明。 */
(function () {
  const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const c = s => `<code>${esc(s)}</code>`;
  const indentOf = l => (l.match(/^[ \t]*/) || [""])[0].replace(/\t/g, "    ").length;

  /* ---------- 基本拆解工具 ---------- */
  // 拆掉行尾註解（字串裡的 # 不算）
  function splitComment(raw) {
    let q = null;
    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      if (q) { if (ch === "\\") { i++; continue; } if (ch === q) q = null; }
      else if (ch === '"' || ch === "'") q = ch;
      else if (ch === "#") return [raw.slice(0, i).trimEnd(), raw.slice(i + 1).trim()];
    }
    return [raw.trimEnd(), ""];
  }
  // 把字串內容換成空白，用來偵測運算子時不會被字串裡的符號騙到
  function blankStrings(s) {
    let out = "", q = null;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (q) { if (ch === "\\") { out += "  "; i++; continue; } if (ch === q) { q = null; out += ch; } else out += " "; }
      else { if (ch === '"' || ch === "'") q = ch; out += ch; }
    }
    return out;
  }
  // 以最外層的分隔符切開（括號、字串裡的不算）
  function splitTop(s, sep = ",") {
    const out = []; let d = 0, q = null, cur = "";
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (q) { cur += ch; if (ch === "\\") { cur += s[++i] || ""; continue; } if (ch === q) q = null; continue; }
      if (ch === '"' || ch === "'") { q = ch; cur += ch; continue; }
      if ("([{".includes(ch)) d++;
      else if (")]}".includes(ch)) d--;
      if (d === 0 && s.startsWith(sep, i)) { out.push(cur.trim()); cur = ""; i += sep.length - 1; }
      else cur += ch;
    }
    if (cur.trim() !== "" || out.length) out.push(cur.trim());
    return out.filter((x, k) => x !== "" || k < out.length - 1);
  }
  // 最外層有沒有某個「=」指定（排除 == != <= >= 以及括號內的關鍵字參數）
  function topAssign(s) {
    let d = 0, q = null;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (q) { if (ch === "\\") { i++; continue; } if (ch === q) q = null; continue; }
      if (ch === '"' || ch === "'") { q = ch; continue; }
      if ("([{".includes(ch)) d++;
      else if (")]}".includes(ch)) d--;
      else if (ch === "=" && d === 0) {
        const prev = s[i - 1] || "", next = s[i + 1] || "";
        if (next === "=" || "=!<>".includes(prev)) { if (next === "=") i++; continue; }
        return i;
      }
    }
    return -1;
  }
  // 整段是不是被一對括號完整包住：name(...)
  function callParts(s) {
    const m = s.match(/^([A-Za-z_][\w.]*)\s*\(/);
    if (!m) return null;
    let d = 0, q = null;
    for (let i = m[0].length - 1; i < s.length; i++) {
      const ch = s[i];
      if (q) { if (ch === "\\") { i++; continue; } if (ch === q) q = null; continue; }
      if (ch === '"' || ch === "'") { q = ch; continue; }
      if (ch === "(") d++;
      else if (ch === ")") { d--; if (d === 0) return i === s.length - 1 ? { name: m[1], inner: s.slice(m[0].length, i) } : null; }
    }
    return null;
  }
  const isNum = s => /^-?\d+$/.test((s || "").trim());
  const isStrLit = s => /^[rbuf]*("[^"]*"|'[^']*')$/i.test((s || "").trim());
  const strVal = s => s.trim().replace(/^[rbuf]*/i, "").slice(1, -1);
  function showStr(v) {
    if (v === "") return "空字串（什麼都不放）";
    if (v === " ") return "一個空白";
    if (v === "\\n") return "換行";
    return c(v.replace(/\\n/g, "↵"));
  }
  function list(arr, n = 6) {
    return arr.length <= n ? arr.join("、") : arr.slice(0, n).join("、") + "、…、" + arr[arr.length - 1];
  }

  /* ---------- 運算子與常用函式的小字典 ---------- */
  // 依序偵測，找到就加一條說明（同一條只加一次）
  const NOTES = [
    [/\binput\s*\(/, "input()：從輸入讀進一整行，拿到的<b>一定是字串</b>。"],
    [/\bint\s*\(/, "int(…)：轉成整數。字串要是純數字才行；小數則是往 0 的方向捨去（int(7.9) 是 7），不是四捨五入。"],
    [/\bfloat\s*\(/, "float(…)：轉成小數（浮點數）。"],
    [/\bstr\s*\(/, "str(…)：轉成字串，之後就能跟其他文字接在一起。"],
    [/\blen\s*\(/, "len(…)：算有幾個元素；字串就是有幾個字元。"],
    [/\bsum\s*\(/, "sum(…)：把裡面所有數字加總。"],
    [/\bmax\s*\(/, "max(…)：取最大的那個。"],
    [/\bmin\s*\(/, "min(…)：取最小的那個。"],
    [/\babs\s*\(/, "abs(…)：取絕對值（負的變正的）。"],
    [/\bround\s*\(/, "round(…)：四捨五入，但剛好 .5 時會捨到最近的<b>偶數</b>（round(2.5) 是 2）。"],
    [/\bsorted\s*\(/, "sorted(…)：產生一份排好序（由小到大）的<b>新</b>串列，原本的不會被改到。"],
    [/\bord\s*\(/, "ord(字元)：查出字元的編碼數字。要記：'A' 是 65、'a' 是 97、'0' 是 48。"],
    [/\bchr\s*\(/, "chr(數字)：把編碼數字換回字元，例如 chr(65) 是 'A'。"],
    [/\bbin\s*\(/, "bin(…)：轉成二進位的字串，前面會帶 0b，例如 bin(13) 是 '0b1101'。"],
    [/\bdivmod\s*\(/, "divmod(a, b)：一次拿到「商」和「餘數」兩個值。"],
    [/\bmap\s*\(/, "map(函式, 一串東西)：把函式套用到每一個元素上，例如 map(int, …) 就是每個都轉成整數。"],
    [/\benumerate\s*\(/, "enumerate(…)：走訪時同時拿到「第幾個（索引）」和「那個元素」。"],
    [/\ball\s*\(/, "all(…)：裡面的條件<b>全部</b>成立才是 True。"],
    [/\bany\s*\(/, "any(…)：裡面的條件<b>只要有一個</b>成立就是 True。"],
    [/\bbool\s*\(/, "bool(…)：判斷真假。空的（空字串、空串列）、0、None 是 False，其他都是 True。"],
    [/\btype\s*\(/, "type(…)：查出這個值是什麼型態（int、float、str…）。"],
    [/\.split\s*\(\s*\)/, ".split()：依空白把字串切成好幾段，結果是一個串列，例如 \"3 5 7\" → [\"3\", \"5\", \"7\"]。"],
    [/\.split\s*\(\s*\S/, ".split(分隔字)：依指定的字把字串切開，結果是一個串列。"],
    [/\.join\s*\(/, "\"分隔字\".join(串列)：把串列裡的字串用分隔字接成一個字串（元素必須都是字串）。"],
    [/\.strip\s*\(/, ".strip()：去掉頭尾的空白和換行。"],
    [/\.upper\s*\(/, ".upper()：轉成大寫。"],
    [/\.lower\s*\(/, ".lower()：轉成小寫。"],
    [/\.replace\s*\(/, ".replace(舊, 新)：把字串裡的「舊」全部換成「新」，產生新的字串。"],
    [/\.find\s*\(/, ".find(x)：找 x 第一次出現的位置（索引），找不到回傳 -1。"],
    [/\.count\s*\(/, ".count(x)：數 x 出現了幾次。"],
    [/\.isdigit\s*\(/, ".isdigit()：是不是全部都是數字字元。"],
    [/\.isalpha\s*\(/, ".isalpha()：是不是英文字母。"],
    [/\.isalnum\s*\(/, ".isalnum()：是不是字母或數字。"],
    [/\.isupper\s*\(/, ".isupper()：是不是大寫字母。"],
    [/\.islower\s*\(/, ".islower()：是不是小寫字母。"],
    [/\.isspace\s*\(/, ".isspace()：是不是空白字元。"],
    [/\.get\s*\(/, "字典.get(key, 預設值)：有這個 key 就拿它的值，沒有就用預設值，不會噴錯。"],
    [/\.pop\s*\(\s*\)/, ".pop()：拿走串列<b>最後一個</b>元素，並把它回傳出來。"],
    [/\.pop\s*\(\s*\S/, ".pop(i)：拿走索引 i 的元素，並把它回傳出來。"],
    [/\.popleft\s*\(/, ".popleft()：拿走佇列<b>最前面</b>的元素（先進先出）。"],
    [/\[\s*::\s*-1\s*\]/, "[::-1]：從最後面往前取，整個反過來（反轉）。"],
    [/\[[^\]]*:[^\]]*\]/, "[開始:結束]：切片，取出一段。<b>含頭不含尾</b>，例如 a[2:5] 是索引 2、3、4。"],
    [/\[\s*-1\s*\]/, "[-1]：負的索引是從後面數，-1 就是最後一個。"],
    [/\/\//, "//：整數除法，結果<b>往下取整</b>。7 // 2 = 3，-7 // 2 = -4（往負的方向）。"],
    [/(^|[^/])\/(?!\/)/, "/：一般除法，結果<b>一定是小數</b>，就算整除也是（6 / 2 = 3.0）。"],
    [/\*\*/, "**：次方，例如 2 ** 10 = 1024。連著寫時由右往左算。"],
    [/%/, "%：取餘數，例如 7 % 2 = 1。常用來判斷整除（% 2 == 0 是偶數）、取最後一位數（% 10）、或讓字母繞回（% 26）。"],
    [/==/, "==：比較兩邊是否相等（一個 = 是「存進去」，兩個 == 才是「比較」）。"],
    [/!=/, "!=：比較兩邊是否<b>不</b>相等。"],
    [/\band\b/, "and：兩邊<b>都</b>成立才算成立；左邊不成立就不會再看右邊（短路）。"],
    [/\bor\b/, "or：<b>有一邊</b>成立就算成立；左邊成立就不會再看右邊（短路）。"],
    [/\bnot\b(?!\s+in\b)/, "not：把真假反過來。"],
    [/\bnot\s+in\b/, "not in：檢查左邊的東西<b>沒有</b>出現在右邊。"],
    [/\bin\b/, "in：檢查左邊的東西有沒有出現在右邊（串列裡有沒有這個值、字串裡有沒有這個字）。"],
    [/<<(?!=)/, "<<：左移，a << n 等於 a 乘以 2 的 n 次方；1 << k 就是「只有第 k 位是 1」的數，常拿來當開關遮罩。"],
    [/>>(?!=)/, ">>：右移，a >> n 等於 a 除以 2 的 n 次方再捨去小數。"],
    [/(^|[^&])&(?!&)/, "&（位元 AND）：把兩個數寫成二進位對齊，兩位都是 1 才得 1。"],
    [/\|/, "|（位元 OR）：二進位逐位比，任一位是 1 就得 1。"],
    [/\^/, "^（XOR）：二進位逐位比，兩位<b>不同</b>才得 1。注意 Python 的 ^ 不是次方！"],
    [/~/, "~：每一位都反轉，結果等於 -x-1。"],
    [/\bif\b.*\belse\b/, "A if 條件 else B：三元運算式，條件成立取 A，不成立取 B。"],
    [/\bNone\b/, "None：代表「沒有值」。"],
  ];
  function exprNotes(expr, skip) {
    const code = blankStrings(expr), out = [];
    for (const [re, txt] of NOTES) {
      if (skip && skip.includes(txt.split("：")[0])) continue;
      if (re.test(code)) out.push(txt);
      if (out.length >= 5) break;
    }
    return out;
  }
  // 條件式的額外說明
  function condNotes(cond) {
    const out = [], code = blankStrings(cond).trim();
    const chain = code.match(/^(\S+)\s*(<=?|>=?)\s*(\S+)\s*(<=?|>=?)\s*(\S+)$/);
    if (chain) out.push(`連鎖比較：${c(cond)} 等同於 ${c(chain[1] + " " + chain[2] + " " + chain[3] + " and " + chain[3] + " " + chain[4] + " " + chain[5])}，兩個都要成立。`);
    const bounds = [...code.matchAll(/0\s*<=\s*(\w+)\s*<\s*([\w()\[\]]+)/g)];
    if (bounds.length) {
      out.push(`<b>邊界檢查</b>：${bounds.map(b => c(`0 <= ${b[1]} < ${b[2]}`) + " 是說 " + c(b[1]) + " 要在 0 到 " + c(b[2]) + "-1 之間").join("；")}。`);
      out.push("一定要先檢查才能存取。Python 的負索引不會報錯，會默默抓到「從後面數」的格子，答案就錯了還很難發現。");
    }
    const mod2 = code.match(/^(.+?)\s*%\s*2\s*==\s*0$/);
    if (mod2) out.push(`${c(cond)} 是在問「除以 2 餘數是 0 嗎」，也就是：是不是<b>偶數</b>。`);
    if (/^\(?\s*\w+\s*&\s*1\s*\)?\s*(==\s*[01])?$/.test(code)) out.push("n & 1 取出二進位的最後一位：1 代表奇數、0 代表偶數。");
    if (/^(not\s+)?[A-Za-z_]\w*$/.test(code)) {
      out.push(`直接把變數當條件：空串列、空字串、0、None 都算<b>不成立</b>，裡面有東西就算<b>成立</b>。${/^not/.test(code) ? "前面加 not 就是反過來：「是空的」才成立。" : ""}`);
    }
    return out.concat(exprNotes(cond));
  }

  /* ---------- f-string ---------- */
  function specText(spec) {
    let m;
    if ((m = spec.match(/^(\d*)\.(\d+)f$/))) return (m[1] ? `佔 ${m[1]} 格寬、` : "") + `取到小數點後 ${m[2]} 位（會四捨五入）`;
    if ((m = spec.match(/^0(\d+)d$/))) return `整數補零到 ${m[1]} 位（例如 7 → ${"0".repeat(Math.max(0, m[1] - 1))}7）`;
    if ((m = spec.match(/^(\d+)d$/))) return `整數至少佔 ${m[1]} 格寬，不夠就在左邊補空白`;
    if ((m = spec.match(/^([<>^])(\d+)$/))) return `佔 ${m[2]} 格寬，${{ "<": "靠左", ">": "靠右", "^": "置中" }[m[1]]}`;
    if (spec === "d") return "當整數顯示";
    if (spec === ",") return "每三位數加一個逗號";
    return `照格式 ${c(spec)} 排版`;
  }
  function explainFString(lit) {
    const body = strVal(lit), out = [];
    const holes = [...body.matchAll(/\{([^{}]+)\}/g)].map(m => m[1]);
    out.push(`${c(lit.length > 40 ? lit.slice(0, 38) + "…" : lit)} 是 <b>f-string（格式化字串）</b>：大括號 ${c("{ }")} 裡面的東西會先算出來，再塞進文字裡。`);
    holes.slice(0, 4).forEach(h => {
      const k = h.lastIndexOf(":");
      if (k > 0 && !/[\[(]/.test(h.slice(k))) {
        out.push(`${c("{" + h + "}")}：放入 ${c(h.slice(0, k))} 的值，冒號後的 ${c(h.slice(k + 1))} 表示${specText(h.slice(k + 1))}。`);
      } else if (/[+\-*/%]/.test(h)) {
        out.push(`${c("{" + h + "}")}：大括號裡可以放運算式，先算出 ${c(h)} 的結果再放進來。`);
      } else {
        out.push(`${c("{" + h + "}")}：放入變數 ${c(h)} 的值。`);
      }
    });
    return out;
  }

  /* ---------- 讀輸入的固定寫法 ---------- */
  function explainInput(lhs, rhs) {
    const r = rhs.replace(/\s+/g, "");
    const targets = splitTop(lhs);
    if (/^\[list\(map\(int,input\(\)\.split\(\)\)\)for_inrange\((.+)\)\]$/.test(r)) {
      const n = r.match(/range\((.+)\)\]$/)[1];
      return { sum: `讀 ${esc(n)} 行、每行好幾個整數，存成一個<b>二維串列</b> ${c(lhs)}`, points: [
        `外面的 ${c("[… for _ in range(" + n + ")]")} 會重複 ${esc(n)} 次，每次讀一行。`,
        `每一行都用 ${c("list(map(int, input().split()))")}：切開、轉整數、裝成串列。`,
        `結果像 ${c("[[1, 2, 3], [4, 5, 6], [7, 8, 9]]")}：${c(lhs + "[i][j]")} 就是第 i 列第 j 個數。`,
        "這個寫法在中級實作題幾乎每題都會用到，建議直接背下來。"] };
    }
    if (/^list\(map\(int,input\(\)\.split\(\)\)\)$/.test(r)) {
      return { sum: `讀一行整數，全部裝進串列 ${c(lhs)}`, points: [
        "① input() 讀進一整行，例如 \"3 5 7\"（這時還是字串）。",
        "② .split() 依空白切開 → [\"3\", \"5\", \"7\"]。",
        "③ map(int, …) 把每一段都轉成整數。",
        `④ list(…) 裝成串列 → ${c("[3, 5, 7]")}。不管一行有幾個數都能用。`] };
    }
    if (/^map\(int,input\(\)\.split\(\)\)$/.test(r)) {
      const eg = [3, 5, 7, 2, 8].slice(0, targets.length);
      return { sum: `讀一行、用空白切開、每段轉成整數，再依序放進 ${targets.map(t => c(t)).join("、")}`, points: [
        `① input() 讀進一整行，例如 "${eg.join(" ")}"（這時還是字串）。`,
        `② .split() 依空白切開 → [${eg.map(x => '"' + x + '"').join(", ")}]。`,
        "③ map(int, …) 把每一段都用 int() 轉成整數。",
        `④ 左邊有 ${targets.length} 個變數，就依序拿到：${targets.map((t, k) => esc(t) + " = " + eg[k]).join("、")}。<b>左右數量要一樣多</b>，不然會出錯。`] };
    }
    if (/^map\(float,input\(\)\.split\(\)\)$/.test(r)) {
      return { sum: `讀一行、切開、每段轉成小數，依序放進 ${targets.map(t => c(t)).join("、")}`, points: [
        "跟 map(int, …) 一樣的步驟，只是改用 float() 轉成小數。"] };
    }
    if (/^int\(input\(\)\)$/.test(r)) return { sum: `讀一行，轉成<b>整數</b>後存進 ${c(lhs)}`, points: [
      "① input() 讀進一行，例如 \"5\"——注意這時是<b>字串</b>，不能拿來加減。",
      `② int(…) 把它轉成整數 5，之後 ${c(lhs)} 才能拿來做運算。`,
      "一行只能有一個數字；一行有好幾個數字要改用 map(int, input().split())。"] };
    if (/^float\(input\(\)\)$/.test(r)) return { sum: `讀一行，轉成<b>小數</b>後存進 ${c(lhs)}`, points: [
      "① input() 讀進一行，例如 \"7.6\"（字串）。", "② float(…) 轉成小數 7.6。"] };
    if (/^input\(\)\.split\(\)$/.test(r)) return { sum: `讀一行、用空白切開，存成<b>字串</b>串列 ${c(lhs)}`, points: [
      "例如輸入 \"小明 80 91\" → [\"小明\", \"80\", \"91\"]。",
      `注意每一段都還是字串，數字要用的話得再 int(${esc(lhs)}[1]) 轉型。`] };
    if (/^input\(\)\.strip\(\)$/.test(r)) return { sum: `讀一行文字，去掉頭尾空白後存進 ${c(lhs)}`, points: [
      "input() 讀進整行（字串），.strip() 把頭尾多餘的空白、換行去掉，比對字串時比較不會出錯。"] };
    if (/^input\(\)$/.test(r)) return { sum: `讀一行文字存進 ${c(lhs)}`, points: [
      "input() 讀進的<b>一定是字串</b>。就算輸入的是 5，拿到的也是 \"5\"，要算數學得先用 int() 轉。"] };
    return null;
  }

  /* ---------- 各種「區塊開頭」（以冒號結尾的行） ---------- */
  function rangeInfo(args) {
    const a = splitTop(args);
    const out = [];
    if (a.every(isNum)) {
      const [s, e, st] = a.length === 1 ? [0, +a[0], 1] : [+a[0], +a[1], a[2] ? +a[2] : 1];
      const seq = [];
      if (st > 0) for (let x = s; x < e && seq.length < 10000; x += st) seq.push(x);
      else if (st < 0) for (let x = s; x > e && seq.length < 10000; x += st) seq.push(x);
      return { seq, text: seq.length ? `range(${esc(args)}) 會產生 ${list(seq)}，一共 <b>${seq.length}</b> 個數，所以迴圈跑 ${seq.length} 輪。` : `range(${esc(args)}) 什麼都不產生，迴圈一次都不會跑。` };
    }
    if (a.length === 1) {
      const lm = a[0].match(/^len\((.+)\)$/);
      if (lm) return { text: `range(len(${esc(lm[1])})) 會產生 0、1、2、…、len(${esc(lm[1])})-1，剛好是 ${c(lm[1])} 的<b>每一個索引</b>，用來一格一格走訪它。` };
      return { text: `range(${esc(a[0])}) 會產生 0、1、2、…、${esc(a[0])}-1，一共 ${esc(a[0])} 個數（從 0 開始、不含 ${esc(a[0])}）。` };
    }
    let t = `range(${esc(args)}) 從 ${c(a[0])} 開始數，數到 ${c(a[1])} 的前一個為止（<b>含頭不含尾</b>）`;
    if (a[2]) t += `，每次${/^-/.test(a[2]) ? "減少 " + esc(a[2].slice(1)) + "（倒著數）" : "增加 " + esc(a[2])}`;
    if (/\+\s*1$/.test(a[1])) t += `。結束值寫 ${c(a[1])} 就是為了讓 ${c(a[1].replace(/\s*\+\s*1$/, ""))} 本身也被包含進去`;
    return { text: t + "。" };
  }
  function explainHeader(t, lines, i) {
    let m;
    if ((m = t.match(/^def\s+(\w+)\s*\((.*)\)\s*:$/))) {
      const params = m[2].trim() ? splitTop(m[2]) : [];
      const pts = [`${c("def")} 是「定義函式」：把底下縮排的程式包成一個有名字的工具，之後寫 ${c(m[1] + "(…)")} 就能重複使用。`];
      if (!params.length) pts.push("括號裡沒有參數，呼叫時不用給任何值。");
      else {
        const plain = params.filter(p => !p.includes("=")), defs = params.filter(p => p.includes("="));
        if (plain.length) pts.push(`參數 ${plain.map(p => c(p)).join("、")}：呼叫時傳進來的值會依序放進這${plain.length > 1 ? "幾個" : "個"}變數。`);
        defs.forEach(p => { const [n, v] = p.split("="); pts.push(`參數 ${c(n.trim())} 有<b>預設值</b> ${c(v.trim())}：呼叫時沒給就用它。`); });
      }
      pts.push("注意：程式跑到這一行只是「定義」，不會執行函式內容，要等到有人呼叫它才會跑。");
      return { sum: `定義一個叫做 ${c(m[1])} 的函式`, points: pts };
    }
    if ((m = t.match(/^for\s+(.+?)\s+in\s+range\s*\((.*)\)\s*:$/))) {
      const v = m[1].trim(), info = rangeInfo(m[2]);
      const pts = [info.text];
      if (v === "_") pts.push(`變數名稱寫 ${c("_")} 代表「這個數字用不到」，只是要把底下的程式重複做這麼多次。`);
      else if (info.seq && info.seq.length) pts.push(`第 1 輪 ${c(v)} = ${info.seq[0]}，第 2 輪 ${c(v)} = ${info.seq[1] !== undefined ? info.seq[1] : "（沒有第 2 輪）"}……每一輪都把底下縮排的程式從頭跑一次。`);
      else pts.push(`每一輪 ${c(v)} 換成下一個數，然後把底下縮排的程式從頭跑一次。`);
      pts.push("跑完最後一輪就離開迴圈，接著執行迴圈下面、沒有縮排的那一行。");
      return { sum: info.seq ? `for 迴圈：讓 ${c(v === "_" ? "_" : v)} 依序變成 ${list(info.seq, 5)}，共跑 ${info.seq.length} 輪` : `for 迴圈：讓 ${c(v)} 依序拿到 range 產生的每個數`, points: pts };
    }
    if ((m = t.match(/^for\s+(.+?)\s+in\s+(.+):$/))) {
      const v = m[1].trim(), it = m[2].trim(), pts = [];
      if (/^sys\.stdin$/.test(it)) {
        return { sum: `一行一行讀輸入，每次讀到的那一行放進 ${c(v)}`, points: [
          "sys.stdin 代表「所有的輸入」，for 會一行一行拿出來，直到沒有資料為止。",
          "適合用在題目沒說總共有幾行的時候。每一行後面會帶換行，通常要先 .strip()。"] };
      }
      const en = it.match(/^enumerate\((.+)\)$/);
      if (en) {
        const vs = splitTop(v);
        return { sum: `走訪 ${c(en[1])}，每一輪同時拿到索引 ${c(vs[0])} 和元素 ${c(vs[1] || "")}`, points: [
          "enumerate 會把「第幾個」一起給你，第一個元素的索引是 0。"] };
      }
      if (isStrLit(it)) {
        const chars = [...strVal(it)];
        pts.push(`字串會一個字元一個字元取出：${list(chars.map(ch => c(ch)), 8)}，一共 ${chars.length} 輪。`);
      } else if (/^\[.*\]$/.test(it)) {
        const items = splitTop(it.slice(1, -1));
        pts.push(`串列裡有 ${items.length} 個元素，${c(v)} 會依序拿到 ${list(items.map(x => c(x)), 6)}，一共 ${items.length} 輪。`);
      } else {
        pts.push(`${c(v)} 會依序拿到 ${c(it)} 裡的<b>每一個元素</b>；如果 ${c(it)} 是字串，就是一個字元一個字元取出。`);
      }
      if (/^(row|r|line)$/.test(v)) pts.push(`${c(it)} 是二維串列時，每一輪 ${c(v)} 拿到的是「一整列」（本身也是一個串列）。`);
      if (splitTop(v).length > 1) pts.push(`左邊有好幾個變數：每個元素本身是一組值，會拆開依序放進 ${splitTop(v).map(x => c(x)).join("、")}。`);
      pts.push("每拿到一個就把底下縮排的程式跑一次，全部拿完就離開迴圈。");
      return { sum: `for 迴圈：把 ${c(it)} 裡的東西一個一個拿出來，放進 ${c(v)}`, points: pts };
    }
    if ((m = t.match(/^while\s+(.+):$/))) {
      const cond = m[1].trim();
      const pts = ["每一輪開始前先檢查條件：<b>成立</b> → 執行底下縮排的程式，跑完回到這一行再檢查；<b>不成立</b> → 跳出迴圈往下走。"];
      if (cond === "True") pts.push("條件寫 True 代表永遠成立，所以一定要靠迴圈裡的 break 才能離開，不然會無窮迴圈。");
      else pts.push("迴圈裡一定要有東西會讓條件最後變成不成立（例如變數一直在變小），否則會變成無窮迴圈（TLE）。");
      return { sum: `while 迴圈：只要 ${c(cond)} 成立，就一直重複做`, points: pts.concat(condNotes(cond)) };
    }
    if ((m = t.match(/^if\s+(.+):$/))) {
      const cond = m[1].trim();
      return { sum: `條件判斷：如果 ${c(cond)} 成立，才執行底下縮排的程式`, points: ["條件不成立就把底下那整段跳過。"].concat(condNotes(cond)) };
    }
    if ((m = t.match(/^elif\s+(.+):$/))) {
      const cond = m[1].trim();
      return { sum: `否則如果：上面的條件都不成立時，再檢查 ${c(cond)}`, points: [
        "if／elif 是<b>由上往下</b>檢查，一旦有一個成立，就只執行那一段，後面的 elif、else 全部跳過。所以條件的順序很重要。"].concat(condNotes(cond)) };
    }
    if (/^else\s*:$/.test(t)) {
      const ind = indentOf(lines[i]);
      for (let j = i - 1; j >= 0; j--) {
        const [tj] = splitComment(lines[j]);
        if (!tj.trim() || indentOf(lines[j]) > ind) continue;
        if (indentOf(lines[j]) < ind) break;
        if (/^\s*(for|while)\b/.test(tj)) return { sum: "for／while 後面的 else：迴圈<b>正常跑完、沒有被 break</b> 才會執行這段", points: [
          "這是 Python 特有的寫法，常用在「找找看有沒有」：找到就 break（不會執行 else），整圈都沒找到才會跑到 else。"] };
        if (/^\s*(if|elif)\b/.test(tj)) break;
        if (/^\s*(try|except)\b/.test(tj)) return { sum: "try 的 else：沒有發生錯誤時才執行這段", points: [] };
      }
      return { sum: "否則：上面的 if／elif 條件<b>全部不成立</b>時，才執行底下這段", points: ["if 和 else 兩段一定只會跑其中一段，不會兩段都跑。"] };
    }
    if (/^try\s*:$/.test(t)) return { sum: "try：先試著執行底下的程式，萬一出錯就交給下面的 except 處理", points: ["這樣程式遇到錯誤不會直接當掉。"] };
    if ((m = t.match(/^except\s*(.*):$/))) return { sum: `except：上面 try 那段${m[1] ? "發生 " + c(m[1]) + " 錯誤" : "出錯"}時，改執行這裡`, points: m[1] === "EOFError" ? ["EOFError 是「輸入已經讀完了還想再讀」時發生的錯誤，常用來判斷資料讀完了。"] : [] };
    if ((m = t.match(/^with\s+(.+):$/))) return { sum: `with 區塊：${c(m[1])}`, points: [] };
    return null;
  }

  /* ---------- 一般敘述 ---------- */
  function explainPrint(inner) {
    const args = inner.trim() ? splitTop(inner) : [];
    if (!args.length) return { sum: "印出一個空行（其實就是只印一個換行）", points: [
      "常用在前面用 end=\" \" 印了一整排之後，補一個換行，讓下一次輸出從新的一行開始。"] };
    const pos = args.filter(a => !/^(sep|end)\s*=/.test(a));
    const kw = Object.fromEntries(args.filter(a => /^(sep|end)\s*=/.test(a)).map(a => { const k = a.indexOf("="); return [a.slice(0, k).trim(), a.slice(k + 1).trim()]; }));
    const pts = [];
    const strs = pos.filter(a => isStrLit(a) && !/^f/i.test(a)), nums = pos.filter(a => /^-?\d+(\.\d+)?$/.test(a));
    if (strs.length) pts.push(`${strs.map(x => c(x)).join("、")} ${strs.length > 1 ? "都是" : "是"}文字（字串），會原樣印出，<b>引號本身不會印出來</b>。`);
    if (nums.length) pts.push(`${nums.map(x => c(x)).join("、")} ${nums.length > 1 ? "都是" : "是"}數字，直接印出。`);
    const others = pos.filter(a => !strs.includes(a) && !nums.includes(a));
    others.slice(0, 3).forEach(a => {
      if (/^f["']/.test(a)) pts.push(...explainFString(a));
      else if (a.startsWith("*")) pts.push(`${c(a)}：星號會把 ${c(a.slice(1))} <b>拆開</b>，每個元素當成獨立的值印出，中間自動放空白。例如 print(*[1, 2, 3]) 印出 1 2 3。`);
      else if (/\.join\(/.test(a)) pts.push(`${c(a.length > 40 ? a.slice(0, 38) + "…" : a)}：先把串列用前面的分隔字接成<b>一個字串</b>，再印出來。`);
      else pts.push(`${c(a)}：先算出它的值，再印出來。`);
    });
    if (pos.length > 1 && !kw.sep) pts.push(`一次給了 ${pos.length} 個值，print 會自動在它們<b>中間放一個空白</b>（sep 預設是空白），印完再換行。`);
    const shown = v => v.includes("\\n") ? `${c(v.replace(/\\n/g, "\\n"))}（其中 ${c("\\n")} 代表換行）` : showStr(v);
    if (kw.sep) pts.push(`${c("sep=" + kw.sep)}：值和值<b>中間</b>改放 ${isStrLit(kw.sep) ? shown(strVal(kw.sep)) : c(kw.sep)}（預設是一個空白）。`);
    if (kw.end) {
      const v = isStrLit(kw.end) ? strVal(kw.end) : null;
      pts.push(`${c("end=" + kw.end)}：印完後<b>結尾</b>放 ${v !== null ? shown(v) : c(kw.end)}，取代預設的換行${v !== null && !v.includes("\\n") ? "，所以<b>下一個 print 會接在同一行</b>。" : "。"}`);
    }
    const extra = exprNotes(others.filter(a => !/^f["']/.test(a)).join(" "));
    const one = pos[0].length > 36 ? pos[0].slice(0, 34) + "…" : pos[0];
    const noNL = kw.end && !(isStrLit(kw.end) && strVal(kw.end).includes("\\n")) ? "（結尾不換行）" : "";
    return { sum: pos.length === 1 ? `輸出：把 ${c(one)} 印到畫面上${noNL}` : `輸出：把 ${pos.length} 個值印在同一行${noNL}`, points: pts.concat(extra.slice(0, 3)) };
  }

  const METHOD = {
    append: (o, a) => ({ sum: `把 ${c(a)} 加到 ${c(o)} 的<b>最後面</b>`, points: [`串列變長一格。${/stack|st\b/.test(o) ? "對堆疊來說，這就是 push（放到最上面）。" : /q|queue/.test(o) ? "對佇列來說，這就是排到隊伍最後面。" : ""}`, "append 不會回傳任何東西，它是直接改 " + c(o) + " 本身。"] }),
    insert: (o, a) => { const [i, v] = splitTop(a); return { sum: `在 ${c(o)} 的索引 ${c(i)} 位置插入 ${c(v || "")}`, points: ["原本在那個位置以及後面的元素，全部往後移一格。索引從 0 開始，所以 insert(0, x) 就是插到最前面。"] }; },
    remove: (o, a) => ({ sum: `從 ${c(o)} 裡移除<b>第一個</b>值等於 ${c(a)} 的元素`, points: ["remove 看的是「值」，不是位置（索引）。", "如果有好幾個相同的值，只會移除最前面那一個；找不到會直接噴錯。"] }),
    pop: (o, a) => ({ sum: a ? `拿走 ${c(o)} 索引 ${c(a)} 的元素` : `拿走 ${c(o)} 的<b>最後一個</b>元素`, points: ["pop 會把拿走的元素回傳出來；這一行沒有用變數接住，所以就是單純把它移除。"] }),
    popleft: o => ({ sum: `拿走佇列 ${c(o)} <b>最前面</b>的元素`, points: ["佇列是先進先出：最早排進去的最先被拿走。"] }),
    sort: (o, a) => ({ sum: `把 ${c(o)} <b>原地排序</b>${/reverse\s*=\s*True/.test(a) ? "（由大到小）" : "（由小到大）"}`, points: [`直接改變 ${c(o)} 本身，回傳值是 None。千萬別寫成 ${c(o + " = " + o + ".sort()")}，那樣 ${c(o)} 會變成 None。`, "想要保留原本順序、另外拿一份排好的，改用 sorted(" + esc(o) + ")。"] }),
    reverse: o => ({ sum: `把 ${c(o)} 原地反轉`, points: ["直接改變本身的順序，回傳 None。"] }),
    extend: (o, a) => ({ sum: `把 ${c(a)} 裡的每個元素都接到 ${c(o)} 後面`, points: [] }),
  };
  function explainStatement(t, ctxInfo) {
    let m;
    if (/^import\s/.test(t) || /^from\s/.test(t)) {
      const mod = (t.match(/^(?:from|import)\s+([\w.]+)/) || [])[1] || "";
      const pts = [];
      if (mod === "math") pts.push("math 裡有 sqrt（開根號）、floor（往下取整）、ceil（往上取整）等工具，用 math.sqrt(16) 這樣呼叫。");
      if (mod === "sys") pts.push("sys.stdin 可以一行一行讀取所有輸入，適合不知道有幾行資料的題目。");
      if (mod === "collections") pts.push("deque 是兩端都能快速放入、拿出的佇列，popleft() 拿最前面只要一步（list 的 pop(0) 要把後面全部往前搬，很慢）。");
      return { sum: `匯入 ${c(mod)} 模組，才能使用它提供的工具`, points: pts };
    }
    if (/^return\b/.test(t)) {
      const v = t.replace(/^return\s*/, "");
      if (!v) return { sum: "結束函式，不回傳值（呼叫端會拿到 None）", points: [] };
      const pts = ["return 會把值交回給呼叫這個函式的地方，函式執行到這裡就<b>結束</b>，下面的程式不會再跑。"];
      if (splitTop(v).length > 1) pts.push(`用逗號回傳好幾個值，其實是打包成一個 tuple，呼叫端可以用 ${c("a, b = 函式(…)")} 一次拆開。`);
      if (ctxInfo.fn && new RegExp("\\b" + ctxInfo.fn + "\\s*\\(").test(v)) pts.push(`這裡又呼叫了 ${c(ctxInfo.fn)} 自己——這就是<b>遞迴</b>。每次呼叫的參數都要更接近終止條件，最後才會停下來。`);
      return { sum: `回傳 ${c(v)} 的值，並結束這個函式`, points: pts.concat(exprNotes(v).slice(0, 3)) };
    }
    if (t === "break") return { sum: "break：立刻<b>跳出整個迴圈</b>", points: ["迴圈剩下的輪數都不跑了，直接接著執行迴圈下面的程式。只會跳出最內層那一個迴圈。"] };
    if (t === "continue") return { sum: "continue：跳過這一輪剩下的程式，<b>直接進入下一輪</b>", points: ["跟 break 不一樣：迴圈沒有結束，只是這一輪提早收工。"] };
    if (t === "pass") return { sum: "pass：什麼都不做", points: ["語法上這裡一定要有東西，但暫時不需要做事時就寫 pass。"] };
    if ((m = t.match(/^global\s+(.+)$/))) return { sum: `宣告函式裡的 ${c(m[1])} 指的是<b>全域</b>的那一個`, points: [`沒有這行的話，函式裡對 ${c(m[1])} 指定值會變成建立一個新的區域變數，改不到外面的 ${c(m[1])}。`] };

    // x.method(args)
    if ((m = t.match(/^([\w.\[\]]+)\.(\w+)\s*\((.*)\)$/)) && METHOD[m[2]] && callParts(t)) return METHOD[m[2]](m[1], m[3].trim());

    // print(...)
    const call = callParts(t);
    if (call && call.name === "print") return explainPrint(call.inner);

    // 指定：lhs = rhs
    const k = topAssign(t);
    if (k > 0) {
      const opm = t.slice(0, k).match(/^(.*?)\s*(\+|-|\*\*|\*|\/\/|\/|%|&|\||\^|<<|>>)$/);
      if (opm) return explainAug(opm[1].trim(), opm[2], t.slice(k + 1).trim());
      return explainAssign(t.slice(0, k).trim(), t.slice(k + 1).trim(), ctxInfo);
    }

    // 呼叫函式
    if (call) {
      const pts = [`執行函式 ${c(call.name)}${call.inner.trim() ? "，把 " + c(call.inner.trim()) + " 傳進去當參數" : ""}。`];
      if (ctxInfo.fn === call.name) pts.push(`這裡呼叫了 ${c(call.name)} 自己（遞迴）。`);
      pts.push("函式如果有 return 值，這一行沒有用變數接住，回傳值就被丟掉了。");
      return { sum: `呼叫函式 ${c(call.name + "(…)")}`, points: pts.concat(exprNotes(call.inner).slice(0, 2)) };
    }

    // 單獨一個運算式（例如練習題裡的條件）
    return { sum: `運算式 ${c(t)}`, points: [/\b(and|or|not)\b|[<>=!]=|[<>]/.test(blankStrings(t)) ? "這是一個條件，算出來會是 True 或 False。" : "算出這個值（這一行沒有存起來，也沒有印出來）。"].concat(condNotes(t)) };
  }
  const OPNAME = { "+": "加上", "-": "減去", "*": "乘以", "/": "除以", "//": "整數除以", "%": "取除以後的餘數", "**": "的次方", "&": "位元 AND", "|": "位元 OR", "^": "位元 XOR", "<<": "左移", ">>": "右移" };
  function explainAug(lhs, op, rhs) {
    const idx = /\[/.test(lhs);
    const strish = op === "+" && (/^([rbu]*["']|chr\(|str\()/i.test(rhs) || (/^(result|res|ans|plain|out|text|word|line)$/.test(lhs) && /^[\w\[\]]+$/.test(rhs)));
    if (strish) {
      const dn = domainNotes(rhs);
      return { sum: `把 ${c(rhs.length > 40 ? rhs.slice(0, 38) + "…" : rhs)} <b>接到字串</b> ${c(lhs)} 的後面`, points: [
        `字串的 ${c("+=")} 是「接起來」，不是數學的加法。例如 ${c(lhs)} 原本是 "Kh"，接上 "o" 就變成 "Kho"。`,
        ...dn, ...(dn.length ? [] : exprNotes(rhs).slice(0, 2))] };
    }
    const pts = [`等同於 ${c(lhs + " = " + lhs + " " + op + " " + rhs)}：先用${idx ? "那一格" : " " + c(lhs) + " "}<b>原本的值</b>算出新值，再存回去。`];
    if (op === "+" && /^["']/.test(rhs)) pts.push("如果是字串，+= 就是把文字接在後面。");
    if (op === "+" && rhs === "1") pts.push(idx ? "這是在<b>計數</b>：每遇到一次，那一格就加 1。" : "每執行一次就加 1，常用來<b>計數</b>或讓迴圈變數前進。");
    if (op === "//" && rhs === "10") pts.push(`${c(lhs + " //= 10")} 會去掉最右邊一位數，例如 9384 → 938。`);
    if (/^\w+\s*%\s*10$/.test(rhs)) pts.push(`${c(rhs)} 就是 ${c(rhs.split("%")[0].trim())} 的<b>個位數</b>（最右邊一位），例如 9384 % 10 = 4。`);
    if (op === "|" && /<</.test(rhs)) pts.push("用 |= 搭配遮罩：把那一位<b>設成 1</b>（打開開關），其他位不變。");
    if (op === "&" && /~/.test(rhs)) pts.push("用 &= ~遮罩：把那一位<b>設成 0</b>（關掉開關），其他位不變。");
    if (op === "^" && /<</.test(rhs)) pts.push("用 ^= 遮罩：把那一位<b>反轉</b>（開變關、關變開）。");
    if (idx) pts.push(`${c(lhs)} 是串列裡的某一格，${c(lhs.replace(/\[.*$/, ""))} 本身不會變長，只有那一格的值改變。`);
    const dn = domainNotes(lhs + " " + rhs);
    return { sum: `把 ${c(lhs)} ${OPNAME[op] || op} ${c(rhs)}，結果存回 ${c(lhs)}`, points: pts.concat(dn, exprNotes(rhs).slice(0, dn.length ? 1 : 3)) };
  }
  function explainAssign(lhs, rhs, ctxInfo) {
    const L = splitTop(lhs), R = splitTop(rhs);
    // 讀輸入
    if (/\binput\s*\(/.test(rhs)) { const r = explainInput(lhs, rhs); if (r) return r; }
    // 交換：a, b = b, a
    if (L.length === 2 && R.length === 2 && L[0].replace(/\s/g, "") === R[1].replace(/\s/g, "") && L[1].replace(/\s/g, "") === R[0].replace(/\s/g, "")) {
      return { sum: `交換 ${c(L[0])} 和 ${c(L[1])} 的值`, points: [
        `Python 會先把右邊整組 ${c(rhs)} 算好，再一次分給左邊，所以<b>不需要暫存變數</b>。`,
        "排序（兩個元素對調位置）時最常用到這種寫法。"] };
    }
    // 同時指派多個
    if (L.length === 2 && R.length === 2 && /\b(dr|dx)\[/.test(R[0]) && /\b(dc|dy)\[/.test(R[1])) {
      const k = (R[0].match(/\[(\w+)\]/) || [])[1] || "k";
      return { sum: `算出第 ${c(k)} 個方向的<b>鄰居座標</b> (${c(L[0])}, ${c(L[1])})`, points: [
        `目前的位置加上第 ${c(k)} 個方向的變化量：列 ${c(R[0])}、行 ${c(R[1])}。`,
        "算出來的座標<b>可能超出邊界</b>（例如在最上面一列再往上），所以下一步一定要先檢查才能拿去用。"] };
    }
    if (L.length > 1) {
      if (R.length === L.length) return { sum: `同時指派：${L.map((x, k) => c(x) + " = " + c(R[k])).join("、")}`, points: ["右邊會先全部算好，再依序分給左邊。"].concat(exprNotes(rhs).slice(0, 3)) };
      if (R.length === 1) return { sum: `右邊算出好幾個值，拆開依序放進 ${L.map(x => c(x)).join("、")}`, points: [`${c(rhs)} 會回傳一組值（tuple），左邊有 ${L.length} 個變數，就依序各拿一個。數量要剛好對上。`].concat(exprNotes(rhs).slice(0, 3)) };
    }
    // 連續指派 a = b = 0
    if (/^[A-Za-z_]\w*\s*=\s*[A-Za-z_]\w*\s*=/.test(lhs + " = " + rhs) && topAssign(rhs) > 0) {
      const names = (lhs + " = " + rhs).split(/\s*=\s*/);
      const v = names.pop();
      return { sum: `${names.map(x => c(x)).join("、")} 全部設成 ${c(v)}`, points: ["一行同時把好幾個變數設成同一個初始值，常用在計數器歸零。"] };
    }
    const target = lhs, idxM = target.match(/^(\w+)\[(.+?)\]\[(.+?)\]$/) || target.match(/^(\w+)\[(.+)\]$/);
    const tdesc = idxM ? (idxM.length === 4 ? `二維串列 ${c(idxM[1])} 第 ${c(idxM[2])} 列、第 ${c(idxM[3])} 行那一格` : `${c(idxM[1])} 的第 ${c(idxM[2])} 格（索引從 0 開始）`) : `變數 ${c(target)}`;
    const r = rhs.replace(/\s+/g, "");
    let m;
    if (r === "[]") return { sum: `建立一個<b>空串列</b> ${c(target)}`, points: ["裡面還沒有東西，之後可以用 .append(…) 一個一個加進去。"] };
    if (r === "{}") return { sum: `建立一個<b>空字典</b> ${c(target)}`, points: ["字典是「key → value」的對照表，常拿來當計數器：count[字] = 次數。"] };
    if (/^deque\(\)$/.test(r)) return { sum: `建立一個空的佇列 ${c(target)}`, points: ["之後用 append 從後面放進去、popleft 從前面拿出來（先進先出）。"] };
    if ((m = r.match(/^\[\[(.+?)\]\*(.+?)for_inrange\((.+)\)\]$/))) return { sum: `建立一個 ${esc(m[3])} 列 × ${esc(m[2])} 行、每格都是 ${esc(m[1])} 的<b>二維串列</b>`, points: [
      `${c("[" + m[1] + "] * " + m[2])} 做出一列（${esc(m[2])} 個 ${esc(m[1])}），外面的 ${c("for _ in range(" + m[3] + ")")} 重複做 ${esc(m[3])} 次，每次都是<b>全新的一列</b>。`,
      `之後用 ${c(target + "[i][j]")} 存取第 i 列第 j 行。`,
      `千萬不要寫成 ${c("[[" + m[1] + "] * " + m[2] + "] * " + m[3])}：那樣每一列其實是<b>同一個串列</b>，改一格所有列都會一起變。`] };
    if ((m = r.match(/^\[\[(.+?)\]\*(.+?)\]\*(.+)$/))) return { sum: `⚠ 看起來像建立二維串列，但這是<b>錯誤寫法</b>`, points: [
      `${c("* " + m[3])} 只是把「同一列」複製 ${esc(m[3])} 次參照，所有列都指向同一個串列。`,
      `所以改其中一格，例如 ${c(target + "[0][0] = 9")}，<b>每一列</b>的第 0 格都會變成 9。`,
      `正確寫法：${c("[[" + m[1] + "] * " + m[2] + " for _ in range(" + m[3] + ")]")}。`] };
    if ((m = r.match(/^\[(.+?)\]\*(.+)$/)) && !/for/.test(r)) return { sum: `建立一個長度 ${esc(m[2])}、每格都是 ${esc(m[1])} 的串列`, points: [
      `例如 ${c("[0] * 5")} 就是 ${c("[0, 0, 0, 0, 0]")}。`, /26/.test(m[2]) ? "26 格剛好對應 a～z 每個字母，常用來統計字母出現次數。" : "常用來當計數器或記錄狀態。"] };
    if (/^\[.+\bfor\b.+\]$/.test(rhs.trim())) {
      const cm = rhs.trim().slice(1, -1).match(/^(.+?)\s+for\s+(.+?)\s+in\s+(.+?)(?:\s+if\s+(.+))?$/);
      if (cm) return { sum: `用<b>串列推導式</b>建立 ${c(target)}`, points: [
        `讀法：對 ${c(cm[3])} 裡的每一個 ${c(cm[2])}，算出 ${c(cm[1])}，收集成一個新的串列。`,
        cm[4] ? `後面的 ${c("if " + cm[4])} 是篩選：只有條件成立的才會被收進來。` : "等於一個 for 迴圈 + append，但寫成一行。"].concat(exprNotes(cm[1]).slice(0, 2)) };
    }
    if (/^(dr|dc|dx|dy)$/.test(target) && /^\[.*\]$/.test(rhs.trim())) {
      const items = splitTop(rhs.trim().slice(1, -1));
      const isRow = /^(dr|dx)$/.test(target);
      return { sum: `<b>方向陣列</b> ${c(target)}：記錄每個方向${isRow ? "「列」" : "「行」"}要怎麼變`, points: [
        isRow ? "dr 是列（上下）的變化：-1 代表往上一列、+1 代表往下一列、0 代表列不變。" : "dc 是行（左右）的變化：-1 代表往左一行、+1 代表往右一行、0 代表行不變。",
        `要跟另一個方向陣列<b>同一個位置一起看</b>：第 k 個方向就是 (dr[k], dc[k])。${items.length === 4 ? "例如 (-1, 0) 是上、(1, 0) 是下、(0, -1) 是左、(0, 1) 是右。" : items.length === 8 ? "8 個元素就是上下左右再加 4 個斜角。" : ""}`,
        "好處是只要一個 for 迴圈跑過每個方向，就不用寫四段幾乎一樣的 if。"] };
    }
    if (/^\[.*\]$/.test(rhs.trim()) && !/\bfor\b/.test(rhs)) {
      const items = splitTop(rhs.trim().slice(1, -1));
      const nested = items.length && items.every(x => /^\[.*\]$/.test(x));
      return { sum: `建立一個有 ${items.length} 個元素的串列 ${c(target)}`, points: [nested
        ? `每個元素本身也是串列，所以這是一個 ${items.length} 列的<b>二維串列</b>，${c(target + "[i][j]")} 是第 i 列第 j 個。`
        : `索引從 0 開始：${c(target + "[0]")} 是 ${c(items[0] || "")}${items.length > 1 ? "、" + c(target + "[" + (items.length - 1) + "]") + " 是 " + c(items[items.length - 1]) : ""}，也可以用 ${c(target + "[-1]")} 拿最後一個。`] };
    }
    if (/^\{.*\}$/.test(rhs.trim())) return { sum: `建立一個字典 ${c(target)}`, points: ["冒號左邊是 key、右邊是 value，之後用 " + esc(target) + "[key] 取出對應的值。"] };
    if (isStrLit(rhs) && !/^f/i.test(rhs.trim())) return { sum: `把文字 ${c(rhs)} 存進${tdesc}`, points: ["這是一個字串。字串可以用索引取字元，但<b>不能</b>直接改其中某一個字元（字串不可變）。"] };
    if (/^f["']/.test(rhs.trim())) return { sum: `把格式化好的文字存進${tdesc}`, points: explainFString(rhs.trim()) };
    if (isNum(rhs) || /^-?\d+\.\d+$/.test(rhs.trim())) return { sum: `把 ${c(rhs)} 存進${tdesc}`, points: [
      /\./.test(rhs) ? "有小數點的是浮點數（float）。" : (idxM ? "把那一格的值改掉，其他格不受影響。" : "= 在程式裡是「把右邊的值存進左邊」，不是數學上的等於。") ] };
    if (/^(True|False|None)$/.test(rhs.trim())) return { sum: `把 ${c(rhs)} 存進${tdesc}`, points: [rhs.trim() === "None" ? "None 代表「沒有值」。" : "布林值，只有 True 和 False 兩種，首字母要大寫。"] };
    // 取出串列元素：x = stack.pop()、first = q.popleft()
    if ((m = rhs.trim().match(/^([\w.]+)\.pop\((.*)\)$/))) return { sum: `從 ${c(m[1])} 拿走${m[2] ? "索引 " + c(m[2]) + " 的" : "<b>最後一個</b>"}元素，存進 ${c(target)}`, points: [
      "pop 會「移除並回傳」：串列少了一個，被拿走的值交給左邊的變數。", /stack|st\b/.test(m[1]) ? "這就是堆疊的 pop：後放進去的先拿出來（LIFO）。" : ""].filter(Boolean) };
    if ((m = rhs.trim().match(/^([\w.]+)\.popleft\(\)$/))) return { sum: `從佇列 ${c(m[1])} 拿走<b>最前面</b>的元素，存進 ${c(target)}`, points: ["佇列是先進先出（FIFO）：最早放進去的最先被拿出來。"] };
    if ((m = rhs.trim().match(/^([\w.]+)\.sort\(/))) return { sum: `⚠ ${c(target)} 會變成 <b>None</b>`, points: [`.sort() 是原地排序，回傳值是 None，所以 ${c(target)} 拿到的是 None。要排好的新串列請用 ${c("sorted(" + m[1] + ")")}。`] };
    // 一般運算
    const pts = [`先算出右邊 ${c(rhs.length > 50 ? rhs.slice(0, 48) + "…" : rhs)} 的值，再存進${tdesc}。`];
    if (!idxM && L.length === 1 && new RegExp("\\b" + target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b").test(rhs))
      pts.push(`右邊也用到了 ${c(target)} 自己：先用<b>舊的值</b>算，算完再存回去蓋掉。這就是為什麼程式裡的 = 是「存進去」，不是數學上的等於。`);
    if (ctxInfo.fn && new RegExp("\\b" + ctxInfo.fn + "\\s*\\(").test(rhs)) pts.push(`右邊呼叫了 ${c(ctxInfo.fn)} 自己——這就是<b>遞迴</b>。`);
    const special = domainNotes(lhs + " " + rhs);
    const short = rhs.length > 30 ? rhs.slice(0, 28) + "…" : rhs;
    const sum = callParts(rhs.trim()) ? `把 ${c(short)} 的結果存進${tdesc}` : `算出 ${c(short)}，存進${tdesc}`;
    return { sum, points: pts.concat(special, exprNotes(rhs).slice(0, Math.max(1, 4 - special.length))) };
  }

  /* ---------- 主題專屬說明（凱撒公式、字母編號、拆數字） ---------- */
  function domainNotes(expr) {
    const out = [];
    const cz = expr.match(/ord\(\s*([\w.()\[\]]+?)\s*\)\s*-\s*ord\(\s*(['"])([aA])\2\s*\)\s*([+-])\s*(\w+)\s*\)\s*%\s*26/);
    if (cz) {
      const [, ch, , base, sign, k] = cz;
      const fwd = sign === "+";
      out.push(`這是<b>凱撒${fwd ? "加密" : "解密"}的公式</b>，由內往外拆成四步：`);
      out.push(`① ${c(`ord(${ch}) - ord('${base}')`)}：把字母換成 0～25 的編號（${base}→0、${String.fromCharCode(base.charCodeAt(0) + 1)}→1……${String.fromCharCode(base.charCodeAt(0) + 25)}→25）。`);
      out.push(`② ${c(sign + " " + k)}：${fwd ? "往後" : "往前"}移 ${esc(k)} 位。`);
      out.push(`③ ${c("% 26")}：${fwd ? "超過 25 " : "變成負數"}就繞回來。Python 的 % 對負數也會給 0～25 的答案，所以往前移也能用同一條公式。`);
      out.push(`④ ${c(`+ ord('${base}')`)} 再用 ${c("chr(…)")} 包起來：把編號換回字母。`);
      out.push(fwd ? `例：'${base === "A" ? "Y" : "y"}' 往後 3 → 24 → 27 → 27 % 26 = 1 → '${base === "A" ? "B" : "b"}'（${base === "A" ? "Y→Z→A→B" : "y→z→a→b"}）。`
                   : `例：'${base === "A" ? "B" : "b"}' 往前 3 → 1 → -2 → -2 % 26 = 24 → '${base === "A" ? "Y" : "y"}'（${base === "A" ? "B→A→Z→Y" : "b→a→z→y"}）。`);
      return out;
    }
    const oi = expr.match(/ord\(\s*([\w.()\[\]]+?)\s*\)\s*-\s*ord\(\s*(['"])([aA0])\2\s*\)/);
    if (oi) {
      const b = oi[3];
      out.push(b === "0"
        ? `${c(`ord(${oi[1]}) - ord('0')`)}：把數字字元換成真正的數字（'0'→0、'7'→7）。`
        : `${c(`ord(${oi[1]}) - ord('${b}')`)}：把字母換成「第幾個」（${b}→0、${String.fromCharCode(b.charCodeAt(0) + 1)}→1……${String.fromCharCode(b.charCodeAt(0) + 25)}→25），剛好可以當長度 26 串列的索引。`);
    }
    const oc = expr.match(/chr\(\s*ord\(\s*(['"])([aA])\1\s*\)\s*\+\s*(\w+)\s*\)/);
    if (oc) out.push(`${c(`chr(ord('${oc[2]}') + ${oc[3]})`)}：反過來把「第 ${esc(oc[3])} 個」換回字母（0→${oc[2]}、1→${String.fromCharCode(oc[2].charCodeAt(0) + 1)}…）。`);
    if (/\/\/\s*100\b/.test(expr) && !/%/.test(expr)) out.push("// 100 會把最後兩位去掉，三位數就只剩<b>百位</b>（472 // 100 = 4）。");
    if (/\/\/\s*10\)\s*%\s*10/.test(expr)) out.push("拆<b>十位數</b>：先 // 10 去掉個位（472 → 47），再 % 10 拿最右邊一位（47 → 7）。");
    else if (/%\s*10\b/.test(expr) && !/ord/.test(expr)) out.push("% 10 拿到最右邊一位，也就是<b>個位數</b>（472 % 10 = 2）。");
    return out;
  }

  /* ---------- 這行屬於哪一段 ---------- */
  function blockContext(lines, i) {
    const ind = indentOf(lines[i]);
    const chain = [];
    let cur = ind;
    for (let j = i - 1; j >= 0 && cur > 0; j--) {
      const [t] = splitComment(lines[j]);
      if (!t.trim()) continue;
      const ij = indentOf(lines[j]);
      if (ij < cur) {
        if (!/:\s*$/.test(t)) break;            // 不是區塊開頭（多半是跨行的括號），不往上追
        chain.push({ line: j, text: t.trim() });
        cur = ij;
      }
    }
    const fn = (chain.find(h => /^def\s/.test(h.text)) || {}).text;
    const fnName = fn ? fn.match(/^def\s+(\w+)/)[1] : null;
    if (!chain.length) return { ctx: "", fn: fnName };
    const h = chain[0], n = h.line + 1, head = h.text.length > 34 ? h.text.slice(0, 32) + "…" : h.text;
    const loops = chain.filter(x => /^(for|while)\b/.test(x.text)).length;
    let s;
    if (/^(for|while)\b/.test(h.text)) s = `這行縮排在第 ${n} 行 ${c(head)} 底下：迴圈<b>每跑一輪，這行就執行一次</b>。`;
    else if (/^if\b/.test(h.text)) s = `這行屬於第 ${n} 行的 ${c(head)}：<b>只有條件成立時</b>才會執行。`;
    else if (/^elif\b/.test(h.text)) s = `這行屬於第 ${n} 行的 ${c(head)}：前面的條件都不成立、而這個條件成立時才執行。`;
    else if (/^else\b/.test(h.text)) s = `這行屬於第 ${n} 行的 ${c("else:")}：上面的條件都不成立時才執行。`;
    else if (/^def\b/.test(h.text)) s = `這行是函式 ${c(fnName)} 的內容：定義時不會跑，<b>要等呼叫 ${esc(fnName)}(…) 時才執行</b>。`;
    else if (/^try\b/.test(h.text)) s = `這行在第 ${n} 行的 try 裡面：出錯的話會跳到 except。`;
    else if (/^except\b/.test(h.text)) s = `這行在第 ${n} 行的 except 裡面：只有 try 那段出錯時才執行。`;
    else s = `這行在第 ${n} 行 ${c(head)} 的區塊裡。`;
    if (loops >= 2) s += `它外面總共包了 ${loops} 層迴圈，所以總執行次數是各層次數<b>相乘</b>。`;
    else if (loops === 1 && !/^(for|while)\b/.test(h.text)) s += "而且外面還有迴圈，所以每一輪都會再判斷一次。";
    return { ctx: s, fn: fnName };
  }
  // 前面的括號還沒關 → 這行是跨行寫法的延續
  function openBrackets(lines, i) {
    let d = 0;
    for (let j = 0; j < i; j++) {
      const t = blankStrings(splitComment(lines[j])[0]);
      for (const ch of t) { if ("([{".includes(ch)) d++; else if (")]}".includes(ch)) d = Math.max(0, d - 1); }
    }
    return d;
  }

  /* ---------- 主入口 ---------- */
  function line(lines, i) {
    const raw = lines[i] || "";
    const [code, cm] = splitComment(raw);
    const t = code.trim();
    const ctxInfo = blockContext(lines, i);
    let r;
    if (!t && !cm) r = { sum: "空行", points: ["只是為了排版好讀，Python 會直接跳過。"] };
    else if (!t) r = { sum: "註解（Python 不會執行）", points: [`# 後面的文字是寫給人看的說明：「${esc(cm)}」`] };
    else if (openBrackets(lines, i) > 0) r = { sum: "接續上一行的內容（括號還沒關）", points: ["Python 允許在括號裡面換行，這行跟上一行其實是同一句程式，分成好幾行只是比較好讀。"] };
    else {
      try {
        r = (/:\s*$/.test(t) && explainHeader(t, lines, i)) || explainStatement(t, ctxInfo);
      } catch (e) { r = null; }
      if (!r) r = { sum: "執行這一行", points: exprNotes(t) };
      // 以 ; 分隔的多個敘述、或 if 後面直接接一行（例如 if a: return b）
      const inline = t.match(/^(if|elif|else|for|while)\b[^:]*:\s*(\S.*)$/);
      if (inline && !/:\s*$/.test(t)) {
        const head = t.slice(0, t.length - inline[2].length).trim();
        const h = explainHeader(head, lines, i), s = explainStatement(inline[2].trim(), ctxInfo);
        if (h && s) r = { sum: `${h.sum}；成立時做：${s.sum}`, points: [`冒號後面直接接一句，是「把區塊寫在同一行」的簡寫。`, ...h.points.slice(0, 2), ...s.points.slice(0, 2)] };
      }
      if (cm) {
        const looksLikeValue = /^[-\d.\[\]'"(), A-Za-z:{}]+$/.test(cm) && /\d|True|False|None|\[/.test(cm);
        const isPrint = /^print\s*\(/.test(t);
        r.points.push(`旁邊的註解：「${esc(cm)}」${looksLikeValue ? (isPrint ? "——就是這行會印出來的內容，可以拿來對照。" : "——作者標出來的結果，可以拿來對照。") : ""}`);
      }
    }
    r.points = (r.points || []).filter(Boolean);
    return { sum: r.sum, points: r.points, ctx: t ? ctxInfo.ctx : "" };
  }

  window.EXPLAIN = { line };
})();
