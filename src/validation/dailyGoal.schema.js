const { z } = require("zod");

const updateTargetSchema = z.object({
  targetCount: z.coerce.number().int().positive().max(1000),
});

module.exports = { updateTargetSchema };