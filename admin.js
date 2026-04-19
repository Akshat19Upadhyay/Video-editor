import { getPortfolioApi } from "./firebase.js";

const passwordLoginForm = document.querySelector("#passwordLoginForm");
const passwordInput = document.querySelector("#passwordInput");
const adminGate = document.querySelector(".admin-gate");
const workspaceSignOutButton = document.querySelector("#workspaceSignOutButton");
const authIntro = document.querySelector("#authIntro");
const authStatus = document.querySelector("#authStatus");
const saveStatus = document.querySelector("#saveStatus");
const adminWorkspace = document.querySelector("#adminWorkspace");
const adminForm = document.querySelector("#adminForm");
const videosEditorList = document.querySelector("#videosEditorList");
const shortsEditorList = document.querySelector("#shortsEditorList");
const addVideoButton = document.querySelector("#addVideoButton");
const addShortButton = document.querySelector("#addShortButton");
const mediaItemTemplate = document.querySelector("#mediaItemTemplate");

const nameInput = document.querySelector("#nameInput");
const experienceInput = document.querySelector("#experienceInput");
const taglineInput = document.querySelector("#taglineInput");
const photoInput = document.querySelector("#photoInput");
const whatsappInput = document.querySelector("#whatsappInput");
const emailInput = document.querySelector("#emailInput");

let api;
let currentUser = null;

function createMediaEditorItem(item = { title: "", url: "" }) {
  const fragment = mediaItemTemplate.content.cloneNode(true);
  const element = fragment.querySelector(".media-item");
  element.querySelector(".media-title").value = item.title || "";
  element.querySelector(".media-url").value = item.url || "";
  element.querySelector(".remove-item").addEventListener("click", () => {
    element.remove();
  });
  return element;
}

function collectMedia(listElement) {
  return [...listElement.querySelectorAll(".media-item")]
    .map((item) => ({
      title: item.querySelector(".media-title").value.trim(),
      url: item.querySelector(".media-url").value.trim(),
    }))
    .filter((item) => item.title && item.url);
}

function populateMedia(listElement, items) {
  listElement.innerHTML = "";
  items.forEach((item) => listElement.append(createMediaEditorItem(item)));
  if (!items.length) {
    listElement.append(createMediaEditorItem());
  }
}

function setFormData(data) {
  nameInput.value = data.profile.name;
  experienceInput.value = data.profile.experience;
  taglineInput.value = data.profile.tagline;
  photoInput.value = data.profile.photo;
  whatsappInput.value = data.contact.whatsapp;
  emailInput.value = data.contact.email;
  populateMedia(videosEditorList, data.videos);
  populateMedia(shortsEditorList, data.shorts);
}

function getFormData() {
  return {
    profile: {
      name: nameInput.value.trim(),
      experience: experienceInput.value.trim(),
      tagline: taglineInput.value.trim(),
      photo: photoInput.value.trim(),
    },
    videos: collectMedia(videosEditorList),
    shorts: collectMedia(shortsEditorList),
    contact: {
      whatsapp: whatsappInput.value.trim(),
      email: emailInput.value.trim(),
    },
  };
}

function isAllowedUser(user) {
  if (api.mode === "backend") return Boolean(user);
  if (api.mode === "demo") return true;
  return Boolean(user?.email && user.email.toLowerCase() === api.getAllowedAdminEmail().toLowerCase());
}

function updateAuthCopy(user) {
  passwordLoginForm.hidden = Boolean(user);
  adminGate.hidden = Boolean(user);
  adminWorkspace.hidden = !Boolean(user);

  authIntro.textContent =
    "This admin panel is protected by the backend password. Only users with the editor password can change live content.";
}

async function loadAndShowForm() {
  const data = await api.getPortfolioData();
  setFormData(data);
  adminWorkspace.hidden = false;
}

async function init() {
  api = await getPortfolioApi();
  updateAuthCopy(null);

  if (api.mode !== "backend") {
    authStatus.textContent = "Backend access is required for this admin panel.";
    passwordLoginForm.hidden = true;
    return;
  }

  authStatus.textContent = "Enter the editor password to manage portfolio content.";

  api.observeAuth(async (user) => {
    currentUser = user;
    updateAuthCopy(user);

    if (!user) {
      adminGate.hidden = false;
      adminWorkspace.hidden = true;
      authStatus.textContent = "Enter the editor password to unlock the admin panel.";
      return;
    }

    if (!isAllowedUser(user)) {
      adminGate.hidden = false;
      adminWorkspace.hidden = true;
      authStatus.textContent = `Signed in as ${user?.email ?? "unknown"}, but this account is not allowed.`;
      return;
    }

    authStatus.textContent = "Password accepted. You can edit the live portfolio now.";
    await loadAndShowForm();
  });
}

passwordLoginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  saveStatus.textContent = "";
  authStatus.textContent = "Checking password...";

  try {
    await api.signIn(passwordInput.value);
    passwordInput.value = "";
  } catch (error) {
    authStatus.textContent = `Login failed: ${error.message}`;
  }
});

workspaceSignOutButton.addEventListener("click", async () => {
  try {
    await api.signOut();
    adminGate.hidden = false;
    adminWorkspace.hidden = true;
    saveStatus.textContent = "";
  } catch (error) {
    authStatus.textContent = `Sign-out failed: ${error.message}`;
  }
});

addVideoButton.addEventListener("click", () => {
  videosEditorList.append(createMediaEditorItem());
});

addShortButton.addEventListener("click", () => {
  shortsEditorList.append(createMediaEditorItem());
});

adminForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!isAllowedUser(currentUser)) {
    saveStatus.textContent = "You are not allowed to save changes.";
    return;
  }

  saveStatus.textContent = "Saving...";

  try {
    await api.savePortfolioData(getFormData());
    saveStatus.textContent = "Changes saved successfully.";
  } catch (error) {
    saveStatus.textContent = `Save failed: ${error.message}`;
  }
});

init().catch((error) => {
  authStatus.textContent = `Setup failed: ${error.message}`;
});
