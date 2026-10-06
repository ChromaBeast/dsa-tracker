import { decryptProgress, encryptProgress } from "./crypto";
import { CloudConfig, EncryptedPayload, LocalStorageState, ProgressData, UserAuthRecord } from "./types";

const URL_KEY = "dsa_upstash_url";
const TOKEN_KEY = "dsa_upstash_token";
const DEFAULT_URL = "https://notable-lemming-203251.upstash.io";
const DEFAULT_TOKEN = "gQAAAAAAAxnzAQIgcDI2YzFhNTIwZWQ1MGI0MWY3OWM3OGVjZWVhYjUxNDQ4MQ";

export function getCloudConfig(): CloudConfig | null {
  const storedUrl = localStorage.getItem(URL_KEY);
  const storedToken = localStorage.getItem(TOKEN_KEY);
  if (storedUrl === "" || storedToken === "") return null;
  const url = storedUrl || DEFAULT_URL;
  const token = storedToken || DEFAULT_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/+$/, ""), token: token.trim() };
}

export function saveCloudConfig(url: string, token: string): void {
  localStorage.setItem(URL_KEY, url.trim().replace(/\/+$/, ""));
  localStorage.setItem(TOKEN_KEY, token.trim());
}

export function clearCloudConfig(): void {
  localStorage.setItem(URL_KEY, "");
  localStorage.setItem(TOKEN_KEY, "");
}

export async function testCloudConnection(url: string, token: string): Promise<boolean> {
  try {
    const res = await fetch(`${url.trim().replace(/\/+$/, "")}/ping`, {
      headers: { Authorization: `Bearer ${token.trim()}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function redisGet<T>(key: string): Promise<T | null> {
  const config = getCloudConfig();
  if (!config) return null;
  try {
    const res = await fetch(`${config.url}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${config.token}` },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { result?: unknown };
    let parsed = json.result;
    if (typeof parsed === "string") {
      try { parsed = JSON.parse(parsed); } catch {}
    }
    if (typeof parsed === "string") {
      try { parsed = JSON.parse(parsed); } catch {}
    }
    return (parsed as T) || null;
  } catch {
    return null;
  }
}

async function redisSet(key: string, value: unknown): Promise<boolean> {
  const config = getCloudConfig();
  if (!config) return false;
  try {
    const res = await fetch(`${config.url}/set/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(value),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchUserAuth(username: string): Promise<UserAuthRecord | null> {
  return redisGet<UserAuthRecord>(`dsa:user:${username.toLowerCase()}:auth`);
}

export async function saveUserAuth(username: string, record: UserAuthRecord): Promise<boolean> {
  const config = getCloudConfig();
  if (!config) return false;
  const ok = await redisSet(`dsa:user:${username.toLowerCase()}:auth`, record);
  if (ok) {
    try {
      await fetch(`${config.url}/sadd/dsa:users/${encodeURIComponent(username.toLowerCase())}`, {
        headers: { Authorization: `Bearer ${config.token}` },
      });
    } catch {}
  }
  return ok;
}

export async function fetchUserLeetCode(username: string): Promise<ProgressData | null> {
  return redisGet<ProgressData>(`dsa:user:${username.toLowerCase()}:leetcode`);
}

export async function fetchUserManual(username: string, pin: string): Promise<LocalStorageState | null> {
  const payload = await redisGet<EncryptedPayload>(`dsa:user:${username.toLowerCase()}:manual`);
  if (!payload) return null;
  try {
    return await decryptProgress<LocalStorageState>(payload, pin);
  } catch {
    return null;
  }
}

export async function saveUserManual(username: string, pin: string, state: LocalStorageState): Promise<boolean> {
  try {
    const encrypted = await encryptProgress(state, pin);
    return await redisSet(`dsa:user:${username.toLowerCase()}:manual`, encrypted);
  } catch {
    return false;
  }
}
