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
        type: "Name must be a string",
      },
    },
    phone: {
      type: "string",
      pattern: "^[0-9]{10,15}$",
      errorMessage: {
        pattern: "Phone number must be between 10-15 digits",
        type: "Phone must be a string",
      },
    },
    email: {
      type: "string",
      format: "email",
      errorMessage: {
        format: "Email must be a valid email address",
      },
    },
    password: {
      type: "string",
      minLength: 6,
      errorMessage: {
        minLength: "Password must be at least 6 characters",
        type: "Password must be a string",
      },
    },
  },
  anyOf: [{ required: ["phone"] }, { required: ["email"] }],
  required: ["name", "password"],
  additionalProperties: false,
  errorMessage: {
    required: {
      name: "Name is required",
      password: "Password is required",
    },
    anyOf: "Either email or phone is required",
    additionalProperties: "Unknown field(s) provided",
  },
};

// ==================== LOGIN SCHEMA ====================
const loginSchema = {
  type: "object",
  properties: {
    phone: {
      type: "string",
      pattern: "^[0-9]{10,15}$",
      errorMessage: {
        pattern: "Phone number must be between 10-15 digits",
      },
    },
    email: {
      type: "string",
      format: "email",
      errorMessage: {
        format: "Email must be a valid email address",
      },
    },
    password: {
      type: "string",
      minLength: 1,
      errorMessage: {
        minLength: "Password is required",
      },
    },
  },
  anyOf: [{ required: ["phone"] }, { required: ["email"] }],
  required: ["password"],
  additionalProperties: false,
  errorMessage: {
    required: {
      password: "Password is required",
    },
    anyOf: "Either email or phone is required",
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

// ==================== FORGET PASSWORD SCHEMA ====================
const forgetPasswordSchema = {
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
      enum: ["below_1l", "1_5l", "5_10l", "10l+"],
      errorMessage: {
        enum: "Income range must be one of: below_1l, 1_5l, 5_10l, 10l+",
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
  },
  minProperties: 1,
  additionalProperties: false,
  errorMessage: {
    minProperties: "At least one field is required to update",
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

// ==================== COMPILE ALL VALIDATORS ====================
export const validateSignup = ajv.compile(signupSchema);
export const validateLogin = ajv.compile(loginSchema);
export const validateUpdateAccountInfo = ajv.compile(updateAccountInfoSchema);
export const validateUpdateEmail = ajv.compile(updateEmailSchema);
export const validateUpdatePhone = ajv.compile(updatePhoneSchema);
export const validateForgetPassword = ajv.compile(forgetPasswordSchema);
export const validateResetPassword = ajv.compile(resetPasswordSchema);
export const validateEnquiry = ajv.compile(enquirySchema);
export const validateVerifyEmailQuery = ajv.compile(verifyEmailQuerySchema);
export const validateUpdateProfile = ajv.compile(updateProfileSchema);
export const validateUpdateKyc = ajv.compile(updateKycSchema);
