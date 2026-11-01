"""Extract readable article text from the user-supplied local HTML snapshot."""
from html.parser import HTMLParser
from pathlib import Path
import hashlib
import json
import re

SOURCE = Path('C:/1new-code/个人找工作和兼职合作-anytingchina')
OUT = Path(__file__).parent / '2026-10-01-wechat-extracted.json'
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}
BLOCK = {'p', 'div', 'section', 'article', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 'tr'}

class ArticleParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []
        self.capture_depth = None
        self.title_depth = None
        self.parts = []
        self.title_parts = []
        self.images = []
        self.links = []
        self.regions = 0

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag not in VOID:
            self.stack.append(tag)
        if tag == 'title':
            self.title_depth = len(self.stack)
        if attrs.get('id') == 'js_content':
            self.capture_depth = len(self.stack)
            self.regions += 1
        if self.capture_depth is not None:
            if tag in BLOCK or tag in {'br', 'hr'}:
                self.parts.append('\n')
            if tag == 'img':
                src = attrs.get('data-src') or attrs.get('src') or ''
                self.images.append('embedded' if src.startswith('data:') else src)
            if tag == 'a' and attrs.get('href'):
                self.links.append(attrs['href'])

    def handle_endtag(self, tag):
        if self.capture_depth is not None and tag in BLOCK:
            self.parts.append('\n')
        if tag not in self.stack:
            return
        idx = len(self.stack) - 1 - self.stack[::-1].index(tag)
        if self.capture_depth is not None and idx < self.capture_depth:
            self.capture_depth = None
        if self.title_depth is not None and idx < self.title_depth:
            self.title_depth = None
        del self.stack[idx:]

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            self.handle_endtag(tag)

    def handle_data(self, data):
        if self.title_depth is not None:
            self.title_parts.append(data)
        if self.capture_depth is not None and not any(t in {'script', 'style', 'noscript'} for t in self.stack):
            self.parts.append(data)

links = json.loads((SOURCE / 'wechat_articles_links.json').read_text(encoding='utf-8-sig'))
files = sorted((SOURCE / 'wechat_articles').glob('*.html'))
rows = []
for idx, link in enumerate(links, 1):
    matches = [f for f in files if f.name.startswith(f'{idx:03d}_')]
    if len(matches) != 1:
        raise ValueError(f'Expected one file for ID {idx}, got {len(matches)}')
    f = matches[0]
    raw = f.read_bytes()
    h = raw.decode('utf-8-sig')
    p = ArticleParser()
    p.feed(h)
    text = '\n'.join(s for line in ''.join(p.parts).splitlines() if (s := re.sub(r'[\t \xa0]+', ' ', line).strip()))
    rows.append({
        'id': f'{idx:03d}', 'title': link['title'], 'url': link['url'], 'file': str(f),
        'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest(),
        'html_title': ''.join(p.title_parts).strip(), 'content_regions': p.regions,
        'text': text, 'text_chars': len(text), 'image_count': len(p.images),
        'embedded_image_count': sum(s == 'embedded' for s in p.images),
        'remote_images': list(dict.fromkeys(s for s in p.images if s and s != 'embedded')),
        'links': list(dict.fromkeys(p.links)),
        'is_verification_page': '当前环境异常' in h and '去验证' in h,
        'content_status': 'readable_text' if text else ('image_only' if p.images else 'empty_export'),
    })
if len(rows) != 98 or any(r['content_regions'] != 1 for r in rows):
    raise ValueError('Unexpected corpus structure')
OUT.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'articles': len(rows), 'total_text_chars': sum(r['text_chars'] for r in rows),
    'min_text_chars': min(r['text_chars'] for r in rows), 'max_text_chars': max(r['text_chars'] for r in rows),
    'verification_pages': sum(r['is_verification_page'] for r in rows),
    'readable_articles': sum(r['content_status'] == 'readable_text' for r in rows),
    'empty_exports': [r['id'] for r in rows if r['content_status'] == 'empty_export'],
    'output': str(OUT), 'lengths': [[r['id'], r['text_chars']] for r in rows]}, ensure_ascii=False))
