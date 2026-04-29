"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { regionalCouncilMap } from "@/lib/council-data";

const categoryOptions = ["Safety", "Security", "Health", "Others"];
const severityOptions = ["Low", "Medium", "High", "Critical"];
const maxIncidentImageBytes = 3 * 1024 * 1024;
const maxIncidentImages = 5;
const allowedIncidentImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const allowedIncidentImageExt = /\.(jpe?g|png|webp)$/i;

function formatVolunteerPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);

  if (digits.length <= 4) {
    return digits;
  }

  return `${digits.slice(0, 4)}-${digits.slice(4)}`;
}

type IncidentFormProps = {
  onSubmitted?: () => Promise<void> | void;
  endpoint?: string;
  useCouncilDropdowns?: boolean;
  requireAllFields?: boolean;
};

type ToastState = {
  type: "success" | "error";
  message: string;
} | null;

export function IncidentForm({
  onSubmitted,
  endpoint = "/api/incidents/create",
  useCouncilDropdowns = false,
  requireAllFields = false
}: IncidentFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [phone, setPhone] = useState("");
  const [regionalCouncil, setRegionalCouncil] = useState("");
  const [localCouncil, setLocalCouncil] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState<ToastState>(null);
  const [councilMap, setCouncilMap] = useState<Record<string, string[]>>(() => ({ ...regionalCouncilMap }));
  const [councilsLoading, setCouncilsLoading] = useState(false);
  const [councilsNotice, setCouncilsNotice] = useState("");
  const [incidentImageFiles, setIncidentImageFiles] = useState<File[]>([]);
  const [incidentImagePreviews, setIncidentImagePreviews] = useState<string[]>([]);
  const incidentImagesInputRef = useRef<HTMLInputElement>(null);

  const regionalKeys = Object.keys(councilMap);
  const localCouncilOptions = regionalCouncil ? councilMap[regionalCouncil] ?? [] : [];

  useEffect(() => {
    if (!useCouncilDropdowns) {
      return;
    }

    let cancelled = false;

    async function loadCouncils() {
      setCouncilsLoading(true);
      setCouncilsNotice("");
      try {
        const response = await fetch("/api/councils");
        const data = (await response.json()) as {
          success?: boolean;
          map?: Record<string, string[]>;
          source?: string;
          message?: string;
        };

        if (cancelled) {
          return;
        }

        if (data.success && data.map && Object.keys(data.map).length > 0) {
          setCouncilMap(data.map);
          if (data.source === "static") {
            setCouncilsNotice("Council list is using built-in data (database lookup empty or not configured).");
          } else {
            setCouncilsNotice("");
          }
        } else {
          setCouncilMap({ ...regionalCouncilMap });
          setCouncilsNotice(
            typeof data.message === "string" && data.message.length > 0
              ? data.message
              : "Could not load councils from the database. Using built-in list."
          );
        }
      } catch {
        if (!cancelled) {
          setCouncilMap({ ...regionalCouncilMap });
          setCouncilsNotice("Could not load councils from the database. Using built-in list.");
        }
      } finally {
        if (!cancelled) {
          setCouncilsLoading(false);
        }
      }
    }

    void loadCouncils();

    return () => {
      cancelled = true;
    };
  }, [useCouncilDropdowns]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeoutId = window.setTimeout(() => setToast(null), 4000);

    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  useEffect(() => {
    const urls = incidentImageFiles.map((file) => URL.createObjectURL(file));
    setIncidentImagePreviews(urls);

    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [incidentImageFiles]);

  const validateIncidentImagesClient = (files: File[]): string | null => {
    if (files.length > maxIncidentImages) {
      return `You can upload at most ${maxIncidentImages} pictures.`;
    }

    for (const file of files) {
      if (file.size === 0) {
        continue;
      }

      if (file.size > maxIncidentImageBytes) {
        return "Each picture must be 3 MB or smaller.";
      }

      if (!allowedIncidentImageTypes.has(file.type) && !allowedIncidentImageExt.test(file.name)) {
        return "Pictures must be JPG, JPEG, PNG, or WEBP.";
      }
    }

    return null;
  };

  const handleIncidentImagesChange = (filesList: FileList | null) => {
    const next = filesList ? Array.from(filesList) : [];

    if (next.length > maxIncidentImages) {
      setError(`You can upload at most ${maxIncidentImages} pictures.`);
      setIncidentImageFiles([]);
      if (incidentImagesInputRef.current) {
        incidentImagesInputRef.current.value = "";
      }

      return;
    }

    const msg = validateIncidentImagesClient(next);
    if (msg) {
      setError(msg);
      setIncidentImageFiles([]);
      if (incidentImagesInputRef.current) {
        incidentImagesInputRef.current.value = "";
      }

      return;
    }

    setError("");
    setIncidentImageFiles(next);
  };

  const handlePhoneChange = (value: string) => {
    setPhone(formatVolunteerPhone(value));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");

    const formData = new FormData(event.currentTarget);

    if (!formData.get("VolunteerName") || !formData.get("IncidentCategory") || !formData.get("IncidentSeverity")) {
      setError("Volunteer name, incident category, and incident severity are required.");
      return;
    }

    if (useCouncilDropdowns && (!formData.get("RegionalCouncil") || !formData.get("LocalCouncil"))) {
      setError("Regional council and local council are required.");
      return;
    }

    if (requireAllFields) {
      const requiredFields = [
        ["VolunteerName", "Volunteer name"],
        ["VolunteerPhone", "Volunteer phone"],
        ["IncidentCategory", "Incident category"],
        ["ConcernedPersonName", "Concerned person name"],
        ["LocalCouncil", "Local council"],
        ["IncidentType", "Incident type"],
        ["IncidentLocation", "Incident location"],
        ["AdditionalNotes", "Additional notes"],
        ["ResponsibleTeam", "Responsible team"],
        ["IncidentSeverity", "Incident severity"]
      ];

      if (useCouncilDropdowns) {
        requiredFields.splice(4, 0, ["RegionalCouncil", "Regional council"]);
      }

      const missingField = requiredFields.find(([name]) => !formData.get(name));

      if (missingField) {
        setError(`${missingField[1]} is required.`);
        return;
      }
    }

    const incidentImageParts = Array.from(formData.getAll("IncidentImages")).filter(
      (item): item is File => item instanceof File
    );
    const incidentImagesErr = validateIncidentImagesClient(incidentImageParts);
    if (incidentImagesErr) {
      setError(incidentImagesErr);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        body: formData
      });

      const result = (await response.json()) as {
        success?: boolean;
        error?: string;
        message?: string;
      };

      if (!response.ok || !result?.success) {
        const apiMsg =
          typeof result?.error === "string" && result.error.length > 0
            ? result.error
            : typeof result?.message === "string" && result.message.length > 0
              ? result.message
              : "Incident could not be submitted.";
        throw new Error(apiMsg);
      }

      setMessage("Your Incident Report has been updated successfully.");
      setToast({
        type: "success",
        message: "Your Incident Report has been updated successfully."
      });
      setPhone("");
      setRegionalCouncil("");
      setLocalCouncil("");
      setIncidentImageFiles([]);
      if (incidentImagesInputRef.current) {
        incidentImagesInputRef.current.value = "";
      }
      formRef.current?.reset();
      await onSubmitted?.();
    } catch (submitError) {
      const friendly =
        submitError instanceof Error && submitError.message.length > 0
          ? submitError.message
          : "Something went wrong while saving the incident. Please try again.";
      setError(friendly);
      setToast({
        type: "error",
        message: friendly
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {toast ? (
        <div className="toast-overlay" role="status" aria-live="polite">
          <div className={`toast-card toast-card--${toast.type}`}>
            <span className="toast-icon" aria-hidden="true">
              {toast.type === "success" ? "✓" : "!"}
            </span>
            <p>{toast.message}</p>
            <button type="button" aria-label="Close message" onClick={() => setToast(null)}>
              Close
            </button>
          </div>
        </div>
      ) : null}

      <form className="incident-form" ref={formRef} onSubmit={handleSubmit}>
        {requireAllFields ? <input type="hidden" name="RequireAllFields" value="1" /> : null}
        <section className="form-section" aria-labelledby="volunteer-info">
          <h4 id="volunteer-info">A. Volunteer Information</h4>
          <div className="form-grid">
            <div className="form-row form-row--responsive volunteer-contact-row">
              <div className="field">
                <label htmlFor="VolunteerName">
                  Name of Volunteer <span className="required">*</span>
                </label>
                <input id="VolunteerName" name="VolunteerName" required />
              </div>

              <div className="field">
                <label htmlFor="VolunteerPhone">Phone Number of Volunteer</label>
                <input
                  id="VolunteerPhone"
                  name="VolunteerPhone"
                  inputMode="tel"
                  maxLength={12}
                  pattern="[0-9]{4}-[0-9]{7}"
                  placeholder="0346-9750336"
                  required={requireAllFields}
                  value={phone}
                  onChange={(event) => handlePhoneChange(event.target.value)}
                />
                <p className="help-text">Format: 0346-9750336</p>
              </div>
            </div>

            <div className="field field--full">
              <label htmlFor="IncidentCategory">
                Incident Category <span className="required">*</span>
              </label>
              <select id="IncidentCategory" name="IncidentCategory" required defaultValue="">
                <option value="" disabled>
                  Select incident category
                </option>
                {categoryOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="form-section" aria-labelledby="concerned-details">
          <h4 id="concerned-details">B. Concerned Individual Details</h4>
          <div className="form-grid">
            <div className="field field--full">
              <label htmlFor="ConcernedPersonName">
                Name of Concerned Person {requireAllFields ? <span className="required">*</span> : null}
              </label>
              <input id="ConcernedPersonName" name="ConcernedPersonName" required={requireAllFields} />
            </div>

            {useCouncilDropdowns ? (
              <>
                {councilsNotice ? (
                  <p className="help-text council-fetch-notice" role="status" aria-live="polite">
                    {councilsNotice}
                  </p>
                ) : null}
                <div className="form-row form-row--responsive form-row--councils">
                  <div className="field">
                    <label htmlFor="RegionalCouncil">
                      Regional Council <span className="required">*</span>
                    </label>
                    <select
                      id="RegionalCouncil"
                      name="RegionalCouncil"
                      required
                      disabled={councilsLoading}
                      value={regionalCouncil}
                      onChange={(event) => {
                        setRegionalCouncil(event.target.value);
                        setLocalCouncil("");
                      }}
                    >
                      <option value="" disabled>
                        {councilsLoading ? "Loading…" : "Select regional council"}
                      </option>
                      {regionalKeys.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label htmlFor="LocalCouncil">
                      Local Council <span className="required">*</span>
                    </label>
                    <select
                      id="LocalCouncil"
                      name="LocalCouncil"
                      required
                      disabled={!regionalCouncil || councilsLoading}
                      value={localCouncil}
                      onChange={(event) => setLocalCouncil(event.target.value)}
                    >
                      <option value="" disabled>
                        {regionalCouncil ? "Select local council" : "Select regional council first"}
                      </option>
                      {localCouncilOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                    <p className="help-text" aria-live="polite">
                      {regionalCouncil
                        ? `${localCouncilOptions.length} local councils available for ${regionalCouncil}.`
                        : "Local councils will appear after selecting a regional council."}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="field field--full">
                <label htmlFor="LocalCouncil">
                  Local Council {requireAllFields ? <span className="required">*</span> : null}
                </label>
                <input id="LocalCouncil" name="LocalCouncil" required={requireAllFields} />
              </div>
            )}

            <div className="field field--full">
              <label htmlFor="IncidentType">
                What type of incident are you reporting? {requireAllFields ? <span className="required">*</span> : null}
              </label>
              <textarea id="IncidentType" name="IncidentType" required={requireAllFields} />
            </div>

            <div className="field field--full">
              <label htmlFor="IncidentLocation">
                Where did the incident occur? {requireAllFields ? <span className="required">*</span> : null}
              </label>
              <textarea id="IncidentLocation" name="IncidentLocation" required={requireAllFields} />
            </div>

            <div className="form-row form-row--responsive form-row--team-severity">
              <div className="field">
                <label htmlFor="ResponsibleTeam">
                  Select the team responsible for the issue {requireAllFields ? <span className="required">*</span> : null}
                </label>
                <select id="ResponsibleTeam" name="ResponsibleTeam" required={requireAllFields} defaultValue="">
                  <option value="">Select responsible team</option>
                  {categoryOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="IncidentSeverity">
                  Incident Severity <span className="required">*</span>
                </label>
                <select id="IncidentSeverity" name="IncidentSeverity" required defaultValue="">
                  <option value="" disabled>
                    Select severity
                  </option>
                  {severityOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="field field--full">
              <label htmlFor="AdditionalNotes">
                Additional Notes for CC Agent {requireAllFields ? <span className="required">*</span> : null}
              </label>
              <textarea id="AdditionalNotes" name="AdditionalNotes" required={requireAllFields} />
            </div>

            <div className="field field--full incident-images-panel">
              <div className="incident-images-panel__heading-block">
                <h5 className="incident-images-panel__title">Upload Incident Pictures</h5>
                <p className="help-text incident-images-panel__intro">
                  You can upload up to 5 pictures related to this incident.
                </p>
              </div>
              <label className="incident-images-panel__label" htmlFor="IncidentImages">
                Select pictures (optional)
              </label>
              <input
                ref={incidentImagesInputRef}
                id="IncidentImages"
                name="IncidentImages"
                type="file"
                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                multiple
                className="incident-images-panel__file-input"
                onChange={(event) => handleIncidentImagesChange(event.target.files)}
                aria-describedby="incident-images-hint"
              />
              <p id="incident-images-hint" className="help-text">
                JPG, JPEG, PNG, or WEBP — maximum 3 MB per picture ({maxIncidentImages} pictures maximum).
              </p>
              {incidentImageFiles.length > 0 ? (
                <ul className="incident-images-file-list" aria-label="Selected incident pictures">
                  {incidentImageFiles.map((file, index) => (
                    <li key={`${file.name}-${file.lastModified}-${index}`}>
                      <span className="incident-images-file-list__name">{file.name}</span>
                      <span className="incident-images-file-list__meta">
                        {(file.size / 1024).toFixed(1)} KB · Slot {index + 1}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {incidentImagePreviews.length > 0 ? (
                <div className="incident-images-previews">
                  {incidentImagePreviews.map((src, index) => (
                    <img
                      key={`${src}-${index}`}
                      src={src}
                      alt={`Preview ${index + 1}`}
                      className="incident-images-previews__thumb"
                    />
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <div className="form-actions">
          <button className="primary-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Submitting..." : "Submit Incident"}
          </button>
          {message ? <p className="status-message">{message}</p> : null}
          {error ? <p className="status-message status-message--error">{error}</p> : null}
        </div>
      </form>
    </>
  );
}
