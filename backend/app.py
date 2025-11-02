from flask import Flask, request, send_file, jsonify, render_template, make_response, g, abort
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text
from sqlalchemy.orm import joinedload
import main as pdf_generator
import io
import secrets
import re
from datetime import datetime, timedelta, timezone
import hashlib
from dotenv import load_dotenv
import os
import functools
import logging
import json
import requests

# JWT/JWKS for Supabase auth verification
import jwt
from jwt import PyJWKClient
import stripe

# Import db and models from models.py
from models import db, Guidebook, Host, Property, Wifi, Rule
from utils.ai_food import get_ai_food_recommendations
from utils.ai_activities import get_ai_activity_recommendations
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
STRIPE_PRICE_ID = os.environ.get('STRIPE_PRICE_ID')  # recurring price for Pro plan
STRIPE_ADDON_PRICE_ID = os.environ.get('STRIPE_ADDON_PRICE_ID')  # $3/mo add-on per extra guidebook slot
STRIPE_WEBHOOK_SECRET = os.environ.get('STRIPE_WEBHOOK_SECRET')
FRONTEND_ORIGIN = os.environ.get('FRONTEND_ORIGIN', 'http://localhost:3000')
STRIPE_PORTAL_CONFIGURATION_ID = os.environ.get('STRIPE_PORTAL_CONFIGURATION_ID')  # optional pc_... id

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

def _profiles_upsert_plan(user_id: str, plan: str):
    try:
        db.session.execute(
            text(
                """
                insert into public.profiles (user_id, plan)
                values (:uid, :plan)
                on conflict (user_id) do update set plan = EXCLUDED.plan
                """
            ),
            {"uid": user_id, "plan": plan},
        )
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise

def _apply_activation_policy(user_id: str) -> dict:
    """Ensure only the allowed number of guidebooks are active for the user.
    Allowed = 0 if free, else 1 + extra_slots for pro.
    Returns a dict with counts { allowed, active_set, deactivated }.
    """
    try:
        row = db.session.execute(
            text("SELECT COALESCE(plan, 'free') AS plan, COALESCE(extra_slots, 0) AS extra FROM public.profiles WHERE user_id = :uid"),
            {"uid": user_id},
        ).fetchone()
        plan = (row[0] if row else 'free')
        extra = int(row[1] if row else 0)
        allowed = 0 if plan != 'pro' else (1 + max(0, extra))

        # Order guidebooks by most recently modified/created first
        ids = [r[0] for r in db.session.execute(
            text(
                """
                SELECT id
                FROM guidebook
                WHERE user_id = :uid
                ORDER BY COALESCE(last_modified_time, created_time) DESC NULLS LAST
                """
            ),
            {"uid": user_id},
        ).fetchall()]

        to_activate = set(ids[:allowed]) if allowed > 0 else set()
        to_deactivate = set(ids[allowed:]) if ids else set()

        # Deactivate those beyond capacity
        if to_deactivate:
            db.session.execute(
                text("UPDATE guidebook SET active = FALSE WHERE user_id = :uid AND id = ANY(:ids)"),
                {"uid": user_id, "ids": list(to_deactivate)},
            )
        # Activate up to capacity
        if to_activate:
            db.session.execute(
                text("UPDATE guidebook SET active = TRUE WHERE user_id = :uid AND id = ANY(:ids)"),
                {"uid": user_id, "ids": list(to_activate)},
            )
        db.session.commit()
        return {"allowed": allowed, "active_set": len(to_activate), "deactivated": len(to_deactivate)}
    except Exception:
        db.session.rollback()
        raise

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
    if not stripe.api_key or not STRIPE_PRICE_ID:
        return jsonify({"error": "Stripe not configured"}), 500
    # Identify the user via Supabase auth
    user_id = g.user_id
    email = getattr(g, 'user_email', None) or (request.json.get('email') if isinstance(request.json, dict) else None)
    try:
        # Guard: if already Pro in our DB, don't allow creating another Pro subscription
        try:
            row = db.session.execute(text("SELECT plan FROM public.profiles WHERE user_id = :uid"), {"uid": user_id}).fetchone()
            if row and (row[0] or 'free') == 'pro':
                return jsonify({"error": "Account already Pro", "redirect": "billing"}), 409
        except Exception:
            pass

        # Optional extra guard: if Stripe shows an active/trialing sub for this email, block duplicate
        try:
            if email:
                customers = stripe.Customer.list(email=email, limit=1)
                if customers.data:
                    subs = stripe.Subscription.list(customer=customers.data[0].id, status='all', limit=10)
                    for s in subs.auto_paging_iter():
                        if getattr(s, 'status', None) in ('active', 'trialing'):
                            return jsonify({"error": "An active subscription already exists", "redirect": "billing"}), 409
        except Exception:
            pass

        session = stripe.checkout.Session.create(
            mode='subscription',
            customer_email=email,
            line_items=[{"price": STRIPE_PRICE_ID, "quantity": 1}],
            success_url=f"{FRONTEND_ORIGIN}/upgrade?success=1",
            cancel_url=f"{FRONTEND_ORIGIN}/upgrade?canceled=1",
            allow_promotion_codes=True,
            metadata={"user_id": user_id},
        )
        return jsonify({"url": session.url})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/billing/create-addon-session', methods=['POST'])
