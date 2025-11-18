from flask import Flask, request, send_file, jsonify, render_template, make_response, g, abort, redirect
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text
from sqlalchemy.orm import joinedload
import main as pdf_generator
import io
import secrets
import re
from datetime import datetime, timezone
import hashlib
from dotenv import load_dotenv
import os
import time
import functools
import logging
import json
import requests

# JWT/JWKS for Supabase auth verification
import jwt
from jwt import PyJWKClient
import stripe

# Import db and models from models.py
from models import db, Guidebook, Host, Property
from utils.ai_recommendations import (
    get_ai_recommendations,
    get_ai_food_recommendations,  # backward compatibility
    get_ai_activity_recommendations  # backward compatibility
)
from utils.google_places import (
    google_places_text_search,
    google_places_details,
    google_places_photo_url,
)

# --- Unicode utilities ---
def _strip_surrogates(s: str) -> str:
    """Remove UTF-16 surrogate code points to avoid encode errors.
    Surrogate range: U+D800–U+DFFF.
    """
    if not isinstance(s, str):
        return s
    return ''.join(ch for ch in s if not (0xD800 <= ord(ch) <= 0xDFFF))

# Simple slugifier for property names -> public slugs
def _slugify(s: str) -> str:
    if not s:
        return 'guidebook'
    s = s.strip().lower()
    # Replace non-alphanumeric with hyphens
    s = re.sub(r'[^a-z0-9]+', '-', s)
    s = re.sub(r'-{2,}', '-', s).strip('-')
    return s or 'guidebook'

load_dotenv() # Load environment variables from .env file

app = Flask(__name__)

# Basic logging setup
logging.basicConfig(level=logging.INFO)
log = logging.getLogger("auth")

@app.before_request
def redirect_root():
    # Only redirect the root path, not API endpoints
    if request.host == "guidewise.onrender.com" and request.path == "/":
        return redirect("https://guidewiseapp.com", code=301)

# Optional gzip compression if Flask-Compress is available
try:
    from flask_compress import Compress
    Compress(app)
except Exception:
    pass

origins_str = os.environ.get('FRONTEND_ORIGIN', '')
_origins = [o.strip() for o in origins_str.split(',') if o.strip()] if origins_str else ['http://localhost:3000']
CORS(
    app,
    resources={r"/api/*": {"origins": _origins}},
    expose_headers=["X-Guidebook-Url"],
)

# Configure the database using the DATABASE_URL from .env
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
# Prevent stale connections (common with managed Postgres like Supabase)
# - pool_pre_ping: checks connection liveness before using it
# - pool_recycle: proactively recycle connections after N seconds (e.g., 300s)
# - connect_args: enable TCP keepalives so idle connections are kept alive
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    'pool_pre_ping': True,
    'pool_recycle': 300,
    'connect_args': {
        'keepalives': 1,
        'keepalives_idle': 30,
        'keepalives_interval': 10,
        'keepalives_count': 5,
    },
}

# Stripe configuration
stripe.api_key = os.environ.get('STRIPE_SECRET_KEY')
STRIPE_WEBHOOK_SECRET = os.environ.get('STRIPE_WEBHOOK_SECRET')
FRONTEND_ORIGIN = os.environ.get('FRONTEND_ORIGIN', 'http://localhost:3000')
STRIPE_PORTAL_CONFIGURATION_ID = os.environ.get('STRIPE_PORTAL_CONFIGURATION_ID')  # optional pc_... id

# Plan configuration for tiered pricing
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
        'price_id': None,  # Custom pricing, contact sales
        'guidebook_limit': None,  # Unlimited
        'price': None,
        'price_display': 'Custom Quote',
        'contact_sales': True
    }
}

def require_auth(fn):
    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        authz = request.headers.get('Authorization')
        claims = _verify_bearer_jwt(authz)
        if not claims:
            log.warning("Unauthorized request to %s %s", request.method, request.path)
            return jsonify({"error": "Unauthorized"}), 401
        # Supabase user id lives in sub
        g.user_id = claims.get('sub')
        g.user_email = claims.get('email') or (claims.get('user_metadata', {}).get('email') if isinstance(claims.get('user_metadata'), dict) else None)
        if not g.user_id:
            log.warning("JWT missing sub claim")
            return jsonify({"error": "Unauthorized"}), 401
        # Propagate claims to Postgres session so RLS policies using auth.uid() work
        try:
            session_claims = {
                "sub": g.user_id,
                "email": g.user_email,
            }
            from sqlalchemy import text as _text
            db.session.execute(
                _text("select set_config('request.jwt.claims', :claims, true)"),
                {"claims": json.dumps(session_claims)}
            )
            db.session.execute(
                _text("select set_config('jwt.claims', :claims, true)"),
                {"claims": json.dumps(session_claims)}
            )
            db.session.execute(_text("select set_config('role', 'authenticated', true)"))
        except Exception as e:
            log.warning("Failed to set request.jwt.claims for RLS: %s: %s", type(e).__name__, e)
        return fn(*args, **kwargs)
    return wrapper

def get_user_guidebook_limit(user_id: str) -> int | None:
    """Get how many guidebooks user can have active. None = unlimited."""
    try:
        row = db.session.execute(
            text("SELECT plan, guidebook_limit FROM public.profiles WHERE user_id = :uid"),
            {"uid": user_id}
        ).fetchone()

        if not row:
            return 0  # No plan = trial only (preview mode)

        plan = row[0] or 'trial'

        # Check config first
        if plan in PLAN_CONFIGS:
            return PLAN_CONFIGS[plan]['guidebook_limit']

        # Fall back to DB column for custom/grandfathered limits
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
    ).scalar() or 0

    if active_count < limit:
        return (True, f"{limit - active_count} slots remaining")
    else:
        return (False, f"You've reached your limit of {limit} guidebooks. Upgrade or deactivate an existing guidebook.")

def _deactivate_all_user_guidebooks(user_id: str):
    try:
        db.session.execute(
            text("update guidebook set active = false where user_id = :uid and active = true"),
            {"uid": user_id},
        )
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise

# --- Billing: Stripe Checkout and Portal ---
@app.route('/api/billing/create-checkout-session', methods=['POST'])
@require_auth
def create_checkout_session():
    """Create Stripe checkout for any paid plan (starter, growth, or pro)."""
    if not stripe.api_key:
        return jsonify({"error": "Stripe not configured"}), 500

    data = request.json or {}
    plan = data.get('plan', 'starter')  # Default to starter

    # Validate plan
    if plan not in PLAN_CONFIGS or not PLAN_CONFIGS[plan]['price_id']:
        return jsonify({"error": f"Invalid plan: {plan}"}), 400

    if plan == 'enterprise':
        return jsonify({"error": "Please contact sales for Enterprise pricing"}), 400

    user_id = g.user_id
    email = getattr(g, 'user_email', None)

    try:
        # Check if user already has an active subscription
        try:
            row = db.session.execute(
                text("SELECT plan FROM public.profiles WHERE user_id = :uid"),
                {"uid": user_id}
            ).fetchone()
            current_plan = row[0] if row else None
            if current_plan and current_plan in PLAN_CONFIGS:
                return jsonify({
                    "error": "You already have a subscription. Use the billing portal to change plans.",
                    "redirect": "/dashboard/billing"
                }), 409
        except Exception:
            pass

        # Optional: Check Stripe for active subscriptions
        try:
            if email:
                customers = stripe.Customer.list(email=email, limit=1)
                if customers.data:
                    subs = stripe.Subscription.list(customer=customers.data[0].id, status='active', limit=1)
                    if subs.data:
                        return jsonify({
                            "error": "An active subscription already exists",
                            "redirect": "/dashboard/billing"
                        }), 409
        except Exception:
            pass

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

@app.route('/api/billing/summary', methods=['GET'])
@require_auth
def billing_summary():
    """Return user's billing state and guidebook limits.

    Response shape:
      {
        plan: 'starter'|'growth'|'pro'|'enterprise'|'trial',
        guidebook_limit: int|null,
        active_guidebooks: int,
        can_activate_more: bool,
        plan_display: str,
        stripe: {
          customer_id: str|null,
          subscription: { id, status, current_period_end }|null,
          invoices: [ { id, status, paid, amount_paid, created, hosted_invoice_url } ]
        }
      }
    """
    user_id = g.user_id
    email = getattr(g, 'user_email', None)

    # Get plan and limit from DB
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
    ).scalar() or 0

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

@app.route('/api/billing/create-portal-session', methods=['POST'])
@require_auth
def create_portal_session():
    if not stripe.api_key:
        return jsonify({"error": "Stripe not configured"}), 500
    # Try to find customer by email
    email = getattr(g, 'user_email', None) or (request.json.get('email') if isinstance(request.json, dict) else None)
    try:
        customers = stripe.Customer.list(email=email, limit=1)
        if not customers.data:
            return jsonify({"error": "No Stripe customer found"}), 404
        customer_id = customers.data[0].id
        kwargs = {
            'customer': customer_id,
            'return_url': f"{FRONTEND_ORIGIN}/dashboard/billing?updated=1",
        }
        if STRIPE_PORTAL_CONFIGURATION_ID:
            kwargs['configuration'] = STRIPE_PORTAL_CONFIGURATION_ID
        portal = stripe.billing_portal.Session.create(**kwargs)
        return jsonify({"url": portal.url})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/webhooks/stripe', methods=['POST'])
