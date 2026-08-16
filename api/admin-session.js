import { createHmac, timingSafeEqual } from "node:crypto";

function parseCookies(cookieHeader = "") {
  return Object.fromEntries(
    cookieHeader
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const i = part.indexOf("=");
        return i === -1
          ? [part, ""]
          : [part.slice(0, i), decodeURIComponent(part.slice(i + 1))];
      })
  );
}

function verifyToken(token, secret) {
  try {
    const [payload, signature] = String(token || "").split(".");
    if (!payload || !signature) return false;

    const expected = createHmac("sha256", secret)
      .update(payload)
      .digest("base64url");

    const a = Buffer.from(signature);
    const b = Buffer.from(expected);

    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return false;
    }

    const data = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    );

    return data.role === "admin" && Number(data.exp) > Date.now();
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false });
  }

  const secret = process.env.ADMIN_SESSION_SECRET;

  if (!secret) {
    return res.status(500).json({
      ok: false,
      authenticated: false,
    });
  }

  const cookies = parseCookies(req.headers.cookie || "");
  const token = cookies.ghs_admin_session;

  const authenticated = verifyToken(token, secret);

  return res.status(authenticated ? 200 : 401).json({
    ok: authenticated,
    authenticated,
  });
}
