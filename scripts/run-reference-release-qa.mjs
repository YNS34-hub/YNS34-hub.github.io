import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';

const root = 'qa-artifacts/release', common = { PALACE_URL: 'http://127.0.0.1:5215' };
const capture = phase => [
  [`${phase}-atrium`, 'capture-reference-atrium.mjs', { PALACE_PHASE: phase, PALACE_URL: phase === 'before' ? 'http://127.0.0.1:5216' : common.PALACE_URL, PALACE_ARTIFACTS: root + '/atrium', PALACE_CAPTURE_ONLY: '1' }],
  [`${phase}-rooms`, 'capture-reference-rooms.mjs', { PALACE_PHASE: phase, PALACE_URL: phase === 'before' ? 'http://127.0.0.1:5216' : common.PALACE_URL, PALACE_ROOMS_ARTIFACTS: root + '/rooms' }],
  [`${phase}-details`, 'capture-reference-details.mjs', { PALACE_PHASE: phase, PALACE_URL: phase === 'before' ? 'http://127.0.0.1:5216' : common.PALACE_URL, PALACE_DETAILS_ARTIFACTS: root + '/details' }],
];
const steps = [
  ...capture('before'), ...capture('after'),
  ['atrium-native', 'check-reference-atrium-v2.mjs', { PALACE_ARTIFACTS: root + '/atrium', PALACE_SOURCE_SNAPSHOT: root + '/source-snapshot.json' }],
  ...['p2', 'p3-research', 'p3-music'].map(stage => [stage, 'check-reference-rooms.mjs', { PALACE_STAGE: stage, PALACE_CHECK_ARTIFACTS: root + '/checks' }]),
  ['court-lighting', 'check-reference-court-lighting.mjs', { PALACE_ARTIFACTS: root + '/checks/court-lighting' }],
  ['public', 'check-reference-public.mjs', { PALACE_PUBLIC_URL: process.env.PALACE_PUBLIC_URL || 'http://127.0.0.1:5217', PALACE_PUBLIC_ARTIFACTS: root + '/public' }],
];
const requested = process.env.PALACE_RELEASE_STEPS?.split(','), selected = requested ? steps.filter(([name]) => requested.includes(name)) : steps;
if (requested && requested.length !== selected.length) throw new Error('Unknown release QA step');
mkdirSync(root, { recursive: true });
const report = { at: new Date().toISOString(), steps: [], passed: false };
const reportFile = process.env.PALACE_RELEASE_REPORT || root + '/qa-run.json';
const save = () => writeFileSync(reportFile, JSON.stringify(report, null, 2));
const otherQA = () => {
  if (process.platform !== 'win32') return [];
  const command = `@(Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.ProcessId -ne ${process.pid} -and $_.CommandLine -match 'scripts[\\/](?:capture-|check-|measure-)' } | Select-Object ProcessId,CommandLine) | ConvertTo-Json -Compress`;
  const raw = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { encoding: 'utf8' }).trim();
  const value = raw ? JSON.parse(raw) : []; return Array.isArray(value) ? value : [value];
};
for (const [name, file, env] of selected) {
  const step = { name, status: 'waiting', deferred: [], attempts: [] }; report.steps.push(step); save();
  const log = `${root}/${name}.log`; writeFileSync(log, '');
  while (true) {
    let waiting = 0;
    while (true) {
      const active = otherQA(); if (!active.length) break;
      if (waiting++ % 6 === 0) { step.deferred.push({ at: new Date().toISOString(), active }); save(); console.log('DEFER ' + name); }
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    const startedAt = new Date().toISOString(); step.status = 'running'; save(); console.log('START ' + name);
    let output = '';
    const child = spawn(process.execPath, ['--experimental-strip-types', 'scripts/' + file], { env: { ...process.env, ...common, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { output += chunk.toString(); appendFileSync(log, chunk); });
    const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
    step.attempts.push({ startedAt, finishedAt: new Date().toISOString(), code });
    if (code !== 0 && output.includes('Other QA process is active; defer GPU work:')) { step.status = 'waiting'; save(); continue; }
    step.status = code === 0 ? 'passed' : 'failed'; step.log = log; save(); console.log(step.status.toUpperCase() + ' ' + name); break;
  }
  if (step.status === 'failed') { process.exitCode = 1; break; }
}
report.passed = report.steps.length === selected.length && report.steps.every(step => step.status === 'passed'); save();