def stripe_webhook():
    payload = request.data
    sig_header = request.headers.get('Stripe-Signature')

    # Debug logging
    log.info(f"Webhook received. Signature header present: {sig_header is not None}")
    log.info(f"Webhook secret configured: {STRIPE_WEBHOOK_SECRET[:10]}... (first 10 chars)")
    log.info(f"Payload size: {len(payload)} bytes")

    event = None
    try:
        if STRIPE_WEBHOOK_SECRET:
            event = stripe.Webhook.construct_event(payload=payload, sig_header=sig_header, secret=STRIPE_WEBHOOK_SECRET)
        else:
            event = stripe.Event.construct_from(json.loads(payload), stripe.api_key)
    except Exception as e:
        log.error(f"Webhook signature verification failed: {e}")
        return jsonify({"error": f"Webhook error: {e}"}), 400

    # Handle subscription events
    try:
        event_type = event['type']
        obj = event['data']['object']

        log.info(f"Processing webhook event: {event_type}")

        if event_type == 'checkout.session.completed':
            # New subscription completed
            user_id = (obj.get('metadata') or {}).get('user_id')
            plan = (obj.get('metadata') or {}).get('plan', 'starter')
            subscription_id = obj.get('subscription')
            customer_id = obj.get('customer')

            if user_id and plan in PLAN_CONFIGS:
                # Update user's plan and guidebook_limit
                limit = PLAN_CONFIGS[plan]['guidebook_limit']

                # Get subscription details to set pro_expires_at and pro_starts_at
                # Note: Subscription might not be fully created yet, dates will be updated by invoice.payment_succeeded
                expires_at = None
                starts_at = None
                if subscription_id:
                    try:
                        subscription = stripe.Subscription.retrieve(subscription_id)
                        period_end = subscription.get('current_period_end')
                        period_start = subscription.get('current_period_start')
                        if period_end:
                            from datetime import datetime
                            expires_at = datetime.fromtimestamp(period_end).isoformat()
                        if period_start:
                            from datetime import datetime
                            starts_at = datetime.fromtimestamp(period_start).isoformat()
                    except stripe.error.InvalidRequestError as e:
                        # Subscription not yet created - will be updated by customer.subscription.created or invoice.payment_succeeded
                        log.info(f"Subscription {subscription_id} not yet available, will update dates from later webhook")
                    except Exception as e:
                        log.warning(f"Failed to fetch subscription details: {e}")

                db.session.execute(
                    text("""
                        INSERT INTO public.profiles (user_id, plan, guidebook_limit, stripe_customer_id, stripe_subscription_id, pro_starts_at, pro_expires_at)
                        VALUES (:uid, :plan, :limit, :cust_id, :sub_id, :starts_at, :expires_at)
                        ON CONFLICT (user_id)
                        DO UPDATE SET
                            plan = EXCLUDED.plan,
                            guidebook_limit = EXCLUDED.guidebook_limit,
                            stripe_customer_id = EXCLUDED.stripe_customer_id,
                            stripe_subscription_id = EXCLUDED.stripe_subscription_id,
                            pro_starts_at = EXCLUDED.pro_starts_at,
                            pro_expires_at = EXCLUDED.pro_expires_at
                    """),
                    {"uid": user_id, "plan": plan, "limit": limit, "cust_id": customer_id, "sub_id": subscription_id, "starts_at": starts_at, "expires_at": expires_at}
                )
                db.session.commit()

        elif event_type == 'customer.subscription.created':
            # New subscription created - update dates if missing from checkout.session.completed
            subscription_id = obj.get('id')
            period_end = obj.get('current_period_end')
            period_start = obj.get('current_period_start')

            if subscription_id and period_end and period_start:
                from datetime import datetime
                expires_at = datetime.fromtimestamp(period_end).isoformat()
                starts_at = datetime.fromtimestamp(period_start).isoformat()

                # Update dates for this subscription
                db.session.execute(
                    text("""
                        UPDATE public.profiles
                        SET pro_expires_at = :expires_at,
                            pro_starts_at = :starts_at
                        WHERE stripe_subscription_id = :sub_id
                          AND (pro_starts_at IS NULL OR pro_expires_at IS NULL)
                    """),
                    {"expires_at": expires_at, "starts_at": starts_at, "sub_id": subscription_id}
                )
                db.session.commit()
                log.info(f"Updated subscription dates for subscription {subscription_id}")

        elif event_type == 'invoice.payment_succeeded':
            # Subscription renewed successfully - update pro_expires_at and pro_starts_at
            subscription_id = obj.get('subscription')
            if subscription_id:
                # Fetch the subscription to get current_period_end and current_period_start
                try:
                    subscription = stripe.Subscription.retrieve(subscription_id)
                    period_end = subscription.get('current_period_end')
                    period_start = subscription.get('current_period_start')

                    if period_end and period_start:
                        # Convert Unix timestamps to ISO datetime
                        from datetime import datetime
                        expires_at = datetime.fromtimestamp(period_end).isoformat()
                        starts_at = datetime.fromtimestamp(period_start).isoformat()

                        # Update the user's pro_expires_at and pro_starts_at
                        db.session.execute(
                            text("""
                                UPDATE public.profiles
                                SET pro_expires_at = :expires_at,
                                    pro_starts_at = :starts_at,
                                    stripe_subscription_id = :sub_id
                                WHERE stripe_subscription_id = :sub_id
                            """),
                            {"expires_at": expires_at, "starts_at": starts_at, "sub_id": subscription_id}
                        )
                        db.session.commit()
                except Exception as e:
                    log.warning(f"Failed to update pro_expires_at/starts_at for subscription {subscription_id}: {e}")

        elif event_type == 'invoice.payment_failed':
            # Payment failed - log warning but don't immediately downgrade
            # Stripe will retry and eventually send subscription.deleted if it keeps failing
            subscription_id = obj.get('subscription')
            if subscription_id:
                log.warning(f"Payment failed for subscription {subscription_id}. Stripe will retry automatically.")
                # Optionally: send email notification to user
                # User keeps access during retry period

        elif event_type in ('customer.subscription.updated', 'customer.subscription.deleted'):
            # Subscription changed or cancelled
            subscription_id = obj.get('id')
            status = obj.get('status')

            log.info(f"Subscription event: {event_type}, ID: {subscription_id}, Status: {status}")

            if event_type == 'customer.subscription.deleted' or status in ('canceled', 'unpaid', 'past_due'):
                # Downgrade to trial
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

            elif event_type == 'customer.subscription.updated' and status == 'active':
                # Subscription plan changed (upgrade/downgrade) - update plan and limits
                items = obj.get('items', {}).get('data', [])
                if items:
                    price_id = items[0].get('price', {}).get('id')
                    log.info(f"Subscription {subscription_id} updated with price_id: {price_id}")

                    # Map price_id back to plan name
                    new_plan = None
                    for plan_key, plan_config in PLAN_CONFIGS.items():
                        if plan_config.get('price_id') == price_id:
                            new_plan = plan_key
                            break

                    if new_plan:
                        limit = PLAN_CONFIGS[new_plan]['guidebook_limit']
                        log.info(f"Mapped to plan '{new_plan}' with guidebook limit: {limit}")

                        # Get subscription period dates
                        period_end = obj.get('current_period_end')
                        period_start = obj.get('current_period_start')
                        expires_at = None
                        starts_at = None
                        if period_end:
                            from datetime import datetime
                            expires_at = datetime.fromtimestamp(period_end).isoformat()
                        if period_start:
                            from datetime import datetime
                            starts_at = datetime.fromtimestamp(period_start).isoformat()

                        # Update user's plan and guidebook limit
                        result = db.session.execute(
                            text("""
                                UPDATE public.profiles
                                SET plan = :plan,
                                    guidebook_limit = :limit,
                                    pro_starts_at = :starts_at,
                                    pro_expires_at = :expires_at,
                                    stripe_subscription_id = :sub_id
                                WHERE stripe_subscription_id = :sub_id
                                RETURNING user_id
                            """),
                            {"plan": new_plan, "limit": limit, "starts_at": starts_at, "expires_at": expires_at, "sub_id": subscription_id}
                        )
                        updated_user = result.fetchone()
                        db.session.commit()

                        if updated_user:
                            log.info(f"✓ Successfully updated user {updated_user[0]} to plan '{new_plan}' with {limit} guidebook limit")
                        else:
                            log.warning(f"No user found with subscription_id {subscription_id}")
                    else:
                        log.warning(f"Could not map price_id {price_id} to any plan in PLAN_CONFIGS")
                else:
                    log.warning(f"No subscription items found for subscription {subscription_id}")

    except Exception as e:
        # Log but don't fail webhook
        log.warning(f"Webhook processing error: {e}")

    return jsonify({"ok": True})

# Initialize the database with the app
db.init_app(app)

# --- Supabase Auth (JWT via JWKS) ---
SUPABASE_URL = os.environ.get('SUPABASE_URL', '').rstrip('/')
SUPABASE_JWKS_URL = os.environ.get('SUPABASE_JWKS_URL') or (f"{SUPABASE_URL}/auth/v1/jwks" if SUPABASE_URL else None)
SUPABASE_JWT_AUD = os.environ.get('SUPABASE_JWT_AUD')  # optional
SUPABASE_JWT_SECRET = os.environ.get('SUPABASE_JWT_SECRET')  # for HS256 tokens (Supabase default)
CLN_SECRET = os.environ.get('CLEANUP_SECRET')  # optional secret for maintenance endpoints

