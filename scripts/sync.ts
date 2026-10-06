import { readFileSync, writeFileSync } from "node:fs";
import { EncryptedPayload, ProgressData, RawProgressResponse } from "../src/types.js";
import { decryptPayload, encryptPayload } from "./crypto.js";

interface LeetCodeSubmission {
  titleSlug: string;
  timestamp: string;
}

const defaultUser = process.env.LC_USER || process.env.LEETCODE_USERNAME || "ChromaBeast";
const password = process.env.TRACKER_PASSWORD || "1234";
const upstashUrl = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/+$/, "");
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

async function fetchLeetCodeSubmissions(username: string): Promise<LeetCodeSubmission[]> {
  const query = "query recentAcSubmissions($username: String!, $limit: Int!) { recentAcSubmissionList(username: $username, limit: $limit) { titleSlug timestamp } }";
  try {
    const res = await fetch("https://leetcode.com/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json", Referer: "https://leetcode.com" },
      body: JSON.stringify({ query, variables: { username, limit: 20 } }),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: { recentAcSubmissionList?: LeetCodeSubmission[] } };
    return json.data?.recentAcSubmissionList || [];
  } catch {
    return [];
  }
}

async function syncMultiUserUpstash(url: string, token: string) {
  let userList: string[] = [];
  try {
    const res = await fetch(`${url}/smembers/dsa:users`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const json = (await res.json()) as { result?: string[] };
      userList = json.result || [];
    }
  } catch {}

  const allUsers = Array.from(new Set([defaultUser.toLowerCase(), ...userList.map(u => u.toLowerCase())]));
  console.log(`Syncing LeetCode for ${allUsers.length} user(s): ${allUsers.join(", ")}`);

  for (const u of allUsers) {
    const subs = await fetchLeetCodeSubmissions(u);
    let existingData: ProgressData = { user: u, updated: null, solved: {} };
    try {
      const getRes = await fetch(`${url}/get/dsa:user:${u}:leetcode`, { headers: { Authorization: `Bearer ${token}` } });
      if (getRes.ok) {
        const json = (await getRes.json()) as { result?: unknown };
        let parsed = json.result;
        if (typeof parsed === "string") {
          try { parsed = JSON.parse(parsed); } catch {}
        }
        if (typeof parsed === "string") {
          try { parsed = JSON.parse(parsed); } catch {}
        }
        if (parsed && typeof parsed === "object") existingData = parsed as ProgressData;
      }
    } catch {}
    if (!existingData.solved) existingData.solved = {};

    let changed = false;
    for (const s of subs) {
      const t = Number(s.timestamp), old = existingData.solved[s.titleSlug];
      if (!old || t < old) { existingData.solved[s.titleSlug] = t; changed = true; }
    }

    if (changed || !existingData.updated) {
      existingData.updated = new Date().toISOString();
      await fetch(`${url}/set/dsa:user:${u}:leetcode`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(existingData),
      });
      console.log(`Updated Upstash record for @${u} (${subs.length} submissions).`);
    }
  }
}

async function syncLocalFallback() {
  const subs = await fetchLeetCodeSubmissions(defaultUser);
  let p: ProgressData = { user: defaultUser, updated: null, solved: {} };
  try {
    const raw = JSON.parse(readFileSync("progress.json", "utf8")) as RawProgressResponse;
    if ("encrypted" in raw && raw.encrypted) {
      p = decryptPayload(raw as EncryptedPayload, password);
    } else {
      p = raw as ProgressData;
    }
  } catch {}

  for (const s of subs) {
    const t = Number(s.timestamp), old = p.solved[s.titleSlug];
    if (!old || t < old) p.solved[s.titleSlug] = t;
  }
  p.updated = new Date().toISOString();
  const enc = encryptPayload(p, password);
  writeFileSync("progress.json", JSON.stringify(enc, null, 1) + "\n");
}

if (upstashUrl && upstashToken) {
  await syncMultiUserUpstash(upstashUrl, upstashToken);
}
await syncLocalFallback();
console.log("Sync complete.");
