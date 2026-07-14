// Driver: loops collect -> extract -> adapt until every cell settles (max 3
// rounds by construction of SAMPLING.rounds), then analyze -> vocab -> report.
//
// Usage: node src/run.js [--skip-vocab]

import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const run = (script) => execSync(`node ${join(here, script)}`, { stdio: 'inherit' });

for (let round = 1; round <= 3; round++) {
  console.log(`\n=== sampling round ${round} ===`);
  run('collect.js');
  run('extract.js');
  try {
    run('adapt.js');
    console.log('all cells settled');
    break;
  } catch {
    // adapt exits 1 when escalations are pending -> loop for another round
  }
}

run('analyze.js');
if (!process.argv.includes('--skip-vocab')) run('vocab.js');
run('report.js');
console.log('\npipeline complete');
