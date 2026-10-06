# DSA Tracker (Encrypted, Automated & Cloud Synced)

A curated 10-week, 116-problem Data Structures & Algorithms tracker. A GitHub Action fetches your accepted LeetCode submissions every 3 hours, encrypts them with AES-256-GCM, and commits the encrypted payload. Visitors must enter your PIN to unlock and view your progress.

Built with **TypeScript** and powered by **Bun**.

---

## Quick Setup (Use for your own profile)

You can fork this repository to track your own LeetCode progress with zero server maintenance.

### 1. Fork or Clone
- Fork this repository or clone it to your own GitHub account.

### 2. Configure Secrets in GitHub
Go to **Settings** > **Secrets and variables** > **Actions** > **New repository secret**:
- `LEETCODE_USERNAME`: Your LeetCode profile handle.
- `TRACKER_PASSWORD`: Your chosen password or PIN to lock the tracker (defaults to `1234` if not set).

### 3. Enable GitHub Pages
- Go to **Settings** > **Pages** > Set **Source** to `Deploy from a branch` (`main`, `/ (root)`).

### 4. Enable Workflow Write Permissions
- Go to **Settings** > **Actions** > **General** > **Workflow permissions** > Select **Read and write permissions**.

### 5. Trigger Initial Sync
- Go to the **Actions** tab > **sync-leetcode** > Click **Run workflow**.
- Open `https://<your-username>.github.io/<repo-name>/`, enter your PIN, and start tracking!

---

## Cross-Device Sync (Free Upstash Redis)

Manual checkmarks and "redo" marks can be synced across all your devices in real-time without rebuilding GitHub Pages:

1. Create a free database at [console.upstash.com](https://console.upstash.com) (free forever, 10,000 requests/day, **never pauses on inactivity**).
2. Copy your **REST URL** (`https://...upstash.io`) and **REST Token**.
3. On your tracker page, click the ☁️ **Cloud** button in the header, paste your URL & Token, and click **Connect**.
4. All manual ticks sync instantly across your phone and desktop — fully encrypted with your PIN!

---

## Security & Privacy (Zero-Knowledge)

- **AES-256-GCM & PBKDF2**: Submissions and manual progress are stored exclusively as authenticated ciphertext derived using 100,000 iterations of PBKDF2-SHA-256.
- **Client-Side Decryption**: Decryption occurs in the browser using the Web Crypto API. Neither GitHub nor Upstash can see your problem checklist without your PIN.

---

## Local Development

```bash
bun install
bun run build
LEETCODE_USERNAME="your_handle" TRACKER_PASSWORD="your_password" bun run sync
```
