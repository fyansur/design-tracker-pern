function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors: result.error.flatten().fieldErrors,
      });
    }
    req.body = result.data; // udah ke-parse & ke-coerce sesuai schema
    next();
  };
}

module.exports = validate;