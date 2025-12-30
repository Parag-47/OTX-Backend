import Ajv from "ajv";
import addFormats from "ajv-formats";
import ajvErrors from "ajv-errors";

const ajv = new Ajv({
  allErrors: true,
  coerceTypes: true, // converts strings → numbers when needed
  useDefaults: true, // fills missing defaults
  removeAdditional: true, // removes extra fields
  strict: false, // prevents annoying strict warnings
});

addFormats(ajv);
ajvErrors(ajv);

export default ajv;
