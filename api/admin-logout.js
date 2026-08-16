export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      ok: false,
      message: "Method not allowed",
    });
  }

  res.setHeader(
    "Set-Cookie",
    [
      "ghs_admin_session=",
      "HttpOnly",
      "Secure",
      "SameSite=Strict",
      "Path=/",
      "Max-Age=0",
    ].join("; ")
  );

  return res.status(200).json({
    ok: true,
    message: "Logged out successfully.",
  });
} 
