/**
 * Centralized section configuration
 * Single source of truth for all section metadata
 */

export interface SectionConfig {
  key: string;
  label: string;
  icon: string;
  order: number;
}

/**
 * All available sections with their metadata
 */
export const SECTIONS_CONFIG: Record<string, SectionConfig> = {
  welcome: {
    key: 'welcome',
    label: 'Welcome',
    icon: '👋',
    order: 1,
  },
  checkin: {
    key: 'checkin',
    label: 'Check-in',
    icon: '🔑',
    order: 2,
  },
  property: {
    key: 'property',
    label: 'Property',
    icon: '🏠',
    order: 3,
  },
  hostinfo: {
    key: 'hostinfo',
    label: 'Host Info',
    icon: '👤',
    order: 4,
  },
  wifi: {
    key: 'wifi',
    label: 'Wi-Fi',
    icon: '📶',
    order: 5,
  },
  food: {
    key: 'food',
    label: 'Food',
    icon: '🍴',
    order: 6,
  },
  activities: {
    key: 'activities',
    label: 'Activities',
    icon: '🎯',
    order: 7,
  },
  rules: {
    key: 'rules',
    label: 'Rules',
    icon: '📋',
    order: 8,
  },
  checkout: {
    key: 'checkout',
    label: 'Checkout',
    icon: '🚪',
    order: 9,
  },
  arrival: {
    key: 'arrival',
    label: 'Arrival',
    icon: '🚗',
    order: 10,
  },
} as const;

/**
 * Section order for create flow (7 sections)
 * More compact - hostinfo and wifi are embedded in other sections
 */
export const CREATE_SECTIONS_ORDER = [
  'welcome',
  'checkin',
  'property',
  'food',
  'activities',
  'rules',
  'checkout',
] as const;

/**
 * Section order for edit flow (7 sections)
 * Host info is embedded in welcome section, Wi-Fi is embedded in checkin section
 */
export const EDIT_SECTIONS_ORDER = [
  'welcome',
  'checkin',
  'property',
  'food',
  'activities',
  'rules',
  'checkout',
] as const;

/**
 * Get section metadata by key
 */
export function getSectionConfig(key: string): SectionConfig | undefined {
  return SECTIONS_CONFIG[key];
}

/**
 * Get ordered sections for a specific flow
 */
export function getSectionsForFlow(flow: 'create' | 'edit'): readonly string[] {
  return flow === 'create' ? CREATE_SECTIONS_ORDER : EDIT_SECTIONS_ORDER;
}
