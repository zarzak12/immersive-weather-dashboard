import { describe, expect, it } from 'vitest';
import en from '../src/localize/en.json';
import fr from '../src/localize/fr.json';

type TreeNode = { [key: string]: string | TreeNode };

function collectKeys(obj: TreeNode, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'object' && v !== null) {
      keys.push(...collectKeys(v as TreeNode, full));
    } else {
      keys.push(full);
    }
  }
  return keys.sort();
}

describe('localization structural alignment', () => {
  it('en.json and fr.json have identical key sets', () => {
    const enKeys = collectKeys(en as unknown as TreeNode);
    const frKeys = collectKeys(fr as unknown as TreeNode);
    expect(frKeys).toEqual(enKeys);
  });

  it('all values in en.json are non-empty strings', () => {
    const enKeys = collectKeys(en as unknown as TreeNode);
    expect(enKeys.length).toBeGreaterThan(0);
  });

  it('all values in fr.json are non-empty strings', () => {
    const frKeys = collectKeys(fr as unknown as TreeNode);
    expect(frKeys.length).toBeGreaterThan(0);
  });
});
