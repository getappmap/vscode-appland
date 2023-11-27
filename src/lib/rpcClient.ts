import jayson from 'jayson/promise';
import { AppMapRpc, SearchRpc } from '@appland/rpc';
import assert from 'assert';
import { AppMap, Metadata, buildAppMap } from '@appland/models';
import { Diagram, SequenceDiagramOptions, unparseDiagram } from '@appland/sequence-diagram';

export type RpcError = {
  code: number;
  message?: string;
};

export class RPCClient {
  client: jayson.Client;

  constructor(public port: number) {
    this.port = port;
    this.client = jayson.Client.http({ port: this.port });
  }

  async search(query: string, maxResults?: number): Promise<SearchRpc.SearchResponse> {
    const response: { error: RpcError | null; result?: SearchRpc.SearchResponse } =
      await this.client.request(SearchRpc.FunctionName, { query, maxResults });
    if (response.error) {
      throw new Error(`${response.error.message || 'unknown error'} (code ${response.error.code})`);
    }
    assert(response.result);
    return response.result;
  }

  async filterAppMap(appmapId: string, filter: string | Record<string, any>): Promise<AppMap> {
    const response: { error: RpcError | null; result?: AppMapRpc.FilterResponse } =
      await this.client.request(AppMapRpc.FilterFunctionName, { appmap: appmapId, filter });
    if (response.error) {
      throw new Error(`${response.error.message || 'unknown error'} (code ${response.error.code})`);
    }
    assert(response.result);
    return buildAppMap().source(response.result).build();
  }

  async metadata(appmapId: string): Promise<Metadata> {
    const response: { error: RpcError | null; result?: AppMapRpc.MetadataResponse } =
      await this.client.request(AppMapRpc.MetadataFunctionName, { appmap: appmapId });
    if (response.error) {
      throw new Error(`${response.error.message || 'unknown error'} (code ${response.error.code})`);
    }
    assert(response.result);
    return response.result as unknown as Metadata;
  }

  async sequenceDiagram(
    appmapId: string,
    options?: SequenceDiagramOptions,
    filter?: string | Record<string, any>,
    format?: string,
    formatOptions?: Record<string, boolean>
  ): Promise<Diagram | string> {
    const response: { error: RpcError | null; result?: AppMapRpc.SequenceDiagramResponse } =
      await this.client.request(AppMapRpc.SequenceDiagramFunctionName, {
        appmap: appmapId,
        options,
        filter,
        format,
        formatOptions,
      });
    if (response.error) {
      throw new Error(`${response.error.message || 'unknown error'} (code ${response.error.code})`);
    }
    assert(response.result);
    if (typeof response.result === 'string') return response.result;
    else return unparseDiagram(response.result as unknown as Diagram);
  }
}
