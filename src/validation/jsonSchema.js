import ajv from "./ajvInstance.js";

// ==================== SIGNUP SCHEMA ====================
const signupSchema = {
  type: "object",
  properties: {
    name: {
      type: "string",
      minLength: 1,
      maxLength: 50,
      errorMessage: {
        minLength: "Name is required",
        maxLength: "Name cannot exceed 50 characters",
      },
    },
    email: {
      type: "string",
      format: "email",
      errorMessage: {
        format: "Email must be a valid email address",
      },
    },
    phone: {
      type: "string",
      pattern: "^[0-9]{10}$",
      errorMessage: {
        pattern: "Phone number must be exactly 10 digits",
      },
    },
    pin: {
      type: "string",
      pattern: "^[0-9]{4}$",
      errorMessage: {
        pattern: "PIN must be exactly 4 digits",
      },
    },
    otp: {
      type: "string",
      pattern: "^[0-9]{6}$",
      errorMessage: {
        pattern: "OTP must be exactly 6 digits",
      },
    },
  },
  required: ["phone", "otp"],
  additionalProperties: false,
  errorMessage: {
    required: {
      phone: "Phone number is required",
      otp: "OTP is required",
    },
    additionalProperties: "Unknown field(s) provided",
  },
};

// ==================== LOGIN SCHEMAS ====================
const loginSchema = {
  type: "object",
  properties: {
    phone: {
      type: "string",
      pattern: "^[0-9]{10}$",
      errorMessage: {
        pattern: "Phone number must be exactly 10 digits",
      },
    },
    pin: {
      type: "string",
      pattern: "^[0-9]{4}$",
      errorMessage: {
        pattern: "PIN must be exactly 4 digits",
      },
    },
  },
  required: ["phone", "pin"],
  additionalProperties: false,
  errorMessage: {
    required: {
      phone: "Phone number is required",
      pin: "PIN is required",
    },
    additionalProperties: "Unknown field(s) provided",
  },
};

const loginOtpSchema = {
  type: "object",
  properties: {
    phone: {
      type: "string",
      pattern: "^[0-9]{10}$",
      errorMessage: {
        pattern: "Phone number must be exactly 10 digits",
      },
    },
    otp: {
      type: "string",
      pattern: "^[0-9]{6}$",
      errorMessage: {
        pattern: "OTP must be exactly 6 digits",
      },
    },
  },
  required: ["phone", "otp"],
  additionalProperties: false,
  errorMessage: {
    required: {
      phone: "Phone number is required",
      otp: "OTP is required",
    },
    additionalProperties: "Unknown field(s) provided",
  },
};

const sendOtpSchema = {
  type: "object",
  properties: {
    phone: {
      type: "string",
      pattern: "^[0-9]{10}$",
      errorMessage: {
        pattern: "Phone number must be exactly 10 digits",
      },
    },
    name: {
      type: "string",
      minLength: 1,
      maxLength: 50,
      errorMessage: {
        minLength: "Name is required",
        maxLength: "Name cannot exceed 50 characters",
      },
    },
    email: {
      type: "string",
      format: "email",
      errorMessage: {
        format: "Email must be a valid email address",
      },
    },
    pin: {
      type: "string",
      pattern: "^[0-9]{4}$",
      errorMessage: {
        pattern: "PIN must be exactly 4 digits",
      },
    },
  },
  required: ["phone"],
  additionalProperties: false,
  errorMessage: {
    required: {
      phone: "Phone number is required",
    },
    additionalProperties: "Unknown field(s) provided",
  },
};

// ==================== UPDATE ACCOUNT INFO SCHEMA ====================
const updateAccountInfoSchema = {
  type: "object",
  properties: {
    name: {
      type: "string",
      minLength: 1,
      maxLength: 50,
      errorMessage: {
        minLength: "Name cannot be empty",
        maxLength: "Name cannot exceed 50 characters",
      },
    },
    broker: {
      type: "string",
      enum: ["Motilal Oswal", "Upstox", "AliceBlue"],
      errorMessage: {
        enum: "Broker must be one of: Motilal Oswal, Upstox, AliceBlue",
      },
    },
    traderType: {
      type: "string",
      enum: [
        "Day Trader",
        "Momentum Trader",
        "Option Trader",
        "Swing Trader",
        "Trend Trader",
        "Buy Hold Trader",
      ],
      errorMessage: {
        enum: "Invalid trader type",
      },
    },
    source: {
      type: "string",
      enum: ["Facebook", "Instagram", "YouTube", "Direct"],
      errorMessage: {
        enum: "Invalid source",
      },
    },
  },
  minProperties: 1,
  additionalProperties: false,
  errorMessage: {
    minProperties: "At least one field is required to update",
    additionalProperties: "Unknown field(s) provided",
  },
};