_jwks_client = None

def _get_jwks_client():
    global _jwks_client
    if _jwks_client is None:
        if not SUPABASE_JWKS_URL:
            raise RuntimeError("SUPABASE_JWKS_URL not configured. Set SUPABASE_URL or SUPABASE_JWKS_URL in env.")
        log.info(f"JWKS URL: {SUPABASE_JWKS_URL}")
        if SUPABASE_JWT_AUD:
            log.info(f"Expecting JWT aud={SUPABASE_JWT_AUD}")
        _jwks_client = PyJWKClient(SUPABASE_JWKS_URL)
    return _jwks_client

def _verify_bearer_jwt(auth_header: str):
    if not auth_header:
        log.warning("Authorization header missing")
        return None
    if not auth_header.startswith('Bearer '):
        log.warning("Authorization header not a Bearer token")
        return None
    token = auth_header.split(' ', 1)[1].strip()
    try:
        # Inspect header to determine algorithm
        try:
            hdr = jwt.get_unverified_header(token)
            alg = hdr.get('alg')
            log.info(f"JWT header kid={hdr.get('kid')} alg={alg}")
        except Exception as e:
            log.warning(f"Unable to read JWT header: {type(e).__name__}: {e}")
            alg = None

        # HS256 (Supabase default): verify with project JWT secret
        if alg == 'HS256':
            if not SUPABASE_JWT_SECRET:
                log.error("SUPABASE_JWT_SECRET not set; cannot verify HS256 token")
                return None
            decoded = jwt.decode(
                token,
                SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                audience=SUPABASE_JWT_AUD if SUPABASE_JWT_AUD else None,
            )
            log.info("JWT (HS256) verified OK for sub=%s", decoded.get('sub'))
            return decoded

        # RS256: fetch signing key from JWKS
        signing_key = _get_jwks_client().get_signing_key_from_jwt(token)
        decoded = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience=SUPABASE_JWT_AUD if SUPABASE_JWT_AUD else None,
        )
        log.info("JWT (RS256) verified OK for sub=%s", decoded.get('sub'))
        return decoded
    except Exception as e:
        log.error("JWT verification failed: %s: %s", type(e).__name__, e)
        return None

def require_auth(fn):
    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        authz = request.headers.get('Authorization')
        claims = _verify_bearer_jwt(authz)
        if not claims:
            log.warning("Unauthorized request to %s %s", request.method, request.path)
            return jsonify({"error": "Unauthorized"}), 401
        # Supabase user id lives in sub
        g.user_id = claims.get('sub')
        g.user_email = claims.get('email') or claims.get('user_metadata', {}).get('email') if isinstance(claims.get('user_metadata'), dict) else None
        if not g.user_id:
            log.warning("JWT missing sub claim")
            return jsonify({"error": "Unauthorized"}), 401
        # IMPORTANT: Propagate claims to Postgres session so RLS policies using auth.uid() work
        try:
            session_claims = {
                "sub": g.user_id,
                # Include email if available; harmless if missing
                "email": g.user_email,
            }
            from sqlalchemy import text as _text
            # Primary setting used by Supabase's auth.uid()
            db.session.execute(
                _text("select set_config('request.jwt.claims', :claims, true)") ,
                {"claims": json.dumps(session_claims)}
            )
            # Back-compat: some helpers read jwt.claims
            db.session.execute(
                _text("select set_config('jwt.claims', :claims, true)") ,
                {"claims": json.dumps(session_claims)}
            )
            # Ensure role is authenticated for policies that check current_role
            db.session.execute(_text("select set_config('role', 'authenticated', true)"))
        except Exception as e:
            log.warning("Failed to set request.jwt.claims for RLS: %s: %s", type(e).__name__, e)
        return fn(*args, **kwargs)
    return wrapper

# Template registry mapping keys to template files (URL renderer)
TEMPLATE_REGISTRY = {
    "template_original": "templates_url/template_original.html",
    # Canonical generic template
    "template_generic": "templates_url/template_generic.html",
    # Modern mobile-first template
    "template_modern": "templates_url/template_modern.html",
    # Clean welcome book style with neutral tones
    "template_welcomebook": "templates_url/template_welcomebook.html",
}
ALLOWED_TEMPLATE_KEYS = set(TEMPLATE_REGISTRY.keys())
# Allowed PDF template keys (canonical)
ALLOWED_PDF_TEMPLATE_KEYS = {"template_pdf_original", "template_pdf_basic", "template_pdf_mobile", "template_pdf_qr", "template_pdf_modern"}

RENDER_CACHE = {}

def _render_cache_key(gb: Guidebook, template_key: str, template_file: str) -> str:
    import os
    ts = getattr(gb, 'last_modified_time', None)
    ts_val = str(ts.timestamp()) if hasattr(ts, 'timestamp') else str(ts)
    # Also include template file mtime so edits to templates invalidate cache
    try:
        base_dir = os.path.dirname(__file__)
        tmpl_path = os.path.join(base_dir, 'templates', template_file)
        mtime = str(os.path.getmtime(tmpl_path)) if os.path.exists(tmpl_path) else '0'
    except Exception:
        mtime = '0'
    return f"{gb.id}:{template_key}:{template_file}:{ts_val}:{mtime}"

def _render_guidebook(gb: Guidebook, show_watermark: bool = False):
    """Render a guidebook to HTML using its selected template with caching."""
    template_key = getattr(gb, 'template_key', None) or 'template_original'
    if template_key not in ALLOWED_TEMPLATE_KEYS:
        template_key = 'template_original'
    template_file = TEMPLATE_REGISTRY.get(template_key, TEMPLATE_REGISTRY['template_original'])
    # Compute included_tabs default (all) if missing; keep any custom_* keys
    # Updated tab keys to match frontend: 'welcome' combines welcome, location, host & safety; wifi lives under check-in
    base_tabs = ['welcome','checkin','property','food','activities','rules','checkout']
    included_tabs = getattr(gb, 'included_tabs', None) or base_tabs
    included_tabs = [t for t in included_tabs if (t in base_tabs) or (isinstance(t, str) and t.startswith('custom_'))]

    # Caching: reuse rendered HTML if guidebook/template unchanged
    # Include show_watermark in cache key to prevent serving wrong version
    cache_key = _render_cache_key(gb, template_key, template_file) + f":wm={show_watermark}"
    etag = hashlib.sha256(cache_key.encode('utf-8')).hexdigest()
    if request.headers.get('If-None-Match') == etag:
        resp = make_response('', 304)
        resp.headers['ETag'] = etag
        return resp

    cached = RENDER_CACHE.get(cache_key)
    if cached is not None:
        resp = make_response(cached)
        resp.headers['Content-Type'] = 'text/html; charset=utf-8'
        resp.headers['ETag'] = etag
        resp.headers['Cache-Control'] = 'public, max-age=300'
        try:
            resp.headers['X-Template-Key'] = template_key
        except Exception:
            pass
        return resp

    # Sanitize custom tabs meta before rendering to avoid surrogate issues from emojis
    safe_custom_tabs_meta = None
    try:
        meta = getattr(gb, 'custom_tabs_meta', None)
        if isinstance(meta, dict):
            safe_custom_tabs_meta = {}
            for k, v in meta.items():
                if isinstance(v, dict):
                    lbl = _strip_surrogates(str(v.get('label'))) if v.get('label') is not None else ''
                    ico = _strip_surrogates(str(v.get('icon'))) if v.get('icon') is not None else ''
                    safe_custom_tabs_meta[k] = {'label': lbl, 'icon': ico}
    except Exception:
        safe_custom_tabs_meta = getattr(gb, 'custom_tabs_meta', None)

    # Build unified rendering context
    # Fallback public placeholder cover image if none provided
    PLACEHOLDER_COVER_URL = (
        "https://hojncqasasvvrhdmwwhv.supabase.co/storage/v1/object/public/my_images/home_placeholder.jpg"
    )

    def _build_ctx(g: Guidebook) -> dict:
        return {
            "schema_version": 1,
            "id": g.id,
            "property_name": (getattr(g.property, 'name', None) or 'My Guidebook'),
            "host": {
                "name": getattr(g.host, 'name', None),
                "bio": getattr(g.host, 'bio', None),
                "contact": getattr(g.host, 'contact', None),
                "photo_url": getattr(g.host, 'host_image_url', None),
            },
            "welcome_message": getattr(g, 'welcome_info', None),
            "safety_info": getattr(g, 'safety_info', {}) or {},
            "address": {
                "street": getattr(g.property, 'address_street', None),
                "city_state": getattr(g.property, 'address_city_state', None),
                "zip": getattr(g.property, 'address_zip', None),
            },
            "wifi_json": getattr(g, 'wifi_json', None) or {},
            "check_in_time": g.check_in_time,
            "check_out_time": g.check_out_time,
            "access_info": g.access_info,
            "parking_info": g.parking_info,
            # Use new JSON rules format if available, otherwise fallback to old Rule model
            "rules": (getattr(g, 'rules_json', None) or [{"name": r.text, "description": ""} for r in g.rules]) if hasattr(g, 'rules') else [],
            "things_to_do": g.things_to_do or [],
            "places_to_eat": g.places_to_eat or [],
            "checkout_info": getattr(g, 'checkout_info', None) or [],
            "house_manual": getattr(g, 'house_manual', None) or [],
            "included_tabs": included_tabs,
            "custom_sections": getattr(g, 'custom_sections', None) or {},
            "custom_tabs_meta": safe_custom_tabs_meta or (getattr(g, 'custom_tabs_meta', None) or {}),
            "cover_image_url": (g.cover_image_url or PLACEHOLDER_COVER_URL),
        }

    ctx = _build_ctx(gb)

    # Build upgrade URL for preview banner
    upgrade_url = f"{FRONTEND_ORIGIN}/pricing" if FRONTEND_ORIGIN else "https://guidewiseapp.com/pricing"

    html = render_template(
        TEMPLATE_REGISTRY.get(template_key, TEMPLATE_REGISTRY['template_original']),
        ctx=ctx,
        show_watermark=show_watermark,
        upgrade_url=upgrade_url
    )
    RENDER_CACHE[cache_key] = html
    resp = make_response(html)
    resp.headers['Content-Type'] = 'text/html; charset=utf-8'
    resp.headers['ETag'] = etag
    resp.headers['Cache-Control'] = 'public, max-age=300'
    try:
        resp.headers['X-Template-Key'] = template_key
    except Exception:
        pass
    return resp