@require_auth
def create_addon_session():
    """Create a Stripe Checkout session for an additional guidebook slot.
    Requires STRIPE_ADDON_PRICE_ID to be configured.
    """
    if not stripe.api_key or not STRIPE_ADDON_PRICE_ID:
        return jsonify({"error": "Stripe add-on not configured"}), 500
    user_id = g.user_id
    email = getattr(g, 'user_email', None) or (request.json.get('email') if isinstance(request.json, dict) else None)
    try:
        # Require Pro plan to buy add-ons
        row = db.session.execute(text("SELECT plan FROM public.profiles WHERE user_id = :uid"), {"uid": user_id}).fetchone()
        if not row or (row[0] or 'free') != 'pro':
            return jsonify({"error": "Add-ons require an active Pro plan"}), 400
        session = stripe.checkout.Session.create(
            mode='subscription',
            customer_email=email,
            line_items=[{"price": STRIPE_ADDON_PRICE_ID, "quantity": 1}],
            success_url=f"{FRONTEND_ORIGIN}/dashboard?success_addon=1",
            cancel_url=f"{FRONTEND_ORIGIN}/dashboard?canceled_addon=1",
            allow_promotion_codes=True,
            metadata={"user_id": user_id, "kind": "addon"},
        )
        return jsonify({"url": session.url})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/billing/summary', methods=['GET'])
