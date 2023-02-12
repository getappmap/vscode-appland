import process from 'process';
import console from 'console';
import { setTimeout } from 'timers/promises';

console.log('starting test process...');

async function exit(signal) {
  console.log(`got ${signal}, exiting`);
  await setTimeout(20);
  process.exit(0);
}

process.on('SIGTERM', exit).on('SIGQUIT', exit).on('SIGINT', exit);

for (;;) await setTimeout(1000);
