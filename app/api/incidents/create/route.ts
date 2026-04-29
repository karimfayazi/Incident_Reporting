import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { extname, join } from "path";
import { NextResponse } from "next/server";
import { getResolvedCouncilMapWithSource } from "@/lib/council-db";
import { getSqlPool, getSqlErrorDetails, sql } from "@/lib/db";

export const runtime = "nodejs";

const incidentCategories = new Set(["Safety", "Security", "Health", "Others"]);
const responsibleTeams = new Set(["Safety", "Security", "Health", "Others", ""]);
const incidentSeverities = new Set(["Low", "Medium", "High", "Critical"]);
const maxAttachmentSize = 10 * 1024 * 1024;
const maxIncidentImageBytes = 3 * 1024 * 1024;
const allowedIncidentImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const allowedIncidentImageExt = /\.(jpe?g|png|webp)$/i;
const allowedAttachmentTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain"
]);

function getText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function normalizeOptional(value: string) {
  return value.length ? value : null;
}

async function saveIncidentImageFiles(
  files: File[],
  incidentId: number
): Promise<[string | null, string | null, string | null, string | null, string | null]> {
  const uploadDirectory = join(process.cwd(), "public", "uploads", "incidents");
  await mkdir(uploadDirectory, { recursive: true });

  const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const slots: [string | null, string | null, string | null, string | null, string | null] = [
    null,
    null,
    null,
    null,
    null
  ];

  for (let i = 0; i < Math.min(files.length, 5); i++) {
    const file = files[i];

    if (file.size > maxIncidentImageBytes) {
      throw new Error("Incident images: Each picture must be 3 MB or smaller.");
    }

    if (file.size === 0) {
      continue;
    }

    const mimeOk = allowedIncidentImageTypes.has(file.type);
    const extOk = allowedIncidentImageExt.test(file.name);
    if (!mimeOk && !extOk) {
      throw new Error("Incident images: Only JPG, JPEG, PNG, and WEBP are allowed.");
    }

    const rawExt = extname(file.name).toLowerCase().replace(/[^a-z0-9.]/g, "");
    let safeExt = ".jpg";
    if (rawExt === ".png") {
      safeExt = ".png";
    } else if (rawExt === ".webp") {
      safeExt = ".webp";
    } else if (rawExt === ".jpeg" || rawExt === ".jpg") {
      safeExt = ".jpg";
    }

    const fileName = `incident_${incidentId}_image${i + 1}_${dateStamp}_${randomUUID().slice(0, 8)}${safeExt}`;
    const bytes = Buffer.from(await file.arrayBuffer());
    await writeFile(join(uploadDirectory, fileName), bytes);
    slots[i] = `/uploads/incidents/${fileName}`;
  }

  return slots;
}

function validateIncidentImageFiles(files: File[]) {
  if (files.length > 5) {
    throw new Error("Incident images: You can upload at most 5 pictures.");
  }

  const nonEmpty = files.filter((f) => f.size > 0);

  for (const file of nonEmpty) {
    if (file.size > maxIncidentImageBytes) {
      throw new Error("Incident images: Each picture must be 3 MB or smaller.");
    }

    const mimeOk = allowedIncidentImageTypes.has(file.type);
    const extOk = allowedIncidentImageExt.test(file.name);
    if (!mimeOk && !extOk) {
      throw new Error("Incident images: Only JPG, JPEG, PNG, and WEBP are allowed.");
    }
  }
}

