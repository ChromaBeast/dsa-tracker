import { changePassword, getCurrentSession } from "./auth";

export function setupPasswordModal(
  pwdBtn: HTMLButtonElement,
  onPasswordChanged: (newPin: string) => void
): void {
  const modal = document.getElementById("pwd-modal") as HTMLDivElement;
  const closeBtn = document.getElementById("close-pwd-btn") as HTMLButtonElement;
  const submitBtn = document.getElementById("pwd-submit-btn") as HTMLButtonElement;
  const currentInput = document.getElementById("pwd-current") as HTMLInputElement;
  const newInput = document.getElementById("pwd-new") as HTMLInputElement;
  const confirmInput = document.getElementById("pwd-confirm") as HTMLInputElement;
  const statusEl = document.getElementById("pwd-status") as HTMLDivElement;

  pwdBtn.onclick = () => {
    currentInput.value = "";
    newInput.value = "";
    confirmInput.value = "";
    statusEl.textContent = "";
    modal.classList.remove("hidden");
    currentInput.focus();
  };

  closeBtn.onclick = () => modal.classList.add("hidden");

  async function handleSubmit() {
    const session = getCurrentSession();
    if (!session) return;

    const currentPin = currentInput.value.trim();
    const newPin = newInput.value.trim();
    const confirmPin = confirmInput.value.trim();

    statusEl.textContent = "";

    if (!currentPin || !newPin || !confirmPin) {
      statusEl.textContent = "Please fill in all fields.";
      statusEl.className = "cloud-status error";
      return;
    }

    if (newPin !== confirmPin) {
      statusEl.textContent = "New PIN and confirmation do not match.";
      statusEl.className = "cloud-status error";
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Updating...";

    const res = await changePassword(session.username, currentPin, newPin);

    submitBtn.disabled = false;
    submitBtn.textContent = "Update PIN";

    if (res.ok) {
      statusEl.textContent = "PIN updated successfully! ✅";
      statusEl.className = "cloud-status success";
      onPasswordChanged(newPin);
      setTimeout(() => modal.classList.add("hidden"), 1000);
    } else {
      statusEl.textContent = res.error || "Failed to update PIN.";
      statusEl.className = "cloud-status error";
    }
  }

  submitBtn.onclick = handleSubmit;
  confirmInput.onkeydown = e => { if (e.key === "Enter") handleSubmit(); };
}
