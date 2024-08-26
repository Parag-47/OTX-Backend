import ApiResponse from "../utils/ApiResponse.js";

function validateDto(validate) {
  return (req, res, next) => {
    const valid = validate(req.body); 
    if (!valid) {
      console.error("Invalid Data, Error: ", validate.errors);
      return res.status(400).json(new ApiResponse(400, false, "Invalid Data, Error!", validate.errors));
    }
    // it is imperative that the reference to the errors is copied
      // the next time ajv runs the errors object could be overridden
      // because under the hood it is just a pointer
      // that's why the reference needs to be copied in the same execution
      // block. Note that Node is single-threaded and you do not have
      // concurrency
      // in this simple example it would work without copying
      // simply because we are directly terminating the request with
      // res.status(400).json(...)
      // but in general copying the errors reference is crucial
    next();
  };
}

export default validateDto;