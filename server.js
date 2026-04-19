const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = __dirname;
const port = Number(process.env.PORT || 5500);
const sessionTtlMs = 1000 * 60 * 60 * 12;
const dataDirectory =
  process.env.DATA_DIR ||
  process.env.RAILWAY_VOLUME_MOUNT_PATH ||
  path.join(root, "data");
const dataFilePath = path.join(dataDirectory, "portfolio-data.json");

const defaultPortfolioData = {
  profile: {
    name: "Rachit",
    experience: "3 years of editing experience",
    tagline: "Turning raw footage into scroll-stopping stories that people remember.",
    photo:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=900&q=80",
  },
  videos: [
    {
      title: "Brand Story Edit",
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    },
    {
      title: "Podcast Highlight Edit",
      url: "https://www.youtube.com/watch?v=ysz5S6PUM-U",
    },
  ],
  shorts: [
    {
      title: "Fast-Paced Reel Edit",
      url: "https://www.youtube.com/shorts/aqz-KE-bpKQ",
    },
    {
      title: "Retention-Focused Short",
      url: "https://www.youtube.com/shorts/F1B9Fk_SgI0",
    },
  ],
  contact: {
    whatsapp: "+91 98765 43210",
    email: "rachit.editor@example.com",
  },
};

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
};

const sessions = new Map();

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

  safe.videos = Array.isArray(next.videos)
    ? next.videos
        .filter((item) => item?.title && item?.url)
        .map((item) => ({ title: String(item.title), url: String(item.url) }))
    : safe.videos;

  safe.shorts = Array.isArray(next.shorts)
    ? next.shorts
        .filter((item) => item?.title && item?.url)
        .map((item) => ({ title: String(item.title), url: String(item.url) }))
    : safe.shorts;

  safe.contact.whatsapp = next.contact?.whatsapp || safe.contact.whatsapp;
  safe.contact.email = next.contact?.email || safe.contact.email;

  return safe;
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";

    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error("Request body too large."));
        req.destroy();
      }
    });

    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Invalid JSON body."));
      }
    });

    req.on("error", reject);
  });
}

function sendJson(res, statusCode, payload, extraHeaders = {}) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    ...extraHeaders,
  });
  res.end(JSON.stringify(payload));
}

function sendText(res, statusCode, message) {
  res.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(message);
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  return header.split(";").reduce((cookies, pair) => {
    const [name, ...rest] = pair.trim().split("=");
    if (!name) return cookies;
    cookies[name] = decodeURIComponent(rest.join("="));
    return cookies;
  }, {});
}

function getSessionToken(req) {
  return parseCookies(req).admin_session || "";
}

function getSession(token) {
  if (!token) return null;

  const session = sessions.get(token);
  if (!session) return null;

  if (session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }

  return session;
}

function createSession() {
  const token = crypto.randomBytes(24).toString("hex");
  sessions.set(token, { expiresAt: Date.now() + sessionTtlMs });
  return token;
}

function destroySession(req) {
  const token = getSessionToken(req);
  if (token) {
    sessions.delete(token);
  }
}

function getCookieHeader(token = "", expires = "") {
  const parts = [
    `admin_session=${encodeURIComponent(token)}`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
  ];

  if (expires) {
    parts.push(`Expires=${expires}`);
  }

  return parts.join("; ");
}

function ensureDataFile() {
  fs.mkdirSync(dataDirectory, { recursive: true });

  if (!fs.existsSync(dataFilePath)) {
    fs.writeFileSync(dataFilePath, JSON.stringify(cloneDefaultData(), null, 2));
  }
}

function loadPortfolioData() {
  ensureDataFile();

  try {
    const raw = fs.readFileSync(dataFilePath, "utf8");
    return sanitizeData(JSON.parse(raw));
  } catch {
    return cloneDefaultData();
  }
}

function savePortfolioData(data) {
  const safe = sanitizeData(data);
  fs.writeFileSync(dataFilePath, JSON.stringify(safe, null, 2));
  return safe;
}

