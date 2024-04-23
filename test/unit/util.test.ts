import './mock/vscode';
import { expect } from 'chai';
import { parseLocation, sanitizeEnvironment } from '../../src/util';
import Location from './mock/vscode/Location';
import { URI } from 'vscode-uri';

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
  it('should parse strings with no line numbers', () => {
    const examples = [
      ['/path/to/file.rb', '/path/to/file.rb'],
      ['C:\\path\\to\\file.rb', '\\path\\to\\file.rb'],
      ['file:///path/to/file.rb', '/path/to/file.rb'],
    ] as const;
    examples.forEach(([location, expected]) => {
      const result = parseLocation(location) as URI;

      expect(result instanceof URI).to.be.true;
      expect(result.fsPath).to.equal(expected);
    });
  });

  it('should parse a location with a line number', () => {
    const examples = [
      ['/path/to/file.rb:11', '/path/to/file.rb', 10],
      ['C:\\path\\to\\file.rb:11', '\\path\\to\\file.rb', 10],
      ['file:///path/to/file.rb:11', '/path/to/file.rb', 10],
      ['file:///path/to/file.rb:11-12', '/path/to/file.rb', 10, 11],
    ] as const;
    examples.forEach(([location, expected, startLine, endLine]) => {
      const result = parseLocation(location) as Location;

      expect(result instanceof Location).to.be.true;
      expect(result.uri.fsPath).to.equal(expected);
      expect(result.range.start.line).to.equal(startLine);
      expect(result.range.end.line).to.equal(endLine ?? startLine);
    });
  });
});
