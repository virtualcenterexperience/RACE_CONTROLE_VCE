/* Parsing rules for visible HUD values. A failed read stays empty. */
(() => {
  'use strict';

  function readValue(field, input) {
    const text = input.trim();
    if (field === 'track') {
      const name = text.replace(/\s+/g, ' ').slice(0, 100);
      return /\p{L}{2}/u.test(name) ? name : null;
    }
    if (field === 'chrono') {
      const match = text.replace(/\s/g, '').match(/^(\d{1,2})[:.](\d{2})[.,:](\d{1,3})$/);
      if (match && Number(match[2]) < 60) {
        return Number(match[1]) + ':' + match[2] + '.' + match[3].padEnd(3, '0');
      }
      const seconds = text.match(/^(\d{1,2})[.,](\d{2,3})$/);
      return seconds && Number(seconds[1]) < 60 ? '0:'+seconds[1].padStart(2,'0')+'.'+seconds[2].padEnd(3,'0') : null;
    }
    if (field === 'gear' && /^[NR]$/i.test(text)) return text.toUpperCase();
    if (field === 'speed' && !/^\d{1,3}(?:\s*(?:km\s*\/?\s*h|kph))?$/i.test(text)) return null;
    if (field !== 'speed' && !/^\d{1,3}\s*%?$/.test(text)) return null;
    const value = Number.parseInt(text, 10);
    if (field === 'lap') return value >= 1 && value <= 999 ? String(value) : null;
    if (field === 'gear') return value >= 0 && value <= 12 ? (value === 0 ? 'N' : String(value)) : null;
    const max = field === 'speed' ? 600 : 100;
    return value >= 0 && value <= max ? String(value) : null;
  }

  function readBar(image, field, vertical) {
    const {data, width, height} = image;
    const length = vertical ? height : width;
    const thickness = vertical ? width : height;
    let active = 0;
    for (let i = 0; i < length; i++) {
      let matches = 0;
      for (let j = Math.floor(thickness * .2); j < Math.ceil(thickness * .8); j++) {
        const offset = (vertical ? i * width + j : j * width + i) * 4;
        const [r, g, b] = [data[offset], data[offset + 1], data[offset + 2]];
        const main = field === 'throttle' ? g : r;
        const other = field === 'throttle' ? Math.max(r, b) : Math.max(g, b);
        if (main >= 90 && main - other >= 30) matches++;
      }
      if (matches >= Math.ceil(thickness * .25)) active++;
    }
    return String(Math.round(100 * active / length));
  }

  // Normalized from the 1029 × 569 LMU cockpit capture. Video controls are outside the HUD.
  function lmuZones() {
    const box = (x1,y1,x2,y2,mode='text') =>
      ({x:x1/1029,y:y1/569,w:(x2-x1)/1029,h:(y2-y1)/569,mode});
    return [
      ['chrono',box(944,98,1025,118)],
      ['lap',box(1003,14,1028,32)],
      ['speed',box(919,490,971,512)],
      ['gear',box(920,437,974,487)],
      ['throttle',box(867,445,905,542,'lmu-arc')],
      ['brake',box(984,445,1024,542,'lmu-arc')],
      ['minimap',box(295,415,394,466,'preview')]
    ];
  }

  function readLmuPedal(image,field) {
    const {data,width,height}=image;
    const x0=field==='throttle'?867:984, x1=field==='throttle'?905:1024;
    const side=field==='throttle'?-1:1;
    let run=0,longest=0;
    const steps=40;
    for(let i=0;i<steps;i++){
      const angle=(-.9+i*1.38/(steps-1));
      let hit=false;
      for(let radius=65;radius<=72&&!hit;radius++){
        const x=Math.round((944+side*Math.cos(angle)*radius-x0)*width/(x1-x0));
        const y=Math.round((508+Math.sin(angle)*radius-445)*height/(542-445));
        if(x<0||x>=width||y<0||y>=height)continue;
        const p=4*(y*width+x),r=data[p],g=data[p+1],b=data[p+2];
        hit=field==='throttle'?g>=92&&g-Math.max(r,b)>=35:r>=103&&r-Math.max(g,b)>=43;
      }
      run=hit?run+1:0;
      longest=Math.max(longest,run);
    }
    return longest===0?'0':longest<4?null:String(Math.round(100*longest/steps));
  }

  const ATLAS_ROW_HEIGHT=64;
  function readAtlas(tsv,fields) {
    const words=fields.map(()=>[]);
    for(const line of (tsv||'').split('\n')){
      const [level,,,,,,left,top,,height,confidence,text]=line.split('\t');
      if(level!=='5'||Number(confidence)<55||!text?.trim()) continue;
      const row=Math.floor((Number(top)+Number(height)/2)/ATLAS_ROW_HEIGHT);
      if(words[row]) words[row].push({left:Number(left),text:text.trim()});
    }
    return Object.fromEntries(fields.map((field,index)=>[
      field,readValue(field,words[index].sort((a,b)=>a.left-b.left).map(word=>word.text).join(' '))
    ]));
  }

  const sampleCount=duration=>Number.isFinite(duration)&&duration>0?Math.ceil(duration):0;

  window.VCEVideoHUDData = {readValue,readBar,lmuZones,readLmuPedal,sampleCount,readAtlas,ATLAS_ROW_HEIGHT};
})();
