#!/usr/bin/env python3
"""Verify VCE CSS files, embedded style blocks, local assets and HTML viewport metadata."""
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit,unquote

ROOT=Path(__file__).resolve().parents[1]
SKIP={'.git','node_modules','race-controle-windows','__pycache__','.venv'}
ISSUES=[]
WARNINGS=[]
URL=re.compile(r"url\(\s*(?:'([^']*)'|\"([^\"]*)\"|([^)]*))\s*\)",re.I)
IMPORT=re.compile(r"@import\s+(?:'([^']+)'|\"([^\"]+)\")",re.I)

class Page(HTMLParser):
 def __init__(self):
  super().__init__(convert_charrefs=False)
  self.links=[];self.styles=[];self.styling=False;self.chunks=[];self.viewport=False;self.lang=False
 def handle_starttag(self,tag,attrs):
  d=dict(attrs)
  if tag=='html':self.lang=bool(d.get('lang'))
  if tag=='meta' and (d.get('name') or '').lower()=='viewport':self.viewport=True
  if tag=='link' and 'stylesheet' in (d.get('rel') or '').lower() and d.get('href'):self.links.append(d['href'])
  if tag=='style':self.styling=True;self.chunks=[]
 def handle_data(self,data):
  if self.styling:self.chunks.append(data)
 def handle_endtag(self,tag):
  if tag=='style' and self.styling:self.styles.append(''.join(self.chunks));self.styling=False

def check_ref(ref,owner):
 ref=ref.strip().strip('\"\'')
 if not ref or ref.startswith(('#','data:','blob:','about:','//','var(','https:','http:')) or ('$'+'{') in ref or '{{' in ref:return
 name=unquote(urlsplit(ref).path)
 if not name:return
 target=((ROOT/name.lstrip('/')) if name.startswith('/') else owner.parent/name).resolve()
 if not target.is_relative_to(ROOT):ISSUES.append(f'PATH_OUTSIDE_ROOT {owner.relative_to(ROOT)} -> {ref}')
 elif not target.is_file():ISSUES.append(f'MISSING_ASSET {owner.relative_to(ROOT)} -> {ref}')

def css_balance(source,identifier):
 opened=[];comment=False;quote=None;i=0
 pairs={')':'(',']':'[','}':'{'}
 while i<len(source):
  c=source[i];n=source[i+1] if i+1<len(source) else ''
  if comment:
   if c=='*' and n=='/':comment=False;i+=2;continue
  elif quote:
   if c=='\\':i+=2;continue
   if c==quote:quote=None
  elif c=='/' and n=='*':comment=True;i+=2;continue
  elif c in ('"',"'"):quote=c
  elif c=='\\':i+=2;continue
  elif c in '([{':opened.append(c)
  elif c in ')]}':
   if not opened or opened.pop()!=pairs[c]:ISSUES.append(f'UNBALANCED_CSS {identifier} character {i}');return
  i+=1
 if comment:ISSUES.append(f'UNCLOSED_COMMENT {identifier}')
 if quote:ISSUES.append(f'UNCLOSED_STRING {identifier}')
 if opened:ISSUES.append(f'UNCLOSED_CSS {identifier} trailing {opened[-1]}')

def check_css(s,owner,label):
 css_balance(s,label)
 for match in URL.finditer(s):
  check_ref(next((x for x in match.groups() if x is not None),''),owner)
 for match in IMPORT.finditer(s):
  check_ref(next((x for x in match.groups() if x is not None),''),owner)
 if len(s)>5000 and '@media' not in s and 'overlay' not in label:WARNINGS.append(f'NO_RESPONSIVE_RULES {label}')
 count=len(re.findall(r'font-size\s*:\s*[1-9]px\b',s,re.I))
 if count>2:WARNINGS.append(f'TINY_FONT_RULES {label}: {count}')
 if s.count('!important')>80:WARNINGS.append(f'HEAVY_CSS_OVERRIDES {label}: {s.count("!important")}')

def find_files(extension):
 return [f for f in ROOT.rglob('*'+extension) if not (set(f.relative_to(ROOT).parts)&SKIP)]

def main():
 css=find_files('.css');html=find_files('.html');inlines=0
 for p in css:check_css(p.read_text(encoding='utf-8-sig'),p,p.relative_to(ROOT).as_posix())
 for p in html:
  parser=Page()
  try:parser.feed(p.read_text(encoding='utf-8-sig'));parser.close()
  except Exception as e:ISSUES.append(f'HTML_ERROR {p.relative_to(ROOT)}: {e}');continue
  if not parser.viewport:ISSUES.append(f'NO_VIEWPORT {p.relative_to(ROOT)}')
  if not parser.lang:WARNINGS.append(f'NO_LANG {p.relative_to(ROOT)}')
  linked=set()
  for href in parser.links:
   check_ref(href,p)
   canon=href.split('?')[0]
   if canon in linked:WARNINGS.append(f'DUPLICATE_STYLESHEET {p.relative_to(ROOT)} -> {canon}')
   linked.add(canon)
  for i,s in enumerate(parser.styles):
   inlines+=1;check_css(s,p,f'{p.relative_to(ROOT)} inline style {i+1}')
 print(f'VCE CSS audit: {len(css)} CSS files, {len(html)} HTML pages, {inlines} embedded styles')
 print(f'Warnings ({len(WARNINGS)}):')
 for x in sorted(WARNINGS):print('WARN',x)
 print(f'Errors ({len(ISSUES)}):')
 for x in sorted(ISSUES):print('ERROR',x)
 return 1 if ISSUES else 0

if __name__=='__main__':sys.exit(main())
