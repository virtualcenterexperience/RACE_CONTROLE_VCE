(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const form = $('vceChatForm');
  if (!form) return;
  let prior = {};
  let last = null;
  let sequence = 0;
  const greeting = 'Décris ton problème avec le circuit, le virage et la voiture. Tu peux répondre aux questions pour affiner le conseil.';
  function bubble(role, message) {
    const box = document.createElement('div');
    box.className = 'vce-chat-bubble ' + role;
    const label = document.createElement('strong');
    label.textContent = role === 'user' ? 'PILOTE' : 'ASSISTANT VCE';
    const p = document.createElement('p');
    p.textContent = message;
    box.append(label, p);
    $('vceChatMessages').append(box);
    $('vceChatMessages').scrollTop = $('vceChatMessages').scrollHeight;
    return p;
  }
  function advice(result) {
    const c = result.context;
    const relevant = result.stages.find(stage => stage.selected) || result.stages[1];
    return [
      [c.trackLabel, c.cornerNumber ? 'T' + c.cornerNumber : c.cornerLabel, c.category, c.model].filter(Boolean).join(' · '),
      result.title,
      relevant.cause,
      'À tester\n' + relevant.correction,
      'Exercice\n' + relevant.exercise + '\n' + relevant.improvement,
      result.hint.join('\n'),
      result.followups.slice(0, 2).join('\n'),
    ].filter(Boolean).join('\n\n');
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const question = $('vceFeeling').value.trim();
    if (!question || $('vceDiagnose').disabled) return;
    const request = ++sequence;
    bubble('user', question);
    $('vceFeeling').value = '';
    const reply = bubble('assistant', 'Consultation des fiches circuit et voiture…');
    $('vceDiagnose').disabled = true;
    last = null;
    try {
      const engine = window.VCECoachEngine;
      if (!engine) throw Error('Moteur de coaching indisponible.');
      const data = await engine.load();
      if (request !== sequence) return;
      const phase = engine.detectPhase($('vcePhase').value);
      const result = engine.analyze(question, {
        model: $('vceCar')?.value || '', track: $('vceCircuit')?.value || '',
        phase, setup: $('vceSetup')?.value || '', assists: $('vceAssists')?.value || ''
      }, data, prior);
      prior = result.context;
      last = result;
      reply.textContent = advice(result);
      $('vceChatNotice').textContent = 'Conseil fondé sur les fiches VCE, à vérifier en piste avec ton coach.';
    } catch (error) {
      reply.textContent = 'Les fiches ne sont pas accessibles pour le moment. ' + error.message;
    } finally {
      $('vceDiagnose').disabled = false;
      $('vceChatMessages').scrollTop = $('vceChatMessages').scrollHeight;
    }
  });
  $('vceAddDiagnosis').addEventListener('click', () => {
    if (!last) {
      $('vceChatNotice').textContent = 'Analyse d’abord un ressenti pour ajouter les conseils.';
      return;
    }
    const target = $('vceDebrief');
    target.value = [target.value.trim(), 'Conseils VCE à vérifier en piste\n' + advice(last)].filter(Boolean).join('\n\n');
    target.dispatchEvent(new Event('input', {bubbles:true}));
    $('vceChatNotice').textContent = 'Conseils ajoutés à ta fiche de suivi.';
  });
  $('vceChatClear').addEventListener('click', () => {
    sequence++;
    last = null;
    prior = {};
    $('vceChatMessages').replaceChildren();
    bubble('assistant', greeting);
    $('vceChatNotice').textContent = '';
  });
  for (const button of document.querySelectorAll('[data-coach-prompt]')) {
    button.addEventListener('click', () => {
      $('vceFeeling').value = button.dataset.coachPrompt;
      $('vceFeeling').focus();
    });
  }
})();