@require_auth
def billing_summary():
    """Return a summary of the user's billing state from Stripe and the database.

    Response shape:
      {
        plan: 'free'|'pro',
        stripe: {
          customer_id: str|null,
          subscription: { id, status, current_period_end }|null,
          upcoming_invoice: { amount_due, next_payment_attempt, lines }|null,
          invoices: [ { id, status, paid, amount_paid, created, hosted_invoice_url } ]
        }
      }
    """
    # Read plan from DB first (cheap & fast)
    try:
        row = db.session.execute(text("SELECT plan FROM public.profiles WHERE user_id = :uid"), {"uid": g.user_id}).fetchone()
        plan_val = (row[0] if row and row[0] else 'free')
    except Exception:
        plan_val = 'free'

    out = {
        'plan': plan_val,
        'stripe': {
            'customer_id': None,
            'subscription': None,
            'upcoming_invoice': None,
            'invoices': [],
        },
        'extra_slots': 0,
    }

    if not stripe.api_key:
        return jsonify(out)

    email = getattr(g, 'user_email', None)
    if not email:
        return jsonify(out)

    try:
        customers = stripe.Customer.list(email=email, limit=1)
        if not customers.data:
            return jsonify(out)
        customer = customers.data[0]
        out['stripe']['customer_id'] = customer.id

        # Find the most relevant subscription (prefer active/trialing)
        sub_obj = None
        subs = stripe.Subscription.list(customer=customer.id, status='all', limit=10)
        for s in subs.auto_paging_iter():
            if getattr(s, 'status', None) in ('active', 'trialing'):
                sub_obj = s
                break
        if not sub_obj:
            # fallback to most recent by created
            subs_all = list(subs.data)
            if subs_all:
                sub_obj = sorted(subs_all, key=lambda x: getattr(x, 'created', 0), reverse=True)[0]
        if sub_obj:
            out['stripe']['subscription'] = {
                'id': sub_obj.id,
                'status': getattr(sub_obj, 'status', None),
                'current_period_end': getattr(sub_obj, 'current_period_end', None),
            }
            # Compute extra_slots from subscription items matching STRIPE_ADDON_PRICE_ID
            try:
                if STRIPE_ADDON_PRICE_ID:
                    total_addons = 0
                    for it in getattr(sub_obj, 'items', {}).get('data', []) or []:
                        price = getattr(it, 'price', None)
                        if price and getattr(price, 'id', None) == STRIPE_ADDON_PRICE_ID:
                            q = getattr(it, 'quantity', 0) or 0
                            total_addons += int(q)
                    out['extra_slots'] = total_addons
            except Exception:
                pass

        # Recent invoices (also used for upcoming fallback)
        invs = stripe.Invoice.list(customer=customer.id, limit=12)
        items = []
        for inv in invs.auto_paging_iter():
            items.append({
                'id': inv.id,
                'status': getattr(inv, 'status', None),
                'paid': getattr(inv, 'paid', None),
                'amount_paid': getattr(inv, 'amount_paid', None),
                'amount_due': getattr(inv, 'amount_due', None),
                'created': getattr(inv, 'created', None),
                'currency': getattr(inv, 'currency', None),
                'hosted_invoice_url': getattr(inv, 'hosted_invoice_url', None),
            })
        out['stripe']['invoices'] = items

        # Upcoming invoice (safe to try; may not exist if no active subscription or right after creation)
        try:
            up = None
            if sub_obj:
                up = stripe.Invoice.upcoming(customer=customer.id, subscription=sub_obj.id)
            else:
                up = stripe.Invoice.upcoming(customer=customer.id)
            if up:
                out['stripe']['upcoming_invoice'] = {
                    'amount_due': getattr(up, 'amount_due', None),
                    'next_payment_attempt': getattr(up, 'next_payment_attempt', None),
                    'currency': getattr(up, 'currency', None),
                }
        except Exception:
            pass

        # Note: If Stripe hasn't generated an upcoming invoice yet (e.g., just after signup
        # or when the current invoice was immediately created/paid), this section may remain null.
    except Exception as e:
        # Non-fatal; return what we have
        try:
            out['error'] = str(e)
        except Exception:
            pass
    return jsonify(out)

@app.route('/api/billing/refresh-plan', methods=['POST'])
@require_auth
def refresh_plan_from_stripe():
    """Manually sync the authenticated user's plan from Stripe.

    Used primarily in development when Stripe webhooks cannot reach the local server.
    Logic:
      - Find Stripe customer by the authenticated user's email
      - Look up subscriptions and determine if any is active/trialing
      - Upsert public.profiles(plan) accordingly and, if pro, activate guidebooks
    Returns: { ok: true, plan: 'pro'|'free' }
    """
    if not stripe.api_key:
        return jsonify({"error": "Stripe not configured"}), 500
    email = getattr(g, 'user_email', None)
    if not email:
        return jsonify({"error": "User email unknown; cannot match Stripe customer"}), 400
    try:
        customers = stripe.Customer.list(email=email, limit=1)
        if not customers.data:
            return jsonify({"error": "No Stripe customer found for this email"}), 404
        customer_id = customers.data[0].id
        # Fetch subscriptions for this customer
        subs = stripe.Subscription.list(customer=customer_id, status='all', limit=10)
        plan = 'free'
        for s in subs.auto_paging_iter():
            status = getattr(s, 'status', None)
            if status in ('active', 'trialing'):
                plan = 'pro'
                break
        _profiles_upsert_plan(g.user_id, plan)
        if plan == 'pro':
            try:
                _activate_all_user_guidebooks(g.user_id)
            except Exception:
                pass
        return jsonify({"ok": True, "plan": plan})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

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
            'return_url': f"{FRONTEND_ORIGIN}/dashboard/profile",
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
    event = None
    try:
        if STRIPE_WEBHOOK_SECRET:
            event = stripe.Webhook.construct_event(payload=payload, sig_header=sig_header, secret=STRIPE_WEBHOOK_SECRET)
        else:
            event = stripe.Event.construct_from(json.loads(payload), stripe.api_key)
    except Exception as e:
        return jsonify({"error": f"Webhook error: {e}"}), 400

    # Handle events that imply subscription state changes
    try:
        type_ = event['type']
        obj = event['data']['object']
        if type_ == 'checkout.session.completed':
            # Mark user pro and activate
            user_id = (obj.get('metadata') or {}).get('user_id')
            if user_id:
                _profiles_upsert_plan(user_id, 'pro')
                _apply_activation_policy(user_id)
        elif type_ in ('customer.subscription.created', 'customer.subscription.updated'):
            status = obj.get('status')
            # subscription object may have metadata.user_id if set by you; fallback unknown
            user_id = (obj.get('metadata') or {}).get('user_id')
            # If we cannot map user_id, we skip; future enhancement: store mapping
            if user_id:
                if status in ('active', 'trialing'):
                    _profiles_upsert_plan(user_id, 'pro')
                    # Update extra_slots based on items matching STRIPE_ADDON_PRICE_ID
                    try:
                        if STRIPE_ADDON_PRICE_ID:
                            total_addons = 0
                            for it in (obj.get('items') or {}).get('data', []) or []:
                                price = (it.get('price') or {})
                                if price.get('id') == STRIPE_ADDON_PRICE_ID:
                                    q = int(it.get('quantity') or 0)
                                    total_addons += q
                            db.session.execute(
                                text("insert into public.profiles (user_id, plan, extra_slots) values (:uid, 'pro', :n) on conflict (user_id) do update set extra_slots = EXCLUDED.extra_slots"),
                                {"uid": user_id, "n": int(total_addons)}
                            )
                            db.session.commit()
                    except Exception:
                        pass
                    _apply_activation_policy(user_id)
                elif status in ('canceled', 'unpaid', 'incomplete_expired'):
                    _profiles_upsert_plan(user_id, 'free')
                    _deactivate_all_user_guidebooks(user_id)
        elif type_ == 'customer.subscription.deleted':
            user_id = (obj.get('metadata') or {}).get('user_id')
            if user_id:
                _profiles_upsert_plan(user_id, 'free')
                _deactivate_all_user_guidebooks(user_id)
    except Exception:
        # Do not fail webhook processing for partial issues
        pass
    return jsonify({"ok": True})

