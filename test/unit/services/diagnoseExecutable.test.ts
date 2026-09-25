import '../mock/vscode';

import { expect } from 'chai';
import { chmod, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Sinon from 'sinon';

import diagnoseExecutable, {
  type CommandResult,
  type RunCommand,
} from '../../../src/services/diagnoseExecutable';

describe('diagnoseExecutable', () => {
  let dir: string;
  let binary: string;

  // Stands in for codesign and xattr, which only exist on the platform this is diagnosing.
  function runner(results: Record<string, CommandResult>): RunCommand {
    return Sinon.stub().callsFake(async (file: string) => results[file] ?? { code: 0, stderr: '' });
  }

  const signed: Record<string, CommandResult> = {
    codesign: { code: 0, stderr: '' },
    xattr: { code: 1, stderr: 'No such xattr: com.apple.quarantine' },
  };

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'diagnose-executable-'));
    binary = join(dir, 'appmap-macos-arm64-3.201.3');
    await writeFile(binary, 'not really a binary');
    await chmod(binary, 0o755);
  });

  afterEach(() => rm(dir, { recursive: true, force: true }));

  it('describes the file', async () => {
    const diagnosis = await diagnoseExecutable(binary, { platform: 'linux' });

    expect(diagnosis).to.include({ size: 19, mode: '755' });
    expect(diagnosis.missing).to.be.undefined;
  });

  it('follows a symlink to what it points at', async () => {
    const link = join(dir, 'appmap');
    await symlink(binary, link);

    const diagnosis = await diagnoseExecutable(link, { platform: 'linux' });

    expect(diagnosis.target).to.equal(binary);
    // Of the target, not of the link itself.
    expect(diagnosis.size).to.equal(19);
  });

  it('says so when there is nothing there', async () => {
    const diagnosis = await diagnoseExecutable(join(dir, 'absent'), { platform: 'linux' });

    expect(diagnosis.missing).to.be.true;
    expect(diagnosis.size).to.be.undefined;
  });

  it('reports a dangling symlink as missing, naming what it pointed at', async () => {
    const link = join(dir, 'appmap');
    await symlink(join(dir, 'absent'), link);

    const diagnosis = await diagnoseExecutable(link, { platform: 'linux' });

    expect(diagnosis.missing).to.be.true;
    expect(diagnosis.target).to.equal(join(dir, 'absent'));
  });

  describe('on macOS', () => {
    it('reports a good signature and no quarantine', async () => {
      const run = runner(signed);

      const diagnosis = await diagnoseExecutable(binary, { platform: 'darwin', run });

      expect(diagnosis.signature).to.equal('ok');
      expect(diagnosis.quarantined).to.be.false;
    });

    // The kernel kills a binary whose signature doesn't check out before it can write a
    // word, which is exactly what these failures look like: SIGKILL and an empty log.
    it('summarizes why the signature was rejected, without repeating the path', async () => {
      const run = runner({
        ...signed,
        codesign: { code: 1, stderr: `${binary}: code object is not signed at all\n` },
      });

      const diagnosis = await diagnoseExecutable(binary, { platform: 'darwin', run });

      expect(diagnosis.signature).to.equal('code object is not signed at all');
    });

    it('notes a quarantined file', async () => {
      const run = runner({ ...signed, xattr: { code: 0, stderr: '' } });

      const diagnosis = await diagnoseExecutable(binary, { platform: 'darwin', run });

      expect(diagnosis.quarantined).to.be.true;
    });

    // A command that never ran reports no exit status, which is not the same as reporting
    // failure -- the distinction the runner preserves.
    it('says why it could not check the signature, rather than calling it rejected', async () => {
      const run = runner({ codesign: { stderr: 'Error: spawn codesign ENOENT' } });

      const diagnosis = await diagnoseExecutable(binary, { platform: 'darwin', run });

      expect(diagnosis.signature).to.equal('unavailable: Error: spawn codesign ENOENT');
    });

    it('leaves quarantine unanswered when the check could not run', async () => {
      const run = runner({ ...signed, xattr: { stderr: 'Error: spawn xattr ENOENT' } });

      const diagnosis = await diagnoseExecutable(binary, { platform: 'darwin', run });

      // Not false: we never got to ask.
      expect(diagnosis.quarantined).to.be.undefined;
    });

    it('survives a runner that throws rather than reporting failure', async () => {
      const run: RunCommand = () => Promise.reject(new Error('boom'));

      const diagnosis = await diagnoseExecutable(binary, { platform: 'darwin', run });

      expect(diagnosis.signature).to.equal('unavailable');
      expect(diagnosis.quarantined).to.be.undefined;
    });
  });

  it('asks nothing of a platform that has no such tools', async () => {
    const run = runner(signed);

    const diagnosis = await diagnoseExecutable(binary, { platform: 'win32', run });

    expect(diagnosis.signature).to.be.undefined;
    expect(diagnosis.quarantined).to.be.undefined;
    expect((run as Sinon.SinonStub).called).to.be.false;
  });
});
