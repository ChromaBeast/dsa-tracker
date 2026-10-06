import { fetchUserAuth, fetchUserManual, getCloudConfig, saveUserAuth, saveUserManual } from "./cloud";
import { base64ToUint8Array, deriveAuthHash, uint8ArrayToBase64 } from "./crypto";

const AUTH_USER_KEY = "dsa_current_user";
const AUTH_PIN_KEY = "dsa_current_pin";

export interface UserSession {
  username: string;
  pin: string;
}

export function getCurrentSession(): UserSession | null {
  const username = sessionStorage.getItem(AUTH_USER_KEY) || localStorage.getItem(AUTH_USER_KEY);
  const pin = sessionStorage.getItem(AUTH_PIN_KEY) || localStorage.getItem(AUTH_PIN_KEY);
  if (!username || !pin) return null;
  return { username, pin };
}

export function setSession(username: string, pin: string, remember: boolean): void {
  sessionStorage.setItem(AUTH_USER_KEY, username);
  sessionStorage.setItem(AUTH_PIN_KEY, pin);
  if (remember) {
    localStorage.setItem(AUTH_USER_KEY, username);
    localStorage.setItem(AUTH_PIN_KEY, pin);
  }
}

export function clearSession(): void {
  sessionStorage.removeItem(AUTH_USER_KEY);
  sessionStorage.removeItem(AUTH_PIN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
  localStorage.removeItem(AUTH_PIN_KEY);
}

export async function register(
  username: string,
  pin: string,
  remember: boolean
): Promise<{ ok: boolean; error?: string }> {
  const cleanUser = username.trim().toLowerCase();
  const cleanPin = pin.trim();
  if (cleanUser.length < 2) return { ok: false, error: "Username must be at least 2 characters." };
  if (cleanPin.length < 4) return { ok: false, error: "PIN must be at least 4 characters." };

  if (!getCloudConfig()) {
    setSession(cleanUser, cleanPin, remember);
    return { ok: true };
  }

  const existing = await fetchUserAuth(cleanUser);
  if (existing) return { ok: false, error: "Username already exists. Please Log In." };

  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const authHash = await deriveAuthHash(cleanPin, saltBytes);
  const saltStr = uint8ArrayToBase64(saltBytes);

  const saved = await saveUserAuth(cleanUser, {
    salt: saltStr,
    authHash,
    createdAt: new Date().toISOString(),
  });
  if (!saved) return { ok: false, error: "Failed to create profile. Check Upstash connection." };

  await saveUserManual(cleanUser, cleanPin, { d: {}, r: {} });
  setSession(cleanUser, cleanPin, remember);
  return { ok: true };
}

export async function login(
  username: string,
  pin: string,
  remember: boolean
): Promise<{ ok: boolean; error?: string }> {
  const cleanUser = username.trim().toLowerCase();
  const cleanPin = pin.trim();
  if (!cleanUser || !cleanPin) return { ok: false, error: "Enter username and PIN." };

  if (!getCloudConfig()) {
    setSession(cleanUser, cleanPin, remember);
    return { ok: true };
  }

  const record = await fetchUserAuth(cleanUser);
  if (!record) return { ok: false, error: "User not found. Click Register." };

  const saltBytes = base64ToUint8Array(record.salt);
  const computedHash = await deriveAuthHash(cleanPin, saltBytes);
  if (computedHash !== record.authHash) return { ok: false, error: "Incorrect PIN." };

  setSession(cleanUser, cleanPin, remember);
  return { ok: true };
}

export async function changePassword(
  username: string,
  oldPin: string,
  newPin: string
): Promise<{ ok: boolean; error?: string }> {
  const cleanUser = username.trim().toLowerCase();
  const cleanOld = oldPin.trim();
  const cleanNew = newPin.trim();

  if (cleanNew.length < 4) return { ok: false, error: "New PIN must be at least 4 characters." };
  if (cleanOld === cleanNew) return { ok: false, error: "New PIN must be different from current PIN." };

  const authRecord = await fetchUserAuth(cleanUser);
  if (!authRecord) return { ok: false, error: "User record not found." };

  const oldSalt = base64ToUint8Array(authRecord.salt);
  const oldHash = await deriveAuthHash(cleanOld, oldSalt);
  if (oldHash !== authRecord.authHash) return { ok: false, error: "Current PIN is incorrect." };

  const manualState = (await fetchUserManual(cleanUser, cleanOld)) || { d: {}, r: {} };
  const savedManual = await saveUserManual(cleanUser, cleanNew, manualState);
  if (!savedManual) return { ok: false, error: "Failed to re-encrypt progress with new PIN." };

  const newSaltBytes = crypto.getRandomValues(new Uint8Array(16));
  const newAuthHash = await deriveAuthHash(cleanNew, newSaltBytes);
  const newSaltStr = uint8ArrayToBase64(newSaltBytes);

  const savedAuth = await saveUserAuth(cleanUser, {
    salt: newSaltStr,
    authHash: newAuthHash,
    createdAt: authRecord.createdAt,
  });
  if (!savedAuth) return { ok: false, error: "Failed to update authentication record." };

  const remember = !!localStorage.getItem(AUTH_USER_KEY);
  setSession(cleanUser, cleanNew, remember);
  return { ok: true };
}
