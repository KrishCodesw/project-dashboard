import { z } from "zod";

export function parseOrThrow<S extends z.ZodTypeAny>(schema: S, data: unknown): z.output<S> {
  try {
    return schema.parse(data) as z.output<S>;
  } catch (err) {
    if (err instanceof z.ZodError) {
      const msgs = err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      throw new Error(msgs);
    }
    throw err;
  }
}
