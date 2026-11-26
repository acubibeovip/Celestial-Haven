import { z } from 'zod';

export const stringsSchema = z.record(
  z.string().regex(/^[a-z][a-z0-9_]*(\.[a-z0-9_]+)*$/),
  z.string().refine((value) => value.trim().length > 0, 'Expected a non-empty translation.'),
);

export type Strings = z.infer<typeof stringsSchema>;
