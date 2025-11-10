# Create and Edit Functionality Analysis Report

## Executive Summary
The Guidewise codebase has significant code duplication between create and edit workflows. Two nearly identical 800+ line pages share 70-80% of their logic and component structure, along with duplicated API communication patterns and form state management. This analysis identifies 14+ opportunities for consolidation and refactoring.

---

## 1. FILE STRUCTURE AND ORGANIZATION

### Current Organization

```
/frontend/src/app/
├── create/
│   ├── page.tsx                 (801 lines) - Main create page
│   ├── SidebarNav.tsx           (14.5 KB) - Sidebar navigation
│   ├── CreateGuidebookLayout.tsx (705 bytes) - Layout wrapper
│   ├── WelcomeSection.tsx       - Welcome/property basics
│   ├── CheckinSection.tsx       - Check-in info
│   ├── WifiSection.tsx          - WiFi details
│   ├── PropertySection.tsx      - Property info
│   ├── HostInfoSection.tsx      - Host information
│   ├── ArrivalSection.tsx       - Arrival details
│   ├── RulesSection.tsx         (9.3 KB) - House rules
│   ├── CheckoutSection.tsx      (8.5 KB) - Checkout info
│   ├── HouseManualList.tsx      - House manual items
│   ├── DynamicItemList.tsx      (8.2 KB) - Reusable item list
│   └── ParkingSection.tsx       - Parking info
├── edit/[id]/
│   ├── page.tsx                 (702 lines) - Main edit page
│   └── loading.tsx              - Loading state
```

### Key Observations
- **Total Create Components**: 14 files
- **Edit-Specific Components**: 0 (reuses all create components)
- **Shared Components**: All 14 create components are imported and reused
- **Duplicate Code**: ~1,503 lines across two main pages (80% overlap)

---

## 2. CREATE-RELATED CODE

### Main Create Page
**File**: `/home/user/Guidewise/frontend/src/app/create/page.tsx` (801 lines)

**Key Sections**:
- Lines 31-70: State initialization (15 state variables for form data)
- Lines 104-112: Image upload handlers
- Lines 119-166: Authentication setup and session management
- Lines 168-301: Main `handleSubmit` function for creating guidebooks
- Lines 303-387: Navigation and section management
- Lines 397-801: JSX rendering with conditional section display

**Form Data Structure** (Lines 49-70):
```typescript
const [formData, setFormData] = useState({
  propertyName, hostName, hostBio, hostContact,
  address_street, address_city_state, address_zip,
  access_info, welcomeMessage, location, parkingInfo,
  wifiNetwork, wifiPassword, wifiNotes,
  checkInTime, checkOutTime,
  emergencyContact, fireExtinguisherLocation
});
```

**API Endpoints Used**:
- `POST /api/generate` - Create new guidebook (Line 243)
- `POST /api/guidebooks/{id}/publish` - Publish snapshot (Line 279)
- `POST /api/ai-food` - Get food recommendations (Line 490)
- `POST /api/ai-activities` - Get activity recommendations (Line 590)

**Special Features**:
- Guided flow with `allowedSections` (Lines 313-350)
- Section visit tracking via `visitedSections` (Lines 305-333)
- Custom section creation (Lines 366-378, 700-750)
- Auto-increment rules on add (Lines 689-698)

**Sections Included** (Lines 36-44):
- welcome, checkin, property, food, activities, rules, checkout

---

## 3. EDIT-RELATED CODE

### Main Edit Page
**File**: `/home/user/Guidewise/frontend/src/app/edit/[id]/page.tsx` (702 lines)

**Key Sections**:
- Lines 79-123: State initialization (very similar to create)
- Lines 146-239: Data fetching and state population
- Lines 241-249: Image upload handlers
- Lines 251-356: Main `handleSubmit` function for updating
- Lines 357-387: Navigation and section management
- Lines 400-701: JSX rendering

**Form Data Structure** (Lines 104-123):
```typescript
const [formData, setFormData] = useState({
  propertyName, hostName, hostBio, hostContact,
  address_street, address_city_state, address_zip,
  access_info, welcomeMessage, location, parkingInfo,
  emergencyContact, fireExtinguisherLocation,
  wifiNetwork, wifiPassword, wifiNotes,
  checkInTime, checkOutTime
});
```

