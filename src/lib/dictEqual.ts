export type Dict = { [key: string]: string | null | undefined | number };

/** Compares two dictionary-like objects for equality. */
export default function dictEqual(xs: Dict | undefined, ys: Dict | undefined): boolean {
  if (xs === ys) return true;
  if (!(xs && ys)) return false;

  const xse = Object.entries(xs);
  const yse = Object.entries(ys);
  if (xse.length !== yse.length) return false;

  for (const [k, v] of xse) if (ys[k] !== v) return false;
  return true;
}
