import { test } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { uiQualitySpec } from '../compiler/emitters/ui-quality-spec.ts';

test('standard disclosure openers use keyboard activation before every inner primary field is audited', () => {
  const content = uiQualitySpec([{ id: 'settings', label: 'Settings' }]);
  const parsed = ts.createSourceFile('quality.ts', content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  assert.deepEqual(parsed.parseDiagnostics.map(item => item.messageText), []);
  assert.match(content, /const primaryControls = '[^']*summary/);
  assert.match(content, /keyboard\.press\('Enter'\)/);
  assert.match(content, /toHaveJSProperty\('open', true\)/);
  const activation = content.indexOf('await openPrimaryDisclosures(page)');
  assert.ok(activation >= 0 && activation < content.indexOf('const labels = await tagPrimaryControls(page)'), 'open disclosures before collecting all inner controls');
});
