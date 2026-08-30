const prisma = require("./prisma");

async function recordActivity({ userId, subjectType, subjectId, event, itemName }) {
  const templates = {
    created: `submitted/created "${itemName}"`,
    updated: `edited "${itemName}"`,
    deleted: `deleted "${itemName}"`,
    completed: `completed "${itemName}"`,
    pending: `marked "${itemName}" as pending`,
  };

  await prisma.activityLog.create({
    data: {
      userId,
      subjectType,
      subjectId,
      event,
      description: templates[event] || `${event} "${itemName}"`,
      properties: { itemName, event, subjectType },
    },
  });
}

module.exports = recordActivity;