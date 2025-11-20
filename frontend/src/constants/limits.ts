export const LIMITS = {
  propertyName: 80,
  hostName: 80,
  hostBio: 600,
  hostContact: 200,
  welcomeMessage: 300, // per user adjustment
  accessInfo: 500,
  parkingInfo: 300,
  location: 120,
  addressStreet: 120,
  addressCityState: 120,
  addressZip: 20,
  wifiNetwork: 64,
  wifiPassword: 64,
  // Food/Activities items
  itemName: 80,
  itemAddress: 120,
  itemDescription: 300,
  // Rules
  ruleName: 80,
  ruleDescription: 300,
  // Checkout
  checkoutName: 80,
  checkoutDescription: 300,
  // Custom section textarea
  customText: 800,
  // Rule limits
  maxRules: 15,
  // List size limits
  maxFoodActivityItems: 8,
  maxCheckoutItems: 8,
  maxCustomTextBoxes: 5,
  // Custom tabs limit
  maxCustomTabs: 3,
  maxCustomSectionItems: 8,
  // Custom tab fields
  customTabTitle: 12,
  customTabEmojiChars: 10, // Increased to handle emojis (which can be 2+ UTF-16 code units)
} as const;