// ==================== UPDATE EMAIL SCHEMA ====================
const updateEmailSchema = {
  type: "object",
  properties: {
    email: {
      type: "string",
      format: "email",
      minLength: 1,
      errorMessage: {
        format: "Email must be a valid email address",
        minLength: "Email is required",
      },
    },
  },
  required: ["email"],
  additionalProperties: false,
  errorMessage: {
    required: {
      email: "Email is required",
    },
    additionalProperties: "Unknown field(s) provided",
  },
};

// ==================== UPDATE PHONE SCHEMA ====================
const updatePhoneSchema = {
  type: "object",
  properties: {
    phone: {
      type: "string",
      pattern: "^[0-9]{10,15}$",
      errorMessage: {
        pattern: "Phone number must be between 10-15 digits",
      },
    },
  },
  required: ["phone"],
  additionalProperties: false,
  errorMessage: {
    required: {
      phone: "Phone number is required",
    },
    additionalProperties: "Unknown field(s) provided",
  },
};

// ==================== FORGET PIN SCHEMA ====================
const forgetPinSchema = {
  type: "object",
  properties: {
    phone: {
      type: "string",
      pattern: "^[0-9]{10}$",
      errorMessage: {
        pattern: "Phone number must be exactly 10 digits",
      },
    },
  },
  required: ["phone"],
  additionalProperties: false,
  errorMessage: {
    required: {
      phone: "Phone number is required",
    },
    additionalProperties: "Unknown field(s) provided",
  },
};

// ==================== RESET PASSWORD SCHEMA ====================
const resetPasswordSchema = {
  type: "object",
  properties: {
    token: {
      type: "string",
      minLength: 1,
      errorMessage: {
        minLength: "Token is required",
      },
    },
    password: {
      type: "string",
      minLength: 6,
      errorMessage: {
        minLength: "Password must be at least 6 characters long",
        type: "Password is required",
      },
    },
    confirmPassword: {
      type: "string",
      minLength: 6,
      errorMessage: {
        minLength: "Confirm password must be at least 6 characters long",
        type: "Confirm password is required",
      },
    },
  },
  required: ["token", "password", "confirmPassword"],
  additionalProperties: false,
  errorMessage: {
    required: {
      token: "Reset token is required",
      password: "Password is required",
      confirmPassword: "Confirm password is required",
    },
    additionalProperties: "Unknown field(s) provided",
  },
};

// ==================== ENQUIRY SCHEMA ====================
const enquirySchema = {
  type: "object",
  properties: {
    name: {
      type: "string",
      minLength: 1,
      maxLength: 100,
      errorMessage: {
        minLength: "Name is required",
        maxLength: "Name cannot exceed 100 characters",
      },
    },
    email: {
      type: "string",
      format: "email",
      errorMessage: {
        format: "Email must be a valid email address",
      },
    },
    phone: {
      type: "string",
      minLength: 7,
      errorMessage: {
        minLength: "Phone number is required",
      },
    },
    inquiryType: {
      type: "string",
      enum: ["General Inquiry", "Partnership", "Support"],
      errorMessage: {
        enum: "Inquiry type must be one of: General Inquiry, Partnership, Support",
      },
    },
    message: {
      type: "string",
      minLength: 10,
      maxLength: 1000,
      errorMessage: {
        minLength: "Message must be at least 10 characters",
        maxLength: "Message cannot exceed 1000 characters",
      },
    },
  },
  required: ["name", "email", "phone", "inquiryType", "message"],
  additionalProperties: false,
  errorMessage: {
    required: {
      name: "Name is required",
      email: "Email is required",
      phone: "Phone number is required",
      inquiryType: "Inquiry type is required",
      message: "Message is required",
    },
    additionalProperties: "Unknown field(s) provided",
  },
};
// ==================== UPDATE PROFILE SCHEMA ====================
const updateProfileSchema = {
  type: "object",
  properties: {
    gender: {
      type: "string",
      enum: ["male", "female"],
      errorMessage: {
        enum: "Gender must be either male or female",
      },
    },
    dateOfBirth: {
      type: "string",
      format: "date",
      errorMessage: {
        format: "Date of birth must be a valid date (YYYY-MM-DD)",
      },
    },
    fathersName: {
      type: "string",
      minLength: 3,
      maxLength: 50,
      pattern: "^[a-zA-Z\\s]+$",
      errorMessage: {
        minLength: "Father's name must be at least 3 characters",
        maxLength: "Father's name cannot exceed 50 characters",
        pattern: "Father's name can only contain letters and spaces",
      },
    },
    incomeRange: {
      type: "string",
      enum: ["below_1l", "1_5l", "5_10l", "10l+", "below1L", "1-5L", "5-10L"],
      errorMessage: {
        enum: "Invalid income range",
      },
    },
    investment: {
      type: ["number", "null"],
      minimum: 0,
      errorMessage: {
        type: "Investment must be a number or null",
        minimum: "Investment amount cannot be negative",
      },
    },
  },
  minProperties: 1,
  additionalProperties: false,
  errorMessage: {
    minProperties: "At least one field is required to update",
    additionalProperties: "Unknown field(s) provided",
  },
};

