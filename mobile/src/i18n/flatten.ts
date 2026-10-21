// Converts between the nested strings object and the flat "a.b.0" keys stored in the database.

type Tree = { [key: string]: unknown };

export function flatten(obj: unknown, prefix = '', out: Record<string, string> = {}) {
  if (typeof obj === 'string') {
    out[prefix] = obj;
  } else if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  }
  return out;
}

/** Overwrites strings in `target` with values from `flat`, ignoring keys the app doesn't know. */
export function applyFlat(target: Tree, flat: Record<string, string>) {
  for (const [key, value] of Object.entries(flat)) {
    const path = key.split('.');
    let node: any = target;
    for (const part of path.slice(0, -1)) {
      node = node?.[part];
      if (!node || typeof node !== 'object') break;
    }
    const last = path[path.length - 1];
    if (node && typeof node === 'object' && typeof node[last] === 'string') node[last] = value;
  }
}
