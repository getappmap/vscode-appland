import './mock/vscode';
import { expect } from 'chai';
import { parseLocation, sanitizeEnvironment } from '../../src/util';
import Location from './mock/vscode/Location';
import { URI } from 'vscode-uri';
import Sinon from 'sinon';
import path, { win32, posix } from 'path';

describe('sanitizeEnvironment', () => {
  it('should remove sensitive environment variables', () => {
    const env = {
      SECRET_KEY: '123456',
      API_KEY: 'abcdef',
      API_URL: 'https://example.com',
    };

    const sanitizedEnv = sanitizeEnvironment(env);

    expect(sanitizedEnv).to.deep.equal({
      SECRET_KEY: '***',
      API_KEY: '***',
      API_URL: 'https://example.com',
    });
  });

  it('should not modify the original environment object', () => {
    const env = {
      SECRET_KEY: '123456',
      API_KEY: 'abcdef',
      API_URL: 'https://example.com',
    };
    const envCopy = { ...env };

    sanitizeEnvironment(env);

    expect(env).to.deep.equal(envCopy);
  });
});

describe('parseLocation', () => {
  describe('unix paths', () => {
    beforeEach(() => {
      if (process.platform === 'win32') {
        Sinon.stub(path, 'isAbsolute').callsFake(posix.isAbsolute);
      }
    });

    afterEach(() => {
      Sinon.restore();
    });

    it('should parse strings with no line numbers', async () => {
      const examples = [
        ['/path/to/file.rb', '/path/to/file.rb'],
        ['file:///path/to/file.rb', '/path/to/file.rb'],
      ] as const;
      for (const [location, expected] of examples) {
        const result = (await parseLocation(location)) as URI;

        expect(result instanceof URI).to.be.true;
        expect(result.fsPath).to.equal(expected);
      }
    });

    it('should parse a location with a line number', async () => {
      const examples = [
        ['/path/to/file.rb:11', '/path/to/file.rb', 10],
        ['/path/to/file.rb:11', '/path/to/file.rb', 10],
        ['/path/to/file.rb:11-12', '/path/to/file.rb', 10, 11],
      ] as const;
      for (const [location, expected, startLine, endLine] of examples) {
        const result = (await parseLocation(location)) as Location;

        expect(result instanceof Location).to.be.true;
        expect(result.uri.fsPath).to.equal(expected);
        expect(result.range.start.line).to.equal(startLine);
        expect(result.range.end.line).to.equal(endLine ?? startLine);
      }
    });
  });

  describe('windows paths', () => {
    beforeEach(() => {
      if (process.platform !== 'win32') {
        Sinon.stub(path, 'isAbsolute').callsFake(win32.isAbsolute);
      }
    });

    afterEach(() => {
      Sinon.restore();
    });

    it('should parse strings with no line numbers', async () => {
      const result = (await parseLocation('C:\\path\\to\\file.rb')) as URI;

      expect(result instanceof URI).to.be.true;

      // TODO: This may have different behavior on Windows
      //       i.e. it may be a URI with a drive letter
      expect(result.fsPath).to.equal('\\path\\to\\file.rb');
    });

    it('should parse a location with a line number', async () => {
      const examples = [
        ['C:\\path\\to\\file.rb:11', 'c:\\path\\to\\file.rb', 10],
        ['C:\\path\\to\\file.rb:11-12', 'c:\\path\\to\\file.rb', 10, 11],
      ] as const;
      for (const [location, expected, startLine, endLine] of examples) {
        const result = (await parseLocation(location)) as Location;

        expect(result instanceof Location).to.be.true;
        expect(result.uri.fsPath).to.equal(expected);
        expect(result.range.start.line).to.equal(startLine);
        expect(result.range.end.line).to.equal(endLine ?? startLine);
      }
    });
  });
});
