import '../mock/vscode';
import MockExtensionContext from '../../mocks/mockExtensionContext';
import {
  getSecretEnv,
  getSecretEnvVar,
  migrateOpenAIApiKey,
  setSecretEnvVars,
} from '../../../src/services/navieConfigurationService';
import { expect } from 'chai';

describe('navieConfigurationService', () => {
  let context: MockExtensionContext;

  beforeEach(() => {
    context = new MockExtensionContext();
  });

  describe('migrateOpenAIApiKey', () => {
    it('migrates an existing api key', async () => {
      const apiKey = 'example-api-key';
      await context.secrets.store('openai.api_key', apiKey);
      await migrateOpenAIApiKey(context);
      expect(await getSecretEnvVar(context, 'OPENAI_API_KEY')).to.equal(apiKey);
    });
  });

  describe('getSecretEnv', () => {
    it('returns an empty object if no secret env var is set', async () => {
      const secretEnv = await getSecretEnv(context);
      expect(secretEnv).to.deep.equal({});
    });

    it('returns the secret env var as an object', async () => {
      const secretEnv = { OPENAI_API_KEY: 'example-api-key' };
      await context.secrets.store('appmap.navie.env', JSON.stringify(secretEnv));
      const retrievedEnv = await getSecretEnv(context);
      expect(retrievedEnv).to.deep.equal(secretEnv);
    });
  });

  describe('getSecretEnvVar', () => {
    it('returns undefined if the env var is not set', async () => {
      const envVar = await getSecretEnvVar(context, 'OPENAI_API_KEY');
      expect(envVar).to.be.undefined;
    });

    it('returns the value of the env var', async () => {
      const secretEnv = { OPENAI_API_KEY: 'example-api-key' };
      await context.secrets.store('appmap.navie.env', JSON.stringify(secretEnv));
      const envVar = await getSecretEnvVar(context, 'OPENAI_API_KEY');
      expect(envVar).to.equal('example-api-key');
    });
  });

  describe('setSecretEnvVars', () => {
    it('sets the secret env var', async () => {
      const secretEnv = { OPENAI_API_KEY: 'example-api-key' };
      await context.secrets.store('appmap.navie.env', JSON.stringify(secretEnv));
      const retrievedEnv = await getSecretEnv(context);
      expect(retrievedEnv).to.deep.equal(secretEnv);
    });

    it('deletes empty keys', async () => {
      expect(await getSecretEnv(context)).to.deep.equal({});
      await setSecretEnvVars(context, { foo: 'bar', baz: 'qux' });
      expect(await getSecretEnv(context)).to.deep.equal({ foo: 'bar', baz: 'qux' });
      await setSecretEnvVars(context, { foo: undefined, baz: '' });
      expect(await getSecretEnv(context)).to.deep.equal({});
    });
  });
});
