import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import ts from 'typescript';

// Released PR32 is immutable input. Restore each full file before running all older protection chains.
const baseline = 'a86b3d243d24b6a669407f1a05b662ad2a9f3fe0';
const candidates = ['src/rooms/Architecture.tsx', 'src/rooms/PersonalRooms.tsx', 'src/rooms/ListeningRoom.tsx', 'src/world/collision.ts', 'src/world/Player.tsx', 'src/rooms/Atrium.tsx', 'src/world/artDirection.ts'];
const digest = text => createHash('sha256').update(text).digest('hex');
const normalize = text => text.replace(/\r\n/g, '\n');
const files = {}, baselineSha256 = {};
function parts(source) {
  const ast = ts.createSourceFile('source.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const functions = ast.statements.filter(ts.isFunctionDeclaration);
  return new Map([['imports', source.slice(0, functions[0].getStart(ast))], ...functions.map(node => [node.name.text, source.slice(node.getStart(ast), node.end)])]);
}
for (const file of candidates) {
  const before = normalize(execFileSync('git', ['show', baseline + ':' + file], { encoding: 'utf8' }));
  const after = normalize(readFileSync(file, 'utf8')), oldParts = parts(before), newParts = parts(after);
  assert.deepEqual([...newParts.keys()], [...oldParts.keys()], file + ': existing functions retained');
  files[file] = [...oldParts].filter(([symbol, body]) => newParts.get(symbol) !== body).map(([symbol, body]) => ({ symbol, before: body, after: newParts.get(symbol) }));
  let restored = after;
  for (const patch of files[file]) { assert.equal(restored.split(patch.after).length, 2); restored = restored.replace(patch.after, patch.before); }
  assert.equal(restored, before, file + ': entire released file restored'); baselineSha256[file] = digest(before);
}
writeFileSync('tests/fixtures/reference-visual-adapters.json', JSON.stringify({ baseline, baselineSha256, files }, null, 2) + '\n');
const template = readFileSync('tests/motion-preservation.test.ts', 'utf8');
let guard = template.slice(template.indexOf('function withoutReferenceVisuals('), template.indexOf('function withoutAdditions('));
guard = guard.replace(/  const baseline = \{[\s\S]*?\n  \};/, '  const baseline = ' + JSON.stringify(baselineSha256, null, 4) + ';');
let source = normalize(execFileSync('git', ['show', baseline + ':tests/motion-preservation.test.ts'], { encoding: 'utf8' }));
source = source.replace('function withoutAdditions(file: string, source: string) {', guard + 'function withoutAdditions(file: string, source: string) {\n  source = withoutReferenceVisuals(file, source);');
source = source.replace('architecture(readFileSync(file, "utf8"))', 'architecture(withoutReferenceVisuals(file, readFileSync(file, "utf8")))');
writeFileSync('tests/motion-preservation.test.ts', source);
console.log(JSON.stringify({ baseline, baselineSha256 }));
