#!/usr/bin/env python3
"""Static validation for VCE GitHub Pages, JSON resources and JS/CSS assets.
No server credentials or game files are ever read or written.
"""
from __future__ import annotations
import json
import pathlib
import re
import sys
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote

ROOT = pathlib.Path(__file__).resolve().parent.parent
IGNORED = {'.git', 'node_modules', '__pycache__', 'race-controle-windows', '.github'}
errors, warnings = [], []

def paths(glob):
    return [p for p in ROOT.rglob(glob) if not any(k in IGNORED for k in p.relative_to(ROOT).parts)]

class PageParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids, self.links, self.inline = set(), [], []
        self.tag = None
    def handle_starttag(self, tag, attrs):
        props = dict(attrs)
        identifier = props.get('id')
        if identifier:
            if identifier in self.ids: self.inline.append(f'duplicate id: {identifier}')
            self.ids.add(identifier)
        if tag in ('script', 'link', 'img'):
            ref = props.get('src') if tag != 'link' else props.get('href')
            if ref: self.links.append(ref)
        if tag == 'script': self.tag = 'script'
    def handle_endtag(self, tag):
        if tag == 'script': self.tag = None

def check_json():
    total = 0
    for path in paths('*.json'):
        total += 1
        try:
            # The full 5000-diagnostic resource is also checked, not truncated.
            json.loads(path.read_text(encoding='utf-8-sig'))
        except (ValueError, UnicodeError) as e:
            errors.append(f'JSON INVALID {path.relative_to(ROOT)}: {e}')
    return total

def check_html():
    count = 0
    for page in paths('*.html'):
        count += 1
        try: text = page.read_text(encoding='utf-8-sig')
        except UnicodeError as e:
            errors.append(f'HTML INVALID {page}: {e}'); continue
        parser = PageParser()
        try: parser.feed(text)
        except ValueError as e: errors.append(f'HTML INVALID {page}: {e}')
        for issue in parser.inline:
            warnings.append(f'{page.relative_to(ROOT)}: {issue}')
        for ref in parser.links:
            if ref.startswith(('http:', 'https:', 'data:', '#', '//','mailto:','tel:')):
                continue
            relative = unquote(urlsplit(ref).path)
            if not relative: continue
            if relative.startswith('/'): target = ROOT / relative.lstrip('/')
            else: target = page.parent / relative
            if not target.is_file():
                warnings.append(f'MISSING LOCAL ASSET {page.relative_to(ROOT)} -> {ref}')
    return count

def check_special():
    index = ROOT / 'data/ressources/manifest.json'
    if not index.exists():
        errors.append('Missing resource index: data/ressources/manifest.json')
        return
    manifest = json.loads(index.read_text(encoding='utf-8'))
    for resource in manifest.get('resources', []):
        target = ROOT / resource['path']
        if not target.is_file(): errors.append('Manifest resource missing: ' + resource['path'])
    for original in ('data/vce/pilotes.json','data/solutions_1000.json','data/solutions_5000.json'):
        if not (ROOT / original).exists(): errors.append('Required backwards-compatible path missing: ' + original)
    base = json.loads((ROOT / 'data/ressources/coach-index-v1.json').read_text(encoding='utf-8'))
    if not base or any(not x.get('id') or not x.get('solution') for x in base):
        errors.append('Coach index has blank IDs or solutions')

if __name__ == '__main__':
    j = check_json()
    h = check_html()
    check_special()
    print(f'VCE audit: {h} HTML pages, {j} JSON resource files')
    for warning in warnings[:80]: print('WARN:', warning)
    if len(warnings)>80: print(f'WARN: ... and {len(warnings)-80} additional notices')
    for error in errors: print('ERROR:', error)
    print(f'Errors: {len(errors)} / Notices: {len(warnings)}')
    sys.exit(1 if errors else 0)
