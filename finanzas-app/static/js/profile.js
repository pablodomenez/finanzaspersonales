const AVATARS = ["👤","😀","😎","🧑","👩","👨","🧔","👩‍💼","👨‍💼","🧑‍💻","👩‍🎓","👨‍🎓","🧑‍🎨","👩‍🍳","👨‍🍳","🦸","🧙","🐱","🐶","🦊","🐻","🐼","🦁","🐯","🦄","🚀","⭐","💎","🌟","🔥"];

let currentAvatar = "👤";

function toggleAvatarPicker() {
  const el = document.getElementById("avatar-picker");
  el.classList.toggle("hidden");
}

function buildAvatarGrid() {
  const grid = document.getElementById("avatar-grid");
  grid.innerHTML = AVATARS.map(e => `
    <button type="button" onclick="selectAvatar('${e}')"
      class="text-2xl w-10 h-10 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 flex items-center justify-center transition border border-transparent hover:border-blue-300 dark:hover:border-blue-600">
      ${e}
    </button>`).join("");
}

function selectAvatar(emoji) {
  currentAvatar = emoji;
  document.getElementById("avatar-display").textContent = emoji;
  document.getElementById("avatar-picker").classList.add("hidden");
}

function showAlert(msg, ok = true) {
  const el = document.getElementById("alert");
  el.textContent = msg;
  el.className = ok
    ? "mb-6 px-4 py-3 rounded-lg text-sm font-medium bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700"
    : "mb-6 px-4 py-3 rounded-lg text-sm font-medium bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-700";
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 4000);
}

function fillForm(data) {
  currentAvatar = data.avatar_emoji || "👤";
  document.getElementById("avatar-display").textContent = currentAvatar;
  document.getElementById("display-name").textContent = data.name || "—";
  document.getElementById("display-email").textContent = data.email || "";
  document.getElementById("display-occupation").textContent = data.occupation || "";

  document.getElementById("p-name").value = data.name || "";
  document.getElementById("p-phone").value = data.phone || "";
  document.getElementById("p-birth").value = data.birth_date || "";
  document.getElementById("p-country").value = data.country || "";
  document.getElementById("p-currency").value = data.currency || "ARS";
  document.getElementById("p-occupation").value = data.occupation || "";
  document.getElementById("p-bio").value = data.bio || "";
  document.getElementById("p-email").value = data.email || "";

  if (data.created_at) {
    const d = new Date(data.created_at);
    document.getElementById("info-created").textContent = d.toLocaleDateString("es-AR", { year: "numeric", month: "long", day: "numeric" });
  }
}

async function loadProfile() {
  try {
    const data = await apiFetch("/api/profile");
    fillForm(data);
  } catch (e) {
    showAlert("No se pudo cargar el perfil.", false);
  }
}

document.getElementById("profile-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("save-btn");
  btn.disabled = true;
  btn.textContent = "Guardando...";

  const payload = {
    name: document.getElementById("p-name").value.trim(),
    phone: document.getElementById("p-phone").value.trim(),
    birth_date: document.getElementById("p-birth").value,
    country: document.getElementById("p-country").value.trim(),
    currency: document.getElementById("p-currency").value,
    occupation: document.getElementById("p-occupation").value.trim(),
    bio: document.getElementById("p-bio").value.trim(),
    avatar_emoji: currentAvatar,
  };

  try {
    const data = await apiFetch("/api/profile", { method: "PUT", body: JSON.stringify(payload) });
    fillForm(data);
    showAlert("Perfil guardado correctamente ✓");
  } catch (err) {
    showAlert("Error al guardar. Intentá de nuevo.", false);
  } finally {
    btn.disabled = false;
    btn.textContent = "Guardar cambios";
  }
});

buildAvatarGrid();
loadProfile();