function hasConfiguredPassword() {
  return typeof process.env.ADMIN_PASSWORD === "string" && process.env.ADMIN_PASSWORD.length > 0;
}

function hashSecret(value) {
  return crypto.createHash("sha256").update(String(value)).digest();
}

function requireAdmin(req, res) {
  if (!hasConfiguredPassword()) {
    sendJson(res, 503, {
      error: "Admin password is not configured on the server.",
    });
    return false;
  }

  if (!getSession(getSessionToken(req))) {
    sendJson(res, 401, { error: "Authentication required." });
    return false;
  }

  return true;
}

async function handleApi(req, res, pathname) {
  if (pathname === "/api/health" && req.method === "GET") {
    sendJson(res, 200, {
      ok: true,
      mode: "backend",
      passwordConfigured: hasConfiguredPassword(),
      dataFilePath,
    });
    return true;
  }

  if (pathname === "/api/portfolio" && req.method === "GET") {
    sendJson(res, 200, loadPortfolioData());
    return true;
  }

  if (pathname === "/api/admin/session" && req.method === "GET") {
    sendJson(res, 200, {
      authenticated: Boolean(getSession(getSessionToken(req))),
    });
    return true;
  }

  if (pathname === "/api/admin/login" && req.method === "POST") {
    if (!hasConfiguredPassword()) {
      sendJson(res, 503, {
        error: "Set ADMIN_PASSWORD before starting the server.",
      });
      return true;
    }

    try {
      const body = await readJsonBody(req);
      const password = String(body.password || "");
      const matches = crypto.timingSafeEqual(
        hashSecret(password),
        hashSecret(process.env.ADMIN_PASSWORD)
      );

      if (!matches) {
        sendJson(res, 401, { error: "Incorrect password." });
        return true;
      }

      const token = createSession();
      sendJson(
        res,
        200,
        { authenticated: true },
        { "Set-Cookie": getCookieHeader(token) }
      );
      return true;
    } catch (error) {
      sendJson(res, 400, { error: error.message });
      return true;
    }
  }

  if (pathname === "/api/admin/logout" && req.method === "POST") {
    destroySession(req);
    sendJson(
      res,
      200,
      { authenticated: false },
      {
        "Set-Cookie": getCookieHeader("", "Thu, 01 Jan 1970 00:00:00 GMT"),
      }
    );
    return true;
  }

  if (pathname === "/api/portfolio" && req.method === "PUT") {
    if (!requireAdmin(req, res)) {
      return true;
    }

    try {
      const body = await readJsonBody(req);
      sendJson(res, 200, savePortfolioData(body));
      return true;
    } catch (error) {
      sendJson(res, 400, { error: error.message });
      return true;
    }
  }

  return false;
}

function serveStaticFile(req, res, pathname) {
  const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  let filePath = path.join(root, relativePath);

  if (!filePath.startsWith(root)) {
    sendText(res, 403, "Forbidden");
    return;
  }

  fs.stat(filePath, (statErr, stats) => {
    if (!statErr && stats.isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }

    fs.readFile(filePath, (readErr, data) => {
      if (readErr) {
        sendText(res, 404, "Not found");
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        "Content-Type": mimeTypes[ext] || "application/octet-stream",
      });
      res.end(data);
    });
  });
}

http
  .createServer(async (req, res) => {
    const requestUrl = new URL(req.url || "/", `http://${req.headers.host || "127.0.0.1"}`);
    const pathname = decodeURIComponent(requestUrl.pathname);

    try {
      if (pathname.startsWith("/api/")) {
        const handled = await handleApi(req, res, pathname);
        if (!handled) {
          sendJson(res, 404, { error: "API route not found." });
        }
        return;
      }

      serveStaticFile(req, res, pathname);
    } catch (error) {
      sendJson(res, 500, { error: error.message || "Unexpected server error." });
    }
  })
  .listen(port, "0.0.0.0", () => {
    console.log(`Portfolio server running at http://127.0.0.1:${port}`);
  });
