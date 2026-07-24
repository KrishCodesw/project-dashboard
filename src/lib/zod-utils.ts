import { z } from "zod";

export function parseOrThrow<T>(schema: z.ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const msgs = err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      throw new Error(msgs);
    }
    throw err;
  }
}
