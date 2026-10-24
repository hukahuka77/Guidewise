import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';

// Guests build a guidebook before creating an account (a Supabase anonymous session). Signing up
// or logging in replaces that session, so we keep a server-signed claim ticket in the browser and
// hand it in once the person is signed in, which moves their guidebooks into the account.

const TICKETS_KEY = 'guidewise-guest-tickets';

export const isGuestSession = (session: Session | null | undefined) => session?.user?.is_anonymous === true;

/** The signed-in session, starting a guest session when nobody is signed in. Null when guests aren't available. */
export async function ensureSession(): Promise<{ token: string; guest: boolean } | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  if (data.session) return { token: data.session.access_token, guest: isGuestSession(data.session) };
  const { data: anon, error } = await supabase.auth.signInAnonymously();
  if (error || !anon.session) return null;
  return { token: anon.session.access_token, guest: true };
}

function readTickets(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(TICKETS_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((t): t is string => typeof t === 'string') : [];
  } catch {
    return [];
  }
}

function writeTickets(tickets: string[]) {
  try {
    if (tickets.length) localStorage.setItem(TICKETS_KEY, JSON.stringify(tickets.slice(-5)));
    else localStorage.removeItem(TICKETS_KEY);
  } catch { }
}

/** The guest a ticket belongs to (its payload is readable; only the server can check the signature). */
function ticketGuest(ticket: string): string | null {
  try {
    return JSON.parse(atob(ticket.split('.')[0].replace(/-/g, '+').replace(/_/g, '/')))?.g ?? null;
  } catch {
    return null;
  }
}

/** Keep a claim ticket handed over some other way (a gift link) so signing up claims its guidebook. */
export function addClaimTicket(ticket: string): void {
  const guest = ticketGuest(ticket);
  if (!guest) return;
  writeTickets([...readTickets().filter((t) => ticketGuest(t) !== guest), ticket]);
}

/** After a guest creates a guidebook, keep a ticket so they can claim it once they have an account. */
export async function rememberGuestGuidebook(token: string): Promise<void> {
  try {
    const res = await fetch('/api/guest/ticket', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    const ticket = res.ok ? (await res.json())?.ticket : null;
    if (typeof ticket !== 'string') return;
    // One ticket per guest covers all of their guidebooks
    const guest = ticketGuest(ticket);
    writeTickets([...readTickets().filter((t) => ticketGuest(t) !== guest), ticket]);
  } catch { }
}

let inFlight: Promise<void> | null = null;
// Moved but not yet reported: the background claim (on sign-in) can finish before the page that
// signed the person in asks, and that page still needs to know which guidebook to open
const claimed: string[] = [];

function startClaim(): Promise<void> {
  if (!inFlight) {
    inFlight = runClaim()
      .then((ids) => {
        claimed.push(...ids);
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

/** Claim without waiting for the result (on any sign-in, wherever the person lands). */
export function claimInBackground(): void {
  void startClaim();
}

/** Whether there is a guest guidebook waiting to join (or that just joined) the signed-in account. */
export const hasPendingClaim = () => readTickets().length > 0 || claimed.length > 0 || inFlight !== null;

/**
 * Move guidebooks made as a guest into the signed-in account. Returns the guidebook ids moved
 * (empty when there's nothing to claim or the person is still a guest). Safe to call from anywhere.
 */
export async function claimGuestGuidebooks(): Promise<string[]> {
  await startClaim();
  return takeClaimed();
}

/** Wait for any claim to finish without taking its result (pair with `takeClaimed`). */
export const finishClaim = (): Promise<void> => startClaim();

/** The guidebook ids claimed since last asked. */
export const takeClaimed = (): string[] => claimed.splice(0);

async function runClaim(): Promise<string[]> {
  const tickets = readTickets();
  if (!supabase || tickets.length === 0) return [];
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session || isGuestSession(session)) return [];
  const moved: string[] = [];
  const keep: string[] = [];
  for (const ticket of tickets) {
    try {
      const res = await fetch('/api/guest/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ ticket }),
      });
      if (res.ok) {
        const ids = (await res.json())?.guidebook_ids;
        if (Array.isArray(ids)) moved.push(...ids.map(String));
      } else if (res.status !== 400) {
        keep.push(ticket); // try again later; 400 means the ticket is spent or expired
      }
    } catch {
      keep.push(ticket);
    }
  }
  writeTickets(keep);
  return moved;
}

// When guests can't be signed in (anonymous sign-ins switched off in Supabase), the person creates an
// account first; what they asked to build is kept so /onboarding can start it as soon as they're in.
const PENDING_BUILD_KEY = 'guidewise-pending-build';
const PENDING_BUILD_TTL_MS = 24 * 60 * 60 * 1000;

export type PendingBuild =
  | { mode: 'link'; url: string }
  | { mode: 'manual'; name: string; address: string; style: string };

export function savePendingBuild(build: PendingBuild): void {
  try {
    localStorage.setItem(PENDING_BUILD_KEY, JSON.stringify({ ...build, at: Date.now() }));
  } catch { }
}

export const hasPendingBuild = (): boolean => peekPendingBuild() !== null;

function peekPendingBuild(): PendingBuild | null {
  try {
    const raw = JSON.parse(localStorage.getItem(PENDING_BUILD_KEY) || 'null');
    if (!raw || typeof raw.at !== 'number' || Date.now() - raw.at > PENDING_BUILD_TTL_MS) return null;
    if (raw.mode === 'link' && typeof raw.url === 'string') return { mode: 'link', url: raw.url };
    if (raw.mode === 'manual' && typeof raw.name === 'string') {
      return { mode: 'manual', name: raw.name, address: String(raw.address ?? ''), style: String(raw.style ?? '') };
    }
    return null;
  } catch {
    return null;
  }
}

/** The build waiting for the person to sign in, removed so it only runs once. */
export function takePendingBuild(): PendingBuild | null {
  const build = peekPendingBuild();
  try {
    localStorage.removeItem(PENDING_BUILD_KEY);
  } catch { }
  return build;
}