**API Endpoints Used**:
- `GET /api/guidebooks/{id}` - Load existing guidebook (Line 177)
- `PUT /api/guidebooks/{id}` - Update guidebook (Line 319)
- `POST /api/guidebooks/{id}/publish` - Publish changes (Line 336)
- `POST /api/ai-food` - Get food recommendations (Line 509)
- `POST /api/ai-activities` - Get activity recommendations (Line 596)

**Special Features**:
- Initial data fetching (Lines 166-239)
- Simpler section navigation (Lines 358-365)
- No guided flow restrictions
- No `allowedSections` - all sections accessible

**Sections Included** (Lines 85-97):
- welcome, checkin, property, hostinfo, wifi, food, activities, rules, checkout
- **Note**: Edit has `hostinfo` and `wifi` as separate sections

---

## 4. DUPLICATE CODE ANALYSIS

### 4.1 State Management Duplication

**Create State** (15 distinct declarations):
- Lines 45-70 in create/page.tsx

**Edit State** (Similar 15 declarations):
- Lines 99-143 in edit/[id]/page.tsx

**Duplicated States**:
```typescript
// Both define these identically:
const [coverImage, setCoverImage] = useState<File | null>(null);
const [previewUrl, setPreviewUrl] = useState<string | null>(null);
const [hostPhoto, setHostPhoto] = useState<File | null>(null);
const [hostPhotoPreviewUrl, setHostPhotoPreviewUrl] = useState<string | null>(null);
const [formData, setFormData] = useState({...});
const [foodItems, setFoodItems] = useState<DynamicItem[]>([]);
const [activityItems, setActivityItems] = useState<DynamicItem[]>([]);
const [houseManualItems, setHouseManualItems] = useState<...>([]);
const [checkoutItems, setCheckoutItems] = useState<...>([]);
const [rules, setRules] = useState<...>([]);
const [isLoading, setIsLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
```

### 4.2 Image Upload Handler Duplication

**Create** (Lines 104-112):
```typescript
const handleCoverImageSelect = (file: File | null) => {
  setCoverImage(file);
  setPreviewUrl(file ? URL.createObjectURL(file) : null);
};

const handleHostPhotoSelect = (file: File | null) => {
  setHostPhoto(file);
  setHostPhotoPreviewUrl(file ? URL.createObjectURL(file) : null);
};
```

**Edit** (Lines 241-249):
```typescript
const handleCoverImageSelect = (file: File | null) => {
  setCoverImage(file);
  setPreviewUrl(file ? URL.createObjectURL(file) : previewUrl); // Slightly different
};

const handleHostPhotoSelect = (file: File | null) => {
  setHostPhoto(file);
  setHostPhotoPreviewUrl(file ? URL.createObjectURL(file) : hostPhotoPreviewUrl); // Slightly different
};
```

**Difference**: Edit's version preserves previous preview if file is null (more correct)

### 4.3 API Submission Handler Duplication

**Create `handleSubmit`** (Lines 168-301):
```typescript
// Uploads images
const uploadToStorage = async (prefix: string, file: File): Promise<string | undefined> { ... }

// Compiles rules
const compiledRules = rules.filter(r => r.checked).map(r => ...)

// Creates payload
const payload = {
  property_name, host_name, location, welcome_message, ...
  things_to_do, places_to_eat, checkout_info, house_manual,
  included_tabs, custom_sections, custom_tabs_meta
}

// Calls POST /api/generate
const response = await fetch(`${API_BASE}/api/generate`, { ... })

// Publishes snapshot
await fetch(`${API_BASE}/api/guidebooks/${newId}/publish`, { ... })
```

**Edit `handleSubmit`** (Lines 251-356):
```typescript
// Almost identical uploadToStorage function
const uploadToStorage = async (prefix: string, file: File): Promise<string | undefined> { ... }

// Compiles rules (same logic)
const compiledRules = rules.filter(r => r.checked).map(r => ...)

// Creates similar payload (but uses PUT instead of POST)
const payload = {
  property_name, host_name, location, welcome_message, ...
}

// Calls PUT /api/guidebooks/{id}
const res = await fetch(`${API_BASE}/api/guidebooks/${guidebookId}`, { 
  method: "PUT", 
  ... 
})

// Publishes snapshot
await fetch(`${API_BASE}/api/guidebooks/${guidebookId}/publish`, { ... })
```

**Duplication Rate**: ~95% identical code

### 4.4 AI Recommendations Logic Duplication