def _slugify(text: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9\s-]", "", text or "")
    s = re.sub(r"\s+", "-", s).strip('-').lower()
    return s or "guidebook"


@app.route('/g/<public_slug>')
def view_live_by_slug(public_slug):
    gb = Guidebook.query.filter_by(public_slug=public_slug, active=True).first_or_404()
    # Serve snapshot if fresh; otherwise render on demand
    if getattr(gb, 'published_html', None) and getattr(gb, 'published_at', None):
        try:
            if gb.published_at and gb.last_modified_time and gb.published_at >= gb.last_modified_time:
                # Validate ETag
                incoming = request.headers.get('If-None-Match')
                etag = gb.published_etag or hashlib.sha256((gb.id + (gb.template_key or '') + str(gb.last_modified_time)).encode('utf-8')).hexdigest()
                if incoming == etag:
                    resp = make_response('', 304)
                    resp.headers['ETag'] = etag
                    return resp
                resp = make_response(gb.published_html)
                resp.headers['Content-Type'] = 'text/html; charset=utf-8'
                resp.headers['ETag'] = etag
                resp.headers['Cache-Control'] = 'public, max-age=300, stale-while-revalidate=86400'
                return resp
        except Exception:
            pass
    return _render_guidebook(gb)


@app.route('/preview/<guidebook_id>')
def preview_guidebook(guidebook_id):
    """Show guidebook in preview mode (with watermark if not active)."""
    gb = Guidebook.query.get_or_404(guidebook_id)

    # Anyone can view preview (no authentication required)
    # Render with watermark indicator
    resp = _render_guidebook(gb, show_watermark=not gb.active)

    # Discourage indexing for previews
    try:
        resp.headers['X-Robots-Tag'] = 'noindex, nofollow'
        resp.headers['Cache-Control'] = 'private, no-store'
    except Exception:
        pass
    return resp


@app.route('/guidebook/<guidebook_id>')
def view_guidebook(guidebook_id):
    # Eager-load related objects to avoid N+1 queries
    guidebook = (
        Guidebook.query.options(
            joinedload(Guidebook.host),
            joinedload(Guidebook.property),
            joinedload(Guidebook.rules),
        ).get_or_404(guidebook_id)
    )
    # Legacy direct-by-id path. Only allow if active; otherwise redirect to upgrade page on frontend.
    if not getattr(guidebook, 'active', False):
        try:
            fe = os.environ.get('FRONTEND_ORIGIN') or 'http://localhost:3000'
            from flask import redirect
            return redirect(f"{fe}/upgrade?gb={guidebook.id}", code=302)
        except Exception:
            return jsonify({"error": "This guidebook is not active. Use preview link to view."}), 403
    # Serve snapshot if fresh; otherwise render on demand
    if getattr(guidebook, 'published_html', None) and getattr(guidebook, 'published_at', None):
        try:
            if guidebook.published_at and guidebook.last_modified_time and guidebook.published_at >= guidebook.last_modified_time:
                incoming = request.headers.get('If-None-Match')
                etag = guidebook.published_etag or hashlib.sha256((guidebook.id + (guidebook.template_key or '') + str(guidebook.last_modified_time)).encode('utf-8')).hexdigest()
                if incoming == etag:
                    resp = make_response('', 304)
                    resp.headers['ETag'] = etag
                    return resp
                resp = make_response(guidebook.published_html)
                resp.headers['Content-Type'] = 'text/html; charset=utf-8'
                resp.headers['ETag'] = etag
                resp.headers['Cache-Control'] = 'public, max-age=300, stale-while-revalidate=86400'
                return resp
        except Exception:
            pass
    return _render_guidebook(guidebook)

