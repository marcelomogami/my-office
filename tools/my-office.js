#!/usr/bin/env node
// CLI portátil para a API local do Boss.
const args = process.argv.slice(2);
const base = process.env.MY_OFFICE_URL || 'http://127.0.0.1:5199';
async function main() {
  if (args.shift() !== 'boss') throw new Error('Uso: boss get | boss set --emote NOME --text TEXTO | boss clear');
  const command = args.shift();
  let method = 'GET', body;
  if (command === 'set') {
    const options = {};
    while (args.length) {
      const key = args.shift();
      if (!['--emote', '--text'].includes(key) || !args.length || Object.hasOwn(options, key)) throw new Error('Argumentos inválidos');
      options[key] = args.shift();
    }
    if (!options['--emote']) throw new Error('Informe --emote');
    method = 'PUT';
    body = JSON.stringify({ emote: options['--emote'], text: options['--text'] ?? '' });
  } else if (command === 'clear' && !args.length) method = 'DELETE';
  else if (command !== 'get' || args.length) throw new Error('Comando inválido');
  const response = await fetch(new URL('/api/boss', base), { method, body, headers: body ? { 'Content-Type': 'application/json' } : {} });
  if (!response.ok) throw new Error(`API respondeu ${response.status}`);
  console.log(JSON.stringify(await response.json(), null, 2));
}
main().catch(err => { console.error(`my-office: ${err.message}`); process.exitCode = 1; });
