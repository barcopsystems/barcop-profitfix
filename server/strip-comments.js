'use strict';
/* ─────────────────────────────────────────────────────────────────────────────
   STRIP COMMENTS FROM SHIPPED JS.

   WHY: 1,891kb of the 6,371kb this app serves is comments, 29.7% of everything.
   They are not API docs, they are the reasoning: which defect a guard exists for,
   what broke last time, why the obvious approach is wrong. pos-ingest.js is 70%
   comments, sales-integrity.js 67%, cash-engine.js 56%. That is years of finding
   things out the hard way, handed to anyone who opens a browser tab. The comments
   stay in the repo and in every harness. They just stop being served.

   ⛔ THE HAZARD, and it is the whole reason this file is not four lines of regex:
   this codebase is full of regex literals containing '//' — `/https?:\/\//`,
   `/\/api\//` — and full of strings containing '//' (every URL). A naive stripper
   sees those two slashes, calls the rest of the line a comment, and eats live code.
   So this walks the source as a tokenizer: it knows strings, template literals
   (including nested ${} expressions), and regex literals, and only treats '/' as a
   comment when it is genuinely one.

   ⛔ THE REGEX-versus-DIVISION PROBLEM. `/` starts a regex in `x = /ab+/` and means
   divide in `x = a / b`. The standard resolution is to look at the last meaningful
   token: after an identifier, number, `)`, `]`, `}` or `++/--` it is division,
   after anything else it is a regex. Getting this backwards silently destroys code,
   which is why verify-strip-comments.js runs the real 144 files through it and
   asserts every string and every regex survives, not just that the output parses.

   FAIL-SAFE: callers must fall back to the original source on ANY throw. A stripped
   file is an optimisation; the original is the product.
   ───────────────────────────────────────────────────────────────────────────── */

// Tokens after which a '/' is DIVISION rather than the start of a regex literal.
const DIV_AFTER_WORD = new Set(['this', 'super', 'null', 'true', 'false']);

function lastMeaningful(out) {
  for (let i = out.length - 1; i >= 0; i--) {
    const c = out[i];
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') continue;
    return { ch: c, i };
  }
  return { ch: '', i: -1 };
}

function regexAllowedHere(out) {
  const { ch, i } = lastMeaningful(out);
  if (!ch) return true;                       // start of file
  if (/[A-Za-z0-9_$]/.test(ch)) {
    // an identifier or number: division, UNLESS it is a keyword like `return` / `typeof`
    let j = i, word = '';
    while (j >= 0 && /[A-Za-z0-9_$]/.test(out[j])) { word = out[j] + word; j--; }
    if (/^\d/.test(word)) return false;       // a number: division
    if (DIV_AFTER_WORD.has(word)) return false;
    return !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(word) ? true : isKeyword(word);
  }
  if (ch === ')' || ch === ']') return false; // (a+b) / 2   arr[0] / 2
  if (ch === '}') return true;                // block end: a regex may follow
  if (ch === '+' && out[i - 1] === '+') return false;  // x++ / 2
  if (ch === '-' && out[i - 1] === '-') return false;  // x-- / 2
  return true;                                // operators, commas, ( [ { etc.
}

function isKeyword(w) {
  return ['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw',
    'case', 'do', 'else', 'yield', 'await'].indexOf(w) !== -1;
}

/* Remove comments, preserving every string, template literal and regex byte for byte.
   Newlines inside removed comments are KEPT so line numbers do not move: a stack trace
   from a customer's browser still points at the right line of the repo source. */
function stripComments(src) {
  if (typeof src !== 'string') throw new TypeError('stripComments expects a string');
  let out = '';
  let i = 0;
  const n = src.length;
  // template literal nesting: each entry is the brace depth at which the ${ } closes
  const tplStack = [];

  while (i < n) {
    const c = src[i];
    const c2 = src[i + 1];

    // ── line comment ──────────────────────────────────────────────────────
    if (c === '/' && c2 === '/') {
      while (i < n && src[i] !== '\n') i++;
      continue;                                  // the \n itself is emitted next pass
    }
    // ── block comment ─────────────────────────────────────────────────────
    if (c === '/' && c2 === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) {
        if (src[i] === '\n') out += '\n';        // keep line numbering intact
        i++;
      }
      if (i >= n) throw new Error('unterminated block comment');
      i += 2;
      continue;
    }
    // ── string ────────────────────────────────────────────────────────────
    if (c === '"' || c === "'") {
      const q = c; out += c; i++;
      while (i < n) {
        if (src[i] === '\\') { out += src[i] + (src[i + 1] || ''); i += 2; continue; }
        out += src[i];
        if (src[i] === q) { i++; break; }
        if (src[i] === '\n') break;              // unterminated; let the parser complain
        i++;
      }
      continue;
    }
    // ── template literal ──────────────────────────────────────────────────
    if (c === '`') {
      out += c; i++;
      while (i < n) {
        if (src[i] === '\\') { out += src[i] + (src[i + 1] || ''); i += 2; continue; }
        if (src[i] === '$' && src[i + 1] === '{') { out += '${'; i += 2; tplStack.push(true); break; }
        out += src[i];
        if (src[i] === '`') { i++; break; }
        i++;
      }
      continue;
    }
    // closing a ${ } inside a template: resume template scanning
    if (c === '}' && tplStack.length) {
      tplStack.pop(); out += c; i++;
      while (i < n) {
        if (src[i] === '\\') { out += src[i] + (src[i + 1] || ''); i += 2; continue; }
        if (src[i] === '$' && src[i + 1] === '{') { out += '${'; i += 2; tplStack.push(true); break; }
        out += src[i];
        if (src[i] === '`') { i++; break; }
        i++;
      }
      continue;
    }
    // ── regex literal ─────────────────────────────────────────────────────
    if (c === '/' && regexAllowedHere(out)) {
      let j = i + 1, inClass = false, closed = false;
      while (j < n) {
        const d = src[j];
        if (d === '\\') { j += 2; continue; }
        if (d === '\n') break;                   // regexes cannot span lines: not a regex
        if (d === '[') inClass = true;
        else if (d === ']') inClass = false;
        else if (d === '/' && !inClass) { closed = true; break; }
        j++;
      }
      if (closed) {
        j++;                                     // past the closing slash
        while (j < n && /[a-z]/i.test(src[j])) j++;   // flags
        out += src.slice(i, j);
        i = j;
        continue;
      }
      // not a regex after all: fall through and emit the slash as an operator
    }
    out += c; i++;
  }
  if (tplStack.length) throw new Error('unterminated template literal');
  return out;
}

module.exports = { stripComments };