@app.route('/api/generate', methods=['POST'])
@require_auth
def generate_guidebook_route():
    data = request.json
    # Auth REQUIRED: all guidebooks must be owned by an account
    user_id = g.user_id

    # Do not auto-generate recommendations here; leave blank if none provided
    if not isinstance(data.get('things_to_do'), list):
        data['things_to_do'] = []
    if not isinstance(data.get('places_to_eat'), list):
        data['places_to_eat'] = []

    # --- Create DB Objects with new normalized schema ---
    # Find or create Host (optional)
    host = None
    incoming_host_name = (data.get('host_name') or '').strip()
    incoming_host_bio = data.get('host_bio')
    incoming_host_contact = data.get('host_contact')
    incoming_host_photo = data.get('host_photo_url')
    # Create a Host record if any host field is provided
    if incoming_host_name or incoming_host_bio or incoming_host_contact or incoming_host_photo:
        if incoming_host_name:
            host = Host.query.filter_by(name=incoming_host_name, user_id=user_id).first()
        if not host:
            host = Host(name=incoming_host_name or None, user_id=user_id)
            db.session.add(host)
        # Update host optional fields
        if incoming_host_bio:
            host.bio = incoming_host_bio
        if incoming_host_contact:
            host.contact = incoming_host_contact
        if incoming_host_photo:
            # Reject inline data URLs for memory safety; expect external URL (Supabase Storage)
            if isinstance(incoming_host_photo, str) and incoming_host_photo.strip().startswith('data:'):
                pass  # ignore base64 for URL rendering; frontend should upload to storage and send URL
            else:
                host.host_image_url = incoming_host_photo

    # Guard: reject data URLs for cover_image_url
    cov = data.get('cover_image_url')
    if isinstance(cov, str) and cov.strip().startswith('data:'):
        # Ignore base64 in create to avoid memory spikes; rely on placeholder or uploaded URL
        data['cover_image_url'] = None

    # Find or create Property (update fields if it already exists)
    prop = Property.query.filter_by(name=data['property_name'], user_id=user_id).first()
    if not prop:
        prop = Property(
            name=data['property_name'],
            address_street=data.get('address_street'),
            address_city_state=data.get('address_city_state'),
            address_zip=data.get('address_zip'),
            user_id=user_id,
        )
        db.session.add(prop)
    else:
        # Update existing property details with latest values if provided
        if 'address_street' in data:
            prop.address_street = data.get('address_street')
        if 'address_city_state' in data:
            prop.address_city_state = data.get('address_city_state')
        if 'address_zip' in data:
            prop.address_zip = data.get('address_zip')

    # Build WiFi JSON from incoming data
    wifi_json = {}
    if data.get('wifi_network'):
        wifi_json['network'] = data.get('wifi_network')
    if data.get('wifi_password'):
        wifi_json['password'] = data.get('wifi_password')

    # Flush session to assign IDs to new host, prop before linking to guidebook
    db.session.flush()

    # Create Guidebook
    # Validate template key against canonical keys
    incoming_key = data.get('template_key')
    selected_template_key = incoming_key if incoming_key in ALLOWED_TEMPLATE_KEYS else 'template_original'
    # Validate included_tabs: allow base tabs + any keys starting with custom_
    # Updated to match new tabs used by the frontend
    base_tabs = {'welcome','checkin','property','food','activities','rules','checkout'}
    incoming_tabs = data.get('included_tabs')
    if not isinstance(incoming_tabs, list):
        incoming_tabs = list(base_tabs)
    included_tabs = []
    for t in incoming_tabs:
        if isinstance(t, str) and (t in base_tabs or t.startswith('custom_')):
            included_tabs.append(t)

    # Custom sections payload: map custom tab key -> list of strings
    custom_sections = {}
    if isinstance(data.get('custom_sections'), dict):
        for k, v in data.get('custom_sections', {}).items():
            if isinstance(k, str) and k.startswith('custom_'):
                # normalize to list of strings
                if isinstance(v, list):
                    custom_sections[k] = [str(x) for x in v if x is not None]

    # Custom tabs meta: map custom key -> { label, icon }
    custom_tabs_meta = {}
    if isinstance(data.get('custom_tabs_meta'), dict):
        for k, v in data.get('custom_tabs_meta', {}).items():
            if isinstance(k, str) and k.startswith('custom_') and isinstance(v, dict):
                label = _strip_surrogates(v.get('label')) if v.get('label') is not None else ''
                icon = _strip_surrogates(v.get('icon')) if v.get('icon') is not None else ''
                custom_tabs_meta[k] = {
                    'label': str(label) if label is not None else '',
                    'icon': str(icon) if icon is not None else ''
                }

    new_guidebook = Guidebook(
        check_in_time=data.get('check_in_time'),
        check_out_time=data.get('check_out_time'),
        access_info=data.get('access_info'),
        welcome_info=data.get('welcome_message'),
        parking_info=data.get('parking_info'),
        cover_image_url=data.get('cover_image_url'),
        safety_info=data.get('safety_info'),
        things_to_do=data.get('things_to_do'),
        places_to_eat=data.get('places_to_eat'),
        checkout_info=data.get('checkout_info'),
        house_manual=data.get('house_manual'),
        wifi_json=wifi_json if wifi_json else None,
        included_tabs=included_tabs,
        custom_sections=custom_sections,
        custom_tabs_meta=custom_tabs_meta if custom_tabs_meta else None,
        template_key=selected_template_key,
        host_id=host.id if host else None,
        property_id=prop.id,
        user_id=user_id,
    )
    db.session.add(new_guidebook)

    # Add Rules - store in new JSON format
    if 'rules' in data and data['rules']:
        rules_json = []
        for rule_text in data['rules']:
            if rule_text:
                # Convert to new format with name and empty description
                rules_json.append({"name": rule_text, "description": ""})
        new_guidebook.rules_json = rules_json if rules_json else None

    # Set lifecycle fields: Auto-activate if user has available slots
    new_guidebook.public_slug = None
    new_guidebook.active = False

    # Flush to ensure the object is persisted before checking for slug uniqueness
    db.session.flush()

    try:
        # Check if user can activate this guidebook (has available slots)
        can_activate, _ = can_activate_guidebook(user_id)
        if can_activate:
            # Activate and assign a unique public slug
            new_guidebook.active = True
            base = _slugify(getattr(prop, 'name', None) or 'guidebook')

            # Always start with a random suffix to avoid common name conflicts
            slug = f"{base}-{secrets.token_hex(3)}"

            # Ensure uniqueness - keep trying until we find a unique slug
            attempt = 0
            max_attempts = 20
            while True:
                # Check if slug exists (excluding current guidebook id)
                existing = db.session.execute(
                    text("SELECT 1 FROM guidebook WHERE public_slug = :s AND id != :gid LIMIT 1"),
                    {"s": slug, "gid": new_guidebook.id}
                ).fetchone()

                if not existing:
                    # Slug is unique, use it
                    break

                attempt += 1
                if attempt >= max_attempts:
                    # Fallback to guaranteed unique slug with timestamp
                    slug = f"{base}-{secrets.token_hex(4)}-{int(time.time())}"
                    log.warning(f"Using timestamp fallback slug after {max_attempts} attempts: {slug}")
                    break

                # Try another random suffix
                slug = f"{base}-{secrets.token_hex(3)}"

            new_guidebook.public_slug = slug
            log.info(f"Auto-activated guidebook {new_guidebook.id} with slug '{slug}' for user {user_id}")
        else:
            log.info(f"Guidebook {new_guidebook.id} created as draft for user {user_id} (no available slots)")
    except Exception as e:
        # fallback to preview mode
        log.warning(f"Failed to check activation eligibility: {e}", exc_info=True)
        pass

    db.session.commit()

    # Respond with identifiers and appropriate URL
    payload = {
        "ok": True,
        "guidebook_id": new_guidebook.id,
        "template_key": selected_template_key,
    }
    resp = jsonify(payload)

    # Return appropriate URLs based on active status
    if new_guidebook.active and new_guidebook.public_slug:
        # Active guidebook with public URL
        live_path = f"/g/{new_guidebook.public_slug}"
        resp.headers['X-Guidebook-Url'] = live_path
        resp.headers['Access-Control-Expose-Headers'] = 'X-Guidebook-Url'
    else:
        # Inactive guidebook - preview mode
        resp.headers['X-Guidebook-Url'] = f"/edit/{new_guidebook.id}"
        resp.headers['X-Guidebook-Preview'] = f"/preview/{new_guidebook.id}"
        resp.headers['Access-Control-Expose-Headers'] = 'X-Guidebook-Url, X-Guidebook-Preview'

    return resp, 201

# --- User-scoped Guidebooks API ---
@app.route('/api/guidebooks', methods=['GET'])
@require_auth
def list_guidebooks():
    # ... (rest of the function remains the same)
    q = Guidebook.query.filter_by(user_id=g.user_id).order_by(Guidebook.created_time.desc())
    items = [
        {
            "id": gb.id,
            "property_name": getattr(gb.property, 'name', None),
            "template_key": gb.template_key,
            "created_time": gb.created_time.isoformat() if gb.created_time else None,
            "last_modified_time": gb.last_modified_time.isoformat() if gb.last_modified_time else None,
            "cover_image_url": gb.cover_image_url,
            "active": gb.active,
            "public_slug": gb.public_slug if gb.active else None,
        }
        for gb in q.all()
    ]
    return jsonify({"ok": True, "items": items})

@app.route('/api/guidebooks/<guidebook_id>/publish', methods=['POST'])
@require_auth
def publish_guidebook(guidebook_id):
    """Render the selected template to a static HTML snapshot and store it.

    Returns: { ok: true, etag, published_at }
    """
    gb = Guidebook.query.get_or_404(guidebook_id)
    if gb.user_id != g.user_id:
        return jsonify({"error": "Not found"}), 404

    # Reuse the same context and template selection as live renderer, but produce HTML string only
    try:
        template_key = getattr(gb, 'template_key', None) or 'template_original'
        if template_key not in ALLOWED_TEMPLATE_KEYS:
            template_key = 'template_original'
        template_file = TEMPLATE_REGISTRY.get(template_key, TEMPLATE_REGISTRY['template_original'])

        base_tabs = ['welcome','checkin','property','food','activities','rules','checkout']
        included_tabs = getattr(gb, 'included_tabs', None) or base_tabs
        included_tabs = [t for t in included_tabs if (t in base_tabs) or (isinstance(t, str) and t.startswith('custom_'))]

        # Sanitize custom tabs meta
        safe_custom_tabs_meta = None
        meta = getattr(gb, 'custom_tabs_meta', None)
        if isinstance(meta, dict):
            safe_custom_tabs_meta = {}
            for k, v in meta.items():
                if isinstance(v, dict):
                    lbl = _strip_surrogates(str(v.get('label'))) if v.get('label') is not None else ''
                    ico = _strip_surrogates(str(v.get('icon'))) if v.get('icon') is not None else ''
                    safe_custom_tabs_meta[k] = {'label': lbl, 'icon': ico}

        PLACEHOLDER_COVER_URL = (
            "https://hojncqasasvvrhdmwwhv.supabase.co/storage/v1/object/public/my_images/home_placeholder.jpg"
        )

        ctx = {
            "schema_version": 1,
            "id": gb.id,
            "property_name": (getattr(gb.property, 'name', None) or 'My Guidebook'),
            "host": {
                "name": getattr(gb.host, 'name', None),
                "bio": getattr(gb.host, 'bio', None),
                "contact": getattr(gb.host, 'contact', None),
                "photo_url": getattr(gb.host, 'host_image_url', None),
            },
            "welcome_message": getattr(gb, 'welcome_info', None),
            "safety_info": getattr(gb, 'safety_info', {}) or {},
            "address": {
                "street": getattr(gb.property, 'address_street', None),
                "city_state": getattr(gb.property, 'address_city_state', None),
                "zip": getattr(gb.property, 'address_zip', None),
            },
            "wifi_json": getattr(gb, 'wifi_json', None) or {},
            "check_in_time": gb.check_in_time,
            "check_out_time": gb.check_out_time,
            "access_info": gb.access_info,
            "parking_info": gb.parking_info,
            # Use new JSON rules format if available, otherwise fallback to old Rule model
            "rules": (getattr(gb, 'rules_json', None) or [{"name": r.text, "description": ""} for r in gb.rules]) if hasattr(gb, 'rules') else [],
            "things_to_do": gb.things_to_do or [],
            "places_to_eat": gb.places_to_eat or [],
            "checkout_info": getattr(gb, 'checkout_info', None) or [],
            "house_manual": getattr(gb, 'house_manual', None) or [],
            "included_tabs": included_tabs,
            "custom_sections": getattr(gb, 'custom_sections', None) or {},
            "custom_tabs_meta": safe_custom_tabs_meta or (getattr(gb, 'custom_tabs_meta', None) or {}),
            "cover_image_url": (gb.cover_image_url or PLACEHOLDER_COVER_URL),
        }

        html = render_template(
            template_file,
            ctx=ctx,
            id=gb.id,
            host_name=getattr(gb.host, 'name', None),
            host_bio=getattr(gb.host, 'bio', None),
            host_contact=getattr(gb.host, 'contact', None),
            host_photo_url=getattr(gb.host, 'host_image_url', None),
            property_name=gb.property.name,
            check_in_time=gb.check_in_time,
            check_out_time=gb.check_out_time,
            address_street=gb.property.address_street,
            address_city_state=gb.property.address_city_state,
            address_zip=gb.property.address_zip,
            access_info=gb.access_info,
            welcome_message=getattr(gb, 'welcome_info', None),
            parking_info=getattr(gb, 'parking_info', None),
            # Use new JSON rules format if available, otherwise fallback to old Rule model
            rules=(getattr(gb, 'rules_json', None) or [{"name": r.text, "description": ""} for r in gb.rules]) if hasattr(gb, 'rules') else [],
            things_to_do=gb.things_to_do,
            places_to_eat=gb.places_to_eat,
            checkout_info=getattr(gb, 'checkout_info', None),
            house_manual=getattr(gb, 'house_manual', None),
            included_tabs=included_tabs,
            custom_sections=getattr(gb, 'custom_sections', None),
            custom_tabs_meta=safe_custom_tabs_meta,
            cover_image_url=gb.cover_image_url,
        )

        # Compute ETag and store snapshot
        etag = hashlib.sha256((gb.id + (template_key or '') + str(gb.last_modified_time) + str(len(html))).encode('utf-8')).hexdigest()
        gb.published_html = html
        gb.published_etag = etag
        gb.published_at = datetime.now(timezone.utc)

        # Persist and bump last_modified_time so downstream caches notice if needed
        try:
            db.session.execute(text("UPDATE guidebook SET last_modified_time = NOW() WHERE id = :id"), {"id": gb.id})
        except Exception:
            pass
        db.session.commit()
        return jsonify({"ok": True, "etag": etag, "published_at": gb.published_at.isoformat()})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"publish failed: {type(e).__name__}: {e}"}), 500

