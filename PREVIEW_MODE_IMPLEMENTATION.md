# Simplified Preview Mode + Tiered Pricing Implementation Plan

## 🎯 Final Pricing Structure

```
Preview Mode (All inactive guidebooks)
├─ Visible with WATERMARK overlay
├─ Accessible via direct link
├─ No expiration
└─ No payment required

Starter – $9.99/month
├─ 1 active guidebook (no watermark)
├─ Public URL + PDF
└─ AI recommendations

Growth – $19.99/month
├─ 3 active guidebooks
├─ Everything in Starter
└─ Priority support

Pro – $29.99/month
├─ 10 active guidebooks
├─ Everything in Growth
└─ Custom branding (future)

Enterprise – Custom Quote
├─ Unlimited guidebooks
├─ White-label options
├─ API access
└─ Dedicated support
```

---

## 🎨 Preview Mode Architecture

### Key Insight
**No trial period needed!** Every inactive guidebook is automatically in preview mode with a watermark. Users can:
- Create unlimited guidebooks
- Share preview links with watermark
- Upgrade to activate (remove watermark) up to plan limit

### Current vs New System

#### CURRENT (Complex)
```python
# Multiple states and tokens
claim_token = secrets.token_hex(32)  # Random token for preview
expires_at = now + 30 days           # Expiration logic
claimed_at = timestamp               # When user claimed
active = True/False                  # Separate from claim state

# Access patterns
/preview/<id>?token=abc123           # Preview with token
/g/<slug>                            # Active only
/guidebook/<id>                      # Legacy, redirects
```

#### NEW (Simple)
```python
# Single boolean
active = True/False

# Access patterns
/g/<slug>              # Active guidebooks (no watermark)
/preview/<id>          # Inactive guidebooks (WITH watermark)
# That's it!

# No tokens, no expiration, no claiming
```

---

## 🎨 Watermark Implementation

### Option 1: CSS Overlay (Recommended for Web)

```css
/* Add to guidebook templates when active=false */
.preview-watermark {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(-45deg);
  font-size: 120px;
  font-weight: bold;
  color: rgba(0, 0, 0, 0.05);
  pointer-events: none;
  user-select: none;
  z-index: 9999;
  white-space: nowrap;
}

.preview-banner {
  position: sticky;
  top: 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 12px 20px;
  text-align: center;
  font-weight: 600;
  z-index: 10000;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}
```

```html
<!-- In base_guidebook.html template -->
{% if not ctx.is_active %}
<div class="preview-banner">
  🔒 PREVIEW MODE - This is a preview.
  <a href="{{ upgrade_url }}" style="color: white; text-decoration: underline;">
    Upgrade to activate
  </a>
</div>
<div class="preview-watermark">PREVIEW</div>
{% endif %}
```

### Option 2: PDF Watermark

```python
# In main.py - PDF generation
def create_guidebook_pdf(guidebook, qr_url=None):
    # ... existing code ...

    # Add watermark if not active
    if not guidebook.active:
        html_with_watermark = f"""
        <style>
          @page {{
            @bottom-center {{
              content: "PREVIEW - Activate to remove watermark";
              font-size: 10pt;
              color: #999;
            }}
          }}
          .watermark-overlay {{
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 100pt;
            font-weight: bold;
            color: rgba(0, 0, 0, 0.03);
            z-index: -1;
          }}
        </style>
        <div class="watermark-overlay">PREVIEW</div>
        {rendered_html}
        """
        pdf_bytes = weasyprint.HTML(string=html_with_watermark).write_pdf()
    else:
        pdf_bytes = weasyprint.HTML(string=rendered_html).write_pdf()
```

### Visual Design

```
┌─────────────────────────────────────────────┐
│ 🔒 PREVIEW MODE - Upgrade to activate      │ ← Sticky banner
├─────────────────────────────────────────────┤
│                                             │
│         Welcome to Beach House              │
│                                             │
│              P R E V I E W                  │ ← Diagonal watermark
│         Check-in: 3pm                       │    (subtle, 5% opacity)
│         Check-out: 11am                     │
│                                             │
│         WiFi: BeachHouse                    │
│         Password: ****                      │
│                                             │
└─────────────────────────────────────────────┘
```

