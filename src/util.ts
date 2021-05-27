export function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

// Returns an object's string values with an optional key prefix
// getStringRecords({ a: 'hello', b: [object Object] }, 'myApp') ->
// { 'myApp.a': 'hello' }
export function getStringRecords(
  obj: Record<string, unknown> = {},
  keyPrefix?: string
): Record<string, string> {
  const base = keyPrefix ? `${keyPrefix}.` : '';

  return Object.entries(obj).reduce((memo, [k, v]) => {
    if (typeof v !== 'object') {
      memo[`${base}${k}`] = String(v);
    }
    return memo;
  }, {} as Record<string, string>);
}

export function notEmpty<TValue>(value: TValue | null | undefined): value is TValue {
  return value !== null && value !== undefined;
}