// ==================== UPDATE KYC SCHEMA ====================
const updateKycSchema = {
  type: "object",
  properties: {
    panNumber: {
      type: "string",
      pattern: "^[A-Z]{5}[0-9]{4}[A-Z]{1}$",
      errorMessage: {
        pattern: "PAN Number must be in the format XXXXX1234X",
      },
    },
    aadhaarNumber: {
      type: "string",
      pattern: "^\\d{12}$",
      errorMessage: {
        pattern: "Aadhaar Number must be exactly 12 digits",
      },
    },
    address: {
      type: "string",
      minLength: 5,
      maxLength: 500,
      errorMessage: {
        minLength: "Address must be at least 5 characters long",
        maxLength: "Address cannot exceed 500 characters",
      },
    },
    accountNumber: {
      type: "string",
      pattern: "^[0-9]{9,18}$",
      errorMessage: {
        pattern: "Bank account number must be between 9 and 18 digits",
      },
    },
    ifscCode: {
      type: "string",
      pattern: "^[A-Za-z]{4}0[A-Za-z0-9]{6}$",
      errorMessage: {
        pattern: "IFSC code must be a valid 11-character Indian financial code",
      },
    },
    accountHolderName: {
      type: "string",
      minLength: 3,
      maxLength: 100,
      errorMessage: {
        minLength: "Account holder name must be at least 3 characters long",
        maxLength: "Account holder name must be less than 100 characters",
      },
    },
    bankName: {
      type: "string",
      minLength: 2,
      maxLength: 100,
      errorMessage: {
        minLength: "Bank name must be at least 2 characters long",
        maxLength: "Bank name must be less than 100 characters",
      },
    },
  },
  minProperties: 1,
  additionalProperties: false,
  errorMessage: {
    minProperties: "At least one field is required to update",
    additionalProperties: "Unknown field(s) provided",
  },
};

// ==================== RESET PIN SCHEMA ====================
const resetPinSchema = {
  type: "object",
  properties: {
    pin: {
      type: "string",
      minLength: 4,
      maxLength: 4,
      pattern: "^[0-9]{4}$",
      errorMessage: {
        minLength: "PIN must be exactly 4 digits",
        maxLength: "PIN must be exactly 4 digits",
        pattern: "PIN must be exactly 4 digits",
      },
    },
    otp: {
      type: "string",
      minLength: 6,
      maxLength: 6,
      pattern: "^[0-9]{6}$",
      errorMessage: {
        minLength: "OTP must be 6 digits",
        maxLength: "OTP must be 6 digits",
        pattern: "OTP must be exactly 6 digits",
      },
    },
  },
  required: ["pin", "otp"],
  additionalProperties: false,
  errorMessage: {
    required: {
      pin: "PIN is required",
      otp: "OTP is required",
    },
    additionalProperties: "Unknown field(s) provided",
  },
};