---

## 🗑️ Code Cleanup - Remove Trial Logic

### Database Cleanup

```sql
-- REMOVE these lifecycle columns
ALTER TABLE guidebook DROP COLUMN claim_token;
ALTER TABLE guidebook DROP COLUMN claimed_at;
ALTER TABLE guidebook DROP COLUMN expires_at;

-- KEEP
-- active (boolean) - single source of truth
-- public_slug (string) - for active guidebooks only
```

### Backend Cleanup

```python
# DELETE from models.py
class Guidebook(db.Model):
    # Remove these lines:
    claimed_at = db.Column(db.DateTime(timezone=True), nullable=True)
    expires_at = db.Column(db.DateTime(timezone=True), nullable=True)
    claim_token = db.Column(db.String(64), unique=True, nullable=True)

# DELETE from app.py
# Remove token generation logic (lines ~1050-1060)
new_guidebook.claim_token = secrets.token_hex(32)
new_guidebook.expires_at = datetime.now(timezone.utc) + timedelta(days=30)

# DELETE token validation in /preview/<id> route
# No need to check token or expiration anymore!
```

### Updated Routes

```python
# SIMPLIFIED /preview/<id> route
@app.route('/preview/<guidebook_id>')
def preview_guidebook(guidebook_id):
    """Show guidebook in preview mode (with watermark)."""
    gb = Guidebook.query.get_or_404(guidebook_id)

    # No token check needed!
    # Anyone with link can see preview (with watermark)

    ctx = build_guidebook_context(gb)
    ctx['is_active'] = gb.active
    ctx['upgrade_url'] = f"{FRONTEND_ORIGIN}/pricing"

    # Render with watermark if not active
    return render_template(
        get_template_for_guidebook(gb),
        ctx=ctx,
        show_watermark=not gb.active
    )

# ACTIVE GUIDEBOOK route (no changes needed)
@app.route('/g/<public_slug>')
def public_guidebook(public_slug):
    """Show active guidebook (no watermark)."""
    gb = Guidebook.query.filter_by(public_slug=public_slug, active=True).first_or_404()

    ctx = build_guidebook_context(gb)
    ctx['is_active'] = True

    return render_template(
        get_template_for_guidebook(gb),
        ctx=ctx,
        show_watermark=False
    )
```

---

## 🔄 Updated User Flow

### Creating First Guidebook
```
1. User signs up (no payment)
2. Creates guidebook
3. Guidebook saved with active=false
4. Gets preview link: /preview/abc-123
5. Sees watermark: "PREVIEW MODE - Upgrade to activate"
6. Clicks upgrade → Pricing page
7. Chooses Starter plan ($9.99)
8. Payment succeeds
9. Can now toggle guidebook to active
10. Watermark disappears, gets public URL: /g/beach-house
```

### Creating Additional Guidebooks
```
Starter plan (1 active):
- Create 5 guidebooks total
- Toggle 1 to active → Public URL, no watermark
- Other 4 in preview mode → Watermark
- Upgrade to Growth to activate more

Growth plan (3 active):
- Toggle up to 3 active
- Rest stay in preview mode
```

---

## 📋 Database Schema Changes

### Remove
```sql
ALTER TABLE guidebook DROP COLUMN claim_token;
ALTER TABLE guidebook DROP COLUMN claimed_at;
ALTER TABLE guidebook DROP COLUMN expires_at;
```

### Keep
```sql
guidebook.active           BOOLEAN  -- Single source of truth
guidebook.public_slug      VARCHAR  -- Only set when active=true
guidebook.user_id          VARCHAR  -- Owner
guidebook.created_time     TIMESTAMP
guidebook.last_modified    TIMESTAMP
```

