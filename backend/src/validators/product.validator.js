const { z } = require('zod');

const attributeValueSchema = z.object({
  attributeId: z.coerce.number().int().positive(),
  optionId: z.coerce.number().int().positive().optional(),
  valueText: z.string().trim().max(1000).optional(),
  valueNumber: z.coerce.number().finite().optional(),
  valueBoolean: z.boolean().optional(),
}).strict();

const baseProductSchema = z.object({
  gameId: z.coerce.number().int().positive().optional(),
  title: z.string().trim().min(3).max(200).optional(),
  description: z.string().trim().min(1).max(10000).optional(),
  price: z.coerce.number().finite().min(0).optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED']).optional(),
  attributes: z.array(attributeValueSchema).max(100).optional(),
}).strict();

const createProductSchema = baseProductSchema.extend({
  gameId: z.coerce.number().int().positive(),
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().min(1).max(10000),
  price: z.coerce.number().finite().min(0),
  attributes: z.array(attributeValueSchema).max(100).default([]),
});

const updateProductSchema = baseProductSchema.refine(
  (value) => Object.keys(value).length > 0,
  { message: 'At least one field must be provided.' },
);

module.exports = { createProductSchema, updateProductSchema };