// ==================== UPDATE DEMAT SCHEMA ====================
const updateDematSchema = {
  type: "object",
  properties: {
    dpName: {
      type: "string",
      enum: ["CDSL", "NSDL"],
      errorMessage: {
        enum: "DP Name must be either CDSL or NSDL",
      },
    },
    dpId: {
      type: "string",
      pattern: "^([0-9]{8}|[iI][nN][0-9]{6})$",
      errorMessage: {
        pattern: "DP ID must be 8 numeric digits (for CDSL) or start with IN followed by 6 digits (for NSDL)",
      },
    },
    clientId: {
      type: "string",
      pattern: "^[0-9]{8}$",
      errorMessage: {
        pattern: "Client ID must be an 8-digit number",
      },
    },
    nomineeName: {
      type: "string",
      minLength: 1,
      maxLength: 100,
      errorMessage: {
        minLength: "Nominee Name cannot be empty",
        maxLength: "Nominee Name cannot exceed 100 characters",
      },
    },
  },
  required: ["dpName", "dpId", "clientId", "nomineeName"],
  additionalProperties: false,
  errorMessage: {
    required: {
      dpName: "DP Name is required",
      dpId: "DP ID is required",
      clientId: "Client ID is required",
      nomineeName: "Nominee Name is required",
    },
    additionalProperties: "Unknown field(s) provided",
  },
};

// ==================== QUERY PARAM SCHEMAS ====================
const verifyEmailQuerySchema = {
  type: "object",
  properties: {
    token: {
      type: "string",
      minLength: 1,
      errorMessage: {
        minLength: "Token is required",
        type: "Token must be a string",
      },
    },
  },
  required: ["token"],
  additionalProperties: true, // Allow other query params
  errorMessage: {
    required: {
      token: "Verification token is required",
    },
  },
};

// ==================== ADD STOCK SCHEMA (ADMIN) ====================
const addStockSchema = {
  type: "object",
  properties: {
    name: {
      type: "string",
      minLength: 1,
      maxLength: 100,
      trim: true,
      errorMessage: {
        minLength: "Stock name is required",
        maxLength: "Stock name cannot exceed 100 characters",
      },
    },
    logo: {
      type: "string",
      minLength: 1,
      errorMessage: {
        minLength: "Logo URL is required",
      },
    },
    sector: {
      type: "string",
      minLength: 1,
      maxLength: 50,
      errorMessage: {
        minLength: "Sector is required",
        maxLength: "Sector cannot exceed 50 characters",
      },
    },
    currentPrice: {
      type: "number",
      exclusiveMinimum: 0,
      errorMessage: {
        type: "Current price must be a number",
        exclusiveMinimum: "Current price must be greater than 0",
      },
    },
    availableQuantity: {
      type: "integer",
      minimum: 0,
      errorMessage: {
        type: "Available quantity must be an integer",
        minimum: "Available quantity cannot be negative",
      },
    },
    aboutCompany: {
      type: "string",
      maxLength: 1000,
      errorMessage: {
        maxLength: "About company cannot exceed 1000 characters",
      },
    },
    foundedYear: { type: "string" },
    headquarters: { type: "string" },
    founder: { type: "string" },
    employees: { type: "string" },
    websiteUrl: { type: "string" },
    estimatedValuation: { type: "string" },
    minimumInvestmentShares: { type: "number" },
    ipoStatusText: { type: "string" },
    ipoTimeline: { type: "string" },
    tag: { type: "string" },
    businessSegments: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          icon: { type: "string" }
        },
        required: ["name"]
      }
    }
  },
  required: ["name", "sector", "currentPrice", "availableQuantity"],
  additionalProperties: false,
  errorMessage: {
    required: {
      name: "Stock name is required",
      sector: "Sector is required",
      currentPrice: "Current price is required",
      availableQuantity: "Available quantity is required",
    },
    additionalProperties: "Unknown field(s) provided",
  },
};

// ==================== UPDATE STOCK SCHEMA ====================
// Same field constraints as addStockSchema but NO required fields (partial update).
const updateStockSchema = {
  type: "object",
  properties: {
    name: {
      type: "string",
      minLength: 1,
      maxLength: 100,
      errorMessage: {
        minLength: "Stock name cannot be empty",
        maxLength: "Stock name cannot exceed 100 characters",
      },
    },
    logo: { type: "string", minLength: 1 },
    sector: {
      type: "string",
      minLength: 1,
      maxLength: 50,
      errorMessage: {
        minLength: "Sector cannot be empty",
        maxLength: "Sector cannot exceed 50 characters",
      },
    },
    currentPrice: {
      type: "number",
      exclusiveMinimum: 0,
      errorMessage: {
        type: "Current price must be a number",
        exclusiveMinimum: "Current price must be greater than 0",
      },
    },
    availableQuantity: {
      type: "integer",
      minimum: 0,
      errorMessage: {
        type: "Available quantity must be an integer",
        minimum: "Available quantity cannot be negative",
      },
    },
    aboutCompany: {
      type: "string",
      maxLength: 1000,
      errorMessage: { maxLength: "About company cannot exceed 1000 characters" },
    },
    foundedYear: { type: "string" },
    headquarters: { type: "string" },
    founder: { type: "string" },
    employees: { type: "string" },
    websiteUrl: { type: "string" },
    estimatedValuation: { type: "string" },
    minimumInvestmentShares: { type: "number", minimum: 1 },
    ipoStatusText: { type: "string" },
    ipoTimeline: { type: "string" },
    tag: { type: "string" },
    isActive: {
      type: "boolean",
      errorMessage: { type: "isActive must be a boolean (true/false)" },
    },
    businessSegments: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          icon: { type: "string" }
        },
        required: ["name"]
      }
    }
  },
  minProperties: 1,
  additionalProperties: false,
  errorMessage: {
    minProperties: "At least one field is required to update",
    additionalProperties: "Unknown field(s) provided",
  },
};

