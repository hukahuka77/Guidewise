# Simplified Tiered Pricing Architecture

## Overview
Replace the complex "Pro + Add-ons" system with simple, clear tiers.

---

## 🎯 Proposed Pricing Structure

```
┌─────────────────────────────────────────────────────────────┐
│                    GUIDEWISE PRICING                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Preview (Free Trial)                                       │
│  • Test with preview links (claim_token access)            │
│  • Guidebooks not publicly accessible                       │
│  • No payment required                                      │
│  • Converts to paid plan to publish                         │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Starter  –  $15/month                                      │
│  • 1 active guidebook                                       │
│  • Public URL (example.com/g/beach-house)                   │
│  • PDF downloads                                            │
│  • AI recommendations                                       │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Growth  –  $29/month                                       │
│  • 3 active guidebooks                                      │
│  • Everything in Starter                                    │
│  • Priority support                                         │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Pro  –  $49/month                                          │
│  • 10 active guidebooks                                     │
│  • Everything in Growth                                     │
│  • Custom branding (coming soon)                            │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Enterprise  –  Custom Quote                                │
│  • Unlimited guidebooks                                     │
│  • White-label options                                      │
│  • API access                                               │
│  • Dedicated support                                        │
│  • Contact sales for pricing                                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Database Schema Changes

### Current Schema
```sql
-- profiles table
user_id           VARCHAR(36) PK
email             VARCHAR
plan              VARCHAR  -- 'free' or 'pro'
extra_slots       INTEGER  -- Add-on count (REMOVE THIS)
stripe_customer_id    VARCHAR
stripe_subscription_id VARCHAR
```

### New Schema
```sql
-- profiles table
user_id           VARCHAR(36) PK
email             VARCHAR
plan              VARCHAR  -- 'starter', 'growth', 'pro', 'enterprise'
guidebook_limit   INTEGER  -- 1, 3, 10, or NULL (unlimited)
stripe_customer_id    VARCHAR
stripe_subscription_id VARCHAR

-- Migration
ALTER TABLE profiles DROP COLUMN extra_slots;
ALTER TABLE profiles ADD COLUMN guidebook_limit INTEGER DEFAULT 1;

-- Update existing users
UPDATE profiles SET
  plan = 'starter',
  guidebook_limit = 1
WHERE plan = 'free';

UPDATE profiles SET
  plan = 'starter',
  guidebook_limit = 1 + COALESCE(extra_slots, 0)
WHERE plan = 'pro';
```

---

## 🔧 Backend Changes

### 1. Plan Configuration

```python
# app.py - Add at top with other configs

PLAN_CONFIGS = {
    'starter': {
        'name': 'Starter',
        'price_id': os.environ.get('STRIPE_STARTER_PRICE_ID'),
        'guidebook_limit': 1,
        'price_display': '$15/month'
    },
    'growth': {
        'name': 'Growth',
        'price_id': os.environ.get('STRIPE_GROWTH_PRICE_ID'),
        'guidebook_limit': 3,
        'price_display': '$29/month'
    },
    'pro': {
        'name': 'Pro',
        'price_id': os.environ.get('STRIPE_PRO_PRICE_ID'),
        'guidebook_limit': 10,
        'price_display': '$49/month'
    },
    'enterprise': {
        'name': 'Enterprise',
        'price_id': None,  # Custom pricing
        'guidebook_limit': None,  # Unlimited
        'price_display': 'Custom'
    }
}

def get_plan_limit(plan: str) -> int | None:
    """Return guidebook limit for plan. None = unlimited."""
    if plan in PLAN_CONFIGS:
        return PLAN_CONFIGS[plan]['guidebook_limit']
    return 0  # Default for unknown/trial