@app.route('/api/guidebooks/<guidebook_id>', methods=['GET'])
@require_auth
def get_guidebook(guidebook_id):
    gb = Guidebook.query.get_or_404(guidebook_id)
    if gb.user_id != g.user_id:
        return jsonify({"error": "Not found"}), 404
    # Minimal payload; extend as needed
    payload = {
        "id": gb.id,
        "template_key": gb.template_key,
        "property": {
            "id": gb.property_id,
            "name": getattr(gb.property, 'name', None),
            "address_street": getattr(gb.property, 'address_street', None),
            "address_city_state": getattr(gb.property, 'address_city_state', None),
            "address_zip": getattr(gb.property, 'address_zip', None),
        },
        "host": {
            "id": gb.host_id,
            "name": getattr(gb.host, 'name', None),
            "bio": getattr(gb.host, 'bio', None),
            "contact": getattr(gb.host, 'contact', None),
            "photo_url": getattr(gb.host, 'host_image_url', None),
        },
        "wifi_json": getattr(gb, 'wifi_json', None) or {},
        "included_tabs": gb.included_tabs,
        "custom_sections": gb.custom_sections,
        "custom_tabs_meta": gb.custom_tabs_meta,
        "things_to_do": gb.things_to_do,
        "places_to_eat": gb.places_to_eat,
        "rules": [r.text for r in gb.rules],
        "house_manual": getattr(gb, 'house_manual', None),
        "safety_info": getattr(gb, 'safety_info', None),
        # Additional fields used by Edit page
        "welcome_message": getattr(gb, 'welcome_info', None),
        "access_info": getattr(gb, 'access_info', None),
        "parking_info": getattr(gb, 'parking_info', None),
        "check_in_time": getattr(gb, 'check_in_time', None),
        "check_out_time": getattr(gb, 'check_out_time', None),
        "cover_image_url": getattr(gb, 'cover_image_url', None),
        "checkout_info": getattr(gb, 'checkout_info', None),
        "created_time": gb.created_time.isoformat() if gb.created_time else None,
        "last_modified_time": gb.last_modified_time.isoformat() if gb.last_modified_time else None,
    }
    return jsonify(payload)


