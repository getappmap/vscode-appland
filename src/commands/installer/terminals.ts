import { Terminal, TerminalOptions } from 'vscode';
import dictEqual from '../../lib/dictEqual';
import assert from 'assert';

function getCwd({ creationOptions }: Terminal): string | undefined {
  if (!('cwd' in creationOptions)) return;
  return creationOptions.cwd?.toString();
}

const terms = new Map<string, Terminal>();

export function unregister(term: Terminal): Terminal {
  const cwd = getCwd(term);
  if (cwd && terms.get(cwd) === term) terms.delete(cwd);
  return term;
}

/* Get an existing terminal for given path as long as it was created with the same env. */
export function getMatching(path: string, env?: TerminalOptions['env']): Terminal | undefined {
  const term = terms.get(path);
  if (!term) return;

  if ('env' in term.creationOptions) {
    if (dictEqual(env, term.creationOptions.env)) return term;
  } else if (!env) return term;
}

/* Register a terminal. If there was a previously existing terminal for the same path, close it. */
export function register(terminal: Terminal): Terminal {
  const cwd = getCwd(terminal);
  assert(cwd);

  const existing = terms.get(cwd);
  if (existing !== terminal) existing?.dispose();

  terms.set(cwd, terminal);
  return terminal;
}
