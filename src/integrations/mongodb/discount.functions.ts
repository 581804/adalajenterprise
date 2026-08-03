import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Client-callable preview — no usage consumed. Anyone can call this, matching the original's PUBLIC grant. */
export const previewDiscountClient = createServerFn({ method: "GET" })
  .validator(z.object({ code: z.string(), subtotalCents: z.number().min(0) }))
  .handler(async ({ data }) => {
    const { previewDiscount } = await import("./discount-logic.server");
    return previewDiscount(data.code, data.subtotalCents);
  });
