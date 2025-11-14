import { useState } from 'react';
import type { DynamicItem } from '@/components/sections/DynamicItemList';

export interface FormData {
  propertyName: string;
  hostName: string;
  hostBio: string;
  hostContact: string;
  address: string;
  address_street: string;
  address_city_state: string;
  address_zip: string;
  access_info: string;
  welcomeMessage: string;
  location: string;
  parkingInfo: string;
  wifiNetwork: string;
  wifiPassword: string;
  wifiNotes: string;
  checkInTime: string;
  checkOutTime: string;
  emergencyContact: string;
  fireExtinguisherLocation: string;
}

export interface RuleItem {
  name: string;
  description: string;
  checked: boolean;
}

export interface CheckoutItem {
  name: string;
  description: string;
  checked: boolean;
}

export interface HouseManualItem {
  name: string;
  description: string;
  mediaUrl?: string;
  mediaType?: "image" | "video";
}

const DEFAULT_FORM_DATA: FormData = {
  propertyName: '',
  hostName: '',
  hostBio: '',
  hostContact: '',
  address: '',
  address_street: '',
  address_city_state: '',
  address_zip: '',
  access_info: '',
  welcomeMessage: '',
  location: '',
  parkingInfo: '',
  wifiNetwork: '',
  wifiPassword: '',
  wifiNotes: 'WiFi works best in the living room and kitchen. Please let us know if you have any issues.',
  checkInTime: '15:00',
  checkOutTime: '11:00',
  emergencyContact: '',
  fireExtinguisherLocation: '',
};

const DEFAULT_HOUSE_MANUAL_ITEMS: HouseManualItem[] = [
  {
    name: "Trash Location",
    description: "Outdoor bins are on the left side of the house behind the wooden gate. Trash day is Tuesday evening."
  },
  {
    name: "Back Gate Code",
    description: "Use keypad on the back gate. Code: 1234 (press ✓ to unlock)."
  },
];

const DEFAULT_CHECKOUT_ITEMS: CheckoutItem[] = [
  {
    name: 'Take out trash',
    description: 'Please bag all trash and place it in the outside bin.',
    checked: true
  },
  {
    name: 'Dishes',
    description: 'Load and run the dishwasher (or hand wash any used dishes).',
    checked: true
  },
  {
    name: 'Lights & doors',
    description: 'Turn off lights, set thermostat to eco, and lock all doors/windows.',
    checked: true
  },
];

const DEFAULT_RULES: RuleItem[] = [
  {
    name: 'No Smoking',
    description: 'Smoking is not allowed inside the house or on the balcony.',
    checked: true
  },
  {
    name: 'No Parties or Events',
    description: 'Parties and events are not allowed on the property.',
    checked: true
  },
  {
    name: 'No Pets',
    description: 'Pets are not allowed unless approved in advance.',
    checked: true
  },
  {
    name: 'Quiet Hours',
    description: 'Please keep noise to a minimum after 10pm to respect our neighbors.',
    checked: true
  },
  {
    name: 'No Unregistered Guests',
    description: 'Only guests included in the reservation are allowed to stay.',
    checked: true
  },
  {
    name: 'Remove Shoes Indoors',
    description: 'Please remove your shoes when entering the house.',
    checked: true
  }
];

export interface UseGuidebookFormOptions {
  initialFormData?: Partial<FormData>;
  initialFoodItems?: DynamicItem[];
  initialActivityItems?: DynamicItem[];
  initialHouseManualItems?: HouseManualItem[];
  initialCheckoutItems?: CheckoutItem[];
  initialRules?: RuleItem[];
  initialIncluded?: string[];
  initialExcluded?: string[];
  initialCustomSections?: Record<string, string[]>;
  initialCustomTabsMeta?: Record<string, { icon: string; label: string }>;
  initialPreviewUrl?: string | null;
  initialHostPhotoPreviewUrl?: string | null;
  useDefaults?: boolean; // Whether to use default values for items/rules
}

