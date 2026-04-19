import { defaultPortfolioData } from "./data.js";
import { firebaseSettings } from "./firebase-config.js";

const STORAGE_KEY = "rachit-portfolio-demo-data";
const DOC_PATH = ["portfolio", "content"];

function cloneDefaultData() {
  return JSON.parse(JSON.stringify(defaultPortfolioData));
}

function sanitizeData(data) {
  const safe = cloneDefaultData();
  const next = data ?? {};

  safe.profile.name = next.profile?.name || safe.profile.name;
  safe.profile.experience = next.profile?.experience || safe.profile.experience;
  safe.profile.tagline = next.profile?.tagline || safe.profile.tagline;
  safe.profile.photo = next.profile?.photo || safe.profile.photo;

  safe.videos = Array.isArray(next.videos) ? next.videos : safe.videos;
  safe.shorts = Array.isArray(next.shorts) ? next.shorts : safe.shorts;

  safe.contact.whatsapp = next.contact?.whatsapp || safe.contact.whatsapp;
  safe.contact.email = next.contact?.email || safe.contact.email;

  return safe;
}

function getDemoData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return cloneDefaultData();

  try {
    return sanitizeData(JSON.parse(raw));
  } catch {
    return cloneDefaultData();
  }
}

function saveDemoData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizeData(data)));
}

async function createBackendApi() {
  const listeners = new Set();
  let currentUser = null;

  async function request(pathname, options = {}) {
    const response = await fetch(pathname, {
      credentials: "same-origin",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || "Request failed.");
    }

    return payload;
  }

  async function refreshAuth() {
    try {
      const session = await request("/api/admin/session", { method: "GET" });
      currentUser = session.authenticated ? { role: "editor" } : null;
    } catch {
      currentUser = null;
    }

    listeners.forEach((callback) => callback(currentUser));
    return currentUser;
  }

  return {
    mode: "backend",
    getAllowedAdminEmail: () => "",
    observeAuth(callback) {
      listeners.add(callback);
      callback(currentUser);
      refreshAuth();
      return () => listeners.delete(callback);
    },
    async signIn(password) {
      await request("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      return refreshAuth();
    },
    async signOut() {
      await request("/api/admin/logout", { method: "POST" });
      return refreshAuth();
    },
    async getPortfolioData() {
      return request("/api/portfolio", { method: "GET" });
    },
    async savePortfolioData(data) {
      return request("/api/portfolio", {
        method: "PUT",
        body: JSON.stringify(data),
      });
    },
  };
}

async function createFirebaseApi() {
  const [{ initializeApp }, authModule, firestoreModule] = await Promise.all([
    import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js"),
    import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"),
  ]);

  const app = initializeApp(firebaseSettings.firebaseConfig);
  const auth = authModule.getAuth(app);
  const db = firestoreModule.getFirestore(app);
  const provider = new authModule.GoogleAuthProvider();
  const docRef = firestoreModule.doc(db, ...DOC_PATH);

  return {
    mode: "firebase",
    getAllowedAdminEmail: () => firebaseSettings.allowedAdminEmail,
    observeAuth(callback) {
      return authModule.onAuthStateChanged(auth, callback);
    },
    async signIn() {
      return authModule.signInWithPopup(auth, provider);
    },
    async signOut() {
      return authModule.signOut(auth);
    },
    async getPortfolioData() {
      const snapshot = await firestoreModule.getDoc(docRef);
      if (!snapshot.exists()) {
        await firestoreModule.setDoc(docRef, cloneDefaultData());
        return cloneDefaultData();
      }

      return sanitizeData(snapshot.data());
    },
    async savePortfolioData(data) {
      const safe = sanitizeData(data);
      await firestoreModule.setDoc(docRef, safe, { merge: true });
      return safe;
    },
  };
}

function createDemoApi() {
  return {
    mode: "demo",
    getAllowedAdminEmail: () => firebaseSettings.allowedAdminEmail,
    observeAuth(callback) {
      callback({ email: firebaseSettings.allowedAdminEmail || "demo@local.dev" });
      return () => {};
    },
    async signIn() {
      return { user: { email: firebaseSettings.allowedAdminEmail || "demo@local.dev" } };
    },
    async signOut() {
      return true;
    },
    async getPortfolioData() {
      return getDemoData();
    },
    async savePortfolioData(data) {
      const safe = sanitizeData(data);
      saveDemoData(safe);
      return safe;
    },
  };
}

async function canUseBackendApi() {
  try {
    const response = await fetch("/api/health", {
      method: "GET",
      credentials: "same-origin",
    });

    if (!response.ok) return false;

    const payload = await response.json();
    return payload.mode === "backend";
  } catch {
    return false;
  }
}

export async function getPortfolioApi() {
  if (await canUseBackendApi()) {
    return createBackendApi();
  }

  if (firebaseSettings.enabled) {
    return createFirebaseApi();
  }

  return createDemoApi();
}

export function normalizeYouTubeUrl(url) {
  if (!url) return "";

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace("www.", "");

    if (host === "youtu.be") {
      return `https://www.youtube.com/embed/${parsed.pathname.slice(1)}`;
    }

    if (host === "youtube.com" || host === "m.youtube.com") {
      if (parsed.pathname === "/watch") {
        return `https://www.youtube.com/embed/${parsed.searchParams.get("v")}`;
      }

      if (parsed.pathname.startsWith("/shorts/")) {
        return `https://www.youtube.com/embed/${parsed.pathname.split("/")[2]}`;
      }

      if (parsed.pathname.startsWith("/embed/")) {
        return url;
      }
    }
  } catch {
    return "";
  }

  return "";
}

export function buildWhatsappLink(phoneNumber) {
  const digits = phoneNumber.replace(/[^\d]/g, "");
  return digits ? `https://wa.me/${digits}` : "#";
}
