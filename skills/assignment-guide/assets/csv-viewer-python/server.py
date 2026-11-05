"""CSV explorer using only Python's standard library. Run manually."""
import argparse
import json
import os
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit


class Viewer:
    def __init__(self, data_dir, base_path=''):
        self.root = Path(data_dir).resolve(strict=True)
        if not self.root.is_dir():
            raise ValueError('CSV 폴더를 지정하세요.')
        self.base = '/' + base_path.strip('/') if base_path.strip('/') else ''
        self.static = Path(__file__).resolve().parent / 'static'

    def files(self):
        result = []
        for folder, dirs, names in os.walk(self.root, followlinks=False):
            dirs[:] = [d for d in dirs if not (Path(folder) / d).is_symlink()]
            for name in names:
                p = Path(folder) / name
                if p.is_symlink() or not p.is_file() or p.suffix.lower() != '.csv':
                    continue
                result.append({'id': p.relative_to(self.root).as_posix(), 'bytes': p.stat().st_size})
        return sorted(result, key=lambda f: f['id'])

    def response(self, url):
        parsed = urlsplit(url)
        path = parsed.path
        headers = {'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'}
        if path in (self.base, self.base + '/'):
            return 302, dict(headers, Location=self.base + '/data'), b''
        if self.base and not path.startswith(self.base + '/'):
            return 404, headers, b'Not found'
        path = path[len(self.base):]
        try:
            static = {'/data': ('index.html', 'text/html'), '/app.js': ('app.js', 'text/javascript'), '/style.css': ('style.css', 'text/css')}
            if path in static:
                name, content_type = static[path]
                headers['Content-Type'] = content_type + '; charset=utf-8'
                return 200, headers, (self.static / name).read_bytes()
            if path == '/api/files':
                headers['Content-Type'] = 'application/json; charset=utf-8'
                return 200, headers, json.dumps({'files': self.files()}, ensure_ascii=False).encode('utf-8')
            if path == '/api/file':
                name = parse_qs(parsed.query).get('file', [''])[0]
                if name not in {f['id'] for f in self.files()}:
                    raise ValueError('선택할 수 없는 파일입니다.')
                target = self.root / name
                if any(p.is_symlink() for p in [target, *target.parents] if p != self.root):
                    raise ValueError('심볼릭 링크는 읽을 수 없습니다.')
                resolved = target.resolve(strict=True)
                resolved.relative_to(self.root)
                content = resolved.read_bytes()
                content.decode('utf-8-sig')  # Fail explicitly instead of replacing invalid bytes.
                headers['Content-Type'] = 'text/plain; charset=utf-8'
                return 200, headers, content
            return 404, headers, b'Not found'
        except (OSError, ValueError) as error:
            headers['Content-Type'] = 'application/json; charset=utf-8'
            message = 'UTF-8 CSV 파일이 아닙니다.' if isinstance(error, UnicodeError) else '파일을 읽을 수 없습니다. 데이터 경로와 권한을 확인하세요.'
            if isinstance(error, ValueError) and not isinstance(error, UnicodeError):
                message = str(error)
            return 400, headers, json.dumps({'error': message}, ensure_ascii=False).encode('utf-8')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data-dir', required=True, help='CSV folder, relative to current directory or absolute')
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=3000)
    parser.add_argument('--base-path', default='', help='Optional preview proxy path, for example /proxy/3000')
    args = parser.parse_args()
    viewer = Viewer(args.data_dir, args.base_path)

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            status, headers, content = viewer.response(self.path)
            self.send_response(status)
            for key, value in headers.items():
                self.send_header(key, value)
            self.send_header('Content-Length', str(len(content)))
            self.end_headers()
            self.wfile.write(content)

    server = ThreadingHTTPServer((args.host, args.port), Handler)
    print('CSV folder:', viewer.root, flush=True)
    print('Open: http://localhost:{}{}/data'.format(args.port, viewer.base), flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
