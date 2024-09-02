import '../mock/vscode';

import http from 'node:http';

import { expect } from 'chai';
import sinon from 'sinon';
import type {
  LanguageModelChat,
  LanguageModelChatMessage,
  LanguageModelChatResponse,
} from 'vscode';

import ChatCompletion from '../../../src/services/chatCompletion';
import { addMockChatModel } from '../mock/vscode/lm';
import assert from 'node:assert';

const mockModel: LanguageModelChat = {
  id: 'test-model',
  family: 'test-family',
  version: 'test-model',
  async countTokens(): Promise<number> {
    return 0;
  },
  maxInputTokens: 325,
  name: 'Test Model',
  sendRequest: sendRequestEcho,
  vendor: 'Test Vendor',
};

addMockChatModel(mockModel);

describe('ChatCompletion', () => {
  let chatCompletion: ChatCompletion;
  before(async () => {
    mockModel.sendRequest = sendRequestEcho;
    chatCompletion = new ChatCompletion(0, 'test-key');
    await chatCompletion.ready;
  });
  after(() => chatCompletion.dispose());

  afterEach(() => {
    sinon.restore();
  });

  it('should create a server and listen on a random port', async () => {
    const instance = await ChatCompletion.instance;
    expect(instance).to.equal(chatCompletion);

    expect(chatCompletion.port).to.be.above(0);
    expect(chatCompletion.url).to.match(/^http:\/\/localhost:\d+\/vscode\/copilot$/);

    // make an actual HTTP request to the server
    const res = await get(chatCompletion.url);
    expect(res.statusCode).to.equal(405);
  });

  it('should handle invalid HTTP methods', async () => {
    const res = await get(chatCompletion.url);
    expect(res.statusCode).to.equal(405);
  });

  it('should handle invalid authorization', async () => {
    const res = await request(chatCompletion.url, { method: 'POST' });
    expect(res.statusCode).to.equal(401);
  });

  it('should handle invalid request', async () => {
    const res = await postAuthorized(chatCompletion.url);
    expect(res.statusCode).to.equal(400);
  });

  it('should handle model not found', async () => {
    const res = await postAuthorized(chatCompletion.url, { model: 'non-existent', messages: [] });
    expect(res.statusCode).to.equal(404);
  });

  it('should handle error processing request', async () => {
    const res = await postAuthorized(chatCompletion.url, { model: 'test-model', messages: [] });
    expect(res.statusCode).to.equal(422);
  });

  it('should send chat completion response', async () => {
    const messages = [
      { content: 'Hello', role: 'user' },
      { content: 'How are you?', role: 'assistant' },
      { content: 'I am good, thank you!', role: 'user' },
    ];
    const response = await postAuthorized(chatCompletion.url, { model: 'test-model', messages });
    expect(response.statusCode).to.equal(200);
    assert(typeof response.data === 'string');
    const result = JSON.parse(response.data);
    expect(result.choices[0].message.content).to.equal('Hello, you said: I am good, thank you!');
  });

  it('should stream chat completion', async () => {
    const messages = [
      { content: 'Hello', role: 'user' },
      { content: 'How are you?', role: 'assistant' },
      { content: 'I am good, thank you!', role: 'user' },
    ];
    const response = await postAuthorized(
      chatCompletion.url,
      { model: 'test-model', messages, stream: true },
      true
    );
    expect(response.statusCode).to.equal(200);
    assert(typeof response.data !== 'string');
    const contents: string[] = [];
    for await (const chunk of readSSE(response.data)) {
      if (chunk === 'data: [DONE]\n\n') break;
      const result = JSON.parse(chunk.replace(/^data: /, ''));
      contents.push(result.choices[0].delta.content);
    }
    expect(contents.join('')).to.equal('Hello, you said: I am good, thank you!');
  });

  describe('when streaming errors', () => {
    beforeEach(() => {
      mockModel.sendRequest = async () => {
        return {
          // eslint-disable-next-line require-yield
          text: (async function* () {
            throw new Error('test error');
          })(),
        };
      };
    });

    it('reports errors when streaming', async () => {
      const messages = [
        { content: 'Hello', role: 'user' },
        { content: 'How are you?', role: 'assistant' },
        { content: 'I am good, thank you!', role: 'user' },
      ];
      const response = await postAuthorized(
        chatCompletion.url,
        { model: 'test-model', messages, stream: true },
        true
      );
      expect(response.statusCode).to.equal(422);
    });

    it('reports errors when not streaming', async () => {
      const messages = [
        { content: 'Hello', role: 'user' },
        { content: 'How are you?', role: 'assistant' },
        { content: 'I am good, thank you!', role: 'user' },
      ];
      const response = await postAuthorized(chatCompletion.url, { model: 'test-model', messages });
      expect(response.statusCode).to.equal(422);
    });
  });
});

interface Response {
  statusCode?: number;
  data: string | AsyncIterable<Buffer>;
}

function get(url: string): Promise<Response> {
  return request(url, { method: 'GET' });
}

function postAuthorized(url: string, body?: unknown, stream = false): Promise<Response> {
  return request(
    url,
    {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-key',
      },
      stream,
    },
    body
  );
}

async function request(
  url: string,
  options: http.RequestOptions & { stream?: boolean },
  body?: unknown
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, options, (res) => {
      if (options.stream) return resolve({ statusCode: res.statusCode, data: res });
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, data });
      });
    });
    req.on('error', reject);

    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));

    req.end();
  });
}

// make an async iterable stream of words (including separating spaces) from a string
async function* makeStream(text: string): AsyncIterable<string> {
  const re = /\S+\s*/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    yield match[0];
  }
}

async function sendRequestEcho(
  messages: LanguageModelChatMessage[]
): Promise<LanguageModelChatResponse> {
  // say hello and echo the last message
  const lastMessage = messages[messages.length - 1];
  return { text: makeStream(`Hello, you said: ${lastMessage.content}`) };
}

// read an async iterable stream of SSE chunks
async function* readSSE(stream: AsyncIterable<Buffer>): AsyncIterable<string> {
  const decoder = new TextDecoder();
  let buffer = '';
  for await (const chunk of stream) {
    buffer += decoder.decode(chunk, { stream: true });
    let index: number;
    while ((index = buffer.indexOf('\n\n')) >= 0) {
      const chunk = buffer.slice(0, index + 2);
      buffer = buffer.slice(index + 2);
      yield chunk;
    }
  }
  if (buffer.length) yield buffer;
}
