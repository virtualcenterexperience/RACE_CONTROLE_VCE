(() => {
  'use strict';

  const byId = id => document.getElementById(id);
  const messages = {
    green: 'Drapeau vert', yellow: 'Drapeau jaune', fcy: 'Full Course Yellow',
    safety_car: 'Safety Car', red: 'Drapeau rouge', finished: 'Course terminée',
    practice: 'Essais', qualifying: 'Qualifications', formation: 'Tour de formation'
  };
  const runningPhases = new Set(['green', 'yellow', 'fcy', 'safety_car']);
  const interval = 15000;
  const configKey = 'vce_strategy_timing_v1';
  const form = byId('strategyLiveForm');
  const formMessage = byId('strategyLiveFormMessage');
  const badge = byId('strategyLiveBadge');
  const carInput = byId('strategyCarNumber');
  const editCarNumber = byId('strategyEditCarNumber');
  const timingLink = byId('strategyTimingLink');
  const refreshButton = byId('strategyRefreshLive');
  const stopButton = byId('strategyStopLive');
  let active = null;
  let current = null;
  let timer;
  let state = 'idle';
  let lastPlan;
  let errorCount = 0;

  function readConfig() {
    try {
      return JSON.parse(localStorage.getItem(configKey)) || {};
    } catch {
      return {};
    }
  }

  function urlFor(value) {
    if (!value) return '';
    let url;
    try {
      url = new URL(value);
    } catch {
      throw Error('Saisis une adresse HTTPS complète.');
    }
    if (url.protocol !== 'https:' || url.username || url.password) {
      throw Error('Utilise une adresse HTTPS sans identifiant ni mot de passe.');
    }
    return url.href;
  }

  function number(value, max, integer = false) {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max &&
      (!integer || Number.isInteger(value)) ? value : null;
  }

  function carKey(value) {
    return String(value ?? '').trim().replace(/^#\s*/, '').replace(/^0+(?=\d)/, '').toUpperCase();
  }

  function decode(data, carNumber) {
    const session = data?.session;
    const phase = session?.phase;
    const remainingSeconds = number(session?.remainingSeconds, 48 * 3600);
    if (typeof phase !== 'string' || !Object.hasOwn(messages, phase) ||
        remainingSeconds === null || !Array.isArray(data?.cars)) {
      throw Error('Format JSON incompatible. Vérifie la structure session et cars.');
    }
    const matches = data.cars.filter(car => carKey(car?.number) === carKey(carNumber));
    if (matches.length !== 1) {
      throw Error(matches.length ? 'Le numéro de voiture apparaît plusieurs fois dans le flux.' :
        'Voiture introuvable dans le flux. Vérifie son numéro.');
    }
    const car = matches[0];
    const laps = number(car.laps, 10000, true);
    if (laps === null) throw Error('Le flux doit fournir le nombre de tours terminés.');
    const sourceTime = typeof data.updatedAt === 'string' ? Date.parse(data.updatedAt) : NaN;
    if (Number.isFinite(sourceTime) && Date.now() - sourceTime > 60000) {
      throw Error('Le flux fournit des données vieilles de plus d’une minute.');
    }
    return {
      phase, remainingSeconds, laps,
      position: number(car.position, 500, true) || null,
      gapAheadSeconds: number(car.gapAheadSeconds, 3600),
      lastLapSeconds: number(car.lastLapSeconds, 1800) || null,
      fuelLiters: number(car.fuelLiters, 500),
      tyreLapsRemaining: number(car.tyreLapsRemaining, 1000),
      elapsedSeconds: number(session.elapsedSeconds, 48 * 3600),
      pitOpen: typeof session.pitOpen === 'boolean' ? session.pitOpen : null,
      inPit: car.inPit === true,
      updatedAt: Number.isFinite(sourceTime) ? sourceTime : Date.now()
    };
  }

  const decimal = (value, digits = 1) => value.toLocaleString('fr-FR', {maximumFractionDigits: digits});
  function clock(seconds) {
    const rounded = Math.max(0, Math.round(seconds));
    const hours = Math.floor(rounded / 3600);
    const minutes = Math.floor((rounded % 3600) / 60);
    return [hours, minutes, rounded % 60].map(unit => String(unit).padStart(2, '0')).join(':');
  }

  function render() {
    refreshButton.hidden = !active;
    stopButton.hidden = !active;
    refreshButton.disabled = Boolean(active?.request);
    badge.dataset.state = state;
    badge.textContent = {
      idle: 'Non connecté', saved: 'Source enregistrée', pending: 'Connexion…',
      live: 'Synchronisé', error: 'Synchronisation suspendue'
    }[state];
    const car = state === 'live' ? current : null;
    byId('strategyLivePosition').textContent = car?.position ? 'P' + car.position : '—';
    byId('strategyLiveLaps').textContent = car ? car.laps : '—';
    byId('strategyLiveClock').textContent = car ? clock(car.remainingSeconds) : '—';
    byId('strategyLiveGap').textContent = car?.gapAheadSeconds != null ? '+' + decimal(car.gapAheadSeconds) + ' s' : '—';
  }

  function notice(message) {
    byId('strategyLiveMessage').textContent = message;
    if (byId('strategyLiveDialog').open) formMessage.textContent = message;
  }

  function renderPit(summary) {
    lastPlan = summary;
    const { nextStop, live, invalid } = summary;
    const mode = byId('strategyPitMode');
    const time = byId('strategyPitTime');
    const detail = byId('strategyPitDetail');
    const emergency = byId('raceType').value === 'endurance' && byId('emergency').checked;
    mode.textContent = emergency ? 'Urgence' : live ? 'Plan synchronisé' : 'Prévision';
    const hold = !emergency && state === 'live' && current &&
      (current.inPit || current.pitOpen === false || !runningPhases.has(current.phase));
    const immediate = summary.immediate;
    time.textContent = invalid ? 'À recalculer' : hold ?
      (current.inPit ? 'Au stand' : current.pitOpen === false ? 'Stands fermés' : messages[current.phase]) :
      immediate ? 'Arrêt immédiat' : nextStop ? fmtClock(nextStop.end) :
      summary.finished ? 'Course terminée' : 'Aucun arrêt prévu';
    detail.textContent = invalid ? 'Vérifie les réglages de course.' : hold ?
      'Vérifie les consignes de course avant de décider du prochain arrêt.' :
      nextStop ? [
        immediate ? 'Autonomie insuffisante' :
          (live ? 'Tour cible ' + (live.laps + nextStop.tours) : 'Dans ' + nextStop.tours + ' tour(s)'),
        nextStop.driver,
        'Ravitaillement' + (nextStop.tyreStop ? ' + pneus' : '') + (nextStop.swap ? ' + swap' : ''),
        decimal(nextStop.service) + ' s estimées'
      ].join(' · ') : immediate ? 'L’autonomie reçue est insuffisante pour le prochain tour.' :
        'Selon le plan actuel et les données disponibles.';
  }

  function stop() {
    const needsRecalculate = current !== null;
    active?.request?.abort();
    clearTimeout(timer);
    active = null;
    current = null;
    errorCount = 0;
    if (needsRecalculate) calculate({persist: false});
  }

  function restore() {
    stop();
    const config = readConfig()[currentSlot()] || {};
    const safeUrl = value => {
      try { return urlFor(value); } catch { return ''; }
    };
    byId('strategyTimingUrl').value = safeUrl(config.page);
    byId('strategyFeedUrl').value = safeUrl(config.feed);
    const carNumber = typeof config.car === 'string' ? config.car.trim().replace(/^#\s*/, '') : '';
    carInput.value = carNumber;
    editCarNumber.textContent = carNumber ? 'Voiture #' + carNumber : 'Choisir la voiture';
    editCarNumber.title = carNumber ? 'Changer le numéro de voiture' : 'Renseigner le numéro de voiture';
    const url = byId('strategyTimingUrl').value || byId('strategyFeedUrl').value;
    timingLink.hidden = !url;
    timingLink.href = url || '#';
    state = url ? 'saved' : 'idle';
    formMessage.textContent = '';
    notice(state === 'saved' ? 'Source enregistrée pour cette course. Ouvre « Configurer le live » pour connecter le flux.' :
      'Connecte un flux ou saisis les données à la main.');
    render();
    if (lastPlan) renderPit(lastPlan);
  }

  function saveConfig(requireFeed) {
    const config = {
      page: urlFor(byId('strategyTimingUrl').value.trim()),
      feed: urlFor(byId('strategyFeedUrl').value.trim()),
      car: carInput.value.trim().replace(/^#\s*/, '')
    };
    if (requireFeed && (!config.feed || !carKey(config.car))) {
      throw Error('Renseigne l’URL du flux JSON et le numéro de voiture.');
    }
    localStorage.setItem(configKey, JSON.stringify({...readConfig(), [currentSlot()]: config}));
    return config;
  }

  async function requestTiming(source, manual = false) {
    if (!source || active !== source || source.request || (document.hidden && !manual)) return;
    clearTimeout(timer);
    const request = new AbortController();
    source.request = request;
    const deadline = setTimeout(() => request.abort(), 8000);
    refreshButton.disabled = true;
    try {
      const response = await fetch(source.feed, {
        signal: request.signal, headers: {Accept: 'application/json'},
        credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer'
      }).catch(error => {
        throw Error(error.name === 'AbortError' ? 'Le flux ne répond pas.' :
          'Flux inaccessible. Vérifie le lien et les autorisations CORS du fournisseur.');
      });
      if (!response.ok) throw Error('Le serveur du timing renvoie HTTP ' + response.status + '.');
      let data;
      try {
        data = await response.json();
      } catch {
        throw Error('Cette adresse ne renvoie pas de JSON. Utilise le champ « Lien de la page » pour un site de timing.');
      }
      const snapshot = decode(data, source.car);
      if (active !== source) return;
      current = snapshot;
      state = 'live';
      errorCount = 0;
      const details = [
        messages[snapshot.phase],
        snapshot.pitOpen === false ? 'Stands fermés' : snapshot.pitOpen === true ? 'Stands ouverts' : '',
        snapshot.lastLapSeconds !== null ? 'Dernier tour ' + decimal(snapshot.lastLapSeconds, 3) + ' s' : '',
        snapshot.fuelLiters !== null ? decimal(snapshot.fuelLiters) + ' L à bord' : '',
        snapshot.tyreLapsRemaining !== null ? snapshot.tyreLapsRemaining + ' tours pneus' : '',
        'Mis à jour à ' + new Date(snapshot.updatedAt).toLocaleTimeString('fr-FR')
      ];
      notice(details.filter(Boolean).join(' · '));
      calculate({persist: false});
    } catch (error) {
      if (active !== source) return;
      current = null;
      state = 'error';
      errorCount++;
      notice(error.message + ' Le calcul utilise la saisie manuelle.');
      calculate({persist: false});
    } finally {
      clearTimeout(deadline);
      if (active === source) {
        source.request = null;
        render();
        if (!document.hidden) {
          timer = setTimeout(() => requestTiming(source), Math.min(120000, interval * 2 ** errorCount));
        }
      }
    }
  }

  window.VCEStrategyLive = {
    snapshot: () => state === 'live' && active?.slot === currentSlot() && current &&
      (runningPhases.has(current.phase) || current.phase === 'finished') ? current : null,
    onPlan: renderPit,
    onCourse: restore
  };

  for (const button of document.querySelectorAll('[data-strategy-dialog]')) {
    const dialog = byId(button.dataset.strategyDialog);
    button.addEventListener('click', () => dialog.showModal());
  }
  editCarNumber.addEventListener('click', () => {
    byId('strategyLiveDialog').showModal();
    carInput.focus();
    carInput.select();
  });
  for (const link of document.querySelectorAll('[data-plan-view]')) {
    link.addEventListener('click', () => view(link.dataset.planView));
  }
  byId('strategyRecalculate').addEventListener('click', () => calculate());
  byId('strategySaveLive').addEventListener('click', () => {
    if (!form.reportValidity()) return;
    try {
      saveConfig(false);
      restore();
      byId('strategyLiveDialog').close();
    } catch (error) {
      formMessage.textContent = error.message;
    }
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    try {
      const config = saveConfig(true);
      restore();
      active = {...config, slot: currentSlot()};
      state = 'pending';
      notice('Connexion au flux de la voiture #' + config.car + '…');
      render();
      byId('strategyLiveDialog').close();
      requestTiming(active, true);
    } catch (error) {
      formMessage.textContent = error.message;
    }
  });
  refreshButton.addEventListener('click', () => requestTiming(active, true));
  stopButton.addEventListener('click', () => {
    restore();
    notice('Flux déconnecté. Le calcul utilise la saisie manuelle.');
  });
  document.addEventListener('visibilitychange', () => {
    clearTimeout(timer);
    if (document.hidden || !active) return;
    if (current) {
      current = null;
      state = 'pending';
      notice('Vérification des données live…');
      render();
      calculate({persist: false});
    }
    requestTiming(active);
  });
  const guide = byId('vce-tool-guide');
  if (guide) document.querySelector('#strategyTools .strategy-drawer-body').append(guide);
  restore();
  calculate({persist: false});
})();
