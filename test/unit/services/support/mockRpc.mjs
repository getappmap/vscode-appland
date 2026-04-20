import process from 'process';
import console from 'console';
import { setTimeout } from 'timers/promises';

let port = 0;
const portArgIndex = process.argv.indexOf('--port');
if (portArgIndex !== -1 && portArgIndex + 1 < process.argv.length) {
  const parsedPort = parseInt(process.argv[portArgIndex + 1], 10);
  if (!isNaN(parsedPort)) {
    port = parsedPort;
  }
}

if (port === 0) {
  port = Math.floor(Math.random() * (65535 - 1024) + 1024);
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

console.log(`Running JSON-RPC server on port: ${port}`);
for (;;) {
  await setTimeout(1000);
}
