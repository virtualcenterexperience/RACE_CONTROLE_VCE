/* VCE GRAPH 3.5 — Native telemetry, shared scale for pilot and reference.
 * No smoothing or fabricated 120 Hz samples; gears are drawn as steps.
 */
(()=>{'use strict';
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const pick=(p,names)=>{
 if(!p)return null;
 for(const n of names)if(finite(p[n]))return Number(p[n]);
 return null;
};
const channels={
 throttle:{label:'ACCÉLÉRATEUR',unit:'%',names:['throttle'],color:'#1cdf91',min:0,max:1,percent:true},
 brake:{label:'FREIN',unit:'%',names:['brake'],color:'#ff5570',min:0,max:1,percent:true},
 speed:{label:'VITESSE',unit:'km/h',names:['speed','speed_kmh'],color:'#9290ff',floor:0},
 gear:{label:'GEARS',unit:'',names:['gear'],color:'#5db7ff',stepped:true},
 delta:{label:'DELTA CHRONO',unit:'s',names:['delta'],color:'#ffb36f',symmetric:true},
 steering:{label:'VOLANT',unit:'',names:['steering','steer'],color:'#e5bf68',symmetric:true},
 rpm:{label:'RÉGIME MOTEUR',unit:'tr/min',names:['rpm'],color:'#f65d60',floor:0}
};
function bounds(kind,main,ref){
 const d=channels[kind]||channels.speed;
 if(d.percent)return [0,1];
 const vals=[];
 for(const data of [main,ref])for(const x of data||[]){const v=pick(x,d.names);if(v!==null)vals.push(v)}
 if(!vals.length)return null;
 let lo=Math.min(...vals.slice(0,10000)),hi=Math.max(...vals.slice(0,10000));
 if(vals.length>10000){for(let i=10000;i<vals.length;i++){lo=Math.min(lo,vals[i]);hi=Math.max(hi,vals[i])}}
 if(d.stepped)return [Math.floor(Math.min(0,lo)-.5),Math.ceil(hi+.5)];
 if(d.symmetric){const maximum=Math.max(kind==='delta'?.05:.25,Math.abs(lo),Math.abs(hi));return [-maximum*1.12,maximum*1.12]}
 if(kind==='speed')return [0,Math.max(25,Math.ceil(hi/25)*25)];
 if(d.floor===0)return [0,Math.max(1,Math.ceil(hi/1000)*1000)];
 const margin=Math.max(.001,(hi-lo)*.08);return [lo-margin,hi+margin]
}
function draw(canvas,{key,primary=[],reference=[],axis='distance',cursor=null,title=null}={}){
 const ctx=canvas.getContext('2d');if(!ctx)return;
 const w=canvas.width,h=canvas.height,d=channels[key]||channels.speed;
 ctx.fillStyle='#101924';ctx.fillRect(0,0,w,h);
 const pad={l:78,r:22,t:28,b:20},top=pad.t,bottom=h-pad.b;
 ctx.font='bold 14px Segoe UI';ctx.fillStyle=d.color;ctx.fillText(title||d.label,12,18);
 const getX=x=>axis==='time'?pick(x,['t']):pick(x,['distance','lap_pos']);
 const all=[...primary,...reference];
 let minX=Infinity,maxX=-Infinity;
 for(const p of all){const x=getX(p);if(x!==null){minX=Math.min(minX,x);maxX=Math.max(maxX,x)}}
 if(!Number.isFinite(minX)){minX=0;maxX=1}
 if(maxX<=minX)maxX=minX+1;
 const getPixelX=x=>pad.l+(x-minX)/(maxX-minX)*(w-pad.l-pad.r);
 const range=bounds(key,primary,reference);
 const count=primary.filter(p=>pick(p,d.names)!==null).length;
 ctx.fillStyle='#98b2c9';ctx.font='12px Segoe UI';
 if(!range||count<2){
  ctx.fillText('Mesures pilotes indisponibles pour ce canal',pad.l,60);
  return {ok:false,count,reason:'channel_empty'}
 }
 const pixY=x=>bottom-(x-range[0])/Math.max(.0000001,range[1]-range[0])*(bottom-top);
 for(let i=0;i<=4;i++){
  const y=top+(bottom-top)*i/4;
  ctx.beginPath();ctx.strokeStyle='#304154';ctx.lineWidth=1;ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();
  const real=range[1]-(range[1]-range[0])*i/4;
  ctx.fillStyle='#a3b7cd';ctx.fillText((d.percent?real*100:real).toFixed(d.stepped?0:d.percent?0:1)+(d.unit||''),6,y+4)
 }
 const render=(samples,color,strokeWidth)=>{
  let prev=null,active=false;
  ctx.strokeStyle=color;ctx.lineWidth=strokeWidth;ctx.beginPath();
  for(const p of samples){
   const raw=getX(p),v=pick(p,d.names);
   if(v===null||raw===null){active=false;prev=null;continue}
   const x=getPixelX(raw),y=pixY(v);
   if(!Number.isFinite(x)||!Number.isFinite(y))continue;
   // Repeated samples are never interpolated. Large time/progress gaps remain visible.
   const jump=prev&&(raw<prev.raw||(axis==='time'&&raw-prev.raw>1)||(axis!=='time'&&raw-prev.raw>.04));
   if(!active||jump){ctx.moveTo(x,y);active=true}
   else if(d.stepped){ctx.lineTo(x,prev.y);ctx.lineTo(x,y)}
   else ctx.lineTo(x,y);
   prev={raw,y};
  }
  ctx.stroke()
 };
 if(reference?.length&&key!=='delta')render(reference,'#5ca8ff',1.5);
 render(primary,d.color,2.3);
 if(key==='delta'){
  const y0=pixY(0);ctx.strokeStyle='#c2d3e466';ctx.setLineDash([6,4]);ctx.beginPath();ctx.moveTo(pad.l,y0);ctx.lineTo(w-pad.r,y0);ctx.stroke();ctx.setLineDash([]);
 }
 if(Number.isFinite(cursor)){
  const cx=pad.l+Math.max(0,Math.min(1,cursor))*(w-pad.l-pad.r);
  ctx.strokeStyle='#ffffff80';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(cx,top);ctx.lineTo(cx,bottom);ctx.stroke()
 }
 ctx.fillStyle='#8da6c3';ctx.font='11px Segoe UI';
 ctx.fillText(axis==='time'?'Temps (s)':'Progression circuit',pad.l,h-5);
 ctx.fillText(count+' mesures pilote'+(reference?.length?' · bleu : référence':''),w-240,19);
 return {ok:true,count,range};
}
window.VCEGraph35={draw,bounds,pick,channels};
})();
