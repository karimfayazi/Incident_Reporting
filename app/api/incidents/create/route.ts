import { existsSync } from "fs";
import { mkdir, stat, unlink, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { getSqlErrorDetails, getSqlPool, sql } from "@/lib/db";

export const runtime = "nodejs";

const incidentCategories = new Set(["Safety", "Security", "Health", "Others"]);
const responsibleTeams = new Set(["Safety", "Security", "Health", "Others"]);
const incidentSeverities = new Set(["Low", "Medium", "High", "Critical"]);
const maxIncidentImageBytes = 1_048_576;
const allowedIncidentImageTypes = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const allowedIncidentImageExt = /\.(jpe?g|png|gif|webp)$/i;

function resolveUploadDirectory(): string {
  if (process.env.UPLOAD_DIR) {
    return path.resolve(process.env.UPLOAD_DIR);
  }
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), "uploads", "NC_IR_Upload");
}

function resolvePublicBaseUrl(requestUrl: string): string {
  if (process.env.INCIDENT_UPLOAD_PUBLIC_BASE_URL) {
    return process.env.INCIDENT_UPLOAD_PUBLIC_BASE_URL.replace(/\/$/, "");
  }
  if (process.env.BASE_URL) {
    return `${process.env.BASE_URL.replace(/\/$/, "")}/NC_IR_Upload`;
  }
  const origin = new URL(requestUrl).origin;
  return `${origin}/api/uploads`;
}

function getText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function jsonError(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}

function getFile(formData: FormData, key: string) {
  const value = formData.get(key);
  return value instanceof File && value.size > 0 ? value : null;
}

function hasAllowedImageExtension(file: File) {
  const ext = path.extname(file.name).toLowerCase();
  return allowedIncidentImageExt.test(ext);
}

function validateImageFile(file: File | null) {
  if (!file) {
    return;
  }
  if (file.size > maxIncidentImageBytes) {
    throw new Error("Each uploaded image must be 1 MB or smaller.");
  }
  if (!allowedIncidentImageTypes.has(file.type) && !hasAllowedImageExtension(file)) {
    throw new Error("Uploaded images must be JPG, JPEG, PNG, GIF, or WEBP.");
  }
}

async function ensureUploadDir(dir: string): Promise<void> {
  if (!existsSync(dir)) {
    console.log(`[UPLOAD] Creating upload directory: ${dir}`);
    await mkdir(dir, { recursive: true });
  }
  const stats = await stat(dir);
  if (!stats.isDirectory()) {
    throw new Error(`Upload path exists but is not a directory: ${dir}`);
  }
  console.log(`[UPLOAD] Upload directory confirmed: ${dir}`);
}

async function saveImageFile(
  file: File,
  incidentId: number,
  slot: number,
  uploadDir: string,
  publicBaseUrl: string
) {
  validateImageFile(file);
  const fileName = `${incidentId}-Image${slot}.jpg`;
  const absolutePath = path.join(uploadDir, fileName);

  console.log(`[UPLOAD] Processing Image${slot}: "${file.name}" (${file.size} bytes, type: ${file.type})`);

  const bytes = Buffer.from(await file.arrayBuffer());
  console.log(`[UPLOAD] Read ${bytes.length} bytes into buffer for Image${slot}`);

  const jpegBuffer = await sharp(bytes).rotate().jpeg({ quality: 85, mozjpeg: true }).toBuffer();
  console.log(`[UPLOAD] Converted to JPEG: ${jpegBuffer.length} bytes for Image${slot}`);

  await writeFile(absolutePath, jpegBuffer);
  console.log(`[UPLOAD] File written successfully: ${absolutePath}`);

  const fileStat = await stat(absolutePath);
  console.log(`[UPLOAD] Verified on disk: ${absolutePath} (${fileStat.size} bytes)`);

  const publicUrl = `${publicBaseUrl}/${fileName}`;
  console.log(`[UPLOAD] Public URL: ${publicUrl}`);

  return { absolutePath, publicUrl };
}

async function deleteUploadedFiles(paths: string[]) {
  for (const filePath of paths) {
    try {
      await unlink(filePath);
      console.log(`[UPLOAD] Cleaned up file: ${filePath}`);
    } catch (error) {
      console.error(`[UPLOAD] Failed to clean up: ${filePath}`, error);
    }
  }
}

