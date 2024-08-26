import { format } from "morgan";
import ajv from "./ajvInstance.js";

const schema = {
  type: "object",
  properties: {
    name: {type: "string",  maxLength: 50},
    phone: {type: "number"},
    email: {type: "string", format: "email"},
    password: {type: "string"},
    broker: {type: "string", enum: ["Motilal Oswal", "Upstox", "AliceBlue"]},
    traderType: {type: "string", enum: ["Day Trader", "Momentum Trader", "Option Trader", "Swing Trader", "Trend Trader", "Buy Hold Trader"]},
    source: {type: "string", enum: ["Facebook", "Instagram", "YouTube", "Direct"]},
  },
  required: ["name", "phone", "email", "password", "broker"],
  additionalProperties: false,
};

const validate = ajv.compile(schema);

export default validate;