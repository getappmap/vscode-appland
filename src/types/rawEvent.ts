/**
 * RawEventData represents the actual JSON structure of events as stored in AppMap files
 * and returned from the scanner. These use snake_case naming (from Ruby/Python origins),
 * unlike the Event class from @appland/models which uses camelCase.
 *
 * Note: The Finding interface from @appland/scanner incorrectly types some fields as Event
 * when they are actually raw JSON objects. This type provides the correct structure.
 */

export interface RawHttpServerRequest {
  readonly request_method: string;
  readonly path_info: string;
  readonly normalized_path_info?: string;
  readonly protocol?: string;
  readonly headers?: Record<string, string>;
}

export interface RawHttpServerResponse {
  readonly status: number;
  readonly headers?: Record<string, string>;
}

export interface RawHttpClientRequest {
  readonly request_method: string;
  readonly url: string;
  readonly headers?: Record<string, string>;
}

export interface RawHttpClientResponse {
  readonly status: number;
  readonly headers?: Record<string, string>;
}

export interface RawSqlQuery {
  readonly database_type: string;
  readonly sql: string;
  readonly explain_sql?: string;
  readonly server_version?: string;
}

export interface RawParameterObject {
  readonly name?: string;
  readonly class: string;
  readonly value?: string;
  readonly size?: number;
}

export interface RawExceptionObject {
  readonly class: string;
  readonly message: string;
  readonly path?: string;
  readonly lineno?: number;
}

export interface RawReturnValue {
  readonly class: string;
  readonly value?: string;
  readonly size?: number;
}

/**
 * Raw event data structure as it appears in AppMap JSON files.
 * This is what Finding.participatingEvents, Finding.event, Finding.scope,
 * and Finding.relatedEvents actually contain (despite being typed as Event).
 */
export interface RawEventData {
  readonly id: number;
  readonly event?: 'call' | 'return';
  readonly thread_id?: number;
  readonly parent_id?: number;
  readonly elapsed?: number;

  // HTTP request/response
  readonly http_server_request?: RawHttpServerRequest;
  readonly http_server_response?: RawHttpServerResponse;
  readonly http_client_request?: RawHttpClientRequest;
  readonly http_client_response?: RawHttpClientResponse;

  // SQL query
  readonly sql_query?: RawSqlQuery;

  // Method/function info
  readonly defined_class?: string;
  readonly method_id?: string;
  readonly path?: string;
  readonly lineno?: number;
  readonly static?: boolean;

  // Parameters and return values
  readonly parameters?: RawParameterObject[];
  readonly receiver?: RawParameterObject;
  readonly return_value?: RawReturnValue;
  readonly exceptions?: RawExceptionObject[];
  readonly message?: RawParameterObject[];

  // Metadata
  readonly labels?: string[];
}
