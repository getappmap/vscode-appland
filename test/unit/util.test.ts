import './mock/vscode';
import { expect } from 'chai';
import { sanitizeEnvironment } from '../../src/util';

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