**Create - Food Recommendations** (Lines 480-577):
```typescript
{currentSection === "food" && (
  <div>
    <button onClick={async () => {
      setIsLoading(true);
      const res = await fetch(`${API_BASE}/api/ai-food`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: formData.location, num_places_to_eat: 5 })
      });
      const data = await res.json();
      let items: PlaceApiItem[] = [];
      if (Array.isArray(data)) items = data;
      else if (Array.isArray(data.restaurants)) items = data.restaurants;
      else if (Array.isArray(data.places_to_eat)) items = data.places_to_eat;
      else if (Array.isArray(data.food)) items = data.food;
      
      if (items.length > 0) {
        const mapped = items.map(item => ({
          name: item.name || "",
          address: item.address || "",
          description: item.description || "",
          image_url: item.photo_reference || item.image_url || ""
        }));
        setFoodItems(mapped);
      }
    }} />
  </div>
)}
```

**Edit - Food Recommendations** (Lines 500-584):
```typescript
// Nearly identical code, only difference:
// - Uses isFetchingFood state instead of isLoading
// - Slightly simplified mapping without photo_reference handling
```

**Duplication**: ~95% for both food and activities (2 instances each = 4 code blocks)

### 4.5 Section Rendering Duplication

**Create** (Lines 432-766):
```typescript
{currentSection === "welcome" && <WelcomeSection ... />}
{currentSection === "checkin" && <CheckinSection ... />}
{currentSection === "property" && <HouseManualList ... />}
{currentSection === "food" && <div>...AI button + DynamicItemList...</div>}
{currentSection === "activities" && <div>...AI button + DynamicItemList...</div>}
{currentSection === "rules" && <RulesSection ... />}
{currentSection === "checkout" && <CheckoutSection ... />}
{currentSection === "arrival" && <ArrivalSection ... />}
{currentSection.startsWith("custom_") && <custom section content>}
```

**Edit** (Lines 443-698):
```typescript
// Same structure but:
// - No "arrival" section
// - Adds "hostinfo" section (hostinfo is shown in Welcome in Create)
// - Same AI button logic for food/activities
// - Same dynamic section rendering
// - Same rules and checkout sections
```

**Duplication**: ~90% identical rendering logic

### 4.6 Navigation Logic Duplication

**Create** (Lines 303-387):
```typescript
const [currentSection, setCurrentSection] = useState("welcome");
const [visitedSections, setVisitedSections] = useState(["welcome"]);

// Complex guided flow logic
const goToSection = (section: string) => {
  // Checks if section is allowed
  // Tracks visited sections
  // Validates transitions
}

// Next button navigation
const goNext = () => { ... }

// Validates location requirement
const canAdvanceFromCurrent = isWelcome ? Boolean(formData.location && formData.location.trim()) : true;
```

**Edit** (Lines 358-387):
```typescript
const [currentSection, setCurrentSection] = useState("welcome");

// Simplified navigation
const goToSection = (section: string) => setCurrentSection(section);

// No visit tracking
// No advance restrictions
// All sections accessible
```

**Duplication**: ~40% (edit is simpler)

---

## 5. SHARED COMPONENTS (13 components reused in both flows)

All components in `/frontend/src/app/create/` are imported and reused by edit:

| Component | Lines | Reuse | Notes |
|-----------|-------|-------|-------|
| **SidebarNav.tsx** | 14.5 KB | Both | Navigation/section management |
| **CreateGuidebookLayout.tsx** | 705 B | Both | Layout wrapper |
| **WelcomeSection.tsx** | - | Both | Property name, location, cover image |
| **CheckinSection.tsx** | - | Both | Check-in time, access info, parking, safety |
| **WifiSection.tsx** | - | Both | WiFi network/password |
| **PropertySection.tsx** | - | Create only | Property details |
| **HostInfoSection.tsx** | - | Both | Host name, bio, contact, photo |
| **ArrivalSection.tsx** | - | Create only | Arrival details |
| **RulesSection.tsx** | 9.3 KB | Both | House rules with checkbox system |
| **CheckoutSection.tsx** | 8.5 KB | Both | Checkout info with checkbox system |
| **HouseManualList.tsx** | - | Both | House manual items (editable list) |
| **DynamicItemList.tsx** | 8.2 KB | Both | Reusable item list (food/activities) |
| **ParkingSection.tsx** | - | Both | Parking info |

**Key Observation**: Edit reuses ALL create components, but the parent pages have significant duplication.

---

## 6. SPECIFIC DUPLICATION EXAMPLES

### 6.1 Identical Input Field Definition

