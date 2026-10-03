import { z } from 'zod';

export const uuidSchema = z.uuid();
export const isoDate = z.iso.date();
export const nonEmpty = (max = 200) => z.string().trim().min(1).max(max);
export const optionalText = (max = 2000) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional();

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}
