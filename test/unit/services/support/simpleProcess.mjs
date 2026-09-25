import process from 'process';
import console from 'console';
import { setTimeout } from 'timers/promises';

console.log('starting test process...');

// Exit straight away, for tests that need the watcher to see a process that won't stay up.
if (process.argv[2] === 'exit') {
  const status = Number(process.argv[3] ?? 0);
  console.log(`exiting with ${status}`);
  process.exit(status);
}

async function exit(signal) {
  console.log(`got ${signal}, exiting`);
  await setTimeout(20);
  process.exit(0);
}

function ignore(signal) {
  console.log(`got ${signal}, but ignoring!`);
}

if (process.argv[2] === 'ignore')
  process.on('SIGTERM', ignore).on('SIGQUIT', ignore).on('SIGINT', ignore);
else process.on('SIGTERM', exit).on('SIGQUIT', exit).on('SIGINT', exit);

for (;;) await setTimeout(1000);
