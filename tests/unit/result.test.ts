import { expect, test } from 'vitest';
import { ok } from '@shared/result';

test('wraps a value in a successful result', () => {
  expect(ok(0)).toEqual({ ok: true, value: 0 });
});
