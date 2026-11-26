import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projectName, uniqueName } from './names.js';

const P = '/home/x/projects';

test('subpastas contam como o projeto, sem nomes especiais', () => {
  assert.equal(projectName(`${P}/work/projeto`, P), 'projeto');
  assert.equal(projectName(`${P}/work/projeto/sub/abc`, P), 'projeto');
  assert.equal(projectName(`${P}/work/projeto-dev/`, P), 'projeto-dev');
});

test('outras pastas usam o nome do projeto', () => {
  assert.equal(projectName(`${P}/personal/my-office/src`, P), 'my-office');
  assert.equal(projectName(`${P}/work/projeto-devx`, P), 'projeto-devx');
  assert.equal(projectName(`${P}/playbooks`, P), 'playbooks');
  assert.equal(projectName(P, P), 'projects');
  assert.equal(projectName('/tmp/algo', P), 'algo');
  assert.equal(projectName('/', P), '/');
});

test('mesmo projeto duas vezes ganha sufixo', () => {
  assert.equal(uniqueName('a', new Set()), 'a');
  assert.equal(uniqueName('a', new Set(['a'])), 'a (2)');
  assert.equal(uniqueName('a', new Set(['a', 'a (2)'])), 'a (3)');
});