### Add for tiers
```sql
-- Already discussed
profiles.guidebook_limit   INTEGER  -- 1, 3, 10, or NULL (unlimited)

-- Remove
profiles.extra_slots       -- DELETE
```

---

## 🎨 Frontend Changes

### Dashboard - Guidebook List

```tsx
// Show all guidebooks with toggle
<div className="guidebooks-grid">
  {guidebooks.map(gb => (
    <div key={gb.id} className="guidebook-card">
      <img src={gb.cover_image_url} alt={gb.property_name} />
      <h3>{gb.property_name}</h3>

      {/* Active/Preview indicator */}
      <div className="status-badge">
        {gb.active ? (
          <span className="badge-active">✓ Active</span>
        ) : (
          <span className="badge-preview">👁️ Preview</span>
        )}
      </div>

      {/* Toggle switch */}
      <Switch
        checked={gb.active}
        onChange={() => toggleGuidebook(gb.id)}
        disabled={!gb.active && !canActivateMore}
      />

      {/* Links */}
      {gb.active ? (
        <a href={`/g/${gb.public_slug}`} target="_blank">
          View Live →
        </a>
      ) : (
        <a href={`/preview/${gb.id}`} target="_blank">
          View Preview (watermarked) →
        </a>
      )}

      <Button variant="outline" onClick={() => editGuidebook(gb.id)}>
        Edit
      </Button>
    </div>
  ))}
</div>

{/* Plan status */}
<div className="plan-indicator">
  {activeCount} / {limit} guidebooks active
  {!canActivateMore && (
    <Link href="/pricing">Upgrade to activate more</Link>
  )}
</div>
```

### Toggle Guidebook Function

```typescript
async function toggleGuidebook(id: string) {
  const gb = guidebooks.find(g => g.id === id);
  const newActiveState = !gb.active;

  // Check if can activate
  if (newActiveState && !canActivateMore) {
    alert(`You've reached your plan limit. Upgrade or deactivate another guidebook.`);
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/guidebooks/${id}/toggle`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      alert(error.error || 'Failed to toggle guidebook');
      return;
    }

    // Refresh guidebooks list
    await fetchGuidebooks();

    // Show success message
    if (newActiveState) {
      toast.success('Guidebook activated! Now live at public URL.');
    } else {
      toast.success('Guidebook moved to preview mode.');
    }
  } catch (error) {
    alert('Failed to toggle guidebook');
  }
}
```

---

## 🔌 New Backend Endpoint

```python
@app.route('/api/guidebooks/<guidebook_id>/toggle', methods=['POST'])
@require_auth
def toggle_guidebook(guidebook_id):
    """Toggle guidebook active state."""
    user_id = g.user_id

    # Get guidebook
    gb = Guidebook.query.filter_by(id=guidebook_id, user_id=user_id).first()
    if not gb:
        return jsonify({"error": "Guidebook not found"}), 404

    # If activating, check limit
    if not gb.active:
        can_activate, message = can_activate_guidebook(user_id)
        if not can_activate:
            return jsonify({"error": message}), 403

        # Generate public slug if doesn't exist
        if not gb.public_slug:
            slug_base = _slugify(gb.property.name if gb.property else 'guidebook')
            unique_slug = slug_base
            for i in range(100):
                exists = Guidebook.query.filter_by(public_slug=unique_slug).first()
                if not exists:
                    break
                unique_slug = f"{slug_base}-{secrets.token_hex(3)}"
            gb.public_slug = unique_slug

        gb.active = True
    else:
        # Deactivating
        gb.active = False

    db.session.commit()

    return jsonify({
        "ok": True,
        "active": gb.active,
        "public_slug": gb.public_slug if gb.active else None,
        "preview_url": f"/preview/{gb.id}" if not gb.active else None
    })
```

---

## 📊 Updated Pricing Config

