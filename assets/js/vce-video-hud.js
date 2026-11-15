/* Local MP4 preview with automatic LMU zones and adjustable HUD analysis. */
(() => {
  'use strict';

  const root = document.querySelector('[data-vce-video-hud]');
  if (!root || document.documentElement.dataset.telemetryView === 'setup') return;
  const fields = [
    ['track', 'Circuit'], ['chrono', 'Chrono'], ['lap', 'Tour'], ['speed', 'Vitesse (km/h)'],
    ['gear', 'Rapport'], ['throttle', 'Accélérateur (%)'], ['brake', 'Frein (%)']
  ];
  const regions = [...fields, ['minimap', 'Mini-carte']];
  const colors = ['#66c9ff', '#e9d888', '#84e0fb', '#dcaeff', '#acc6f0', '#45e2aa', '#ff7e9a', '#f2a266'];
  root.innerHTML = `
    <div class="vce-lap-heading">
      <div><h2>Analyser une vidéo MP4</h2><p>Analyse les valeurs visibles du HUD ou synchronise le MP4 avec un tour VCE, notamment sur Le Mans Ultimate. Les fichiers restent dans ce navigateur.</p></div>
      <label class="vce-lap-picker">Choisir un MP4<input data-video="file" type="file" accept=".mp4,video/mp4"></label>
    </div>
    <p data-video="status" role="status" hidden></p>
    <div data-video="details" hidden>
      <div class="vce-video-stage" data-video="stage">
        <video data-video="video" controls playsinline preload="auto" aria-label="Vidéo du tour"></video>
        <div class="vce-hud-overlay" data-video="overlay" aria-hidden="true"></div>
      </div>
      <div class="vce-video-controls">
        <label class="vce-hud-switch"><input type="checkbox" data-video="show-zones" checked> Afficher les zones HUD</label>
        <button type="button" data-video="preset">Rétablir les zones LMU</button>
        <label>Donnée à repérer<select data-video="field"></select></label>
        <label data-video="mode-label" hidden>Affichage<select data-video="mode">
          <option value="text">Chiffres à l’écran</option><option value="lmu-arc">Arc LMU</option><option value="horizontal">Barre horizontale</option><option value="vertical">Barre verticale</option>
        </select></label>
        <button type="button" data-video="mark">Délimiter la zone</button>
        <button type="button" data-video="remove">Retirer la zone</button>
      </div>
      <div class="vce-video-marking" data-video="marking" hidden>
        <p>Trace un rectangle serré autour de la valeur. Pour une barre, encadre toute sa longueur, même lorsqu’elle est vide.</p>
        <canvas data-video="frame" tabindex="0" aria-label="Image figée pour sélectionner la zone du HUD"></canvas>
      </div>
      <p data-video="zones">Aucune zone définie.</p>
      <figure data-video="minimap-panel" class="vce-video-minimap" hidden>
        <figcaption>Mini-carte du HUD · position dans la vidéo</figcaption>
        <canvas data-video="minimap" role="img" aria-label="Mini-carte extraite de la vidéo"></canvas>
      </figure>
      <div class="vce-video-controls">
        <button type="button" data-video="read" disabled>Lire cette image</button>
        <label>Analyse dans la vidéo<select data-video="length">
          <option value="10">10 secondes</option><option value="30">30 secondes</option><option value="60">60 secondes</option><option value="all" selected>Jusqu’à la fin de la vidéo</option>
        </select></label>
        <button type="button" data-video="full-scan" disabled>Analyser toute la vidéo</button>
        <button type="button" data-video="scan" disabled>Scanner à partir de la position actuelle</button>
        <button type="button" data-video="stop" hidden>Arrêter</button>
      </div>
      <p class="vce-video-note">L’analyse automatique parcourt toute la vidéo, à raison d’une image par seconde. Les pédales lues dans le HUD sont des estimations. Pour un HUD déplacé, ajuste les cadres puis relance l’analyse.</p>
      <section class="vce-video-coach" aria-label="Diagnostic du pilotage">
        <h3>Passages à revoir</h3>
        <p data-video="archive">Pour une analyse précise dans LMU, importe aussi le JSON du même tour dans « Importer un tour ».</p>
        <button type="button" data-video="use-session" hidden>Utiliser le tour A de Télémétrie</button>
        <div class="vce-video-controls" data-video="align-tools" hidden>
          <button type="button" data-video="align">Marquer ici le début du tour</button>
          <button type="button" data-video="auto-align" disabled>Caler avec le chrono du HUD</button>
        </div>
        <p data-video="align-status" role="status" hidden></p>
        <p data-video="live" hidden></p>
        <p data-video="coach-status" role="status">Lance un scan du HUD ou cale un tour importé pour obtenir des observations.</p>
        <ol data-video="observations"></ol>
      </section>
      <div data-video="results" class="vce-video-results" hidden>
        <table><caption>Valeurs lues dans la vidéo</caption><thead><tr><th scope="col">Position vidéo</th>
          ${fields.map(([, label]) => '<th scope="col">' + label + '</th>').join('')}
        </tr></thead><tbody data-video="rows"></tbody></table>
      </div>
    </div>`;

  const get = name => root.querySelector('[data-video="' + name + '"]');
  const video = get('video');
  const frame = get('frame');
  const picker = get('field');
  const mode = get('mode');
  const zones = new Map();
  const raw = document.createElement('canvas');
  const crop = document.createElement('canvas');
  const atlas = document.createElement('canvas');
  const atlasContext = atlas.getContext('2d');
  let fileUrl, startPoint, endPoint, task, engine, telemetry, autoScanPending=false, videoStart=null, hudRows=[];
  picker.append(...regions.map(([key, label]) => new Option(label, key)));
  function message(text) {
    const status = get('status');
    status.hidden = !text;
    status.textContent = text;
  }
  function showZones() {
    const overlay=get('overlay');
    overlay.hidden=!get('show-zones').checked;
    overlay.replaceChildren();
    for(const [index,[field,label]] of regions.entries()) {
      const zone=zones.get(field);
      if(!zone) continue;
      const box=document.createElement('div');
      box.style.cssText='left:'+zone.x*100+'%;top:'+zone.y*100+'%;width:'+zone.w*100+'%;height:'+zone.h*100+'%;--zone-color:'+colors[index];
      const tag=document.createElement('span');
      tag.textContent=label.replace(' (%)','').replace(' (km/h)','');
      box.append(tag);overlay.append(box);
    }
  }
  function applyPreset() {
    zones.clear();
    for(const [field,zone] of window.VCEVideoHUDData.lmuZones()) zones.set(field,zone);
    if(!get('marking').hidden) repaint();
    showMinimap();
    controls();
    showZones();
  }
  get('show-zones').addEventListener('change',showZones);
  get('preset').addEventListener('click',applyPreset);
  function controls() {
    const field = picker.value;
    const pedal = field === 'brake' || field === 'throttle';
    get('mode-label').hidden = !pedal;
    mode.value = zones.get(field)?.mode || 'text';
    get('zones').textContent = zones.size ? regions.filter(([key]) => zones.has(key)).map(([, label]) => label).join(' · ') : 'Aucune zone définie.';
    get('remove').disabled = !!task || !zones.has(field);
    for (const name of ['read', 'scan', 'full-scan']) get(name).disabled = !!task || !fields.some(([key]) => zones.has(key));
    for (const name of ['mark', 'field', 'mode', 'length', 'file', 'preset']) get(name).disabled = !!task;
    get('stop').hidden = !task;
    get('align').disabled = !!task;
    get('auto-align').disabled = !!task || !telemetry || hudRows.length < 3;
  }
  get('file').addEventListener('change', () => {
    const file = get('file').files[0];
    if (!file) return;
    get('file').value = '';
    if (!/\.mp4$/i.test(file.name)) { message('Choisis un fichier MP4.'); return; }
    video.pause();
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    fileUrl = URL.createObjectURL(file);
    zones.clear();
    autoScanPending=true;
    hudRows=[];
    videoStart=null;
    alignmentMessage('');
    renderCoach();
    showMinimap();
    get('rows').replaceChildren();
    get('details').hidden = true;
    get('results').hidden = true;
    get('marking').hidden = true;
    controls();
    message('Ouverture du MP4…');
    video.src = fileUrl;
  });
  video.addEventListener('loadedmetadata', () => {
    if (!video.videoWidth || !Number.isFinite(video.duration) || video.duration <= 0) {
      message('Ce fichier ne contient pas de piste vidéo exploitable.');
      return;
    }
    get('stage').style.maxWidth='min(100%, '+(65*video.videoWidth/video.videoHeight)+'vh)';
    get('details').hidden = false;
    applyPreset();
    message('Zones HUD LMU prépositionnées.');
  });
  function startAutomaticScan() {
    if(!autoScanPending||get('details').hidden||video.readyState<2) return;
    autoScanPending=false;
    analyze({scan:true,full:true,automatic:true});
  }
  video.addEventListener('loadeddata',startAutomaticScan);
  video.addEventListener('canplay',startAutomaticScan);
  video.addEventListener('error', () => {
    get('details').hidden = true;
    message('Ce MP4 est illisible dans ce navigateur. Essaie un MP4 encodé en H.264.');
  });
  function drawBox(context, box, color) {
    const {x, y, w, h} = box;
    context.strokeStyle = color;
    context.lineWidth = 2;
    context.strokeRect(x * frame.width, y * frame.height, w * frame.width, h * frame.height);
  }
  function repaint() {
    const context = frame.getContext('2d');
    context.drawImage(raw, 0, 0, frame.width, frame.height);
    for (const [index, [field]] of regions.entries()) {
      if (zones.has(field)) drawBox(context, zones.get(field), colors[index]);
    }
    if (startPoint && endPoint) drawBox(context, boxBetween(startPoint, endPoint), '#fff');
  }
  function boxBetween(a, b) {
    return {x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y)};
  }
  function point(event) {
    const bounds = frame.getBoundingClientRect();
    const clamp = n => Math.max(0, Math.min(1, n));
    return {x: clamp((event.clientX - bounds.left) / bounds.width), y: clamp((event.clientY - bounds.top) / bounds.height)};
  }
  get('mark').addEventListener('click', () => {
    if (video.readyState < 2 || video.seeking) { message('Attends que l’image vidéo s’affiche.'); return; }
    video.pause();
    frame.width = Math.min(1080, video.videoWidth);
    frame.height = Math.round(frame.width * video.videoHeight / video.videoWidth);
    raw.width = frame.width;
    raw.height = frame.height;
    raw.getContext('2d').drawImage(video, 0, 0, raw.width, raw.height);
    startPoint = endPoint = null;
    get('marking').hidden = false;
    repaint();
    frame.focus();
  });
  frame.addEventListener('pointerdown', event => {
    if (task || event.button !== 0) return;
    frame.setPointerCapture(event.pointerId);
    startPoint = point(event);
    endPoint = null;
  });
  frame.addEventListener('pointermove', event => {
    if (!startPoint) return;
    endPoint = point(event);
    repaint();
  });
  frame.addEventListener('pointerup', event => {
    if (!startPoint) return;
    const box = boxBetween(startPoint, point(event));
    startPoint = endPoint = null;
    if (box.w * frame.width >= 5 && box.h * frame.height >= 5) {
      zones.set(picker.value, {...box, mode: mode.value});
      message('');
      showMinimap();
    }
    repaint();
    controls();
    showZones();
  });
  frame.addEventListener('pointercancel', () => { startPoint = endPoint = null; repaint(); });
  picker.addEventListener('change', controls);
  mode.addEventListener('change', () => {
    const zone = zones.get(picker.value);
    if (zone) zone.mode = mode.value;
  });
  get('remove').addEventListener('click', () => {
    zones.delete(picker.value);
    showMinimap();
    if (!get('marking').hidden) repaint();
    controls();
    showZones();
  });

  function showMinimap() {
    const zone = zones.get('minimap');
    get('minimap-panel').hidden = !zone;
    if (!zone || video.readyState < 2 || task) return;
    const canvas = get('minimap');
    const width = video.videoWidth * zone.w, height = video.videoHeight * zone.h;
    canvas.width = Math.max(1, Math.min(420, Math.round(width)));
    canvas.height = Math.max(1, Math.round(canvas.width * height / width));
    canvas.getContext('2d').drawImage(video, zone.x * video.videoWidth, zone.y * video.videoHeight,
      width, height, 0, 0, canvas.width, canvas.height);
  }
  video.addEventListener('seeked', showMinimap);
  video.addEventListener('timeupdate', showMinimap);

  function getEngine() {
    if (engine) return engine;
    engine = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/tesseract.min.js';
      script.integrity = 'sha384-r1ru3tcf6FhnCFR4B7pIFG+BhFF9LlFtz/P1y4pblWn3AGs9y3lBx5SKLNf4+rED';
      script.crossOrigin = 'anonymous';
      const failed=()=>{
        clearTimeout(timer);script.remove();
        reject(new Error('Le lecteur HUD ne se charge pas. Vérifie ta connexion puis relance la lecture.'));
      };
      const timer=setTimeout(failed,10000);
      script.onload=()=>{clearTimeout(timer);resolve(window.Tesseract)};
      script.onerror=failed;
      document.head.append(script);
    }).catch(error => { engine = null; throw error; });
    return engine;
  }

  function seek(time) {
    if (Math.abs(video.currentTime - time) < .005 && video.readyState >= 2 && !video.seeking) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const finish = error => {
        clearTimeout(timer);
        video.removeEventListener('seeked', done);
        video.removeEventListener('error', failed);
        if (error) reject(error); else resolve();
      };
      const done = () => finish();
      const failed = () => finish(new Error('Impossible de lire cette partie de la vidéo.'));
      const timer = setTimeout(failed, 10000);
      video.addEventListener('seeked', done, {once: true});
      video.addEventListener('error', failed, {once: true});
      video.currentTime = time;
    });
  }

  function extract(zone) {
    const sw = video.videoWidth * zone.w, sh = video.videoHeight * zone.h;
    const scale = zone.mode === 'text' ? Math.min(6, Math.max(1, 80 / sh), 1400 / sw, 400 / sh) : Math.min(1, 500 / Math.max(sw, sh));
    crop.width = Math.max(1, Math.round(sw * scale));
    crop.height = Math.max(1, Math.round(sh * scale));
    const ctx = crop.getContext('2d', {willReadFrequently: true});
    ctx.drawImage(video, zone.x * video.videoWidth, zone.y * video.videoHeight, sw, sh, 0, 0, crop.width, crop.height);
    return ctx;
  }

  const format = time => {
    const seconds = Math.floor(Math.max(0,time)*10)/10;
    return Math.floor(seconds/60)+':'+(seconds%60).toFixed(1).padStart(4,'0');
  };
  function alignmentMessage(text) {
    get('align-status').textContent=text;
    get('align-status').hidden=!text;
  }
  function showArchive() {
    const ready=telemetry?.lap.points.some(p=>Number.isFinite(p.t)&&Number.isFinite(p.speed));
    get('align-tools').hidden=!ready;
    get('archive').textContent=ready
      ? [telemetry.track,telemetry.game,telemetry.car,'Tour '+telemetry.lap.number,Number.isFinite(telemetry.lap.time)?format(telemetry.lap.time):''].filter(Boolean).join(' · ')
      : 'Pour une analyse précise dans LMU, importe le JSON VCE du même tour dans « Importer un tour ».';
    controls();
  }
  function nearestPoint(points,time) {
    let lower=0,upper=points.length-1;
    while(lower<upper){
      const middle=(lower+upper)>>1;
      if(points[middle].t<time) lower=middle+1; else upper=middle;
    }
    const current=points[lower], previous=points[lower-1];
    return previous && Math.abs(previous.t-time)<Math.abs(current.t-time) ? previous : current;
  }
  function showSynchronizedSample() {
    const live=get('live');
    live.hidden=true;
    const time=video.currentTime-videoStart;
    if(!telemetry?.points.length||videoStart===null||time<0||time>telemetry.points.at(-1).t) return;
    const point=nearestPoint(telemetry.points,time);
    if(Math.abs(point.t-time)>.35) return;
    const value=(n,mult,unit)=>Number.isFinite(n)?Math.round(n*mult)+unit:'—';
    live.textContent='Télémétrie au curseur · '+value(point.speed,1,' km/h')+
      ' · Frein '+value(point.brake,100,' %')+' · Accélérateur '+value(point.throttle,100,' %')+
      ' · Rapport '+(point.gear===0?'N':point.gear===-1?'R':value(point.gear,1,''))+
      ' · Tour '+value(point.progress,100,' %')+
      (Number.isFinite(point.x)&&Number.isFinite(point.z)?' · Position X/Z '+Math.round(point.x)+' / '+Math.round(point.z):'')+
      (Number.isFinite(point.steer)?' · Volant '+point.steer.toFixed(2):'');
    live.hidden=false;
  }
  function renderCoach() {
    const coach=window.VCEVideoCoach;
    const list=get('observations');
    list.replaceChildren();
    showSynchronizedSample();
    const archive=videoStart!==null&&!!telemetry;
    if(!archive&&!hudRows.length) {
      get('coach-status').textContent='Lance un scan du HUD ou cale un tour importé pour obtenir des observations.';
      return;
    }
    const source=archive?'Télémétrie VCE synchronisée':'HUD vidéo · estimation';
    const segments=archive
      ? [{number:telemetry.lap.number,points:telemetry.points.filter(p=>p.t+videoStart>=0&&p.t+videoStart<=video.duration)}]
      : coach.splitHudLaps(hudRows).map(segment=>({number:segment.number,points:coach.hudSamples(segment.rows)}));
    const results=segments.map(({number,points})=>({number,...coach.diagnose(points,{archive})}));
    const observations=results.flatMap(({number,events})=>events.map(event=>({...event,number})));
    get('coach-status').textContent=source+' · '+(!results.some(result=>result.sufficient)
      ? 'Données insuffisantes. Il faut des relevés exploitables de vitesse, de frein et d’accélérateur.'
      : observations.length?'Passages à vérifier dans le replay.':'Aucun passage n’a atteint les seuils du diagnostic sur la portion analysée.');
    for(const item of observations){
      const time=item.start+(archive?videoStart:0);
      const line=document.createElement('li');
      const jump=document.createElement('button');jump.type='button';jump.textContent=format(time);
      jump.addEventListener('click',()=>{
        const target=Math.max(0,time-.3);
        if(task){task.stopped=true;task.review=target;message('Ouverture du passage après cette image…');return}
        video.pause();video.currentTime=target;
      });
      const detail=document.createElement('span');
      const duration=item.end-item.start;
      detail.textContent=(item.number==null?'':'Tour '+item.number+' · ')+coach.titles[item.kind]+' · '+Math.round(item.speed)+' km/h'+
        (duration>=.1?' · '+duration.toFixed(1)+' s':'')+
        (archive&&Number.isFinite(item.progress)?' · '+Math.round(item.progress*100)+' % du tour':'')+
        '. '+coach.tips[item.kind];
      line.append(jump,detail);
      list.append(line);
    }
  }
  function align(time,label) {
    videoStart=time;
    alignmentMessage(label+' · '+(time>=0?'début du tour à '+format(time):'la vidéo commence '+format(-time)+' après le début du tour')+'. Vérifie le calage au passage de la ligne.');
    renderCoach();
  }
  function useArchive(detail) {
    telemetry=detail?{...detail,points:detail.lap.points.filter(p=>Number.isFinite(p.t)).sort((a,b)=>a.t-b.t)}:null;
    videoStart=null;
    alignmentMessage('');
    showArchive();
    renderCoach();
  }
  document.addEventListener('vce-video-lap',event=>useArchive(event.detail));
  const lapSelector=document.getElementById('lap');
  function telemetrySelection() {
    const session=window.vceSession;
    const laps=(session?.laps||[]).filter(lap=>lap&&(
      (Number.isFinite(lap.time)&&lap.time>0)||lap.samples?.length>=2||Number.isInteger(lap.number)
    )).sort((a,b)=>(a.number??0)-(b.number??0));
    const active=lapSelector?.value===''?null:laps[Number(lapSelector?.value)];
    return active?.samples?.length>=2?{session,active}:null;
  }
  function updateSessionButton(){
    get('use-session').hidden=!telemetrySelection();
  }
  get('use-session').addEventListener('click',()=>{
    const selected=telemetrySelection();
    if(!selected||task) return;
    const {session,active}=selected;
    useArchive({lap:window.VCELapImportData.normalizeLap(active,0),track:session.track,game:session.game,car:session.car});
  });
  if(lapSelector){
    document.addEventListener('vce-cloud-update',updateSessionButton);
    lapSelector.addEventListener('change',updateSessionButton);
    document.getElementById('session')?.addEventListener('change',()=>queueMicrotask(updateSessionButton));
    updateSessionButton();
  }
  get('align').addEventListener('click',()=>align(video.currentTime,'Calage manuel'));
  get('auto-align').addEventListener('click',()=>{
    const time=window.VCEVideoCoach.startFromHud(hudRows,telemetry.lap);
    if(time===null) alignmentMessage('Le chrono du tour doit défiler : cadre le chrono en cours, puis scanne au moins trois images concordantes.');
    else align(time,'Calage estimé par le chrono du HUD');
  });
  for(const event of ['timeupdate','seeked']) video.addEventListener(event,showSynchronizedSample);

  function deadline(promise,ms,message,onLateResult) {
    let timer;
    let expired=false;
    const timeout=new Promise((_,reject)=>{
      timer=setTimeout(()=>{expired=true;reject(new Error(message))},ms);
    });
    return Promise.race([promise.then(result=>{
      if(expired) onLateResult?.(result);
      return result;
    }),timeout]).finally(()=>clearTimeout(timer));
  }

  function paintAtlas(textZones) {
    const rowHeight=window.VCEVideoHUDData.ATLAS_ROW_HEIGHT;
    atlas.width=300;
    atlas.height=rowHeight*textZones.length;
    atlasContext.fillStyle='#fff';
    atlasContext.fillRect(0,0,atlas.width,atlas.height);
    for(const [index,[,zone]] of textZones.entries()){
      const sw=zone.w*video.videoWidth,sh=zone.h*video.videoHeight;
      const scale=Math.min(44/sh,284/sw);
      crop.width=Math.max(1,Math.round(sw*scale));crop.height=Math.max(1,Math.round(sh*scale));
      const ctx=crop.getContext('2d',{willReadFrequently:true});
      ctx.drawImage(video,zone.x*video.videoWidth,zone.y*video.videoHeight,sw,sh,0,0,crop.width,crop.height);
      const image=ctx.getImageData(0,0,crop.width,crop.height);
      const pixels=image.data;
      let min=255,max=0,sum=0;
      for(let p=0;p<pixels.length;p+=4){
        const l=Math.round(.299*pixels[p]+.587*pixels[p+1]+.114*pixels[p+2]);
        pixels[p]=l;min=Math.min(min,l);max=Math.max(max,l);sum+=l;
      }
      if(max-min<18) continue;
      const lightHud=sum/(pixels.length/4)<(min+max)/2;
      for(let p=0;p<pixels.length;p+=4){
        const intensity=255*(pixels[p]-min)/(max-min);
        const value=(lightHud?255-intensity:intensity)<115?0:255;
        pixels[p]=pixels[p+1]=pixels[p+2]=value;
      }
      atlasContext.putImageData(image,8,index*rowHeight+Math.floor((rowHeight-crop.height)/2));
    }
  }

  function renderRow(time, values) {
    const row = get('rows').insertRow();
    const jump = document.createElement('button');
    jump.type = 'button';
    jump.textContent = Math.floor(time / 60) + ':' + (time % 60).toFixed(2).padStart(5, '0');
    jump.addEventListener('click', () => { if (!task) video.currentTime = time; });
    row.insertCell().append(jump);
    for (const [key] of fields) row.insertCell().textContent = values[key] ?? '—';
    get('results').hidden = false;
  }

  async function analyze({scan=false,full=false,automatic=false}={}) {
    if (task || !zones.size) return;
    const job = {stopped: false};
    task = job;
    controls();
    video.pause();
    video.controls = false;
    get('marking').hidden = true;
    const initialTime=video.currentTime;
    const start=full?0:Math.min(initialTime,Math.max(0,video.duration-.04));
    const length=get('length').value;
    const duration=Math.min(video.duration-start,full||length==='all'?Infinity:Number(length));
    const count=scan?window.VCEVideoHUDData.sampleCount(duration):1;
    const previewStride=Math.max(1,Math.ceil(count/240));
    const selected = [...zones].filter(([key]) => key !== 'minimap');
    const textZones=selected.filter(([,zone])=>zone.mode==='text');
    const pedalZones=selected.filter(([,zone])=>zone.mode!=='text');
    const textFields=textZones.map(([field])=>field);
    let nextReport=4;
    let worker;
    get('rows').replaceChildren();
    get('results').hidden = true;
    hudRows=[];
    try {
      if(textZones.length){
        message('Chargement du moteur de lecture du HUD…');
        const api=await getEngine();
        if (job.stopped) return;
        worker=await deadline(api.createWorker('eng',1,{
          workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/worker.min.js',
          corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@6.0.0',
          langPath: 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int',
          errorHandler:error=>console.warn('VCE OCR',error)
        }),25000,'Le moteur HUD ne démarre pas. Vérifie ta connexion, puis relance la lecture.',
        lateWorker=>lateWorker.terminate().catch(()=>{}));
        if(job.stopped) return;
        await deadline(worker.setParameters({
          tessedit_pageseg_mode:'6',
          tessedit_char_whitelist:textFields.includes('track')?'':'0123456789:.,NR%'
        }),5000,'Le moteur HUD ne répond pas.');
      }
      let reads=0,skipped=0,seekFailures=0;
      for (let index = 0; index < count && !job.stopped; index++) {
        const time=Math.min(start+index,Math.max(0,video.duration-.04));
        message('Analyse HUD · '+format(time)+' / '+format(start+duration)+' · '+(index+1)+' / '+count+' images');
        try {
          await seek(time);
          seekFailures=0;
        } catch(error) {
          if(video.error||++seekFailures>=2||!scan) throw error;
          skipped++;
          hudRows.push({time,values:{}});
          continue;
        }
        if(job.stopped) break;
        const values={};
        for(const [field,zone] of pedalZones){
          const ctx=extract(zone);
          const image=ctx.getImageData(0,0,crop.width,crop.height);
          values[field]=zone.mode==='lmu-arc'
            ?window.VCEVideoHUDData.readLmuPedal(image,field)
            :window.VCEVideoHUDData.readBar(image,field,zone.mode==='vertical');
        }
        if(worker&&!job.stopped){
          paintAtlas(textZones);
          const {data}=await deadline(worker.recognize(atlas,{},{text:false,tsv:true}),8000,
            'La lecture du HUD s’est bloquée à '+format(time)+'. Les secondes déjà lues restent disponibles.');
          Object.assign(values,window.VCEVideoHUDData.readAtlas(data.tsv,textFields));
        }
        if (job.stopped) break;
        reads+=fields.filter(([key])=>key==='throttle'||key==='brake'?Number(values[key])>0:values[key]!=null).length;
        hudRows.push({time,values});
        if(index%previewStride===0||index===count-1)renderRow(time,values);
        if(index+1>=nextReport){
          renderCoach();
          nextReport+=Math.max(6,Math.ceil(nextReport/4));
        }
      }
      if(!job.stopped && telemetry && videoStart===null){
        const aligned=window.VCEVideoCoach.startFromHud(hudRows,telemetry.lap);
        if(aligned!==null)align(aligned,'Calage estimé par le chrono du HUD');
      }
      message(job.stopped?'Analyse arrêtée.':reads
        ? 'Analyse terminée · '+(count-skipped)+' image(s) sur '+format(duration)+(skipped?' · '+skipped+' image illisible.':'.')+(previewStride>1?' Le tableau affiche un extrait.':'')
        : 'Aucun chiffre lisible dans les zones du HUD. Ajuste les cadres puis relance l’analyse.');
    } catch (error) {
      message('Analyse interrompue. ' + error.message);
    } finally {
      if (worker) await worker.terminate().catch(() => {});
      if (job.stopped) message(Number.isFinite(job.review)?'Analyse interrompue pour revoir le passage. Relance-la pour analyser la suite.':'Analyse arrêtée.');
      task = null;
      video.controls = true;
      if(!video.error&&(automatic||Number.isFinite(job.review))) video.currentTime=job.review??initialTime;
      showMinimap();
      controls();
      renderCoach();
    }
  }
  get('read').addEventListener('click',()=>analyze());
  get('scan').addEventListener('click',()=>analyze({scan:true}));
  get('full-scan').addEventListener('click',()=>analyze({scan:true,full:true}));
  get('stop').addEventListener('click', () => {
    if (task) task.stopped = true;
    message('Arrêt après la lecture en cours…');
  });
  controls();
})();