```

### 2. Simplified Checkout Endpoint

```python
@app.route('/api/billing/create-checkout-session', methods=['POST'])
@require_auth
def create_checkout_session():
    """Create Stripe checkout for any paid plan."""
    data = request.json or {}
    plan = data.get('plan', 'starter')  # starter, growth, or pro

    if plan not in PLAN_CONFIGS or not PLAN_CONFIGS[plan]['price_id']:
        return jsonify({"error": f"Invalid plan: {plan}"}), 400

    if plan == 'enterprise':
        return jsonify({"error": "Please contact sales for Enterprise pricing"}), 400

    user_id = g.user_id
    email = getattr(g, 'user_email', None)

    try:
        # Check if user already has an active subscription
        current_plan = get_user_plan(user_id)
        if current_plan and current_plan != 'trial':
            return jsonify({
                "error": "You already have a subscription. Use the billing portal to change plans.",
                "redirect": "/dashboard/billing"
            }), 409

        # Create Stripe checkout session
        session = stripe.checkout.Session.create(
            mode='subscription',
            customer_email=email,
            line_items=[{
                "price": PLAN_CONFIGS[plan]['price_id'],
                "quantity": 1
            }],
            success_url=f"{FRONTEND_ORIGIN}/dashboard?upgraded=1",
            cancel_url=f"{FRONTEND_ORIGIN}/pricing?canceled=1",
            allow_promotion_codes=True,
            metadata={
                "user_id": user_id,
                "plan": plan
            },
        )
        return jsonify({"url": session.url})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
```

### 3. Simplified Activation Logic

```python
# REMOVE this entire function (157-203)
def _apply_activation_policy(user_id: str) -> dict:
    # DELETE 47 lines of complex logic
    pass

# REPLACE with simple function
def get_user_guidebook_limit(user_id: str) -> int | None:
    """Get how many guidebooks user can have active. None = unlimited."""
    try:
        row = db.session.execute(
            text("SELECT plan, guidebook_limit FROM public.profiles WHERE user_id = :uid"),
            {"uid": user_id}
        ).fetchone()

        if not row:
            return 0  # No plan = trial only

        plan = row[0] or 'trial'

        # Check config first, fall back to DB column
        if plan in PLAN_CONFIGS:
            return PLAN_CONFIGS[plan]['guidebook_limit']

        # Custom limit from DB (for grandfathered users)
        return row[1] if row[1] is not None else 0
    except Exception:
        return 0

def can_activate_guidebook(user_id: str) -> tuple[bool, str]:
    """Check if user can activate another guidebook."""
    limit = get_user_guidebook_limit(user_id)

    if limit is None:
        return (True, "Unlimited guidebooks")

    if limit == 0:
        return (False, "Please upgrade to a paid plan to publish guidebooks")

    # Count currently active guidebooks
    active_count = db.session.execute(
        text("SELECT COUNT(*) FROM guidebook WHERE user_id = :uid AND active = true"),
        {"uid": user_id}
    ).scalar()

    if active_count < limit:
        return (True, f"{limit - active_count} slots remaining")
    else:
        return (False, f"You've reached your limit of {limit} guidebooks. Upgrade or deactivate an existing guidebook.")
```

### 4. Updated Guidebook Creation

```python
# In /api/generate endpoint (around line 1042)

# OLD (lines 1042-1062)
new_guidebook.public_slug = None
new_guidebook.active = False
try:
    plan_row = db.session.execute(...)
    is_pro = bool(plan_row) and (plan_row[0] or 'free') == 'pro'
    if is_pro:
        # Complex slug generation and activation
        ...

# NEW
can_activate, message = can_activate_guidebook(user_id)

if can_activate:
    # Auto-activate and create public slug
    slug_base = _slugify(data.get('property_name') or 'guidebook')
    unique_slug = slug_base
    for i in range(100):
        exists = Guidebook.query.filter_by(public_slug=unique_slug).first()
        if not exists:
            break
        unique_slug = f"{slug_base}-{secrets.token_hex(3)}"

    new_guidebook.public_slug = unique_slug
    new_guidebook.active = True
else:
    # Create as preview only
    new_guidebook.public_slug = None
    new_guidebook.active = False
    new_guidebook.claim_token = secrets.token_hex(32)
    new_guidebook.expires_at = datetime.now(timezone.utc) + timedelta(days=30)