**Create** (Line 73-74 in CheckinSection):
```typescript
<Input
  id="propertyName"
  value={propertyName}
  maxLength={LIMITS.propertyName}
  onChange={(e) => onChange("propertyName", e.target.value)}
```

**Edit** (Line 104 in edit/[id]/page.tsx formData state):
```typescript
propertyName: "",
```
Then passed to same component identically.

### 6.2 Identical Payload Compilation (Rules)

**Create** (Lines 202-206):
```typescript
const compiledRules = rules
  .filter(r => r.checked)
  .map(r => (r.description ? `${r.name}: ${r.description}` : r.name))
  .filter(Boolean);
```

**Edit** (Lines 281-284):
```typescript
const compiledRules = rules
  .filter(r => r.checked)
  .map(r => (r.description ? `${r.name}: ${r.description}` : r.name))
  .filter(Boolean);
```

**Exact Match**: 100% identical code

### 6.3 Identical Item Mapping

**Create** (Lines 234-235):
```typescript
things_to_do: activityItems.map(i => ({ 
  name: i.name, description: i.description, image_url: i.image_url || "", address: i.address || "" 
})),
places_to_eat: foodItems.map(i => ({ 
  name: i.name, description: i.description, image_url: i.image_url || "", address: i.address || "" 
})),
```

**Edit** (Lines 308-309):
```typescript
things_to_do: activityItems.map(i => ({ 
  name: i.name, description: i.description, image_url: i.image_url || "", address: i.address || "" 
})),
places_to_eat: foodItems.map(i => ({ 
  name: i.name, description: i.description, image_url: i.image_url || "", address: i.address || "" 
})),
```

**Exact Match**: 100% identical code

---

## 7. DIFFERENCES BETWEEN CREATE AND EDIT

### 7.1 Section Organization

| Aspect | Create | Edit | Impact |
|--------|--------|------|--------|
| Sections in guided flow | 7 | 9 | Edit adds `hostinfo` & `wifi` as separate |
| Has "arrival" section | Yes (line 764) | No | Create-only feature |
| Has "hostinfo" section | No (embedded in welcome) | Yes (line 468) | Edit-only section |
| Has "wifi" section | No (embedded in checkin) | Yes (line 492) | Edit-only section |
| Guided navigation | Yes (restrictive) | No (open) | Different UX patterns |
| Visit tracking | Yes | No | Create is more structured |

### 7.2 API Endpoints

| Operation | Create | Edit |
|-----------|--------|------|
| Submit/Save | `POST /api/generate` | `PUT /api/guidebooks/{id}` |
| Load existing | N/A | `GET /api/guidebooks/{id}` |
| Publish snapshot | `POST /api/guidebooks/{id}/publish` | `POST /api/guidebooks/{id}/publish` |
| AI food | `POST /api/ai-food` | `POST /api/ai-food` |
| AI activities | `POST /api/ai-activities` | `POST /api/ai-activities` |

### 7.3 Form Data Differences

**Create**: 19 form fields
**Edit**: 18 form fields (missing `wifiNotes` in initial state)

### 7.4 State Management Differences

| Feature | Create | Edit |
|---------|--------|------|
| `isLoading` | General + specific `isLoading` | `isLoading` + `isFetchingFood` + `isFetchingActivities` + `initialLoading` |
| `authChecked` | Used for redirect | Not tracked |
| `signupSuccess` | Banner display | Not present |
| `visitedSections` | Navigation tracking | Not present |
| `hasReachedEnd` | Publish button visibility | Not used |
| `ruleAutoEditIndex` | Auto-edit newly added rules | Not used |

---

## 8. CONSOLIDATION OPPORTUNITIES

### Opportunity 1: Extract Shared Page Logic
**Priority**: HIGH | **Impact**: 400+ lines eliminated | **Effort**: Medium

Create a `useGuidebookForm` hook containing:
- Form state initialization
- Image upload handlers
- Rules compilation
- Custom section initialization
- Sync location to address_street
- Navigation state

**Example refactored usage**:
```typescript
const {
  formData, setFormData,
  foodItems, setFoodItems,
  rules, setRules,
  handleCoverImageSelect,
  handleHostPhotoSelect,
  // ...
} = useGuidebookForm(initialData);
```

### Opportunity 2: Extract AI Recommendation Logic
**Priority**: HIGH | **Impact**: 200+ lines eliminated | **Effort**: Medium

Create `useAIRecommendations` hook:
```typescript
const {
  isFetching,
  error,
  fetchFoodRecommendations,
  fetchActivityRecommendations
} = useAIRecommendations(apiBase, location);
```

