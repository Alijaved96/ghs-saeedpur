import { get, list, put } from "@vercel/blob";
import { createHmac, timingSafeEqual } from "node:crypto";

const PREFIX = "admission-applications/";
const allowedStatuses = new Set([
  "Pending",
  "Approved",
  "Rejected"
]);

function json(res, status, data) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  return res.status(status).json(data);
}

function parseCookies(header = "") {
  return Object.fromEntries(
    header
      .split(";")
      .map(v => v.trim())
      .filter(Boolean)
      .map(v => {
        const i = v.indexOf("=");
        return i < 0
          ? [v, ""]
          : [v.slice(0, i), decodeURIComponent(v.slice(i + 1))];
      })
  );
}

function verifySession(token, secret) {
  try {
    const [payload, signature] = String(token || "").split(".");
    if (!payload || !signature || !secret) return false;

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

    return (
      data.role === "admin" &&
      Number(data.exp) > Date.now()
    );
  } catch {
    return false;
  }
}

async function requireAdmin(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  return verifySession(
    cookies.ghs_admin_session,
    process.env.ADMIN_SESSION_SECRET
  );
}

async function readApplication(pathname) {
  const result = await get(pathname, {
    access: "private",
    useCache: false
  });

  if (!result) return null;

  return new Response(result.stream).json();
}

export default async function handler(req, res) {
  const authenticated = await requireAdmin(req);

  if (!authenticated) {
    return json(res, 401, {
      error: "Administrator login required."
    });
  }

  try {

    if (req.method === "GET") {

      const result = await list({
        prefix: PREFIX
      });

      const applications = (
        await Promise.all(
          result.blobs.map(blob =>
            readApplication(blob.pathname)
              .catch(() => null)
          )
        )
      ).filter(Boolean);

      applications.sort(
        (a, b) =>
          new Date(b.created_at || 0) -
          new Date(a.created_at || 0)
      );

      return json(res, 200, {
        applications,
        user: {
          email: "Administrator"
        }
      });
    }

    if (req.method === "POST") {

      let body = req.body || {};

      if (typeof body === "string") {
        try {
          body = JSON.parse(body);
        } catch {
          body = {};
        }
      }

      if (body.action !== "update-status") {
        return json(res, 400, {
          error: "Unsupported action."
        });
      }

      if (
        !body.id ||
        !allowedStatuses.has(body.status)
      ) {
        return json(res, 400, {
          error: "Invalid application status."
        });
      }

      const pathname =
        `${PREFIX}${body.id}.json`;

      const application =
        await readApplication(pathname);

      if (!application) {
        return json(res, 404, {
          error: "Application not found."
        });
      }

      application.status = body.status;
      application.updated_at =
        new Date().toISOString();
      application.status_updated_by =
        "Administrator";

      await put(
        pathname,
        JSON.stringify(application),
        {
          access: "private",
          addRandomSuffix: false,
          allowOverwrite: true,
          contentType: "application/json"
        }
      );

      return json(res, 200, {
        application
      });
    }

    res.setHeader("Allow", "GET, POST");

    return json(res, 405, {
      error: "Method not allowed."
    });

  } catch (error) {

    console.error(error);

    return json(res, 500, {
      error: "Unable to access admission records."
    });
  }
    } 
