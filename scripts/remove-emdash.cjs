/**
 * Replace every em-dash (—) with a hyphen ( - ) across src/.
 * Safe: only touches .ts, .tsx, .css, .html, .md files.
 *
 * Usage: node scripts/remove-emdash.cjs
 */
const fs = require('fs');
const path = require('path');

const EM_DASH = '—';
const ROOT = path.resolve(__dirname, '..', 'src');
const EXT = new Set(['.ts', '.tsx', '.css', '.html', '.md']);

let totalFiles = 0;
let totalReplacements = 0;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
    } else if (EXT.has(path.extname(entry.name))) {
      const content = fs.readFileSync(full, 'utf8');
      if (!content.includes(EM_DASH)) continue;
      // Replace ` — ` with ` - ` first to keep spacing clean,
      // then any remaining `—` (no surrounding spaces) with `-`.
      const matches = (content.match(new RegExp(EM_DASH, 'g')) ?? []).length;
      const next = content.replace(/ — /g, ' - ').replace(/—/g, '-');
      fs.writeFileSync(full, next);
      totalFiles++;
      totalReplacements += matches;
      console.log(full.replace(ROOT + path.sep, ''), '→', matches);
    }
  }
}

walk(ROOT);
console.log(`\nFiles touched: ${totalFiles}`);
console.log(`Em-dashes removed: ${totalReplacements}`);