```

### 5. Simplified Billing Summary

```python
@app.route('/api/billing/summary', methods=['GET'])
@require_auth
def billing_summary():
    """Return user's billing state."""
    user_id = g.user_id
    email = getattr(g, 'user_email', None)

    # Get plan from DB
    try:
        row = db.session.execute(
            text("SELECT plan, guidebook_limit FROM public.profiles WHERE user_id = :uid"),
            {"uid": user_id}
        ).fetchone()
        plan = (row[0] if row else None) or 'trial'
        limit = row[1] if row else 0
    except Exception:
        plan = 'trial'
        limit = 0

    # Get active guidebook count
    active_count = db.session.execute(
        text("SELECT COUNT(*) FROM guidebook WHERE user_id = :uid AND active = true"),
        {"uid": user_id}
    ).scalar()

    out = {
        'plan': plan,
        'guidebook_limit': limit,
        'active_guidebooks': active_count,
        'can_activate_more': (limit is None) or (active_count < limit),
        'plan_display': PLAN_CONFIGS.get(plan, {}).get('name', 'Trial'),
        'stripe': {
            'customer_id': None,
            'subscription': None,
            'invoices': []
        }
    }

    # Get Stripe details if API key configured
    if stripe.api_key and email:
        try:
            customers = stripe.Customer.list(email=email, limit=1)
            if customers.data:
                customer = customers.data[0]
                out['stripe']['customer_id'] = customer.id

                # Get active subscription
                subs = stripe.Subscription.list(customer=customer.id, status='active', limit=1)
                if subs.data:
                    sub = subs.data[0]
                    out['stripe']['subscription'] = {
                        'id': sub.id,
                        'status': sub.status,
                        'current_period_end': sub.current_period_end
                    }

                # Get recent invoices
                invoices = stripe.Invoice.list(customer=customer.id, limit=10)
                out['stripe']['invoices'] = [{
                    'id': inv.id,
                    'status': inv.status,
                    'amount_paid': inv.amount_paid,
                    'created': inv.created,
                    'hosted_invoice_url': inv.hosted_invoice_url
                } for inv in invoices.data]
        except Exception:
            pass

    return jsonify(out)

# WENT FROM 120 LINES → 60 LINES (50% reduction)
```

### 6. Updated Webhook Handler

```python
@app.route('/webhooks/stripe', methods=['POST'])
def stripe_webhook():
    """Handle Stripe webhook events."""
    payload = request.data
    sig_header = request.headers.get('Stripe-Signature')

    try:
        if STRIPE_WEBHOOK_SECRET:
            event = stripe.Webhook.construct_event(
                payload=payload,
                sig_header=sig_header,
                secret=STRIPE_WEBHOOK_SECRET
            )
        else:
            event = stripe.Event.construct_from(json.loads(payload), stripe.api_key)
    except Exception as e:
        return jsonify({"error": f"Webhook error: {e}"}), 400

    try:
        event_type = event['type']
        obj = event['data']['object']

        if event_type == 'checkout.session.completed':
            # New subscription completed
            user_id = (obj.get('metadata') or {}).get('user_id')
            plan = (obj.get('metadata') or {}).get('plan', 'starter')

            if user_id and plan in PLAN_CONFIGS:
                # Update user's plan
                limit = PLAN_CONFIGS[plan]['guidebook_limit']
                db.session.execute(
                    text("""
                        INSERT INTO public.profiles (user_id, plan, guidebook_limit)
                        VALUES (:uid, :plan, :limit)
                        ON CONFLICT (user_id)
                        DO UPDATE SET plan = EXCLUDED.plan, guidebook_limit = EXCLUDED.guidebook_limit
                    """),
                    {"uid": user_id, "plan": plan, "limit": limit}
                )
                db.session.commit()

        elif event_type in ('customer.subscription.updated', 'customer.subscription.deleted'):
            # Subscription changed or cancelled
            subscription_id = obj.get('id')
            status = obj.get('status')

            if status in ('canceled', 'unpaid', 'past_due'):
                # Downgrade to trial
                # Find user by subscription_id
                user_row = db.session.execute(
                    text("SELECT user_id FROM public.profiles WHERE stripe_subscription_id = :sid"),
                    {"sid": subscription_id}
                ).fetchone()

                if user_row:
                    user_id = user_row[0]
                    db.session.execute(
                        text("UPDATE public.profiles SET plan = 'trial', guidebook_limit = 0 WHERE user_id = :uid"),
                        {"uid": user_id}
                    )
                    # Deactivate all guidebooks
                    db.session.execute(
                        text("UPDATE guidebook SET active = false WHERE user_id = :uid"),
                        {"uid": user_id}
                    )
                    db.session.commit()

    except Exception as e:
        # Log but don't fail webhook
        print(f"Webhook processing error: {e}")

    return jsonify({"ok": True})

# WENT FROM ~60 LINES → 50 LINES
# REMOVED: All add-on parsing logic
# REMOVED: _apply_activation_policy calls
```

---

## 🎨 Frontend Changes

### 1. New Pricing Page Component

```typescript
// frontend/src/app/pricing/page.tsx