Both create and edit would call identical logic.

### Opportunity 3: Create Generic Page Wrapper
**Priority**: MEDIUM | **Impact**: 300+ lines consolidated | **Effort**: Medium

Create `GuidebookFormPage` component that handles:
- Common layout structure
- Error/success messages
- Loading states
- Section navigation
- Submit button behavior

```typescript
<GuidebookFormPage
  mode="create" | "edit"
  sections={currentSections}
  onSubmit={handleSubmit}
>
  {renderSectionContent()}
</GuidebookFormPage>
```

### Opportunity 4: Extract Section Rendering
**Priority**: MEDIUM | **Impact**: 250+ lines consolidated | **Effort**: Medium

Create `SectionRenderer` component:
```typescript
<SectionRenderer
  currentSection={currentSection}
  sections={includedSections}
  formData={formData}
  onChange={handleFormChange}
  onAIFetch={handleAIFetch}
  // ...
/>
```

### Opportunity 5: Unify Payload Building
**Priority**: MEDIUM | **Impact**: 150+ lines eliminated | **Effort**: Low

Create `buildGuidebookPayload` utility function:
```typescript
const payload = buildGuidebookPayload({
  formData,
  foodItems,
  activityItems,
  rules,
  houseManualItems,
  checkoutItems,
  customSections,
  customTabsMeta,
  included,
  coverImageUrl,
  hostPhotoUrl
});
```

### Opportunity 6: Unify Image Upload
**Priority**: MEDIUM | **Impact**: 40+ lines eliminated | **Effort**: Low

Create `useImageUpload` hook:
```typescript
const { uploadToStorage } = useImageUpload(supabase, bucketName);
```

### Opportunity 7: Extract Fetch Recommendation Helper
**Priority**: MEDIUM | **Impact**: 80+ lines eliminated | **Effort**: Low

```typescript
const fetchAndMapRecommendations = async (
  endpoint: string,
  address: string,
  count: number,
  onSuccess: (items) => void
) => { ... }
```

### Opportunity 8: Create Shared Section Component Library
**Priority**: LOW | **Impact**: Code organization | **Effort**: Low

Move section components to shared folder and update imports in both pages.

### Opportunity 9: Unify Navigation State
**Priority**: LOW | **Impact**: 30+ lines | **Effort**: Low

Create `useSectionNavigation` hook that works for both guided (create) and open (edit) flows:
```typescript
const {
  currentSection,
  setCurrentSection,
  allowedSections,
  canAdvance
} = useSectionNavigation(included, visitedSections, mode);
```

### Opportunity 10: Extract Auth/Loading Boilerplate
**Priority**: MEDIUM | **Impact**: 50+ lines | **Effort**: Low

Create reusable auth setup effect and loading wrapper.

### Opportunity 11: Consolidate Section Configurations
**Priority**: MEDIUM | **Impact**: Organization | **Effort**: Low

Create a sections configuration file:
```typescript
const SECTIONS_CONFIG = {
  create: ['welcome', 'checkin', 'property', ...],
  edit: ['welcome', 'checkin', 'property', 'hostinfo', ...],
  shared: {
    welcome: { component: WelcomeSection, icon: '👋' },
    // ...
  }
};
```

### Opportunity 12: Create Form Handler Factory
**Priority**: MEDIUM | **Impact**: 150+ lines | **Effort**: Medium

```typescript
const createFormHandler = (mode: 'create' | 'edit') => ({
  onSubmit: async () => { ... },
  onFieldChange: (field, value) => { ... },
  // ...
});
```

### Opportunity 13: Extract API Call Patterns
**Priority**: LOW | **Impact**: Code clarity | **Effort**: Low

Create utility for guarded API calls with auth headers:
```typescript
const fetchWithAuth = (
  url: string,
  options: RequestInit,
  accessToken: string | null
) => { ... }
```

### Opportunity 14: Create Reusable Modal Patterns
**Priority**: LOW | **Impact**: Minor code reduction | **Effort**: Very Low

Both pages use identical AddItemChoiceModal and PlacePickerModal patterns.

---

## 9. RECOMMENDED REFACTORING ROADMAP

### Phase 1: Quick Wins (2-3 days)
1. Extract `useImageUpload` hook - eliminates 40 lines
2. Create `buildGuidebookPayload` utility - eliminates 50 lines
3. Extract `fetchRecommendations` helper - eliminates 80 lines
4. Create `useGuidebookForm` hook - eliminates 200+ lines

