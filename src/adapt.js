// Adaptive-sampling controller: reads extracted.jsonl, decides per cell whether
// more samples are needed, and writes data/targets.json for the next collect
// pass. Exits 0 if all cells are settled, 1 if another round is needed.
//
// Rules (SAMPLING.rounds = [4, 8, 12]):
//   n >= 4 and unanimous            -> settled
//   n >= 8 and <= 2 distinct picks  -> settled
//   n >= 12                         -> settled (cap)
//   otherwise                       -> escalate to next round

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MODELS, DOMAINS, PROBES, SAMPLING } from './config.js';

const here = dirname(fileURLToPath(import.meta.url));
const IN = join(here, '..', 'data', 'extracted.jsonl');
const TARGETS = join(here, '..', 'data', 'targets.json');

const rows = existsSync(IN)
  ? readFileSync(IN, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
  : [];

const norm = (s) => s?.replace(/[*"“”]/g, '').replace(/\s+/g, ' ').trim().replace(/^(the|a|an) /i, '').toLowerCase() ?? '∅';
const [R1, R2, R3] = SAMPLING.rounds;

const targets = {};
let escalations = 0, settled = 0;
for (const model of MODELS) {
  for (const domain of Object.keys(DOMAINS)) {
    for (const probe of Object.keys(PROBES)) {
      const cell = rows.filter((r) => r.model === model.id && r.domain === domain && r.probe === probe);
      const n = cell.length;
      const unique = new Set(cell.map((r) => norm(r.entity))).size;
      const key = `${model.id}|${domain}|${probe}`;
      let target;
      if (n >= 10) target = n;                       // at cap, incl. legacy 10-sample pilot cells
      else if (n >= R2 && unique <= 2) target = n;   // low variation at round 2
      else if (n >= R1 && unique === 1) target = n;  // unanimous at round 1
      else if (n >= R2) target = R3;
      else if (n >= R1) target = R2;
      else target = R1;                              // not yet collected
      targets[key] = target;
      if (target > n) escalations++; else settled++;
    }
  }
}

writeFileSync(TARGETS, JSON.stringify(targets, null, 2));
console.log(`adapt: ${settled} cells settled, ${escalations} need more samples`);
process.exit(escalations > 0 ? 1 : 0);
