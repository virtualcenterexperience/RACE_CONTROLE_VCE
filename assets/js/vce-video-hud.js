/* Local MP4 preview and sampled OCR of regions selected by the pilot. */
(() => {
  'use strict';

  const root = document.querySelector('[data-vce-video-hud]');
  if (!root || document.documentElement.dataset.telemetryView === 'setup') return;
  const fields = [
    ['track', 'Circuit'], ['chrono', 'Chrono'], ['speed', 'Vitesse (km/h)'],
    ['gear', 'Rapport'], ['throttle', 'Accélérateur (%)'], ['brake', 'Frein (%)']
  ];
  const regions = [...fields, ['minimap', 'Mini-carte']];
  const colors = ['#66c9ff', '#e9d888', '#dcaeff', '#acc6f0', '#45e2aa', '#ff7e9a', '#f2a266'];
  root.innerHTML = `
    <div class="vce-lap-heading">
      <div><h2>Analyser une vidéo MP4</h2><p>Analyse les valeurs visibles du HUD ou synchronise le MP4 avec un tour VCE, notamment sur Le Mans Ultimate. Les fichiers restent dans ce navigateur.</p></div>
      <label class="vce-lap-picker">Choisir un MP4<input data-video="file" type="file" accept=".mp4,video/mp4"></label>
    </div>
    <p data-video="status" role="status" hidden></p>
    <div data-video="details" hidden>
      <video data-video="video" controls playsinline preload="metadata" aria-label="Vidéo du tour"></video>
      <div class="vce-video-controls">
        <label>Donnée à repérer<select data-video="field"></select></label>
        <label data-video="mode-label" hidden>Affichage<select data-video="mode">
          <option value="text">Chiffres à l’écran</option><option value="horizontal">Barre horizontale</option><option value="vertical">Barre verticale</option>
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
          <option value="10">10 secondes</option><option value="30">30 secondes</option><option value="60">60 secondes</option><option value="all">Jusqu’à la fin de la vidéo</option>
        </select></label>
        <button type="button" data-video="scan" disabled>Scanner à partir de la position actuelle</button>
        <button type="button" data-video="stop" hidden>Arrêter</button>
      </div>
      <p class="vce-video-note">Le scan lit jusqu’à 180 images, espacées d’au moins une seconde. Les barres vertes d’accélérateur et rouges de frein donnent un pourcentage estimé.</p>
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
  let fileUrl, startPoint, endPoint, task, engine, telemetry, videoStart=null, hudRows=[];
  picker.append(...regions.map(([key, label]) => new Option(label, key)));
  function message(text) {
    const status = get('status');
    status.hidden = !text;
    status.textContent = text;
  }
  function controls() {
    const field = picker.value;
    const pedal = field === 'brake' || field === 'throttle';
    get('mode-label').hidden = !pedal;
    mode.value = zones.get(field)?.mode || 'text';
    get('zones').textContent = zones.size ? regions.filter(([key]) => zones.has(key)).map(([, label]) => label).join(' · ') : 'Aucune zone définie.';
    get('remove').disabled = !!task || !zones.has(field);
    for (const name of ['read', 'scan']) get(name).disabled = !!task || !fields.some(([key]) => zones.has(key));
    for (const name of ['mark', 'field', 'mode', 'length', 'file']) get(name).disabled = !!task;
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
    get('details').hidden = false;
    message('');
  });
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
  });

  function showMinimap() {
    const zone = zones.get('minimap');
    get('minimap-panel').hidden = !zone;
    if (!zone || video.readyState < 2) return;
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
      script.onload = () => resolve(window.Tesseract);
      script.onerror = () => { script.remove(); reject(new Error('Le moteur de lecture est inaccessible. Vérifie ta connexion.')); };
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
    const points=archive?telemetry.points.filter(p=>p.t+videoStart>=0&&p.t+videoStart<=video.duration):coach.hudSamples(hudRows);
    const result=coach.diagnose(points,{archive});
    get('coach-status').textContent=source+' · '+(!result.sufficient
      ? 'Données insuffisantes. Il faut des relevés exploitables de vitesse, de frein et d’accélérateur.'
      : result.events.length?'Passages à vérifier dans le replay.':'Aucun passage n’a atteint les seuils du diagnostic sur la portion analysée.');
    for(const item of result.events){
      const time=item.start+(archive?videoStart:0);
      const line=document.createElement('li');
      const jump=document.createElement('button');jump.type='button';jump.textContent=format(time);
      jump.addEventListener('click',()=>{if(!task){video.pause();video.currentTime=Math.max(0,time-.3)}});
      const detail=document.createElement('span');
      const duration=item.end-item.start;
      detail.textContent=coach.titles[item.kind]+' · '+Math.round(item.speed)+' km/h'+
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

  function improveContrast(context) {
    const image=context.getImageData(0,0,crop.width,crop.height);
    const pixels=image.data;
    const brightness=new Uint8Array(pixels.length/4);
    let min=255,max=0;
    for(let i=0;i<brightness.length;i++){
      const p=4*i;
      const value=Math.round(.299*pixels[p]+.587*pixels[p+1]+.114*pixels[p+2]);
      brightness[i]=value;min=Math.min(min,value);max=Math.max(max,value);
    }
    if(max-min<18) return false;
    for(let i=0;i<brightness.length;i++){
      const p=4*i;
      const value=Math.round(255*(brightness[i]-min)/(max-min));
      pixels[p]=pixels[p+1]=pixels[p+2]=value;
    }
    context.putImageData(image,0,0);
    return true;
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

  async function analyze(scan) {
    if (task || !zones.size) return;
    const job = {stopped: false};
    task = job;
    controls();
    video.pause();
    video.controls = false;
    get('marking').hidden = true;
    const start = Math.min(video.currentTime, Math.max(0, video.duration - .04));
    const length = get('length').value;
    const duration = Math.min(video.duration - start, length === 'all' ? Infinity : Number(length));
    const step = Math.max(1, duration / 180);
    const count = scan ? Math.max(1, Math.min(180, Math.ceil(duration / step))) : 1;
    const selected = [...zones].filter(([key]) => key !== 'minimap');
    let worker;
    get('rows').replaceChildren();
    get('results').hidden = true;
    hudRows=[];
    try {
      if (selected.some(([, zone]) => zone.mode === 'text')) {
        message('Chargement du moteur de lecture du HUD…');
        const api = await getEngine();
        if (job.stopped) return;
        worker = await api.createWorker('eng', 1, {
          workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/worker.min.js',
          corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@6.0.0',
          langPath: 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int',
          errorHandler: error => { console.error('VCE OCR', error); }
        });
      }
      let reads = 0;
      for (let index = 0; index < count && !job.stopped; index++) {
        const time = Math.min(start + index * step, Math.max(0, video.duration - .04));
        message('Lecture du HUD · image ' + (index + 1) + ' / ' + count);
        await seek(time);
        const values = {};
        for (const [field, zone] of selected) {
          if (job.stopped) break;
          const ctx = extract(zone);
          if (zone.mode !== 'text') {
            values[field] = window.VCEVideoHUDData.readBar(ctx.getImageData(0, 0, crop.width, crop.height), field, zone.mode === 'vertical');
            continue;
          }
          const params = {
            tessedit_pageseg_mode: field === 'gear' ? '10' : '7',
            tessedit_char_whitelist: field === 'track' ? '' : field === 'chrono' ? '0123456789:.,' :
              field === 'gear' ? '0123456789NR' : '0123456789%'
          };
          await worker.setParameters(params);
          const recognize=async()=>{
            const {data}=await worker.recognize(crop);
            return data.confidence>=65?window.VCEVideoHUDData.readValue(field,data.text):null;
          };
          const value=await recognize();
          values[field]=value??(!job.stopped&&improveContrast(ctx)?await recognize():null);
        }
        if (job.stopped) break;
        reads += Object.values(values).filter(value => value !== null).length;
        hudRows.push({time,values});
        renderRow(time, values);
      }
      message(job.stopped ? 'Analyse arrêtée.' : reads ? 'Analyse terminée. Clique sur une position pour revoir l’image.' : 'Aucune valeur lisible. Essaie de resserrer les zones sur les chiffres.');
    } catch (error) {
      message('Analyse interrompue. ' + error.message);
    } finally {
      if (worker) await worker.terminate().catch(() => {});
      if (job.stopped) message('Analyse arrêtée.');
      task = null;
      video.controls = true;
      controls();
      renderCoach();
    }
  }
  get('read').addEventListener('click', () => analyze(false));
  get('scan').addEventListener('click', () => analyze(true));
  get('stop').addEventListener('click', () => {
    if (task) task.stopped = true;
    message('Arrêt après la lecture en cours…');
  });
  controls();
})();
