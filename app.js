import { getPortfolioApi, normalizeYouTubeUrl, buildWhatsappLink } from "./firebase.js";

const navName = document.querySelector("#navName");
const navProfilePhoto = document.querySelector("#navProfilePhoto");
const profileName = document.querySelector("#profileName");
const profileTagline = document.querySelector("#profileTagline");
const profileExperience = document.querySelector("#profileExperience");
const heroProfilePhoto = document.querySelector("#heroProfilePhoto");
const videosGrid = document.querySelector("#videosGrid");
const shortsGrid = document.querySelector("#shortsGrid");
const contactWhatsapp = document.querySelector("#contactWhatsapp");
const contactEmail = document.querySelector("#contactEmail");
const whatsappLink = document.querySelector("#whatsappLink");
const emailLink = document.querySelector("#emailLink");

function createVideoCard(item) {
  const embedUrl = normalizeYouTubeUrl(item.url);
  if (!embedUrl) return null;

  const card = document.createElement("article");
  card.className = "video-card";
  card.innerHTML = `
    <div class="video-frame">
      <iframe
        src="${embedUrl}"
        title="${item.title}"
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowfullscreen
      ></iframe>
    </div>
    <div class="video-meta">
      <h3>${item.title}</h3>
      <a href="${item.url}" target="_blank" rel="noreferrer">Watch on YouTube</a>
    </div>
  `;
  return card;
}

function renderMedia(grid, items, emptyMessage) {
  grid.innerHTML = "";

  const cards = items
    .map(createVideoCard)
    .filter(Boolean);

  if (!cards.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = emptyMessage;
    grid.append(empty);
    return;
  }

  cards.forEach((card) => grid.append(card));
}

async function init() {
  const api = await getPortfolioApi();
  const data = await api.getPortfolioData();

  navName.textContent = data.profile.name;
  profileName.textContent = data.profile.name;
  profileTagline.textContent = data.profile.tagline;
  profileExperience.textContent = data.profile.experience;
  navProfilePhoto.src = data.profile.photo;
  heroProfilePhoto.src = data.profile.photo;
  navProfilePhoto.alt = `${data.profile.name} profile photo`;
  heroProfilePhoto.alt = `${data.profile.name} portrait`;

  renderMedia(videosGrid, data.videos, "No videos added yet. Use the admin panel to add your first YouTube video.");
  renderMedia(shortsGrid, data.shorts, "No shorts added yet. Use the admin panel to add your first YouTube short.");

  contactWhatsapp.textContent = data.contact.whatsapp;
  contactEmail.textContent = data.contact.email;
  whatsappLink.href = buildWhatsappLink(data.contact.whatsapp);
  emailLink.href = `mailto:${data.contact.email}`;
}

init().catch((error) => {
  console.error(error);
});
