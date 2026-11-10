#!/usr/bin/env node
/* Syntax-check inline scripts in VCE HTML, not only external .js files.
   The page parser uses JS-literal script tags. No scripts are executed. */
import {readdirSync,readFileSync} from 'node:fs';
import {join,relative,extname} from 'node:path';
import {spawnSync} from 'node:child_process';
const root=process.cwd(),ignored=new Set(['.git','node_modules','race-controle-windows','__pycache__']);
const failures=[];let pages=0,scripts=0;
function scan(dir){
 for(const item of readdirSync(dir,{withFileTypes:true})){
  if(ignored.has(item.name))continue;
  const full=join(dir,item.name);
  if(item.isDirectory())scan(full);
  else if(item.isFile()&&extname(item.name).toLowerCase()==='.html')check(full);
 }
}
function check(file){
 pages++;
 const raw=readFileSync(file,'utf8');
 const re=/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
 let match,index=0;
 while((match=re.exec(raw))){
  index++;
  const attrs=match[1],content=match[2];
  if(/\bsrc\s*=/.test(attrs)||!content.trim())continue;
  const type=attrs.match(/\btype\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase();
  if(type&&!['module','text/javascript','application/javascript'].includes(type))continue;
  scripts++;
  const args=['--check',...(type==='module'?['--input-type=module']:[]),'-'];
  const result=spawnSync(process.execPath,args,{input:content,encoding:'utf8'});
  if(result.status!==0)failures.push({file:relative(root,file),script:index,stderr:(result.stderr||'').trim().slice(0,700)});
 }
}
scan(root);
console.log('VCE inline JS:',pages,'HTML pages /',scripts,'script sections');
for(const f of failures)console.error('INLINE SCRIPT ERROR',f.file,'script #'+f.script,'\n',f.stderr);
if(failures.length)process.exit(1);
