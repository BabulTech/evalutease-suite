/**
 * Bulk-add aria-label="X" to elements that have title="X" but no aria-label.
 * Adds aria-label IMMEDIATELY AFTER the existing title attribute,
 * preserving the title value exactly.
 *
 * Usage: node scripts/add-aria-labels.cjs
 */
const fs = require('fs');

const FILES = [
  'src/routes/_app/billing/PayStep.tsx',
  'src/routes/admin/ActivityLogsSection.tsx',
  'src/routes/admin/FinanceSection.tsx',
  'src/routes/admin/UsersSection.tsx',
  'src/routes/admin/QuizzesSection.tsx',
  'src/routes/admin/ParticipantsSection.tsx',
  'src/routes/admin/AiUsageSection.tsx',
  'src/routes/admin/CategoriesSection.tsx',
  'src/routes/admin/PlansSection.tsx',
];

// Match title="anything-not-quote" (capture the value)
const TITLE_RE = /\btitle="([^"]*)"/g;

let totalAdded = 0;
for (const file of FILES) {
  if (!fs.existsSync(file)) {
    console.log('MISSING', file);
    continue;
  }
  const orig = fs.readFileSync(file, 'utf8');
  const lines = orig.split('\n');
  let added = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('aria-label')) continue;          // already labelled
    TITLE_RE.lastIndex = 0;
    const m = TITLE_RE.exec(line);
    if (!m) continue;
    const value = m[1];
    if (!value) continue;                                // empty title - skip
    // Insert aria-label right after title="..."
    lines[i] = line.replace(
      /\btitle="([^"]*)"/,
      (whole, v) => `title="${v}" aria-label="${v}"`,
    );
    added++;
  }

  if (added > 0) {
    fs.writeFileSync(file, lines.join('\n'));
    console.log(file, '→', added);
    totalAdded += added;
  }
}
console.log('Total aria-labels added:', totalAdded);
