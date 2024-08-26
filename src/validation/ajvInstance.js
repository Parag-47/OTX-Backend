import Ajv from "ajv";
import addFormats from "ajv-formats";

const ajv = new Ajv({allErrors: true});
addFormats(ajv);

// Test
// function verifyJson(data) {
//   try {
//     const valid = validate(data);
//     if (!valid) throw new Error(validate.errors);
//     return valid;
//   } catch (error) {
//     console.error("Invalid Data, Error: ", error);
//   }
// }

export default ajv;