async function saveAttachment(file: File | null) {
  if (!file || file.size === 0) {
    return null;
  }

  if (file.size > maxAttachmentSize) {
    throw new Error("Attachment must be 10 MB or smaller.");
  }

  if (!allowedAttachmentTypes.has(file.type)) {
    throw new Error("Attachment must be an image, PDF, Word, Excel, or text document.");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const safeExtension = extname(file.name).replace(/[^a-zA-Z0-9.]/g, "");
  const fileName = `${randomUUID()}${safeExtension}`;
  const uploadDirectory = join(process.cwd(), "public", "uploads", "incidents");

  await mkdir(uploadDirectory, { recursive: true });
  await writeFile(join(uploadDirectory, fileName), bytes);

  return `/uploads/incidents/${fileName}`;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const volunteerName = getText(formData, "VolunteerName");
    const volunteerPhone = getText(formData, "VolunteerPhone");
    const incidentCategory = getText(formData, "IncidentCategory");
    const concernedPersonName = getText(formData, "ConcernedPersonName");
    const regionalCouncil = getText(formData, "RegionalCouncil");
    const localCouncil = getText(formData, "LocalCouncil");
    const incidentType = getText(formData, "IncidentType");
    const incidentLocation = getText(formData, "IncidentLocation");
    const additionalNotes = getText(formData, "AdditionalNotes");
    const responsibleTeam = getText(formData, "ResponsibleTeam");
    const incidentSeverity = getText(formData, "IncidentSeverity");
    const requireAllFields = getText(formData, "RequireAllFields") === "1";
    const attachment = formData.get("Attachment");

    if (!volunteerName || !incidentCategory || !incidentSeverity) {
      return NextResponse.json(
        { error: "VolunteerName, IncidentCategory, and IncidentSeverity are required." },
        { status: 400 }
      );
    }

    if (requireAllFields) {
      const requiredFields = [
        [volunteerName, "VolunteerName"],
        [volunteerPhone, "VolunteerPhone"],
        [incidentCategory, "IncidentCategory"],
        [concernedPersonName, "ConcernedPersonName"],
        [regionalCouncil, "RegionalCouncil"],
        [localCouncil, "LocalCouncil"],
        [incidentType, "IncidentType"],
        [incidentLocation, "IncidentLocation"],
        [additionalNotes, "AdditionalNotes"],
        [responsibleTeam, "ResponsibleTeam"],
        [incidentSeverity, "IncidentSeverity"]
      ];
      const missingField = requiredFields.find(([value]) => !value);

      if (missingField) {
        return NextResponse.json({ error: `${missingField[1]} is required.` }, { status: 400 });
      }

    }

    if (volunteerPhone && !/^\d{4}-\d{7}$/.test(volunteerPhone)) {
      return NextResponse.json({ error: "VolunteerPhone must use format 0346-9750336." }, { status: 400 });
    }

    const { map: regionalCouncilMap } = await getResolvedCouncilMapWithSource();

    if (regionalCouncil && !localCouncil) {
      return NextResponse.json({ error: "LocalCouncil is required when RegionalCouncil is selected." }, { status: 400 });
    }

    if (regionalCouncil && !regionalCouncilMap[regionalCouncil]) {
      return NextResponse.json({ error: "RegionalCouncil is invalid." }, { status: 400 });
    }

    if (regionalCouncil && !regionalCouncilMap[regionalCouncil].includes(localCouncil)) {
      return NextResponse.json({ error: "LocalCouncil is not valid for the selected RegionalCouncil." }, { status: 400 });
    }

    if (!incidentCategories.has(incidentCategory)) {
      return NextResponse.json({ error: "IncidentCategory is invalid." }, { status: 400 });
    }

    if (!responsibleTeams.has(responsibleTeam)) {
      return NextResponse.json({ error: "ResponsibleTeam is invalid." }, { status: 400 });
    }

    if (!incidentSeverities.has(incidentSeverity)) {
      return NextResponse.json({ error: "IncidentSeverity is invalid." }, { status: 400 });
    }

    const incidentImageParts = formData
      .getAll("IncidentImages")
      .filter((item): item is File => item instanceof File);

    try {
      validateIncidentImageFiles(incidentImageParts);
    } catch (validationError) {
      const msg = validationError instanceof Error ? validationError.message : "Invalid incident images.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const incidentImages = incidentImageParts.filter((f) => f.size > 0);

    const attachmentPath = await saveAttachment(attachment instanceof File ? attachment : null);
    const pool = await getSqlPool();
    const result = await pool
      .request()
      .input("VolunteerName", sql.NVarChar(150), volunteerName)
      .input("VolunteerPhone", sql.NVarChar(30), normalizeOptional(volunteerPhone))
      .input("IncidentCategory", sql.NVarChar(50), incidentCategory)
      .input("ConcernedPersonName", sql.NVarChar(150), normalizeOptional(concernedPersonName))
      .input("RegionalCouncil", sql.NVarChar(150), normalizeOptional(regionalCouncil))
      .input("LocalCouncil", sql.NVarChar(150), normalizeOptional(localCouncil))
      .input("IncidentType", sql.NVarChar(sql.MAX), normalizeOptional(incidentType))
      .input("IncidentLocation", sql.NVarChar(sql.MAX), normalizeOptional(incidentLocation))
      .input("AdditionalNotes", sql.NVarChar(sql.MAX), normalizeOptional(additionalNotes))
      .input("ResponsibleTeam", sql.NVarChar(50), normalizeOptional(responsibleTeam))
      .input("AttachmentPath", sql.NVarChar(500), attachmentPath)
      .input("IncidentSeverity", sql.NVarChar(50), incidentSeverity)
      .input("CreatedBy", sql.NVarChar(100), "Public Form").query(`
        INSERT INTO [rifiiorg].[Incident_Reporting] (
          VolunteerName,
          VolunteerPhone,
          IncidentCategory,
          ConcernedPersonName,
          RegionalCouncil,
          LocalCouncil,
          IncidentType,
          IncidentLocation,
          AdditionalNotes,
          ResponsibleTeam,
          AttachmentPath,
          Image1Path,
          Image2Path,
          Image3Path,
          Image4Path,
          Image5Path,
          IncidentSeverity,
          CreatedBy,
          CreatedDate,
          UpdatedBy,
          UpdatedDate,
          IsActive
        )
        OUTPUT INSERTED.IncidentID
        VALUES (
          @VolunteerName,
          @VolunteerPhone,
          @IncidentCategory,
          @ConcernedPersonName,
          @RegionalCouncil,
          @LocalCouncil,
          @IncidentType,
          @IncidentLocation,
          @AdditionalNotes,
          @ResponsibleTeam,
          @AttachmentPath,
          NULL,
          NULL,
          NULL,
          NULL,
          NULL,
          @IncidentSeverity,
          @CreatedBy,
          GETDATE(),
          NULL,
          NULL,
          1
        );
      `);

    const incidentId = result.recordset[0]?.IncidentID as number | undefined;

    if (!incidentId) {
      return NextResponse.json({ error: "Incident could not be created.", success: false }, { status: 500 });
    }

    if (incidentImages.length > 0) {
      const [image1Path, image2Path, image3Path, image4Path, image5Path] = await saveIncidentImageFiles(
        incidentImages,
        incidentId
      );

      await pool
        .request()
        .input("IncidentID", sql.Int, incidentId)
        .input("Image1Path", sql.NVarChar(500), image1Path)
        .input("Image2Path", sql.NVarChar(500), image2Path)
        .input("Image3Path", sql.NVarChar(500), image3Path)
        .input("Image4Path", sql.NVarChar(500), image4Path)
        .input("Image5Path", sql.NVarChar(500), image5Path)
        .query(`
          UPDATE [rifiiorg].[Incident_Reporting]
          SET
            Image1Path = @Image1Path,
            Image2Path = @Image2Path,
            Image3Path = @Image3Path,
            Image4Path = @Image4Path,
            Image5Path = @Image5Path
          WHERE IncidentID = @IncidentID;
        `);
    }

    return NextResponse.json({
      success: true,
      message: "Your Incident Report has been updated successfully.",
      incidentId
    });
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "Unable to save incident.";
    const sqlError = getSqlErrorDetails(error);

    if (rawMessage.startsWith("Attachment") || rawMessage.startsWith("Incident images:")) {
      console.error("Insert Error:", rawMessage);
      return NextResponse.json(
        {
          success: false,
          message: "Failed to save incident",
          error: rawMessage
        },
        { status: 400 }
      );
    }

    if (rawMessage.includes("SQL Server environment variables are not configured")) {
      console.error("Insert Error:", sqlError);
      return NextResponse.json(
        {
          success: false,
          message: "Failed to save incident",
          error: sqlError.message,
          code: sqlError.code
        },
        { status: 503 }
      );
    }

    console.error("Insert Error:", sqlError);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to save incident",
        error: sqlError.message,
        code: sqlError.code
      },
      { status: 500 }
    );
  }
}
