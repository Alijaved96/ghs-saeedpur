import { put } from "@vercel/blob";
import { randomUUID } from "node:crypto";

const MAX_TOTAL_FILE_SIZE = 2.4 * 1024 * 1024;

const PHOTO_TYPES = new Set([
  "image/jpeg",
  "image/png"
]);

const BFORM_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "application/pdf"
]);

function send(res, status, data) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  return res.status(status).json(data);
}

function clean(value, max = 200) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

function digits(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function extension(name = "", type = "") {
  const ext = String(name)
    .split(".")
    .pop()
    .toLowerCase();

  if (["jpg", "jpeg", "png", "pdf"].includes(ext)) {
    return ext === "jpeg" ? "jpg" : ext;
  }

  if (type === "image/jpeg") return "jpg";
  if (type === "image/png") return "png";
  if (type === "application/pdf") return "pdf";

  return "bin";
}

function decodeFile(file) {
  if (!file || !file.data) return null;

  let encoded = String(file.data);

  if (encoded.includes(",")) {
    encoded = encoded.split(",").pop();
  }

  return Buffer.from(encoded, "base64");
}

async function saveFile({
  file,
  id,
  label,
  allowedTypes
}) {
  if (!file || !file.data) {
    return null;
  }

  const type = clean(file.type, 100);

  if (!allowedTypes.has(type)) {
    throw new Error(
      `${label} has an unsupported file type.`
    );
  }

  const buffer = decodeFile(file);

  if (!buffer || !buffer.length) {
    throw new Error(`${label} is empty.`);
  }

  const ext = extension(file.name, type);

  const pathname =
    `admission-files/${id}/${label}.${ext}`;

  const blob = await put(
    pathname,
    buffer,
    {
      access: "private",
      addRandomSuffix: false,
      contentType: type,
      token: process.env.BLOB_READ_WRITE_TOKEN
    }
  );

  return {
    pathname: blob.pathname,
    contentType: type,
    originalName: clean(file.name, 150),
    size: buffer.length
  };
}

export default async function handler(req, res) {

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");

    return send(res, 405, {
      ok: false,
      error: "Method not allowed."
    });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return send(res, 500, {
      ok: false,
      error: "Admission storage is not configured."
    });
  }

  try {

    let body = req.body || {};

    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }

    /*
      Honeypot spam protection.
      Real users leave this empty.
    */
    if (clean(body.bot_field, 100)) {
      return send(res, 200, {
        ok: true
      });
    }


    const data = {

      student_name:
        clean(body.student_name, 120),

      guardian_name:
        clean(body.guardian_name, 120),

      student_surname:
        clean(body.student_surname, 120),

      class_applying:
        clean(body.class_applying, 50),

      previous_school:
        clean(body.previous_school, 180),

      date_of_birth:
        clean(body.date_of_birth, 20),

      student_bform_number:
        clean(body.student_bform_number, 20),

      father_cnic_number:
        clean(body.father_cnic_number, 20),

      mobile:
        clean(body.mobile, 20),

      declaration:
        clean(body.declaration, 30)
    };


    const required = [
      "student_name",
      "guardian_name",
      "student_surname",
      "class_applying",
      "previous_school",
      "date_of_birth",
      "student_bform_number",
      "father_cnic_number",
      "mobile"
    ];


    for (const field of required) {

      if (!data[field]) {
        return send(res, 400, {
          ok: false,
          error:
            "Please complete all required admission fields."
        });
      }
    }


    if (
      digits(data.student_bform_number).length !== 13
    ) {
      return send(res, 400, {
        ok: false,
        error:
          "Student B-Form / CRC number must contain 13 digits."
      });
    }


    if (
      digits(data.father_cnic_number).length !== 13
    ) {
      return send(res, 400, {
        ok: false,
        error:
          "Father's CNIC number must contain 13 digits."
      });
    }


    if (
      !/^03\d{9}$/.test(
        digits(data.mobile)
      )
    ) {
      return send(res, 400, {
        ok: false,
        error:
          "Please enter a valid Pakistani mobile number."
      });
    }


    if (data.declaration !== "Agreed") {
      return send(res, 400, {
        ok: false,
        error:
          "Please accept the declaration before submitting."
      });
    }


    const photoBuffer =
      decodeFile(body.student_photo);

    const bformBuffer =
      decodeFile(body.student_bform);


    const combinedSize =
      (photoBuffer?.length || 0) +
      (bformBuffer?.length || 0);


    if (combinedSize > MAX_TOTAL_FILE_SIZE) {
      return send(res, 413, {
        ok: false,
        error:
          "Combined attachment size must be below 2.4 MB."
      });
    }


    const id =
      `ADM-${Date.now()}-${randomUUID()
        .slice(0, 8)}`;


    const photo = await saveFile({
      file: body.student_photo,
      id,
      label: "student-photo",
      allowedTypes: PHOTO_TYPES
    });


    const bform = await saveFile({
      file: body.student_bform,
      id,
      label: "student-bform",
      allowedTypes: BFORM_TYPES
    });


    /*
      These URLs will later be served through
      our protected admission-file API.
    */

    if (photo) {
      data.student_photo =
        `/api/admission-file?id=${encodeURIComponent(id)}&type=photo`;

      data.student_photo_path =
        photo.pathname;

      data.student_photo_name =
        photo.originalName;
    }


    if (bform) {
      data.student_bform =
        `/api/admission-file?id=${encodeURIComponent(id)}&type=bform`;

      data.student_bform_path =
        bform.pathname;

      data.student_bform_name =
        bform.originalName;
    }


    const application = {

      id,

      created_at:
        new Date().toISOString(),

      updated_at: null,

      status: "Pending",

      data
    };


    await put(
      `admission-applications/${id}.json`,
      JSON.stringify(application),
      {
        access: "private",
        addRandomSuffix: false,
        contentType: "application/json",
        token: process.env.BLOB_READ_WRITE_TOKEN
      }
    );


    return send(res, 201, {
      ok: true,
      id,
      message:
        "Admission application submitted successfully."
    });


  } catch (error) {

    console.error(
      "Admission submission error:",
      error
    );

    return send(res, 500, {
      ok: false,
      error:
        error?.message ||
        "Unable to submit the admission application."
    });
  }
    } 
