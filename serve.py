"""本機預覽伺服器：跟 `python3 -m http.server` 一樣，但會叫瀏覽器每次都檢查檔案有沒有更新。

用法（在專案根目錄）：
    python3 serve.py          # 預設 8000 port
    python3 serve.py 8080     # 指定 port
然後開 http://localhost:8000/website/

為什麼需要它：內建的 http.server 不送 Cache-Control，瀏覽器會自己決定把
app.js、plan.js、教材 .md 快取多久。改了程式之後，瀏覽器可能還在用舊版，
就會出現「明明修好了，點下去還是沒反應」。這裡一律送 no-cache：
檔案沒變時瀏覽器只會拿到 304（很快），有變就一定拿到新版。
"""
import http.server
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    with http.server.ThreadingHTTPServer(("", port), NoCacheHandler) as httpd:
        print(f"學習網站：http://localhost:{port}/website/   （Ctrl+C 停止）")
        httpd.serve_forever()
