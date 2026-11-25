import { expect, expectTypeOf, test } from 'vitest';
import { err, isErr, isOk, ok, type Result } from '@shared/result';

function parseCount(value: string): Result<number, string> {
  return /^\d+$/.test(value) ? ok(Number(value)) : err('Invalid count');
}

test('wraps a value in a successful result and narrows to its value', () => {
  const result = parseCount('0');

  expect(result).toEqual({ ok: true, value: 0 });
  expect(isErr(result)).toBe(false);
  if (!isOk(result)) throw new Error('Expected a successful result');
  expectTypeOf(result.value).toEqualTypeOf<number>();
});

test('wraps an error in a failed result and narrows to its error', () => {
  const result = parseCount('invalid');

  expect(result).toEqual({ ok: false, error: 'Invalid count' });
  expect(isOk(result)).toBe(false);
  if (!isErr(result)) throw new Error('Expected a failed result');
  expectTypeOf(result.error).toEqualTypeOf<string>();
});
