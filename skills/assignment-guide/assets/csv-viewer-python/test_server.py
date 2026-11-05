import json
import tempfile
import unittest
from pathlib import Path
from server import Viewer


class ViewerTests(unittest.TestCase):
    def test_files_raw_content_and_path_boundary(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            data = root / 'inputs'
            data.mkdir()
            content = '\ufeff이름,값\n"여러\n줄",10\n'.encode('utf-8')
            (data / 'example.csv').write_bytes(content)
            (root / 'secret.csv').write_text('secret')
            (data / 'link.csv').symlink_to(root / 'secret.csv')
            viewer = Viewer(data)
            self.assertEqual(viewer.files(), [{'id': 'example.csv', 'bytes': len(content)}])
            self.assertEqual(viewer.response('/api/file?file=example.csv')[2], content)
            for name in ('../secret.csv', 'link.csv', '/etc/passwd'):
                self.assertEqual(viewer.response('/api/file?file=' + name)[0], 400)
            self.assertEqual(viewer.response('/server.py')[0], 404)
            (data / 'bad.csv').write_bytes(b'\xff')
            self.assertEqual(viewer.response('/api/file?file=bad.csv')[0], 400)

    def test_preview_prefix_and_static_assets(self):
        with tempfile.TemporaryDirectory() as folder:
            viewer = Viewer(folder, '/proxy/3000')
            self.assertEqual(viewer.response('/proxy/3000/')[1]['Location'], '/proxy/3000/data')
            for url in ('/data', '/app.js', '/style.css', '/api/files'):
                self.assertEqual(viewer.response('/proxy/3000' + url)[0], 200)
            self.assertEqual(viewer.response('/api/files')[0], 404)


if __name__ == '__main__':
    unittest.main()