def _activate_all_user_guidebooks(user_id: str):
    try:
        db.session.execute(
            text("update guidebook set active = true where user_id = :uid and active = false"),
            {"uid": user_id},
        )
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise

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
}
ALLOWED_TEMPLATE_KEYS = set(TEMPLATE_REGISTRY.keys())
# Allowed PDF template keys (canonical)
ALLOWED_PDF_TEMPLATE_KEYS = {"template_pdf_original", "template_pdf_basic", "template_pdf_mobile", "template_pdf_qr"}

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

def _render_guidebook(gb: Guidebook):
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
    cache_key = _render_cache_key(gb, template_key, template_file)
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
            "wifi": {
                "network": getattr(g.wifi, 'network', None) if g.wifi else None,
                "password": getattr(g.wifi, 'password', None) if g.wifi else None,
            },
            "check_in_time": g.check_in_time,
            "check_out_time": g.check_out_time,
            "access_info": g.access_info,
            "parking_info": g.parking_info,
            "rules": [r.text for r in g.rules],
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

    html = render_template(
        TEMPLATE_REGISTRY.get(template_key, TEMPLATE_REGISTRY['template_original']),
        ctx=ctx,
        id=gb.id,
        host_name=getattr(gb.host, 'name', None),
        host_bio=getattr(gb.host, 'bio', None),
        host_contact=getattr(gb.host, 'contact', None),
        host_photo_url=getattr(gb.host, 'host_image_url', None),
        property_name=gb.property.name,
        wifi_network=gb.wifi.network if gb.wifi and gb.wifi.network else None,
        wifi_password=gb.wifi.password if gb.wifi and gb.wifi.password else None,
        check_in_time=gb.check_in_time,
        check_out_time=gb.check_out_time,
        address_street=gb.property.address_street,
        address_city_state=gb.property.address_city_state,
        address_zip=gb.property.address_zip,
        access_info=gb.access_info,
        welcome_message=getattr(gb, 'welcome_info', None),
        parking_info=getattr(gb, 'parking_info', None),
        rules=[rule.text for rule in gb.rules],
        things_to_do=gb.things_to_do,
        places_to_eat=gb.places_to_eat,
        checkout_info=getattr(gb, 'checkout_info', None),
        house_manual=getattr(gb, 'house_manual', None),
        included_tabs=included_tabs,
        custom_sections=getattr(gb, 'custom_sections', None),
        custom_tabs_meta=safe_custom_tabs_meta,
        cover_image_url=gb.cover_image_url,
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
    token = request.args.get('token')
    if not token:
        return jsonify({"error": "token required"}), 400
    gb = Guidebook.query.get_or_404(guidebook_id)
    if gb.claim_token != token:
        return jsonify({"error": "invalid token"}), 403
    # Check expiry if set
    if gb.expires_at and datetime.now(timezone.utc) > gb.expires_at:
        return jsonify({"error": "preview expired"}), 410
    resp = _render_guidebook(gb)
    # discourage indexing
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
            joinedload(Guidebook.wifi),
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

    # Find or create Wifi (update password if it already exists)
    wifi = None
    if data.get('wifi_network'):
        wifi = Wifi.query.filter_by(network=data['wifi_network'], user_id=user_id).first()
        if not wifi:
            wifi = Wifi(network=data['wifi_network'], password=data.get('wifi_password'), user_id=user_id)
            db.session.add(wifi)
        else:
            if 'wifi_password' in data:
                wifi.password = data.get('wifi_password')
    
    # Flush session to assign IDs to new host, prop, wifi before linking to guidebook
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
        included_tabs=included_tabs,
        custom_sections=custom_sections,
        custom_tabs_meta=custom_tabs_meta if custom_tabs_meta else None,
        template_key=selected_template_key,
        host_id=host.id if host else None,
        property_id=prop.id,
        wifi_id=wifi.id if wifi else None,
        user_id=user_id,
    )
    db.session.add(new_guidebook)

    # Add Rules
    if 'rules' in data and data['rules']:
        for rule_text in data['rules']:
            if rule_text:
                new_rule = Rule(text=rule_text, guidebook=new_guidebook)
                db.session.add(new_rule)

    # Set lifecycle fields: Pro users get active + slug immediately
    new_guidebook.public_slug = None
    new_guidebook.active = False
    try:
        plan_row = db.session.execute(text("SELECT plan FROM public.profiles WHERE user_id = :uid"), {"uid": user_id}).fetchone()
        is_pro = bool(plan_row) and (plan_row[0] or 'free') == 'pro'
        if is_pro:
            # Activate and assign a unique public slug
            new_guidebook.active = True
            base = _slugify(getattr(prop, 'name', None) or 'guidebook')
            slug = base
            # Ensure uniqueness
            attempt = 0
            while db.session.execute(text("SELECT 1 FROM guidebook WHERE public_slug = :s LIMIT 1"), {"s": slug}).fetchone():
                attempt += 1
                suffix = secrets.token_hex(2)
                slug = f"{base}-{suffix}"
                if attempt > 8:
                    break
            new_guidebook.public_slug = slug
    except Exception:
        # fallback to draft
        pass
    new_guidebook.claimed_at = datetime.now(timezone.utc)
    new_guidebook.expires_at = None
    # Generate a preview token so the user can view a draft via /preview/<id>?token=...
    try:
        new_guidebook.claim_token = secrets.token_urlsafe(24)
    except Exception:
        new_guidebook.claim_token = None

    db.session.commit()

    # Respond with identifiers and appropriate URL
    payload = {
        "ok": True,
        "guidebook_id": new_guidebook.id,
        "template_key": selected_template_key,
    }
    resp = jsonify(payload)
    # For Pro (active) users, return live URL immediately; otherwise return Edit + Preview
    if new_guidebook.active:
        live_path = f"/guidebook/{new_guidebook.id}"
        if new_guidebook.public_slug:
            live_path = f"/g/{new_guidebook.public_slug}"
        resp.headers['X-Guidebook-Url'] = live_path
        # No preview header when live
        resp.headers['Access-Control-Expose-Headers'] = 'X-Guidebook-Url'
    else:
        resp.headers['X-Guidebook-Url'] = f"/edit/{new_guidebook.id}"
        if new_guidebook.claim_token:
            resp.headers['X-Guidebook-Preview'] = f"/preview/{new_guidebook.id}?token={new_guidebook.claim_token}"
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
            "wifi": {
                "network": getattr(gb.wifi, 'network', None) if gb.wifi else None,
                "password": getattr(gb.wifi, 'password', None) if gb.wifi else None,
            },
            "check_in_time": gb.check_in_time,
            "check_out_time": gb.check_out_time,
            "access_info": gb.access_info,
            "parking_info": gb.parking_info,
            "rules": [r.text for r in gb.rules],
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
            wifi_network=gb.wifi.network if gb.wifi and gb.wifi.network else None,
            wifi_password=gb.wifi.password if gb.wifi and gb.wifi.password else None,
            check_in_time=gb.check_in_time,
            check_out_time=gb.check_out_time,
            address_street=gb.property.address_street,
            address_city_state=gb.property.address_city_state,
            address_zip=gb.property.address_zip,
            access_info=gb.access_info,
            welcome_message=getattr(gb, 'welcome_info', None),
            parking_info=getattr(gb, 'parking_info', None),
            rules=[rule.text for rule in gb.rules],
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
        "wifi": {
            "id": gb.wifi_id,
            "network": getattr(gb.wifi, 'network', None),
            # include password so Edit form can show/modify it; send None if absent
            "password": getattr(gb.wifi, 'password', None) if hasattr(gb.wifi, 'password') else None,
        },
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

    # Update or create related Wifi (create only if network provided)
    wifi_network = data.get('wifi_network')
    wifi_password = data.get('wifi_password')
    if wifi_network is not None or wifi_password is not None:
        wifi = Wifi.query.get(gb.wifi_id) if gb.wifi_id else None
        # If we have a non-empty network, create or update
        if isinstance(wifi_network, str) and wifi_network.strip():
            if not wifi:
                # try find existing by network for this user
                wifi = Wifi.query.filter_by(network=wifi_network, user_id=g.user_id).first()
            if not wifi:
                wifi = Wifi(network=wifi_network.strip(), user_id=g.user_id)
                db.session.add(wifi)
                db.session.flush()
                gb.wifi_id = wifi.id
            else:
                wifi.network = wifi_network.strip()
            if wifi_password is not None:
                wifi.password = wifi_password
        else:
            # No network provided; only update password if a wifi already exists
            if wifi and wifi_password is not None:
                wifi.password = wifi_password

    # Replace Rules if provided
    if 'rules' in data and isinstance(data.get('rules'), list):
        # delete existing rules
        for r in list(gb.rules):
            db.session.delete(r)
        for rule_text in data.get('rules'):
            if rule_text:
                db.session.add(Rule(text=rule_text, guidebook=gb))

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
        # Lifecycle fields
        "ALTER TABLE guidebook ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT FALSE;",
        "ALTER TABLE guidebook ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;",
        "ALTER TABLE guidebook ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;",
        "ALTER TABLE guidebook ADD COLUMN IF NOT EXISTS claim_token TEXT;",
        "ALTER TABLE guidebook ADD COLUMN IF NOT EXISTS public_slug TEXT;",
        # Uniques (Postgres): create unique indexes if not exist
        "CREATE UNIQUE INDEX IF NOT EXISTS ux_guidebook_claim_token ON guidebook (claim_token);",
        "CREATE UNIQUE INDEX IF NOT EXISTS ux_guidebook_public_slug ON guidebook (public_slug);",
        # Timestamps
        "ALTER TABLE guidebook ADD COLUMN IF NOT EXISTS created_time TIMESTAMPTZ DEFAULT NOW();",
        "ALTER TABLE guidebook ADD COLUMN IF NOT EXISTS last_modified_time TIMESTAMPTZ DEFAULT NOW();",
        # Snapshot columns
        "ALTER TABLE guidebook ADD COLUMN IF NOT EXISTS published_html TEXT;",
        "ALTER TABLE guidebook ADD COLUMN IF NOT EXISTS published_etag TEXT;",
        "ALTER TABLE guidebook ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;",
        # Profiles add-on slot count
        "ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS extra_slots INTEGER DEFAULT 0;",
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

@app.route('/api/ai-food', methods=['POST'])
def ai_food_route():
    data = request.json
    address = data.get('location') or data.get('address')
    num_places_to_eat = data.get('num_places_to_eat', 5)
    if not address or not str(address).strip():
        return jsonify({"error": "Please provide a valid location to generate recommendations."}), 400
    recs = get_ai_food_recommendations(address, num_places_to_eat)
    return jsonify(recs or {"error": "Could not get recommendations"})

@app.route('/api/ai-activities', methods=['POST'])
def ai_activities_route():
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

if __name__ == '__main__':
    app.run(debug=True, port=5001)
