import { getCloudConfig } from "./cloud";

export function setupCloudModal(cloudBtn: HTMLButtonElement): void {
  const modal = document.getElementById("cloud-modal") as HTMLDivElement;
  const closeBtn = document.getElementById("close-cloud-btn") as HTMLButtonElement;
  const okBtn = document.getElementById("ok-cloud-btn") as HTMLButtonElement;
  const statusEl = document.getElementById("cloud-sync-status") as HTMLParagraphElement;

  function updateStatus() {
    const isConnected = !!getCloudConfig();
    cloudBtn.classList.toggle("active-cloud", isConnected);
    if (statusEl) {
      statusEl.textContent = isConnected
        ? "Connected 🟢 — Changes sync across all devices in real-time."
        : "Local Only 🟡 — Connect cloud to sync across devices.";
    }
  }

  updateStatus();

  cloudBtn.onclick = () => {
    updateStatus();
    modal.classList.remove("hidden");
  };

  closeBtn.onclick = () => modal.classList.add("hidden");
  if (okBtn) okBtn.onclick = () => modal.classList.add("hidden");
}