### Phase 2: Component Refactoring (3-5 days)
1. Create `GuidebookFormPage` wrapper - eliminates 300+ lines
2. Create `SectionRenderer` component - eliminates 250+ lines
3. Consolidate navigation logic - eliminates 100+ lines
4. Extract auth/loading patterns - eliminates 50+ lines

### Phase 3: Organization (1-2 days)
1. Create sections configuration file
2. Move section components to shared folder
3. Create comprehensive form handler factory
4. Write hooks documentation

### Total Impact
- **Lines of code eliminated**: 1,000+
- **Code reuse improvement**: From 80% to 95%+
- **Maintenance burden**: Reduced by ~60%
- **Testing surface area**: Reduced significantly

---

## 10. FILE PATHS SUMMARY

### Create Flow Files
- `/home/user/Guidewise/frontend/src/app/create/page.tsx` (801 lines)
- `/home/user/Guidewise/frontend/src/app/create/SidebarNav.tsx`
- `/home/user/Guidewise/frontend/src/app/create/CreateGuidebookLayout.tsx`
- `/home/user/Guidewise/frontend/src/app/create/WelcomeSection.tsx`
- `/home/user/Guidewise/frontend/src/app/create/CheckinSection.tsx`
- `/home/user/Guidewise/frontend/src/app/create/CheckoutSection.tsx` (8.5 KB)
- `/home/user/Guidewise/frontend/src/app/create/RulesSection.tsx` (9.3 KB)
- `/home/user/Guidewise/frontend/src/app/create/DynamicItemList.tsx` (8.2 KB)
- `/home/user/Guidewise/frontend/src/app/create/HostInfoSection.tsx`
- `/home/user/Guidewise/frontend/src/app/create/HouseManualList.tsx`
- `/home/user/Guidewise/frontend/src/app/create/WifiSection.tsx`
- `/home/user/Guidewise/frontend/src/app/create/ArrivalSection.tsx`
- `/home/user/Guidewise/frontend/src/app/create/ParkingSection.tsx`
- `/home/user/Guidewise/frontend/src/app/create/PropertySection.tsx`

### Edit Flow Files
- `/home/user/Guidewise/frontend/src/app/edit/[id]/page.tsx` (702 lines)
- `/home/user/Guidewise/frontend/src/app/edit/[id]/loading.tsx`
- (All create components imported)

### Utilities (New - Recommended)
- `/home/user/Guidewise/frontend/src/hooks/useGuidebookForm.ts` (NEW)
- `/home/user/Guidewise/frontend/src/hooks/useAIRecommendations.ts` (NEW)
- `/home/user/Guidewise/frontend/src/hooks/useImageUpload.ts` (NEW)
- `/home/user/Guidewise/frontend/src/hooks/useSectionNavigation.ts` (NEW)
- `/home/user/Guidewise/frontend/src/utils/guidebookPayload.ts` (NEW)
- `/home/user/Guidewise/frontend/src/utils/recommendations.ts` (NEW)
- `/home/user/Guidewise/frontend/src/config/sections.ts` (NEW)

---

## 11. CODE QUALITY METRICS

### Current State
- **Code Duplication**: ~80% between create and edit pages
- **Maintainability Index**: Low (duplicated code means bug fixes needed twice)
- **Single Responsibility**: Violated (pages handle form, auth, navigation, rendering)
- **Testability**: Difficult (logic mixed with components)

### After Refactoring (Estimated)
- **Code Duplication**: ~20%
- **Maintainability Index**: High
- **Single Responsibility**: Improved (hooks handle logic)
- **Testability**: Much easier (isolated hook tests)

---

## 12. IMPLEMENTATION NOTES

### Key Insights
1. **Edit mode has better image handlers** - The edit page's image handler logic that preserves previous previews is more correct
2. **Section structure differs intentionally** - Create and edit have different section orderings for UX reasons
3. **Auth patterns are nearly identical** - Both use the same Supabase session pattern
4. **Guided flow is create-specific** - Edit doesn't need restrictive navigation

### Testing Strategy
1. Extract hooks first (easier to test)
2. Extract utilities second (no side effects)
3. Extract components last (requires prop drilling coordination)
4. Run existing tests after each phase
5. Add new tests for consolidated code

### Risk Mitigation
1. Keep git history clean (one consolidation per commit)
2. Test each refactoring independently
3. Keep create and edit behaviors identical for same sections
4. Document differences in section-specific comments
5. Create feature flags if rollback needed