export function useGuidebookForm(options: UseGuidebookFormOptions = {}) {
  const {
    initialFormData = {},
    initialFoodItems = [],
    initialActivityItems = [],
    initialHouseManualItems,
    initialCheckoutItems,
    initialRules,
    initialIncluded = [],
    initialExcluded = [],
    initialCustomSections = {},
    initialCustomTabsMeta = {},
    initialPreviewUrl = null,
    initialHostPhotoPreviewUrl = null,
    useDefaults = true,
  } = options;

  // Form data state
  const [formData, setFormData] = useState<FormData>({
    ...DEFAULT_FORM_DATA,
    ...initialFormData,
  });

  // Image states
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialPreviewUrl);
  const [hostPhoto, setHostPhoto] = useState<File | null>(null);
  const [hostPhotoPreviewUrl, setHostPhotoPreviewUrl] = useState<string | null>(initialHostPhotoPreviewUrl);

  // Items states
  const [foodItems, setFoodItems] = useState<DynamicItem[]>(initialFoodItems);
  const [activityItems, setActivityItems] = useState<DynamicItem[]>(initialActivityItems);
  const [houseManualItems, setHouseManualItems] = useState<HouseManualItem[]>(
    initialHouseManualItems ?? (useDefaults ? DEFAULT_HOUSE_MANUAL_ITEMS : [])
  );
  const [checkoutItems, setCheckoutItems] = useState<CheckoutItem[]>(
    initialCheckoutItems ?? (useDefaults ? DEFAULT_CHECKOUT_ITEMS : [])
  );
  const [rules, setRules] = useState<RuleItem[]>(
    initialRules ?? (useDefaults ? DEFAULT_RULES : [])
  );

  // Section organization states
  const [included, setIncluded] = useState<string[]>(initialIncluded);
  const [excluded, setExcluded] = useState<string[]>(initialExcluded);
  const [customSections, setCustomSections] = useState<Record<string, string[]>>(initialCustomSections);
  const [customTabsMeta, setCustomTabsMeta] = useState<Record<string, { icon: string; label: string }>>(initialCustomTabsMeta);

  // Modal states for place pickers
  const [foodPickerOpen, setFoodPickerOpen] = useState(false);
  const [activityPickerOpen, setActivityPickerOpen] = useState(false);
  const [foodAddChoiceOpen, setFoodAddChoiceOpen] = useState(false);
  const [activityAddChoiceOpen, setActivityAddChoiceOpen] = useState(false);

  // Auto-edit state for rules (create flow only, but included for consistency)
  const [ruleAutoEditIndex, setRuleAutoEditIndex] = useState<number | null>(null);

  // Image upload handlers
  const handleCoverImageSelect = (file: File | null) => {
    setCoverImage(file);
    setPreviewUrl(file ? URL.createObjectURL(file) : previewUrl);
  };

  const handleHostPhotoSelect = (file: File | null) => {
    setHostPhoto(file);
    setHostPhotoPreviewUrl(file ? URL.createObjectURL(file) : hostPhotoPreviewUrl);
  };

  return {
    // Form data
    formData,
    setFormData,

    // Images
    coverImage,
    setCoverImage,
    previewUrl,
    setPreviewUrl,
    hostPhoto,
    setHostPhoto,
    hostPhotoPreviewUrl,
    setHostPhotoPreviewUrl,

    // Items
    foodItems,
    setFoodItems,
    activityItems,
    setActivityItems,
    houseManualItems,
    setHouseManualItems,
    checkoutItems,
    setCheckoutItems,
    rules,
    setRules,

    // Section organization
    included,
    setIncluded,
    excluded,
    setExcluded,
    customSections,
    setCustomSections,
    customTabsMeta,
    setCustomTabsMeta,

    // Modals
    foodPickerOpen,
    setFoodPickerOpen,
    activityPickerOpen,
    setActivityPickerOpen,
    foodAddChoiceOpen,
    setFoodAddChoiceOpen,
    activityAddChoiceOpen,
    setActivityAddChoiceOpen,

    // Auto-edit
    ruleAutoEditIndex,
    setRuleAutoEditIndex,

    // Handlers
    handleCoverImageSelect,
    handleHostPhotoSelect,
  };
}
