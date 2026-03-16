/**
 * Country and Indian state lists for location pickers and geo-compliance.
 * Subset of countries relevant to the fantasy sports user base.
 */

export const COUNTRIES = [
  { code: "IN", name: "India" },
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "AU", name: "Australia" },
  { code: "CA", name: "Canada" },
  { code: "NZ", name: "New Zealand" },
  { code: "ZA", name: "South Africa" },
  { code: "BD", name: "Bangladesh" },
  { code: "LK", name: "Sri Lanka" },
  { code: "NP", name: "Nepal" },
  { code: "SG", name: "Singapore" },
  { code: "MY", name: "Malaysia" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "QA", name: "Qatar" },
  { code: "KW", name: "Kuwait" },
  { code: "BH", name: "Bahrain" },
  { code: "OM", name: "Oman" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "PK", name: "Pakistan" },
  { code: "WI", name: "West Indies" },
  { code: "IE", name: "Ireland" },
  { code: "KE", name: "Kenya" },
  { code: "ZW", name: "Zimbabwe" },
  { code: "AF", name: "Afghanistan" },
] as const;

export const INDIA_STATES = [
  { code: "AN", name: "Andaman and Nicobar Islands" },
  { code: "AP", name: "Andhra Pradesh" },
  { code: "AR", name: "Arunachal Pradesh" },
  { code: "AS", name: "Assam" },
  { code: "BR", name: "Bihar" },
  { code: "CH", name: "Chandigarh" },
  { code: "CT", name: "Chhattisgarh" },
  { code: "DD", name: "Daman and Diu" },
  { code: "DL", name: "Delhi" },
  { code: "GA", name: "Goa" },
  { code: "GJ", name: "Gujarat" },
  { code: "HP", name: "Himachal Pradesh" },
  { code: "HR", name: "Haryana" },
  { code: "JH", name: "Jharkhand" },
  { code: "JK", name: "Jammu and Kashmir" },
  { code: "KA", name: "Karnataka" },
  { code: "KL", name: "Kerala" },
  { code: "LA", name: "Ladakh" },
  { code: "MH", name: "Maharashtra" },
  { code: "ML", name: "Meghalaya" },
  { code: "MN", name: "Manipur" },
  { code: "MP", name: "Madhya Pradesh" },
  { code: "MZ", name: "Mizoram" },
  { code: "NL", name: "Nagaland" },
  { code: "OD", name: "Odisha" },
  { code: "PB", name: "Punjab" },
  { code: "PY", name: "Puducherry" },
  { code: "RJ", name: "Rajasthan" },
  { code: "SK", name: "Sikkim" },
  { code: "TG", name: "Telangana" },
  { code: "TN", name: "Tamil Nadu" },
  { code: "TR", name: "Tripura" },
  { code: "UK", name: "Uttarakhand" },
  { code: "UP", name: "Uttar Pradesh" },
  { code: "WB", name: "West Bengal" },
] as const;

/** States where fantasy sports with real money is banned. */
export const INDIA_BANNED_STATES = ["AP", "TG", "AS", "OD"] as const;

/** States requiring a special license for real-money fantasy. */
export const INDIA_LICENSE_REQUIRED_STATES = ["SK", "NL"] as const;

/** States with ongoing legal challenges to fantasy sports. */
export const INDIA_CONTESTED_STATES = ["TN", "KA"] as const;

/** Countries where real-money fantasy is fully blocked. */
export const INTERNATIONAL_BANNED_COUNTRIES = ["PK", "AE", "QA", "KW", "BH", "OM", "SA"] as const;
