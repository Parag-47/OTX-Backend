import * as fuzzball from "fuzzball";

/**
 * Normalizes Indian personal names for regulatory cross-matching (PMLA / SEBI standards).
 * - Trims and lowercases.
 * - Strips punctuation, periods, special symbols.
 * - Removes common honorifics, titles, and salutations that frequently differ across documents.
 * - Collapses redundant whitespace.
 * 
 * @param {string} name - Raw name from government or bank record
 * @returns {string} - Cleaned normalized string
 */
export function normalizeName(name) {
  if (!name || typeof name !== "string") return "";

  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(mr|mrs|ms|miss|dr|shri|shree|smt|kumar|kumari|md|mohd)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Checks if the system is executing in an explicit sandbox test mode.
 * The mock-name bypass is enabled ONLY when:
 * 1. CASHFREE_ENV is explicitly set to "sandbox" (no fallback default)
 * 2. AND NODE_ENV is NOT "production"
 *
 * In all other cases (production, staging, or unset env), returns false.
 * @returns {boolean}
 */
export function isExplicitSandbox() {
  const cashfreeEnv = (process.env.CASHFREE_ENV || "").toLowerCase().trim();
  const nodeEnv = (process.env.NODE_ENV || "").toLowerCase().trim();
  return cashfreeEnv === "sandbox" && nodeEnv !== "production";
}

/**
 * Checks if the system is executing in production mode.
 * @returns {boolean}
 */
export function isProductionMode() {
  const nodeEnv = (process.env.NODE_ENV || "").toLowerCase().trim();
  const cashfreeEnv = (process.env.CASHFREE_ENV || "").toLowerCase().trim();
  return nodeEnv === "production" || cashfreeEnv === "production";
}

/**
 * Verifies whether a pair of names is an allowable Cashfree sandbox mock pair.
 * The mock-name bypass is enabled ONLY when CASHFREE_ENV is explicitly set to "sandbox"
 * and the runtime is not production. In all other cases, this ALWAYS returns false.
 * 
 * @param {string} name1
 * @param {string} name2
 * @returns {boolean}
 */
export function isSandboxMockPair(name1, name2) {
  if (!isExplicitSandbox()) {
    return false; // STRICT ENFORCEMENT: Enabled ONLY when CASHFREE_ENV is explicitly "sandbox" and runtime is not production
  }

  const n1 = (name1 || "").toUpperCase().trim();
  const n2 = (name2 || "").toUpperCase().trim();

  const MOCK_NAMES = ["JOHN DOE", "MALLESH FAKKIRAPPA DOLLIN"];

  return (
    (MOCK_NAMES.includes(n1) && MOCK_NAMES.includes(n2)) ||
    (n1 === "JOHN DOE" && n2 === "JOHN DOE")
  );
}

/**
 * Calculates a composite fuzzy similarity score between two names.
 * Utilizes multiple algorithmic strategies (Token Sort, Token Set, Levenshtein)
 * to accommodate Indian naming conventions (surname-first vs given-name-first,
 * middle name inclusion/exclusion, and initials).
 * 
 * @param {string} name1 - Primary verified name (e.g. NSDL PAN name)
 * @param {string} name2 - Target name (e.g. UIDAI Aadhaar name or NPCI Bank name)
 * @returns {number} - Match score between 0 and 100
 */
export function calculateNameSimilarity(name1, name2) {
  const norm1 = normalizeName(name1);
  const norm2 = normalizeName(name2);

  if (!norm1 || !norm2) return 0;
  if (norm1 === norm2) return 100;

  // 1. Token Sort Ratio: handles word reordering (e.g. "SHARMA RAHUL" vs "RAHUL SHARMA")
  const sortScore = fuzzball.token_sort_ratio(norm1, norm2);

  // 2. Token Set Ratio: handles subsets / initials / extra middle names
  const setScore = fuzzball.token_set_ratio(norm1, norm2);

  // 3. Standard Levenshtein Ratio: handles minor transliteration spelling variations
  const ratioScore = fuzzball.ratio(norm1, norm2);

  // Composite score takes the best aligned representation
  return Math.max(sortScore, setScore, ratioScore);
}

/**
 * Validates whether two names match within the acceptable FinTech regulatory threshold (>= 70%).
 * 
 * @param {string} primaryName - Verified PAN Name
 * @param {string} targetName - Aadhaar Name or Bank Account Holder Name
 * @param {number} [threshold=70] - Minimum acceptable matching percentage
 * @returns {{ matched: boolean, score: number, isMock: boolean }}
 */
export function verifyNameMatch(primaryName, targetName, threshold = 70) {
  if (isSandboxMockPair(primaryName, targetName)) {
    return { matched: true, score: 100, isMock: true };
  }

  const score = calculateNameSimilarity(primaryName, targetName);
  return {
    matched: score >= threshold,
    score,
    isMock: false,
  };
}
