// Voice input with the browser's speech recognition (Chrome, Edge, Safari). Falls back to keyboard dictation.
// Android Chrome ends recognition at the first pause, so we keep restarting short sessions until the person
// taps the mic again, stays silent for a while, or reaches the time limit. Each session's final text is kept.
import { micSvg, toast } from './ui.js';

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
export const speechSupported = !!SR;
const SILENCE_MS = 6000, MAX_MS = 90000;

// Turns `button` into a mic toggle that writes what is said into `field`.
export function attachMic(button, field, { onFinal } = {}) {
  button.innerHTML = micSvg; button.classList.add('mic'); button.type = 'button';
  if (!SR) { button.hidden = true; return; }
  button.setAttribute('aria-label', 'Falar');
  let active = false, rec = null, base = '', kept = '', startedAt = 0, lastVoice = 0, fatal = false;
  const show = (extra = '') => { field.value = (base + kept + extra).replace(/\s+/g, ' ').replace(/^\s/, ''); field.dispatchEvent(new Event('input')); };
  const finish = () => {
    active = false; rec = null;
    button.classList.remove('rec'); button.setAttribute('aria-label', 'Falar');
    show(); if (onFinal && field.value.trim()) onFinal(field.value.trim());
  };
  const session = () => {
    const r = new SR(); rec = r;
    r.lang = 'pt-BR'; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
    let fin = '';
    r.onresult = e => {
      let tmp = ''; fin = '';
      for (const x of e.results) (x.isFinal ? (fin += x[0].transcript) : (tmp += x[0].transcript));
      lastVoice = Date.now(); show(fin + tmp);
    };
    r.onerror = e => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { fatal = true; toast('Permita o uso do microfone para falar.'); }
      else if (e.error === 'network') { fatal = true; toast('O reconhecimento de voz precisa de internet.'); }
      else if (e.error === 'audio-capture') { fatal = true; toast('Não encontrei o microfone do aparelho.'); }
      // "no-speech" and "aborted" just end this session; onend decides whether to continue.
    };
    r.onend = () => {
      if (fin.trim()) kept += fin.trim() + ' ';
      const now = Date.now();
      if (active && !fatal && now - lastVoice < SILENCE_MS && now - startedAt < MAX_MS) { setTimeout(() => { if (active) try { session(); } catch (x) { finish(); } }, 120); return; }
      if (active && !kept.trim() && !fatal) toast('Não ouvi nada. Toque e fale de novo.');
      finish();
    };
    r.start();
  };
  button.onclick = () => {
    if (active) { active = false; try { rec && rec.stop(); } catch (e) { finish(); } return; }
    base = field.value ? field.value.replace(/\s*$/, ' ') : ''; kept = ''; fatal = false;
    active = true; startedAt = lastVoice = Date.now();
    try { session(); button.classList.add('rec'); button.setAttribute('aria-label', 'Parar'); toast('Pode falar. Toque no microfone de novo quando terminar.'); }
    catch (e) { active = false; rec = null; toast('Não consegui ligar o microfone.'); }
  };
}
