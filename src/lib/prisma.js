const { PrismaClient } = require("@prisma/client");
const { createSoftDeleteExtension } = require("prisma-extension-soft-delete");

const softDeleteConfig = {
  field: "deletedAt",
  createValue: (deleted) => (deleted ? new Date() : null),
};

const SOFT_DELETE_MODELS = [
  "User", "Owner", "Store", "Category",
  "Design", "Goal", "DailyGoal", "DailyGoalTarget",
];

const prisma = new PrismaClient().$extends(
  createSoftDeleteExtension({
    models: Object.fromEntries(
      SOFT_DELETE_MODELS.map((m) => [m, softDeleteConfig])
    ),
  })
);

module.exports = prisma;