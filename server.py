import http.server, socketserver, os

PORT = 8080
os.chdir(os.path.dirname(os.path.abspath(__file__)))

class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        print(f"[TwinFlame] {args[0]} {args[1]}")

print(f"TwinFlame ruleaza pe http://localhost:{PORT}")
print(f"De pe telefon: http://<IP-ul-tau>:{PORT}")
print("Apasa Ctrl+C pentru a opri.\n")

with socketserver.TCPServer(("0.0.0.0", PORT), Handler) as httpd:
    httpd.serve_forever()