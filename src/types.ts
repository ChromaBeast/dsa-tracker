export interface ProblemItem {
  slug: string;
  difficulty: "E" | "M" | "H";
}

export interface WeekPlan {
  title: string;
  note: string;
  problems: ProblemItem[];
}

export interface ProgressData {
  user: string;
  updated: string | null;
  solved: Record<string, number>;
}

export interface EncryptedPayload {
  encrypted: true;
  version: number;
  salt: string;
  iv: string;
  ciphertext: string;
}

export interface UserAuthRecord {
  salt: string;
  authHash: string;
  createdAt: string;
}

export type RawProgressResponse = ProgressData | EncryptedPayload;

export interface LocalStorageState {
  d: Record<string, number>;
  r: Record<string, number>;
}

export interface CloudConfig {
  url: string;
  token: string;
}
