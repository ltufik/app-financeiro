// Personal notes on entries ("JIM.COM* STTUP" → "cabeleireiro Lily") and the memory that brings the same
// note back the next time the same description shows up. Pure module, tested in tests/lib.test.mjs.
import { norm } from './format.js';

export const NOTE_MAX = 120;
export const memoKey = (source, description) => `${source}|${norm(description)}`;
export const cleanNote = s => String(s || '').replace(/\s+/g, ' ').trim().slice(0, NOTE_MAX);

// Rows of a bill or statement get the note remembered for their description, if they have none.
export function applyMemos(rows, source, memos = {}) {
  let n = 0;
  for (const r of rows || []) { const m = memos[memoKey(source, r.description)]; if (m && !r.note) { r.note = m; n++; } }
  return n;
}

// The memos after saving a note: remember it, or forget it when the note was cleared.
export function withMemo(memos = {}, source, description, note) {
  const k = memoKey(source, description), out = { ...memos };
  if (note) out[k] = cleanNote(note); else delete out[k];
  return out;
}
