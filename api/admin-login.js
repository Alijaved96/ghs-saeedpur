import {
  createHash,
  createHmac,
  timingSafeEqual,
} from "node:crypto";

function safeEqual(a, b) {
  const aHash = createHash("sha256")
    .update(String(a ?? ""))
    .digest();

  const bHash = createHash("sha256")
    .update(String(b ?? ""))
    .digest();

  return timingSafeEqual(aHash, bHash);
}

function createSessionToken(secret) {
  const payload = Buffer.from(
    JSON.stringify({
      role: "admin",
      exp: Date.now() + 8 * 60 * 60 * 1000,
    })
  ).toString("base64url");

  const signature = createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");

  return `${payload}.${signature}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      ok: false,
      message: "Method not allowed",
    });
  }

  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const sessionSecret = process.env.ADMIN_SESSION_SECRET;

  if (!adminUsername || !adminPassword || !sessionSecret) {
    return res.status(500).json({
      ok: false,
      message: "Admin authentication is not configured.",
    });
  }

  let body = req.body || {};

  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }

  const username = body.username || "";
  const password = body.password || "";

  const usernameOK = safeEqual(username, adminUsername);
  const passwordOK = safeEqual(password, adminPassword);

  if (!usernameOK || !passwordOK) {
    return res.status(401).json({
      ok: false,
      message: "Invalid username or password.",
    });
  }

  const token = createSessionToken(sessionSecret);

  res.setHeader(
    "Set-Cookie",
    [
      `ghs_admin_session=${token}`,
      "HttpOnly",
      "Secure",
      "SameSite=Strict",
      "Path=/",
      "Max-Age=28800",
    ].join("; ")
  );

  return res.status(200).json({
    ok: true,
    message: "Login successful.",
  });
}
