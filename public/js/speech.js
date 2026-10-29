// Voice input with the browser's speech recognition (Chrome, Edge, Safari). Falls back to keyboard dictation.
import { micSvg, toast } from './ui.js';

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
export const speechSupported = !!SR;

// Turns `button` into a mic toggle that writes what is said into `field`.
export function attachMic(button, field, { onFinal } = {}) {
  button.innerHTML = micSvg; button.classList.add('mic'); button.type = 'button';
  if (!SR) { button.hidden = true; return; }
  button.setAttribute('aria-label', 'Falar');
  let rec = null, base = '';
  const stop = () => { try { rec && rec.stop(); } catch (e) { /* already stopped */ } };
  button.onclick = () => {
    if (rec) { stop(); return; }
    rec = new SR(); rec.lang = 'pt-BR'; rec.interimResults = true; rec.continuous = false;
    base = field.value ? field.value.replace(/\s*$/, ' ') : '';
    rec.onresult = e => {
      let fin = '', tmp = '';
      for (const r of e.results) (r.isFinal ? (fin += r[0].transcript) : (tmp += r[0].transcript));
      field.value = base + fin + tmp;
      field.dispatchEvent(new Event('input'));
    };
    rec.onerror = e => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') toast('Permita o uso do microfone para falar.');
      else if (e.error === 'no-speech') toast('Não ouvi nada. Toque e fale de novo.');
      else if (e.error !== 'aborted') toast('O reconhecimento de voz falhou. Tente o microfone do teclado.');
    };
    rec.onend = () => { rec = null; button.classList.remove('rec'); button.setAttribute('aria-label', 'Falar'); if (onFinal && field.value.trim()) onFinal(field.value.trim()); };
    try { rec.start(); button.classList.add('rec'); button.setAttribute('aria-label', 'Parar'); }
    catch (e) { rec = null; toast('Não consegui ligar o microfone.'); }
  };
}