// ==================== UPDATE BANK SCHEMA ====================
const updateBankSchema = {
  type: "object",
  properties: {
    accountNumber: {
      type: "string",
      pattern: "^[0-9]{9,18}$",
      errorMessage: {
        pattern: "Bank account number must be between 9 and 18 digits",
      },
    },
    ifscCode: {
      type: "string",
      pattern: "^[A-Za-z]{4}0[A-Za-z0-9]{6}$",
      errorMessage: {
        pattern: "IFSC code must be a valid 11-character Indian financial code (e.g., SBIN0001234)",
      },
    },
    accountHolderName: {
      type: "string",
      minLength: 3,
      maxLength: 100,
      errorMessage: {
        minLength: "Account holder name must be at least 3 characters long",
        maxLength: "Account holder name must be less than 100 characters",
      },
    },
    bankName: {
      type: "string",
      minLength: 2,
      maxLength: 100,
      errorMessage: {
        minLength: "Bank name must be at least 2 characters long",
        maxLength: "Bank name must be less than 100 characters",
      },
    },
  },
  required: ["accountNumber", "ifscCode"],
  additionalProperties: false,
  errorMessage: {
    required: {
      accountNumber: "Bank account number is required",
      ifscCode: "Bank IFSC code is required",
    },
    additionalProperties: "Unknown field(s) provided",
  },
};

// ==================== CREATE ORDER SCHEMA ====================
const createOrderSchema = {
  type: "object",
  properties: {
    stockId: {
      type: "string",
      pattern: "^[0-9a-fA-F]{24}$",
      errorMessage: {
        pattern: "Invalid Stock ID format",
      },
    },
    quantity: {
      type: "integer",
      minimum: 1,
      errorMessage: {
        type: "Quantity must be an integer",
        minimum: "Quantity must be at least 1",
      },
    },
  },
  required: ["stockId", "quantity"],
  additionalProperties: false,
  errorMessage: {
    required: {
      stockId: "Stock ID is required",
      quantity: "Quantity is required",
    },
    additionalProperties: "Unknown field(s) provided",
  },
};

// ==================== COMPILE ALL VALIDATORS ====================
export const validateSignup = ajv.compile(signupSchema);
export const validateLogin = ajv.compile(loginSchema);
export const validateLoginOtp = ajv.compile(loginOtpSchema);
export const validateSendOtp = ajv.compile(sendOtpSchema);
export const validateUpdateAccountInfo = ajv.compile(updateAccountInfoSchema);
export const validateUpdateEmail = ajv.compile(updateEmailSchema);
export const validateUpdatePhone = ajv.compile(updatePhoneSchema);
export const validateForgetPin = ajv.compile(forgetPinSchema);
export const validateResetPassword = ajv.compile(resetPasswordSchema);
export const validateEnquiry = ajv.compile(enquirySchema);
export const validateVerifyEmailQuery = ajv.compile(verifyEmailQuerySchema);
export const validateUpdateProfile = ajv.compile(updateProfileSchema);
export const validateUpdateKyc = ajv.compile(updateKycSchema);
export const validateResetPin = ajv.compile(resetPinSchema);
export const validateUpdateDemat = ajv.compile(updateDematSchema);
export const validateAddStock = ajv.compile(addStockSchema);
export const validateUpdateBank = ajv.compile(updateBankSchema);
export const validateCreateOrder = ajv.compile(createOrderSchema);
export const validateUpdateStock = ajv.compile(updateStockSchema);
export const validateVerifyPhoneOtp = ajv.compile(loginOtpSchema); // Requires phone + otp
export const validateSendVerificationOtp = ajv.compile(forgetPinSchema); // Requires just phone (exactly 10 digits)


