import mongoose, { Schema } from "mongoose";

const stockSchema = new Schema(
  {
    name: { 
      type: String, 
      required: true, 
      trim: true 
    },
    logo: { 
      type: String, 
      
    },
    sector: { 
      type: String, 
      required: true // e.g., "IT", "Banking"
    },
    currentPrice: { 
      type: Number, 
      required: true, // Stored in Paise to avoid float issues
      min: [0, "Current price cannot be negative"],
      validate: {
        validator: Number.isInteger,
        message: "Current price must be an integer (paise)"
      }
    },
    previousPrice: {
      type: Number, // Stored in Paise. Used for smart backend price change calculation
      default: null
    },
    priceHistory: [
      {
        date: { type: Date, required: true },
        price: { type: Number, required: true } // Stored in Paise
      }
    ],
    availableQuantity: { 
      type: Number, 
      required: true, 
      min: [0, "Quantity cannot be negative"] 
    },
    aboutCompany: {
      type: String, // Short description
    },
    // --- Company Snapshot ---
    foundedYear: { type: String },
    headquarters: { type: String },
    founder: { type: String },
    employees: { type: String },
    websiteUrl: { type: String },
    
    // --- Financial & Investment Metrics ---
    estimatedValuation: { type: String }, // e.g. "95,000 Cr"
    minimumInvestmentShares: { type: Number, default: 50 },
    
    // --- IPO Status ---
    ipoStatusText: { type: String }, // e.g. "Expected to File DRHP"
    ipoTimeline: { type: String }, // e.g. "Q4 2026 (Tentative)"
    
    // --- Key Business Segments ---
    businessSegments: [
      {
        name: { type: String, required: true },
        icon: { type: String } // Can be emoji or short code
      }
    ],

    tag: {
      type: String,
      default: "LIVE" // e.g., LIVE, SOLD OUT, COMING SOON
    },
    isActive: { 
      type: Boolean, 
      default: true 
    }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual for auto-calculating price change
stockSchema.virtual("priceChange").get(function () {
  if (this.previousPrice == null || this.currentPrice == null) return 0;
  return this.currentPrice - this.previousPrice;
});

stockSchema.virtual("priceChangePercentage").get(function () {
  if (this.previousPrice == null || this.previousPrice === 0 || this.currentPrice == null) return 0;
  const change = this.currentPrice - this.previousPrice;
  return parseFloat(((change / this.previousPrice) * 100).toFixed(2));
});

stockSchema.index(
  { name: 1 },
  {
    unique: true,
    collation: { locale: "en", strength: 2 },
  }
);

export const Stock = mongoose.model("Stock", stockSchema);