export async function POST(request: Request) {
  console.log("[INCIDENT] === POST /api/record-incident started ===");

  try {
    const formData = await request.formData();
    console.log("[INCIDENT] FormData parsed successfully");

    const darbarLocation = getText(formData, "Darbar_Location");
    const region = getText(formData, "Region");
    const localCouncil = getText(formData, "LocalCouncil");
    const volunteerName = getText(formData, "VolunteerName");
    const volunteerPhone = getText(formData, "VolunteerPhone");
    const incidentCategory = getText(formData, "IncidentCategory");
    const incidentTitle = getText(formData, "IncidentTitle");
    const villageLocation = getText(formData, "VillageLocation");
    const incidentDescription = getText(formData, "IncidentDescription");
    const incidentPlace = getText(formData, "IncidentPlace");
    const responsibleTeam = getText(formData, "ResponsibleTeam");
    const incidentSeverity = getText(formData, "IncidentSeverity");

    const imageFiles = [
      getFile(formData, "Image1File"),
      getFile(formData, "Image2File"),
      getFile(formData, "Image3File")
    ];

    const imageCount = imageFiles.filter(Boolean).length;
    console.log(`[INCIDENT] Fields parsed. Images attached: ${imageCount}`);

    const requiredFields = [
      [darbarLocation, "Darbar Location"],
      [volunteerName, "Name of Volunteer"],
      [volunteerPhone, "Phone Number of Volunteer"],
      [incidentCategory, "Incident Category"],
      [incidentTitle, "What is the incident about?"],
      [region, "Regional Council"],
      [localCouncil, "Local Council"],
      [villageLocation, "Village / Location"],
      [incidentDescription, "Describe what happened"],
      [incidentPlace, "Where did it happen?"],
      [responsibleTeam, "Which team should handle this?"],
      [incidentSeverity, "How serious is the incident?"]
    ];
    const missingField = requiredFields.find(([value]) => !value);

    if (missingField) {
      return jsonError(`${missingField[1]} is required.`);
    }

    if (!incidentCategories.has(incidentCategory)) {
      return jsonError("Incident Category is invalid.");
    }
    if (!responsibleTeams.has(responsibleTeam)) {
      return jsonError("Which team should handle this? is invalid.");
    }
    if (!incidentSeverities.has(incidentSeverity)) {
      return jsonError("How serious is the incident? is invalid.");
    }

    try {
      imageFiles.forEach(validateImageFile);
    } catch (validationError) {
      return jsonError(validationError instanceof Error ? validationError.message : "Uploaded images are invalid.");
    }

    const uploadDir = resolveUploadDirectory();
    const publicBaseUrl = resolvePublicBaseUrl(request.url);
    console.log(`[INCIDENT] Upload dir: ${uploadDir}`);
    console.log(`[INCIDENT] Public base URL: ${publicBaseUrl}`);

    await ensureUploadDir(uploadDir);

    const uploadedImagePaths: string[] = [];
    const imageUrls: Array<string | null> = [null, null, null];

    const pool = await getSqlPool();
    console.log("[INCIDENT] Database pool acquired");

    const transaction = new sql.Transaction(pool);
    let incidentId: number | undefined;
    let transactionOpen = false;

    try {
      await transaction.begin();
      transactionOpen = true;
      console.log("[INCIDENT] Transaction started");

      const locationResult = await new sql.Request(transaction)
        .input("Darbar_Location", sql.NVarChar(255), darbarLocation)
        .input("Region", sql.NVarChar(150), region)
        .input("LocalCouncil", sql.NVarChar(150), localCouncil)
        .query<{
          DidargahName: string;
          RegionalCouncilName: string;
          LocalCouncilName: string;
        }>(`
          SELECT TOP (1)
            LTRIM(RTRIM(DidargahName)) AS DidargahName,
            LTRIM(RTRIM(RegionalCouncilName)) AS RegionalCouncilName,
            LTRIM(RTRIM(LocalCouncilName)) AS LocalCouncilName
          FROM [_rifiiorg_db].[rifiiorg].[View_RC_LC_List]
          WHERE LTRIM(RTRIM(DidargahName)) = @Darbar_Location
            AND LTRIM(RTRIM(RegionalCouncilName)) = @Region
            AND LTRIM(RTRIM(LocalCouncilName)) = @LocalCouncil;
        `);
      const location = locationResult.recordset[0];

      if (!location) {
        await transaction.rollback();
        transactionOpen = false;
        return jsonError("Darbar Location, Regional Council, and Local Council selection is invalid.");
      }

      console.log("[INCIDENT] Location validated:", location.DidargahName);

      const insertResult = await new sql.Request(transaction)
        .input("Darbar_Location", sql.NVarChar(255), location.DidargahName)
        .input("VolunteerName", sql.NVarChar(150), volunteerName)
        .input("VolunteerPhone", sql.NVarChar(50), volunteerPhone)
        .input("IncidentCategory", sql.NVarChar(50), incidentCategory)
        .input("IncidentTitle", sql.NVarChar(255), incidentTitle)
        .input("Region", sql.NVarChar(150), location.RegionalCouncilName)
        .input("LocalCouncil", sql.NVarChar(150), location.LocalCouncilName)
        .input("VillageLocation", sql.NVarChar(sql.MAX), villageLocation)
        .input("IncidentDescription", sql.NVarChar(sql.MAX), incidentDescription)
        .input("IncidentPlace", sql.NVarChar(sql.MAX), incidentPlace)
        .input("ResponsibleTeam", sql.NVarChar(50), responsibleTeam)
        .input("IncidentSeverity", sql.NVarChar(50), incidentSeverity)
        .query(`
          INSERT INTO [_rifiiorg_db].[rifiiorg].[NC_RI_Incident_Reporting] (
            Darbar_Location,
            VolunteerName,
            VolunteerPhone,
            IncidentCategory,
            IncidentTitle,
            Region,
            LocalCouncil,
            VillageLocation,
            IncidentDescription,
            IncidentPlace,
            ResponsibleTeam,
            IncidentSeverity,
            CreatedDate,
            UpdatedDate,
            IsActive,
            Incident_Status,
            Image1,
            Image2,
            Image3
          )
          OUTPUT INSERTED.IncidentID
          VALUES (
            @Darbar_Location,
            @VolunteerName,
            @VolunteerPhone,
            @IncidentCategory,
            @IncidentTitle,
            @Region,
            @LocalCouncil,
            @VillageLocation,
            @IncidentDescription,
            @IncidentPlace,
            @ResponsibleTeam,
            @IncidentSeverity,
            GETDATE(),
            NULL,
            1,
            'Open',
            NULL,
            NULL,
            NULL
          );
        `);

      incidentId = insertResult.recordset[0]?.IncidentID as number | undefined;

      if (!incidentId) {
        throw new Error("Database did not return an IncidentID after insert.");
      }

      console.log(`[INCIDENT] Inserted IncidentID: ${incidentId}`);

      for (let index = 0; index < imageFiles.length; index += 1) {
        const file = imageFiles[index];
        if (!file) continue;

        const saved = await saveImageFile(file, incidentId, index + 1, uploadDir, publicBaseUrl);
        uploadedImagePaths.push(saved.absolutePath);
        imageUrls[index] = saved.publicUrl;
      }

      if (imageUrls.some(Boolean)) {
        console.log("[INCIDENT] Updating DB with image URLs:", imageUrls);
        await new sql.Request(transaction)
          .input("IncidentID", sql.Int, incidentId)
          .input("Image1", sql.NVarChar(1000), imageUrls[0])
          .input("Image2", sql.NVarChar(1000), imageUrls[1])
          .input("Image3", sql.NVarChar(1000), imageUrls[2])
          .query(`
            UPDATE [_rifiiorg_db].[rifiiorg].[NC_RI_Incident_Reporting]
            SET
              Image1 = @Image1,
              Image2 = @Image2,
              Image3 = @Image3,
              UpdatedDate = GETDATE()
            WHERE IncidentID = @IncidentID;
          `);
      }

      await transaction.commit();
      transactionOpen = false;
      console.log(`[INCIDENT] Transaction committed. IncidentID=${incidentId}, images=${uploadedImagePaths.length}`);
    } catch (error) {
      if (transactionOpen) {
        await transaction.rollback().catch((rollbackError) => {
          console.error("[INCIDENT] Transaction rollback failed:", rollbackError);
        });
        transactionOpen = false;
      }
      await deleteUploadedFiles(uploadedImagePaths);
      throw error;
    }

    console.log("[INCIDENT] === SUCCESS ===");
    return NextResponse.json({
      success: true,
      message: "Incident report submitted successfully.",
      incidentId
    });
  } catch (error) {
    console.error("[INCIDENT] === FAILURE ===");
    console.error("[INCIDENT] Raw error:", error);
    const details = getSqlErrorDetails(error);
    console.error("[INCIDENT] SQL details:", details);

    if (details.code === "ELOGIN" || details.code === "ETIMEOUT" || details.code === "ESOCKET") {
      return jsonError("Database connection failed. Please try again or contact support.", 503);
    }
    if (details.code === "EPARAM") {
      return jsonError("The incident form contains a value that could not be sent to the database.", 400);
    }
    return jsonError("Incident report could not be saved because the database rejected the request.", 500);
  }
}
