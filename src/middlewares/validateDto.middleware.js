import ApiResponse from "../utils/ApiResponse.js";

/**
 * Generic validation middleware that can validate body, query, params, or headers
 * @param {Function} validator - Compiled AJV validator
 * @param {string} source - Source to validate: 'body' | 'query' | 'params' | 'headers'
 * @returns {Function} Express middleware
 */
function validate(validator, source = "body") {
  return (req, res, next) => {
    const dataToValidate = req[source];

    if (!dataToValidate) {
      return res
        .status(400)
        .json(new ApiResponse(400, false, `No ${source} data provided`));
    }

    const valid = validator(dataToValidate);

    if (valid) return next();

    const errors = validator.errors.map((err) => {
      let field = err.instancePath ? err.instancePath.slice(1) : null;
      if (err.keyword === "required") {
        field = err.params.missingProperty;
      }

      if (err.keyword === "anyOf") {
        field = null;
      }

      return {
        field: field || "general",
        message: err.message,
      };
    });

    return res
      .status(400)
      .json(new ApiResponse(400, false, "Validation failed", errors));
  };
}

export const validateBody = (validator) => validate(validator, "body");
export const validateQuery = (validator) => validate(validator, "query");
export const validateParams = (validator) => validate(validator, "params");
export const validateHeaders = (validator) => validate(validator, "headers");

export default validate;
