// Lightweight CSS sanity check: comments/strings aware brace balance.
// Run: node qa/experience/check-css.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const files = ['css/ui.css', 'css/base.css'];
let fail = false;
for (const rel of files) {
  const source = fs.readFileSync(path.join(root, rel), 'utf8');
  let depth = 0;
  let line = 1;
  let inString = '';
  let inComment = false;
  const unmatchedClose = [];
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    const nx = source[i + 1];
    if (ch === '\n') line++;
    if (inComment) {
      if (ch === '*' && nx === '/') {
        inComment = false;
        i++;
      }
      continue;
    }
    if (inString) {
      if (ch === '\\') {
        i++;
        continue;
      }
      if (ch === inString) inString = '';
      continue;
    }
    if (ch === '/' && nx === '*') {
      inComment = true;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = ch;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth < 0) {
        unmatchedClose.push(line);
        depth = 0;
      }
    }
  }
  const ok = depth === 0 && unmatchedClose.length === 0 && !inString && !inComment;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${rel} (depth ${depth}, unmatched closes: ${unmatchedClose.join(',') || 'none'})`);
  if (!ok) fail = true;
}
process.exit(fail ? 1 : 0);
