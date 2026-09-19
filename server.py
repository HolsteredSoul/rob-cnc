import http.server
import socketserver
import os
import sys
import webbrowser

PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))


class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

    def guess_type(self, path):
        mimetype = super().guess_type(path)
        if path.endswith('.js'):
            return 'application/javascript'
        if path.endswith('.css'):
            return 'text/css'
        if path.endswith('.html'):
            return 'text/html'
        return mimetype

    def log_message(self, format, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), format % args))


class ThreadingHTTPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    # Chrome opens extra connections (favicon, preconnect). A single-thread
    # TCPServer deadlocks those while the first request is still in flight.
    daemon_threads = True
    # A reload can burst more parallel asset connections than TCPServer's
    # default five-slot queue, especially while another tab is still loading.
    request_queue_size = 64
    allow_reuse_address = True
    block_on_close = False


def bind_server(handler):
    last_error = None
    for port in range(PORT, PORT + 10):
        try:
            httpd = ThreadingHTTPServer(('127.0.0.1', port), handler)
            return httpd, port
        except OSError as err:
            last_error = err
    raise last_error


if __name__ == '__main__':
    os.chdir(DIRECTORY)

    try:
        httpd, bound_port = bind_server(CustomHandler)
        url = f"http://127.0.0.1:{bound_port}/index.html"
        print("=" * 60)
        print("  COMMAND & CONQUER RTS: OPERATION VANGUARD")
        print(f"  Local Web Server running at: {url}")
        print("  Press Ctrl+C to stop the server")
        print("=" * 60)

        if "--no-browser" not in sys.argv:
            try:
                webbrowser.open(url)
            except Exception as e:
                print(f"Could not open browser automatically: {e}")

        try:
            httpd.serve_forever()
        finally:
            httpd.server_close()
    except KeyboardInterrupt:
        print("\nServer shutting down.")
    except Exception as e:
        print(f"Server error: {e}")
        sys.exit(1)
