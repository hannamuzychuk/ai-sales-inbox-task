import { z } from "zod";

export const createLeadSchema = z
  .object({
    sourceMessageId: z.string().trim().min(1),
    product: z.string().trim().min(1),
    quantity: z.number().int().positive(),
    material: z.union([z.string(), z.null()]).optional(),
    budget: z.union([z.number().nonnegative(), z.null()]).optional(),
  })
  .transform((value) => {
    const material =
      value.material === undefined || value.material === null
        ? null
        : value.material.trim() === ""
          ? null
          : value.material.trim();

    return {
      sourceMessageId: value.sourceMessageId,
      product: value.product,
      quantity: value.quantity,
      material,
      budget: value.budget === undefined ? null : value.budget,
    };
  });

export const updateLeadStatusSchema = z
  .object({
    status: z.literal("CONTACTED"),
  })
  .strict();

export function serializeLead(lead: {
  id: string;
  sourceMessageId: string;
  product: string;
  quantity: number;
  material: string | null;
  budget: number | null;
  status: string;
  createdAt: Date;
}) {
  return {
    id: lead.id,
    sourceMessageId: lead.sourceMessageId,
    product: lead.product,
    quantity: lead.quantity,
    material: lead.material,
    budget: lead.budget,
    status: lead.status,
    createdAt: lead.createdAt.toISOString(),
  };
}