```python
# app.py - Updated prices
PLAN_CONFIGS = {
    'starter': {
        'name': 'Starter',
        'price_id': os.environ.get('STRIPE_STARTER_PRICE_ID'),
        'guidebook_limit': 1,
        'price': 9.99,
        'price_display': '$9.99/month'
    },
    'growth': {
        'name': 'Growth',
        'price_id': os.environ.get('STRIPE_GROWTH_PRICE_ID'),
        'guidebook_limit': 3,
        'price': 19.99,
        'price_display': '$19.99/month'
    },
    'pro': {
        'name': 'Pro',
        'price_id': os.environ.get('STRIPE_PRO_PRICE_ID'),
        'guidebook_limit': 10,
        'price': 29.99,
        'price_display': '$29.99/month'
    },
    'enterprise': {
        'name': 'Enterprise',
        'price_id': None,
        'guidebook_limit': None,  # Unlimited
        'price': None,
        'price_display': 'Custom Quote',
        'contact_sales': True
    }
}
```

---

## ✅ Implementation Checklist

### Phase 1: Database & Backend
- [ ] Remove claim_token, claimed_at, expires_at columns
- [ ] Add guidebook_limit column to profiles
- [ ] Remove extra_slots column from profiles
- [ ] Add PLAN_CONFIGS to app.py
- [ ] Create `/api/guidebooks/<id>/toggle` endpoint
- [ ] Update `/preview/<id>` route (remove token validation)
- [ ] Add watermark logic to templates
- [ ] Update `/api/generate` (remove token generation)
- [ ] Simplify billing endpoints

### Phase 2: Templates
- [ ] Add CSS watermark styles to base_guidebook.html
- [ ] Add preview banner component
- [ ] Update PDF generation with watermark
- [ ] Pass `is_active` and `show_watermark` to all templates

### Phase 3: Frontend
- [ ] Update pricing page with new prices
- [ ] Add guidebook toggle UI to dashboard
- [ ] Remove "Add slot" button from billing page
- [ ] Update guidebook cards to show active/preview status
- [ ] Add preview/live links
- [ ] Implement toggleGuidebook function

### Phase 4: Stripe Setup
- [ ] Create Starter product ($9.99/mo)
- [ ] Create Growth product ($19.99/mo)
- [ ] Create Pro product ($29.99/mo)
- [ ] Copy price IDs to environment variables
- [ ] Test checkout flows

### Phase 5: Testing
- [ ] Test creating guidebook without payment (preview mode)
- [ ] Test watermark appears on preview
- [ ] Test upgrade flow
- [ ] Test activating guidebook (watermark disappears)
- [ ] Test deactivating guidebook (watermark appears)
- [ ] Test plan limits (can't activate beyond limit)
- [ ] Test PDF watermark
- [ ] Test all 3 paid tiers

---

## 🎯 Benefits of This Approach

1. **No Trial Complexity**
   - No expiration dates to track
   - No token generation/validation
   - No "claim" concept
   - Just active vs preview

2. **Better UX**
   - Users can create unlimited guidebooks
   - See exactly what it looks like before paying
   - Simple toggle to activate/deactivate
   - Clear visual feedback (watermark)

3. **Simpler Code**
   - Remove 3 database columns
   - Remove token logic (~30 lines)
   - Remove expiration checks (~20 lines)
   - Simpler routes

4. **Marketing Advantage**
   - "Try before you buy" without trial limits
   - Users invested (created guidebooks) before paying
   - Higher conversion: "Just remove watermark for $9.99"

5. **Flexibility**
   - Users can have 50 guidebooks, only pay for active ones
   - Can activate/deactivate seasonally
   - Preview mode for drafts

---

## 💰 Value Proposition

```
Current (Free Plan):
"Sign up for free, create 1 preview guidebook, expires in 30 days"
→ Pressure to upgrade before trying properly

New (Preview Mode):
"Create unlimited guidebooks, share previews with watermark.
Pay $9.99/mo to activate one and remove watermark."
→ Low pressure, high value, clear benefit
```

---

Ready to implement! This is actually simpler than the current system. Should I start with Phase 1 (Database & Backend)?