@app.route('/api/guidebooks/<guidebook_id>', methods=['DELETE'])
@require_auth
def delete_guidebook(guidebook_id):
    """Delete a guidebook owned by the authenticated user."""
    gb = Guidebook.query.get_or_404(guidebook_id)

    # Enforce ownership: only the guidebook owner can delete
    if getattr(gb, 'user_id', None) != g.user_id:
        return jsonify({"error": "Not found"}), 404

    try:
        db.session.delete(gb)
        db.session.commit()
        return jsonify({"ok": True}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Delete failed: {type(e).__name__}: {e}"}), 500

@app.route('/api/guidebooks/<guidebook_id>', methods=['PUT', 'PATCH'])
@require_auth
def update_guidebook(guidebook_id):
    gb = Guidebook.query.get_or_404(guidebook_id)
    if gb.user_id != g.user_id:
        return jsonify({"error": "Not found"}), 404

    data = request.json or {}

    # Update primary guidebook fields if present
    field_map = {
        'check_in_time': 'check_in_time',
        'check_out_time': 'check_out_time',
        'access_info': 'access_info',
        'welcome_message': 'welcome_info',
        'parking_info': 'parking_info',
        'cover_image_url': 'cover_image_url',
        'things_to_do': 'things_to_do',
        'places_to_eat': 'places_to_eat',
        'checkout_info': 'checkout_info',
        'house_manual': 'house_manual',
        'included_tabs': 'included_tabs',
        'custom_sections': 'custom_sections',
        'custom_tabs_meta': 'custom_tabs_meta',
        'template_key': 'template_key',
    }
    # Guard: reject data URLs for cover_image_url
    cov = data.get('cover_image_url')
    if isinstance(cov, str) and cov.strip().startswith('data:'):
        data['cover_image_url'] = None

    for incoming, model_attr in field_map.items():
        if incoming in data:
            setattr(gb, model_attr, data.get(incoming))

    # safety_info: validate and persist explicitly (dict with optional keys)
    if 'safety_info' in data:
        si = data.get('safety_info') or {}
        if si is None:
            gb.safety_info = None
        elif isinstance(si, dict):
            try:
                emer = si.get('emergency_contact', None)
                fire = si.get('fire_extinguisher_location', None)
                # Normalize to strings or None
                emer_norm = (str(emer).strip() if emer is not None and str(emer).strip() != '' else None)
                fire_norm = (str(fire).strip() if fire is not None and str(fire).strip() != '' else None)
                gb.safety_info = {
                    'emergency_contact': emer_norm,
                    'fire_extinguisher_location': fire_norm,
                }
            except Exception:
                # Fallback: ignore malformed safety_info
                pass

    # Update or create related Host
    incoming_host_name = (data.get('host_name') or '').strip()
    incoming_host_bio = data.get('host_bio')
    incoming_host_contact = data.get('host_contact')
    incoming_host_photo = data.get('host_photo_url')
    if incoming_host_name or incoming_host_bio or incoming_host_photo:
        host = None
        if gb.host_id:
            host = Host.query.get(gb.host_id)
        if not host and incoming_host_name:
            host = Host.query.filter_by(name=incoming_host_name, user_id=g.user_id).first()
        if not host:
            host = Host(name=incoming_host_name or None, user_id=g.user_id)
            db.session.add(host)
            db.session.flush()
            gb.host_id = host.id
        if incoming_host_name:
            host.name = incoming_host_name
        if incoming_host_bio is not None:
            host.bio = incoming_host_bio
        if incoming_host_contact is not None:
            host.contact = incoming_host_contact
        if incoming_host_photo is not None:
            if isinstance(incoming_host_photo, str) and incoming_host_photo.strip().startswith('data:'):
                pass
            else:
                host.host_image_url = incoming_host_photo

    # Update or create related Property
    prop_name = data.get('property_name')
    addr_street = data.get('address_street')
    addr_city_state = data.get('address_city_state')
    addr_zip = data.get('address_zip')
    if any(v is not None for v in [prop_name, addr_street, addr_city_state, addr_zip]):
        prop = Property.query.get(gb.property_id) if gb.property_id else None
        if not prop:
            prop = Property(name=prop_name or None, user_id=g.user_id)
            db.session.add(prop)
            db.session.flush()
            gb.property_id = prop.id
        if prop_name is not None:
            prop.name = prop_name
        if addr_street is not None:
            prop.address_street = addr_street
        if addr_city_state is not None:
            prop.address_city_state = addr_city_state
        if addr_zip is not None:
            prop.address_zip = addr_zip

    # Update WiFi JSON
    wifi_network = data.get('wifi_network')
    wifi_password = data.get('wifi_password')
    if wifi_network is not None or wifi_password is not None:
        wifi_json = gb.wifi_json or {}
        if wifi_network is not None:
            wifi_json['network'] = wifi_network
        if wifi_password is not None:
            wifi_json['password'] = wifi_password
        gb.wifi_json = wifi_json if wifi_json else None

    # Replace Rules if provided - store in new JSON format
    if 'rules' in data and isinstance(data.get('rules'), list):
        rules_json = []
        for rule_text in data.get('rules'):
            if rule_text:
                rules_json.append({"name": rule_text, "description": ""})
        gb.rules_json = rules_json if rules_json else None

        # Also clear old Rule model entries for consistency (will be deprecated)
        for r in list(gb.rules):
            db.session.delete(r)

    # Update last_modified_time
    try:
        db.session.execute(text("UPDATE guidebook SET last_modified_time = NOW() WHERE id = :id"), {"id": gb.id})
    except Exception:
        pass

    db.session.commit()

    return jsonify({"ok": True, "guidebook_id": gb.id})

def run_startup_migrations():
    """Add missing columns if they don't already exist (Postgres)."""
    stmts = [
        "ALTER TABLE host ADD COLUMN IF NOT EXISTS bio TEXT;",
        "ALTER TABLE host ADD COLUMN IF NOT EXISTS contact TEXT;",
        "ALTER TABLE host DROP COLUMN IF EXISTS host_image_base64;",
        "ALTER TABLE host ADD COLUMN IF NOT EXISTS host_image_url TEXT;",
        "ALTER TABLE guidebook ADD COLUMN IF NOT EXISTS welcome_info TEXT;",
        "ALTER TABLE guidebook ADD COLUMN IF NOT EXISTS parking_info TEXT;",
        "ALTER TABLE guidebook ADD COLUMN IF NOT EXISTS safety_info JSON;",
        "ALTER TABLE guidebook ADD COLUMN IF NOT EXISTS checkout_info JSON;",
        "ALTER TABLE guidebook ADD COLUMN IF NOT EXISTS house_manual JSON;",
        "ALTER TABLE guidebook ADD COLUMN IF NOT EXISTS included_tabs JSON;",
        "ALTER TABLE guidebook ADD COLUMN IF NOT EXISTS custom_sections JSON;",
        "ALTER TABLE guidebook ADD COLUMN IF NOT EXISTS custom_tabs_meta JSON;",
        "ALTER TABLE guidebook ADD COLUMN IF NOT EXISTS rules_json JSON;",
        "ALTER TABLE guidebook ADD COLUMN IF NOT EXISTS wifi_json JSON;",
        # Lifecycle fields (simplified for preview mode)
        "ALTER TABLE guidebook ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT FALSE;",
        "ALTER TABLE guidebook ADD COLUMN IF NOT EXISTS public_slug TEXT;",
        # Remove old trial/claim fields
        "ALTER TABLE guidebook DROP COLUMN IF EXISTS claim_token;",
        "ALTER TABLE guidebook DROP COLUMN IF EXISTS claimed_at;",
        "ALTER TABLE guidebook DROP COLUMN IF EXISTS expires_at;",
        # Drop old index if exists
        "DROP INDEX IF EXISTS ux_guidebook_claim_token;",
        # Unique index for public_slug
        "CREATE UNIQUE INDEX IF NOT EXISTS ux_guidebook_public_slug ON guidebook (public_slug);",
        # Timestamps
        "ALTER TABLE guidebook ADD COLUMN IF NOT EXISTS created_time TIMESTAMPTZ DEFAULT NOW();",
        "ALTER TABLE guidebook ADD COLUMN IF NOT EXISTS last_modified_time TIMESTAMPTZ DEFAULT NOW();",
        # Snapshot columns
        "ALTER TABLE guidebook ADD COLUMN IF NOT EXISTS published_html TEXT;",
        "ALTER TABLE guidebook ADD COLUMN IF NOT EXISTS published_etag TEXT;",
        "ALTER TABLE guidebook ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;",
        # Profiles - add guidebook_limit, remove old extra_slots
        "ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS guidebook_limit INTEGER;",
        "ALTER TABLE public.profiles DROP COLUMN IF EXISTS extra_slots;",
        # Profiles - add Stripe tracking columns
        "ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;",
        "ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;",
        "ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pro_starts_at TIMESTAMPTZ;",
        # Add indexes for faster Stripe lookups
        "CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer ON public.profiles(stripe_customer_id);",
        "CREATE INDEX IF NOT EXISTS idx_profiles_stripe_subscription ON public.profiles(stripe_subscription_id);",
        # Update plan check constraint to allow new plan tiers
        "ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_plan_check;",
        "ALTER TABLE public.profiles ADD CONSTRAINT profiles_plan_check CHECK (plan IN ('trial', 'free', 'starter', 'growth', 'pro', 'enterprise'));",
        # Make host name and guidebook.host_id optional
        "ALTER TABLE host ALTER COLUMN name DROP NOT NULL;",
        "ALTER TABLE guidebook ALTER COLUMN host_id DROP NOT NULL;",
    ]
    for s in stmts:
        try:
            db.session.execute(text(s))
            db.session.commit()
        except Exception as e:
            # Log and continue so the app still boots
            print(f"Migration statement failed or already applied: {s} => {e}")

with app.app_context():
    db.create_all() # Create tables if they don't exist
    run_startup_migrations()


# (Removed) Claim endpoint deprecated: anonymous creation is no longer supported.


@app.route('/api/maintenance/cleanup-expired', methods=['POST'])
def cleanup_expired():
    """Delete expired, unclaimed guidebooks. Secure with CLEANUP_SECRET header.

    Criteria: active = false AND claimed_at IS NULL AND expires_at < now().
    """
    if not CLN_SECRET:
        return jsonify({"error": "CLEANUP_SECRET not configured"}), 501
    supplied = request.headers.get('X-Cleanup-Secret')
    if supplied != CLN_SECRET:
        return jsonify({"error": "Unauthorized"}), 401
    now_utc = datetime.now(timezone.utc)
    # Find candidates
    q = Guidebook.query.filter(
        Guidebook.active.is_(False),
        Guidebook.claimed_at.is_(None),
        Guidebook.expires_at.isnot(None),
        Guidebook.expires_at < now_utc,
    )
    count = 0
    for gb in q.all():
        db.session.delete(gb)
        count += 1
    db.session.commit()
    return jsonify({"ok": True, "deleted": count})

@app.route('/api/ai-recommendations', methods=['POST'])
def ai_recommendations_route():
    """
    Generic AI recommendations endpoint.
    Supports multiple recommendation types: food, activities, nightlife, etc.

    POST body:
    {
        "type": "food" | "activities" | "nightlife",
        "location": "address string",
        "num_items": 5  # optional, defaults to 5
    }
    """
    data = request.json
    recommendation_type = data.get('type')
    address = data.get('location') or data.get('address')
    num_items = data.get('num_items', 5)

    if not recommendation_type:
        return jsonify({"error": "Please provide a recommendation type (food, activities, nightlife, etc.)"}), 400

    if not address or not str(address).strip():
        return jsonify({"error": "Please provide a valid location to generate recommendations."}), 400

    try:
        recs = get_ai_recommendations(recommendation_type, address, num_items)
        return jsonify(recs or [])
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": "Could not get recommendations"}), 500

@app.route('/api/ai-food', methods=['POST'])
def ai_food_route():
    """Legacy endpoint for food recommendations. Use /api/ai-recommendations instead."""
    data = request.json
    address = data.get('location') or data.get('address')
    num_places_to_eat = data.get('num_places_to_eat', 5)
    if not address or not str(address).strip():
        return jsonify({"error": "Please provide a valid location to generate recommendations."}), 400
    recs = get_ai_food_recommendations(address, num_places_to_eat)
    return jsonify(recs or {"error": "Could not get recommendations"})

@app.route('/api/ai-activities', methods=['POST'])
def ai_activities_route():
    """Legacy endpoint for activity recommendations. Use /api/ai-recommendations instead."""
    data = request.json
    address = data.get('location') or data.get('address')
    num_things_to_do = data.get('num_things_to_do', 5)
    if not address or not str(address).strip():
        return jsonify({"error": "Please provide a valid location to generate recommendations."}), 400
    recs = get_ai_activity_recommendations(address, num_things_to_do)
    return jsonify(recs or {"error": "Could not get recommendations"})

@app.route('/api/place-photo', methods=['GET'])
def get_place_photo():
    """Proxy endpoint to serve Google Places photos and bypass CORS restrictions."""
    photo_reference = request.args.get('photo_reference')
    maxwidth = request.args.get('maxwidth', 800)
    
    if not photo_reference:
        return jsonify({"error": "photo_reference required"}), 400
    
    try:
        photo_url = google_places_photo_url(photo_reference, maxwidth=int(maxwidth))
        resp = requests.get(photo_url, timeout=10)
        resp.raise_for_status()
        
        # Return image with proper CORS headers
        image_resp = make_response(resp.content)
        image_resp.headers['Content-Type'] = resp.headers.get('Content-Type', 'image/jpeg')
        image_resp.headers['Cache-Control'] = 'public, max-age=86400'  # Cache for 24 hours
        image_resp.headers['Access-Control-Allow-Origin'] = '*'
        return image_resp
    except Exception as e:
        return jsonify({"error": f"Failed to fetch photo: {str(e)}"}), 500

@app.route('/api/guidebook/<guidebook_id>/template', methods=['POST'])
def update_template_key(guidebook_id):
    gb = Guidebook.query.get_or_404(guidebook_id)
    body = request.json or {}
    new_key = body.get('template_key')
    if new_key not in ALLOWED_TEMPLATE_KEYS:
        return jsonify({"error": "Invalid template_key", "allowed": list(ALLOWED_TEMPLATE_KEYS)}), 400
    gb.template_key = new_key
    # Bump last_modified_time to invalidate ETags and caches
    try:
        from datetime import datetime, timezone
        gb.last_modified_time = datetime.now(timezone.utc)
    except Exception:
        pass
    db.session.commit()
    # Clear any cached renders for this guidebook (any template)
    try:
        gid_prefix = f"{gb.id}:"
        keys_to_delete = [k for k in list(RENDER_CACHE.keys()) if k.startswith(gid_prefix)]
        for k in keys_to_delete:
            RENDER_CACHE.pop(k, None)
    except Exception:
        pass
    return jsonify({"ok": True, "template_key": gb.template_key})

@app.route('/api/guidebooks/<guidebook_id>/toggle', methods=['POST'])
@require_auth
def toggle_guidebook(guidebook_id):
    """Toggle guidebook active state (publish/unpublish)."""
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
            property_name = getattr(gb.property, 'name', None) if gb.property else None
            slug_base = _slugify(property_name or 'guidebook')
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

@app.route('/api/places/search', methods=['POST'])
def places_search():
    """Proxy Google Places Text Search. Returns minimal normalized items.
    Body: { "query": string, "near": string|null }
    Response: { items: [ { name, address, place_id } ] }
    """
    data = request.json or {}
    query = (data.get('query') or '').strip()
    near = (data.get('near') or '').strip()
    if not query:
        return jsonify({"error": "query is required"}), 400
    try:
        resp = google_places_text_search(query, location=near or None)
        items = []
        for r in resp.get('results', [])[:8]:
            items.append({
                'name': r.get('name') or '',
                'address': r.get('formatted_address') or '',
                'place_id': r.get('place_id') or '',
            })
        return jsonify({ 'items': items })
    except Exception as e:
        log.error("places_search error: %s: %s", type(e).__name__, e)
        return jsonify({"error": "Failed to search places"}), 502

@app.route('/api/places/enrich', methods=['GET'])
def places_enrich():
    """Given a place_id, return a DynamicItem-like normalized object.
    Response: { name, address, description, image_url }
    """
    place_id = (request.args.get('place_id') or '').strip()
    if not place_id:
        return jsonify({"error": "place_id is required"}), 400
    try:
        det = google_places_details(place_id)
        result = det.get('result') or {}
        name = result.get('name') or ''
        address = result.get('formatted_address') or ''
        website = result.get('website') or ''
        rating = result.get('rating')
        types = result.get('types') or []
        parts = []
        if rating is not None:
            parts.append(f"Rating {rating}")
        if types:
            parts.append((types[0] or '').replace('_', ' ').title())
        if website:
            parts.append(website)
        description = ' • '.join([p for p in parts if p])
        image_url = ''
        photos = result.get('photos') or []
        if photos:
            ref = (photos[0] or {}).get('photo_reference')
            if ref:
                # Return the raw photo_reference so the frontend can call our
                # /api/place-photo proxy endpoint to bypass browser CORS.
                # The frontend expects a non-http string here and will proxy it.
                image_url = ref
        return jsonify({
            'name': name,
            'address': address,
            'description': description,
            'image_url': image_url,
        })
    except Exception as e:
        log.error("places_enrich error: %s: %s", type(e).__name__, e)
        return jsonify({"error": "Failed to enrich place"}), 502

# In-memory cache for generated PDFs for the lifetime of the process
PDF_CACHE = {}
PRINT_PDF_CACHE = {}

def _pdf_cache_key(guidebook: Guidebook, template_key: str) -> str:
    # Use id + template; include last_modified_time when available for better busting
    ts = getattr(guidebook, 'last_modified_time', None)
    ts_val = str(ts.timestamp()) if hasattr(ts, 'timestamp') else str(ts)
    return f"{guidebook.id}:{template_key}:{ts_val}"

@app.route('/api/guidebook/<guidebook_id>/pdf', methods=['GET'])
def get_pdf_on_demand(guidebook_id):
    gb = Guidebook.query.get_or_404(guidebook_id)
    requested_template = request.args.get('template')
    want_download = str(request.args.get('download', '0')).lower() in ('1', 'true', 'yes')
    include_qr = str(request.args.get('include_qr', '0')).lower() in ('1', 'true', 'yes')
    qr_url_param = request.args.get('qr_url') if include_qr else None
    # Choose a valid PDF template: prefer explicit request; otherwise default to PDF original
    # Note: URL template keys are distinct and not used for PDFs.
    if requested_template in ALLOWED_PDF_TEMPLATE_KEYS:
        chosen_template = requested_template
    else:
        chosen_template = 'template_pdf_original'

    # Incorporate QR params into cache key so variants don't collide
    cache_key = _pdf_cache_key(gb, chosen_template)
    if include_qr and qr_url_param:
        try:
            qh = hashlib.sha256(qr_url_param.encode('utf-8')).hexdigest()[:12]
        except Exception:
            qh = 'qr'
        cache_key = f"{cache_key}:qr:{qh}"
    etag = hashlib.sha256(cache_key.encode('utf-8')).hexdigest()
    if request.headers.get('If-None-Match') == etag:
        resp = make_response('', 304)
        resp.headers['ETag'] = etag
        return resp

    cached = PDF_CACHE.get(cache_key)
    if cached:
        resp = send_file(
            io.BytesIO(cached),
            mimetype='application/pdf',
            as_attachment=want_download,
            download_name='guidebook.pdf'
        )
        resp.headers['ETag'] = etag
        resp.headers['Cache-Control'] = 'public, max-age=3600'
        try:
            resp.headers['X-PDF-Template-Key'] = chosen_template
        except Exception:
            pass
        return resp

    # Generate PDF lazily. If the generator reads gb.template_key, temporarily override.
    original_template = getattr(gb, 'template_key', None)
    try:
        gb.template_key = chosen_template
        pdf_bytes = pdf_generator.create_guidebook_pdf(gb, qr_url=qr_url_param)
    finally:
        gb.template_key = original_template

    PDF_CACHE[cache_key] = pdf_bytes
    resp = send_file(
        io.BytesIO(pdf_bytes),
        mimetype='application/pdf',
        as_attachment=want_download,
        download_name='guidebook.pdf'
    )
    resp.headers['ETag'] = etag
    resp.headers['Cache-Control'] = 'public, max-age=3600'
    try:
        resp.headers['X-PDF-Template-Key'] = chosen_template
    except Exception:
        pass
    return resp

@app.route('/api/guidebooks/activate_for_user', methods=['POST'])
@require_auth
def activate_guidebooks_for_user():
    """Apply activation policy for the authenticated user if their plan is pro.

    Returns: { ok: true, allowed, active_set, deactivated } or 400 if not pro.
    """
    uid = g.user_id
    # Check plan from public.profiles
    try:
        row = db.session.execute(text("SELECT plan FROM public.profiles WHERE user_id = :uid"), {"uid": uid}).fetchone()
        if not row or (row[0] or 'free') != 'pro':
            return jsonify({"error": "Account is not Pro"}), 400
        # Enforce slot capacity
        result = _apply_activation_policy(uid)
        return jsonify({"ok": True, **{k:int(v) for k,v in result.items()}})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Activation failed: {type(e).__name__}: {e}"}), 500

@app.route('/api/guidebook/<guidebook_id>/print-pdf', methods=['GET'])
def get_print_pdf(guidebook_id):
    """Generate print-ready PDF from web template (welcomebook).

    This uses the same template as the web version with print CSS applied.
    Perfect for creating physical guidebooks or binders.

    Query params:
        - download: Set to '1' or 'true' to force download instead of inline display
    """
    gb = Guidebook.query.get_or_404(guidebook_id)
    want_download = str(request.args.get('download', '1')).lower() in ('1', 'true', 'yes')

    # Cache key includes template and last modified time
    cache_key = _pdf_cache_key(gb, getattr(gb, 'template_key', 'template_welcomebook') + '_print')
    etag = hashlib.sha256(cache_key.encode('utf-8')).hexdigest()

    # Check if client has cached version
    if request.headers.get('If-None-Match') == etag:
        resp = make_response('', 304)
        resp.headers['ETag'] = etag
        return resp

    # Check server cache
    cached = PRINT_PDF_CACHE.get(cache_key)
    if cached:
        resp = send_file(
            io.BytesIO(cached),
            mimetype='application/pdf',
            as_attachment=want_download,
            download_name=f"{getattr(gb.property, 'name', 'guidebook') if hasattr(gb, 'property') else 'guidebook'}_print.pdf"
        )
        resp.headers['ETag'] = etag
        resp.headers['Cache-Control'] = 'public, max-age=3600'
        resp.headers['X-PDF-Type'] = 'print'
        return resp

    # Generate PDF from web template
    try:
        pdf_bytes = pdf_generator.create_print_pdf_from_web_template(gb)
    except Exception as e:
        log.error(f"Failed to generate print PDF: {type(e).__name__}: {e}")
        return jsonify({"error": "Failed to generate print PDF"}), 500

    # Cache the generated PDF
    PRINT_PDF_CACHE[cache_key] = pdf_bytes

    # Return PDF
    property_name = getattr(gb.property, 'name', 'guidebook') if hasattr(gb, 'property') else 'guidebook'
    safe_filename = property_name.replace(' ', '_').replace('/', '_')

    resp = send_file(
        io.BytesIO(pdf_bytes),
        mimetype='application/pdf',
        as_attachment=want_download,
        download_name=f"{safe_filename}_print.pdf"
    )
    resp.headers['ETag'] = etag
    resp.headers['Cache-Control'] = 'public, max-age=3600'
    resp.headers['X-PDF-Type'] = 'print'

    return resp

if __name__ == '__main__':
    app.run(debug=True, port=5001)
