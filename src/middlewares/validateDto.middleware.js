import ApiResponse from "../utils/ApiResponse.js";

function validateDto(validate) {
  return (req, res, next) => {
    const valid = validate(req.body); 
    if (valid) return next();
    console.error("Invalid Data, Error: ", validate.errors);
    return res.status(400).json(new ApiResponse(400, false, "Invalid Data, Error!", validate.errors));
  };
}

export default validateDto;