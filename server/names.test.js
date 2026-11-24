import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projectName, uniqueName } from './names.js';

const P = '/home/x/projects';

test('pastas das sessões fixas viram o nome com til, inclusive subpastas', () => {
  assert.equal(projectName(`${P}/MTI/detran`, P), '~detran');
  assert.equal(projectName(`${P}/MTI/detran/detrannet-work/abc`, P), '~detran');
  assert.equal(projectName(`${P}/MTI/secretario`, P), '~secretario');
  assert.equal(projectName(`${P}/MTI/secretario-dev/`, P), '~secretario-dev');
  assert.equal(projectName(`${P}/personal/chat-ferramentas`, P), 'chat-ferramentas');
});

test('outras pastas usam o nome do projeto', () => {
  assert.equal(projectName(`${P}/personal/my-office/src`, P), 'my-office');
  assert.equal(projectName(`${P}/MTI/secretario-devx`, P), 'secretario-devx');
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