const PLANS = [
  {
    name: 'Starter',
    price: '$15',
    period: '/month',
    guidebooks: 1,
    features: [
      '1 active guidebook',
      'Public URL sharing',
      'PDF downloads',
      'AI recommendations',
      'All templates'
    ],
    cta: 'Start with Starter',
    planId: 'starter'
  },
  {
    name: 'Growth',
    price: '$29',
    period: '/month',
    guidebooks: 3,
    features: [
      '3 active guidebooks',
      'Everything in Starter',
      'Priority support',
      'Custom branding (soon)'
    ],
    cta: 'Choose Growth',
    planId: 'growth',
    popular: true
  },
  {
    name: 'Pro',
    price: '$49',
    period: '/month',
    guidebooks: 10,
    features: [
      '10 active guidebooks',
      'Everything in Growth',
      'Advanced analytics (soon)',
      'API access (soon)'
    ],
    cta: 'Go Pro',
    planId: 'pro'
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    guidebooks: null, // unlimited
    features: [
      'Unlimited guidebooks',
      'White-label options',
      'API access',
      'Dedicated support',
      'Custom integrations'
    ],
    cta: 'Contact Sales',
    planId: 'enterprise'
  }
];

async function handleUpgrade(planId: string) {
  if (planId === 'enterprise') {
    // Open contact form or mailto
    window.location.href = 'mailto:sales@guidewise.com?subject=Enterprise%20Plan';
    return;
  }

  // Create checkout session with plan
  const response = await fetch(`${API_BASE}/api/billing/create-checkout-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ plan: planId })
  });

  const data = await response.json();
  if (data.url) {
    window.location.href = data.url;
  }
}
```

### 2. Updated Dashboard

```typescript
// frontend/src/app/dashboard/page.tsx

// Show plan status
<div className="plan-indicator">
  You're on the {summary.plan_display} plan
  ({summary.active_guidebooks} / {summary.guidebook_limit || '∞'} active)

  {summary.can_activate_more ? (
    <span className="text-green-600">You can activate more guidebooks</span>
  ) : (
    <span className="text-orange-600">
      Limit reached.
      <Link href="/pricing">Upgrade</Link> or deactivate a guidebook.
    </span>
  )}
</div>

// Add "Activate/Deactivate" toggle for each guidebook
{guidebooks.map(gb => (
  <div key={gb.id} className="guidebook-card">
    <h3>{gb.property_name}</h3>
    <Switch
      checked={gb.active}
      onChange={() => toggleGuidebook(gb.id)}
      disabled={!gb.active && !summary.can_activate_more}
    />
    <span>{gb.active ? 'Live' : 'Draft'}</span>
  </div>
))}
```

### 3. Simplified Billing Page

```typescript
// frontend/src/app/dashboard/billing/page.tsx

// REMOVE: "Add guidebook slot" button (line 136)
// REMOVE: extra_slots display (line 130)

// REPLACE with:
<div className="plan-card">
  <h2>{summary.plan_display} Plan</h2>
  <p>{summary.guidebook_limit || 'Unlimited'} guidebooks</p>
  <p>{summary.active_guidebooks} currently active</p>

  <Button onClick={openPortal}>Manage Billing</Button>
  <Link href="/pricing">
    <Button variant="outline">Change Plan</Button>
  </Link>
</div>
```

---

## 🗑️ Code to DELETE

### Backend (app.py)
```python
# DELETE entire functions
- create_addon_session() (lines 259-285)
- refresh_plan_from_stripe() (lines 408-446) # Keep only if needed for dev
- _apply_activation_policy() (lines 157-203)
- /api/guidebooks/activate_for_user endpoint

# DELETE from billing_summary()
- Lines 353-364 (add-on counting logic)
- extra_slots return value

# DELETE from webhook handler
- Lines 502-517 (add-on parsing in subscription.updated)

# DELETE config
- STRIPE_ADDON_PRICE_ID
```

### Frontend
```typescript
// DELETE
- startAddonCheckout() function (lib/billing.ts)
- "Add guidebook slot" button (dashboard/billing/page.tsx)
- extra_slots display logic
```

### Database
```sql
-- DELETE column
ALTER TABLE public.profiles DROP COLUMN extra_slots;
```

---

## 📋 Environment Variables

### Remove
```bash
STRIPE_ADDON_PRICE_ID  # DELETE
```

### Add
```bash
STRIPE_STARTER_PRICE_ID=price_...  # $15/mo - 1 guidebook
STRIPE_GROWTH_PRICE_ID=price_...   # $29/mo - 3 guidebooks
STRIPE_PRO_PRICE_ID=price_...      # $49/mo - 10 guidebooks
```

---

## 🔄 Migration Strategy

### Step 1: Create New Stripe Products
```
1. In Stripe Dashboard:
   - Create "Starter" product with $15/mo recurring price
   - Create "Growth" product with $29/mo recurring price
   - Create "Pro" product with $49/mo recurring price

2. Copy price IDs to .env
```

### Step 2: Migrate Existing Users

```sql
-- Grandfather existing users
-- Convert based on current guidebook count

-- Users with 1 guidebook → Starter
UPDATE profiles
SET plan = 'starter', guidebook_limit = 1
WHERE plan = 'pro' AND (1 + COALESCE(extra_slots, 0)) = 1;

-- Users with 2-3 guidebooks → Growth
UPDATE profiles
SET plan = 'growth', guidebook_limit = 3
WHERE plan = 'pro' AND (1 + COALESCE(extra_slots, 0)) BETWEEN 2 AND 3;

-- Users with 4-10 guidebooks → Pro
UPDATE profiles
SET plan = 'pro', guidebook_limit = 10
WHERE plan = 'pro' AND (1 + COALESCE(extra_slots, 0)) BETWEEN 4 AND 10;

-- Users with 11+ guidebooks → Custom limit
UPDATE profiles
SET plan = 'enterprise', guidebook_limit = NULL
WHERE plan = 'pro' AND (1 + COALESCE(extra_slots, 0)) > 10;

-- Free users → trial
UPDATE profiles
SET plan = 'trial', guidebook_limit = 0
WHERE plan = 'free';
```

### Step 3: Handle Stripe Subscriptions

Option A: **Let them expire naturally**
- Don't cancel existing subscriptions
- When they renew, they'll be on new pricing
- Email users 1 week before renewal with new pricing

Option B: **Immediate migration**
```python
# Script to migrate subscriptions
for user in users_with_subscriptions:
    old_sub = stripe.Subscription.retrieve(user.stripe_subscription_id)

    # Determine new plan based on current guidebooks
    new_plan = determine_plan(user.guidebook_count)
    new_price_id = PLAN_CONFIGS[new_plan]['price_id']

    # Update subscription
    stripe.Subscription.modify(
        old_sub.id,
        items=[{
            'id': old_sub['items']['data'][0].id,
            'price': new_price_id,
        }],
        proration_behavior='create_prorations'  # Credit/charge difference
    )
```

### Step 4: Update Code
1. Deploy backend with new endpoints
2. Deploy frontend with new pricing page
3. Remove old endpoints after testing

---

## 📊 Complexity Reduction Summary

| Metric | Before | After | Reduction |
|--------|--------|-------|-----------|
| **Stripe Products** | 2 (Pro + Add-on) | 3 (Starter/Growth/Pro) | Simpler |
| **API Endpoints** | 5 | 3 | -40% |
| **DB Columns** | 2 (plan, extra_slots) | 2 (plan, guidebook_limit) | Same count, clearer purpose |
| **Activation Logic** | 47 lines | 20 lines | -57% |
| **Billing Summary** | 120 lines | 60 lines | -50% |
| **Webhook Handler** | 60 lines | 50 lines | -17% |
| **User Confusion** | High | Low | ⭐⭐⭐⭐⭐ |
| **Support Complexity** | Complex | Simple | ⭐⭐⭐⭐⭐ |

---

## ✅ Benefits

1. **Clearer Value Proposition**
   - Users understand pricing immediately
   - No math required ("1 + 2 add-ons = ?")

2. **Simpler UX**
   - "You have 2/3 guidebooks active"
   - Clear upgrade path

3. **Less Code**
   - No add-on tracking
   - Simpler activation logic
   - Fewer edge cases

4. **Better Conversions**
   - Clear tiers make decision easier
   - No confusion about add-ons

5. **Easier Support**
   - "What plan are you on?" → Clear answer
   - No "why is this inactive?" tickets

6. **Competitive Pricing**
   - Most competitors charge $20-50/property
   - Your pricing is competitive and scalable

---

## 🎯 Next Steps

1. **Review pricing** - Are $15/$29/$49 the right price points?
2. **Create Stripe products** - Set up the 3 tiers
3. **Plan migration** - Decide on migration strategy for existing users
4. **Implementation** - I can implement all code changes
5. **Testing** - Test checkout flow for each tier
6. **Deployment** - Roll out with clear communication

What do you think? Ready to implement this?
