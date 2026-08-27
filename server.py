# 개발용 정적 서버 — 캐시 완전 비활성화 + 멀티스레드 (keep-alive에 안 막히게)
import http.server

PORT = 8321


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Expires', '0')
        super().end_headers()


with http.server.ThreadingHTTPServer(('', PORT), NoCacheHandler) as httpd:
    print(f'dev server on http://localhost:{PORT}')
    httpd.serve_forever()
