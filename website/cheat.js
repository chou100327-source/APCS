/* ===== 考前速查：最常用的 Python 語法（考前快速掃過用） =====
   每個 item：t = 標題；c = 程式碼片段（會語法上色）；或 d = 純文字提醒。 */
const CHEAT = [
  {
    id: "io", name: "輸入輸出", items: [
      { t: "讀一個整數 / 一行字串", c: `n = int(input())        # 一個整數
s = input().strip()     # 一行字串（順手去掉頭尾空白與換行）` },
      { t: "一行多個數字", c: `a, b, c = map(int, input().split())     # 剛好三個
nums = list(map(int, input().split()))  # 不確定幾個，全丟進 list` },
      { t: "讀 N 行 / 讀 N×M 矩陣", c: `n = int(input())
arr = [int(input()) for _ in range(n)]           # N 行，每行一個數

r, c = map(int, input().split())
grid = [list(map(int, input().split())) for _ in range(r)]   # 矩陣` },
      { t: "讀到沒有資料為止（EOF）", c: `import sys
for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    # 處理 line` },
      { t: "輸出格式", c: `print(a, b)                  # 用空白隔開
print(*nums)                 # 把 list 展開印，也是空白隔開
print(" ".join(map(str, nums)))   # 自己控制分隔符
print(f"{x:.2f}")            # 小數點後 2 位
print(f"{n:03d}")            # 補零到 3 位
print(x, end="")             # 不換行` },
    ]
  },
  {
    id: "num", name: "數字運算", items: [
      { t: "整除、餘數、次方", c: `7 / 2     # 3.5   一定是小數
7 // 2    # 3     整除
7 % 2     # 1     餘數
2 ** 10   # 1024  次方（右結合：2**3**2 = 512）` },
      { t: "負數的坑（跟 C/Java 不一樣）", c: `-7 // 2   # -4   往負無窮捨去（不是 -3）
-7 % 2    #  1   餘數正負跟「除數」相同
int(-3.7) # -3   int() 是往 0 捨去` },
      { t: "拆數字每一位", c: `ones = n % 10          # 個位
tens = (n // 10) % 10  # 十位

total = 0
while n > 0:           # 各位數字總和
    total += n % 10
    n //= 10` },
      { t: "常用函式", c: `abs(-7)          # 7
max(a), min(a)   # 最大 / 最小
sum(a)           # 總和
divmod(17, 5)    # (3, 2) 商與餘數
int(x ** 0.5)    # 開根號取整（判質數用）` },
    ]
  },
  {
    id: "bit", name: "位元運算", items: [
      { t: "五個運算子", c: `a & b    # AND  兩位都是 1 才 1
a | b    # OR   有一位是 1 就 1
a ^ b    # XOR  兩位不同才 1
~a       # NOT  等於 -a-1
a << n   # 左移 = 乘以 2**n
a >> n   # 右移 = 除以 2**n（捨去）` },
      { t: "必背四技巧", c: `(n & 1) == 0                  # 偶數（括號要加！）
n > 0 and (n & (n-1)) == 0    # n 是 2 的次方
n & -n                        # 取出最低位的 1

result = 0                    # 找出唯一出現奇數次的數
for x in nums:
    result ^= x` },
      { t: "位元當開關", c: `state |= (1 << k)     # 打開第 k 個
state &= ~(1 << k)    # 關閉第 k 個
state ^= (1 << k)     # 切換第 k 個
bool(state & (1 << k))     # 第 k 個開著嗎
bin(state).count("1")      # 有幾個開著` },
      { t: "進位轉換", c: `bin(13)          # '0b1101'
int('1101', 2)   # 13
hex(255)         # '0xff'` },
    ]
  },
  {
    id: "list", name: "串列 list", items: [
      { t: "基本操作", c: `a.append(x)      # 尾端加
a.insert(0, x)   # 指定位置插入
a.pop()          # 拿走最後一個（回傳它）
a.pop(0)         # 拿走第一個（慢，O(n)）
a.remove(v)      # 移除「值」為 v 的第一個
del a[i]         # 移除索引 i` },
      { t: "切片", c: `a[2:5]    # 索引 2,3,4（含頭不含尾）
a[:3]     # 前三個
a[-2:]    # 最後兩個
a[::2]    # 每隔一個
a[::-1]   # 反轉` },
      { t: "排序與推導式", c: `sorted(a)          # 回傳新的排序結果（a 不變）
a.sort()           # 原地排序，回傳 None！
a.sort(reverse=True)

b = [x * 2 for x in a]          # 每個乘 2
c = [x for x in a if x > 3]     # 只留大於 3 的` },
      { t: "二維陣列（一定要這樣建）", c: `grid = [[0] * c for _ in range(r)]   # 正確
# grid = [[0] * c] * r              ← 錯！三列會共用同一個 list` },
      { t: "方向陣列（四鄰居）", c: `dr = [-1, 1, 0, 0]
dc = [0, 0, -1, 1]
for k in range(4):
    ni, nj = i + dr[k], j + dc[k]
    if 0 <= ni < R and 0 <= nj < C:    # 邊界檢查不能省
        ...` },
    ]
  },
  {
    id: "str", name: "字串與字元", items: [
      { t: "常用方法", c: `s.upper()   s.lower()
s.strip()                  # 去頭尾空白
s.split(",")               # 切成 list
"-".join(lst)              # list 接成字串
s.replace("a", "b")
s.find("x")                # 找不到回傳 -1
s.count("a")
s[::-1]                    # 反轉（字串不可變，要重建）` },
      { t: "字元 ↔ 編碼", c: `ord('A')  # 65
ord('a')  # 97
ord('0')  # 48
chr(65)   # 'A'
ord(c) - ord('a')   # 字母 → 0~25
int(c)              # 數字字元 → 數字` },
      { t: "字元判斷", c: `c.isdigit()  c.isalpha()  c.isalnum()
c.isupper()  c.islower()  c.isspace()` },
      { t: "凱撒加解密", c: `# 往後移 k：先減起點 → 位移 → % 26 → 加回起點
chr((ord(ch) - ord('A') + k) % 26 + ord('A'))   # 大寫
chr((ord(ch) - ord('a') + k) % 26 + ord('a'))   # 小寫
# 往前移就把 + k 換成 - k（Python 的 % 對負數會給正值，剛好繞回）` },
      { t: "字母頻率統計", c: `cnt = [0] * 26
for ch in s:
    if ch.isalpha():
        cnt[ord(ch.lower()) - ord('a')] += 1` },
    ]
  },
  {
    id: "ds", name: "堆疊 / 佇列 / 字典", items: [
      { t: "堆疊 stack（後進先出）", c: `stack = []
stack.append(x)      # push
if stack:            # 取之前先確認非空
    top = stack.pop()  # pop（回傳拿走的值）` },
      { t: "佇列 queue（先進先出）", c: `from collections import deque
q = deque()
q.append(x)      # 進（尾端）
first = q.popleft()   # 出（前端），O(1)` },
      { t: "括號匹配", c: `pairs = {')': '(', ']': '[', '}': '{'}
for ch in s:
    if ch in "([{":
        stack.append(ch)
    elif ch in ")]}":
        if not stack or stack.pop() != pairs[ch]:
            return False
return len(stack) == 0    # 掃完要空的` },
      { t: "字典當計數器", c: `cnt = {}
for ch in s:
    cnt[ch] = cnt.get(ch, 0) + 1
best = max(cnt, key=cnt.get)    # 出現最多次的 key` },
    ]
  },
  {
    id: "algo", name: "排序 / 搜尋 / 遞迴", items: [
      { t: "三種 O(n²) 排序的核心", d: "氣泡＝相鄰交換（每輪最大值浮到最後、後段先定型）；選擇＝每輪挑最小換到前面（前段先定型）；插入＝插進前面已排序區段（資料接近排好時最快）。" },
      { t: "二分搜尋（資料要先排序）", c: `lo, hi = 0, len(a) - 1
while lo <= hi:
    mid = (lo + hi) // 2
    if a[mid] == target:
        return mid
    elif a[mid] < target:
        lo = mid + 1     # 往右半找
    else:
        hi = mid - 1     # 往左半找
return -1` },
      { t: "上界 upper bound（插入位置）", c: `lo, hi = 0, len(a)
while lo < hi:
    mid = (lo + hi) // 2
    if a[mid] <= target:
        lo = mid + 1
    else:
        hi = mid
# 答案 = lo` },
      { t: "遞迴骨架", c: `def f(n):
    if n == 0:          # ① 終止條件
        return 1
    return n * f(n - 1) # ② 規模要變小

memo = {}               # 記憶化：避免重算
def fib(n):
    if n in memo: return memo[n]
    if n <= 1: return n
    memo[n] = fib(n-1) + fib(n-2)
    return memo[n]` },
      { t: "複雜度速記", d: "O(1) < O(log n) < O(n) < O(n log n) < O(n²) < O(2ⁿ)。變數每次「加減」→ O(n)；每次「乘除」→ O(log n)；雙層迴圈 → O(n²)。" },
    ]
  },
  {
    id: "warn", name: "考前地雷提醒", items: [
      { t: "只印答案", d: "不要印「請輸入…」之類的提示文字，判題是逐字比對，多印就錯。" },
      { t: "input() 一定要轉型", d: "input() 回傳字串，要算數學前先 int() / float()。\"3\" + \"4\" 會得到 \"34\"。" },
      { t: "二維陣列別用 * 建", d: "[[0]*c]*r 三列會共用同一個 list，改一格全部一起變。要用 [[0]*c for _ in range(r)]。" },
      { t: "a = a.sort() 會變 None", d: ".sort() 原地排序回傳 None；要新的排序結果用 sorted(a)。" },
      { t: "負數的 // 與 %", d: "-7 // 2 = -4、-7 % 2 = 1，跟 C/Java 不同，觀念題很愛考。" },
      { t: "縮排只用空白", d: "Tab 與空白混用會 TabError；整份程式統一 4 個空白。" },
      { t: "邊界自己先測", d: "只有 1 筆資料、空輸入、全部相同、第一個與最後一個元素，這四種最容易 WA。" },
      { t: "range 的 off-by-one", d: "要跑 1~n 是 range(1, n+1)；要跑索引 0~n-1 是 range(n)。" },
    ]
  },
];
