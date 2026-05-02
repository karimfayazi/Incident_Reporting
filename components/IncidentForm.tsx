"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

const categoryOptions = ["Safety", "Security", "Health", "Others"];
const severityOptions = ["Low", "Medium", "High", "Critical"];
const maxIncidentImageBytes = 1_048_576;
const allowedIncidentImageTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif"
]);
const allowedIncidentImageExt = /\.(jpe?g|png|gif|webp)$/i;

type IncidentFormProps = {
  onSubmitted?: () => Promise<void> | void;
  endpoint?: string;
};

type ToastState = {
  type: "success" | "error";
  message: string;
} | null;

type FieldErrors = Partial<Record<string, string>>;

type LocationCascadeRow = {
  DidargahName: string;
  RegionalCouncilName: string;
  LocalCouncilName: string;
};

function getUniqueSorted(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.map((value) => (typeof value === "string" ? value.trim() : "")).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));
}

function formatVolunteerPhone(value: string) {
  return value.replace(/[^\d+\-\s()]/g, "").slice(0, 20);
}

function validateIncidentImage(file: File): string | null {
  if (file.size > maxIncidentImageBytes) {
    return "Image must be 1 MB or smaller.";
  }

  if (!allowedIncidentImageTypes.has(file.type) && !allowedIncidentImageExt.test(file.name)) {
    return "Only JPG, JPEG, PNG, GIF, or WEBP images are allowed.";
  }

  return null;
}

export function IncidentForm({ onSubmitted, endpoint = "/api/record-incident" }: IncidentFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [phone, setPhone] = useState("");
  const [locationRows, setLocationRows] = useState<LocationCascadeRow[]>([]);
  const [selectedDarbarName, setSelectedDarbarName] = useState("");
  const [selectedRegionalCouncilName, setSelectedRegionalCouncilName] = useState("");
  const [selectedLocalCouncilName, setSelectedLocalCouncilName] = useState("");
  const [isLocationLoading, setIsLocationLoading] = useState(true);
  const [lookupError, setLookupError] = useState("");
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [toast, setToast] = useState<ToastState>(null);
  const [incidentImages, setIncidentImages] = useState<Array<File | null>>([null, null, null]);
  const [incidentImageErrors, setIncidentImageErrors] = useState<string[]>(["", "", ""]);
  const [incidentImagePreviews, setIncidentImagePreviews] = useState<string[]>(["", "", ""]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeoutId = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  useEffect(() => {
    const previews = incidentImages.map((file) => (file ? URL.createObjectURL(file) : ""));
    setIncidentImagePreviews(previews);

    return () => {
      previews.forEach((preview) => {
        if (preview) {
          URL.revokeObjectURL(preview);
        }
      });
    };
  }, [incidentImages]);

  useEffect(() => {
    let cancelled = false;

    async function loadDarbarLocations() {
      setIsLocationLoading(true);
      setLookupError("");

      try {
        const response = await fetch("/api/darbar-locations", { cache: "no-store" });
        const data = (await response.json().catch(() => ({}))) as {
          success?: boolean;
          message?: string;
          rows?: LocationCascadeRow[];
        };

        if (cancelled) {
          return;
        }

        if (!response.ok || !data.success) {
          throw new Error(data.message || "Darbar, Regional Council, and Local Council list could not be loaded.");
        }

        setLocationRows(Array.isArray(data.rows) ? data.rows : []);
      } catch (error) {
        if (!cancelled) {
          setLookupError(
            error instanceof Error
              ? error.message
              : "Darbar, Regional Council, and Local Council list could not be loaded."
          );
          setLocationRows([]);
        }
      } finally {
        if (!cancelled) {
          setIsLocationLoading(false);
        }
      }
    }

    void loadDarbarLocations();

    return () => {
      cancelled = true;
    };
  }, []);

  const darbarLocationOptions = useMemo(
    () => getUniqueSorted(locationRows.map((row) => row.DidargahName)),
    [locationRows]
  );
  const regionalCouncilOptions = useMemo(
    () =>
      getUniqueSorted(
        locationRows
          .filter((row) => row.DidargahName === selectedDarbarName)
          .map((row) => row.RegionalCouncilName)
      ),
    [locationRows, selectedDarbarName]
  );
  const localCouncilOptions = useMemo(
    () =>
      getUniqueSorted(
        locationRows
          .filter(
            (row) =>
              row.DidargahName === selectedDarbarName &&
              row.RegionalCouncilName === selectedRegionalCouncilName
          )
          .map((row) => row.LocalCouncilName)
      ),
    [locationRows, selectedDarbarName, selectedRegionalCouncilName]
  );

  function setErrorForRequired(formData: FormData, key: string, label: string, errors: FieldErrors) {
    if (!String(formData.get(key) ?? "").trim()) {
      errors[key] = `${label} is required.`;
    }
  }

  function handleIncidentImageChange(index: number, file: File | null, input: HTMLInputElement) {
    const nextImages = [...incidentImages];
    const nextErrors = [...incidentImageErrors];

    if (!file) {
      nextImages[index] = null;
      nextErrors[index] = "";
      setIncidentImages(nextImages);
      setIncidentImageErrors(nextErrors);
      return;
    }

    const imageError = validateIncidentImage(file);

    if (imageError) {
      input.value = "";
      nextImages[index] = null;
      nextErrors[index] = imageError;
    } else {
      nextImages[index] = file;
      nextErrors[index] = "";
    }

    setIncidentImages(nextImages);
    setIncidentImageErrors(nextErrors);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setMessage("");

    const formData = new FormData(event.currentTarget);
    const nextErrors: FieldErrors = {};

    [
      ["Darbar_Location", "Darbar Location"],
      ["VolunteerName", "Name of Volunteer"],
      ["VolunteerPhone", "Phone Number of Volunteer"],
      ["IncidentCategory", "Incident Category"],
      ["IncidentTitle", "What is the incident about?"],
      ["Region", "Regional Council"],
      ["LocalCouncil", "Local Council"],
      ["VillageLocation", "Village / Location"],
      ["IncidentDescription", "Describe what happened"],
      ["IncidentPlace", "Where did it happen?"],
      ["ResponsibleTeam", "Which team should handle this?"],
      ["IncidentSeverity", "How serious is the incident?"]
    ].forEach(([key, label]) => setErrorForRequired(formData, key, label, nextErrors));

    if (incidentImageErrors.some(Boolean)) {
      nextErrors.IncidentImages = "Please fix image upload errors before submitting.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setFormError("Please complete the required fields before submitting.");
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    try {
      incidentImages.forEach((file, index) => {
        if (file) {
          formData.set(`Image${index + 1}File`, file);
        }
      });

      const response = await fetch(endpoint, {
        method: "POST",
        body: formData
      });
      const result = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        message?: string;
        incidentId?: number;
      };

      if (!response.ok || !result.success) {
        throw new Error(result.error || result.message || "Incident report could not be submitted.");
      }

      const successMessage = result.incidentId
        ? `Incident report submitted successfully! Reference ID: ${result.incidentId}`
        : "Incident report submitted successfully!";
      setMessage(successMessage);
      setToast({ type: "success", message: successMessage });
      setPhone("");
      setSelectedDarbarName("");
      setSelectedRegionalCouncilName("");
      setSelectedLocalCouncilName("");
      setIncidentImages([null, null, null]);
      setIncidentImageErrors(["", "", ""]);
      formRef.current?.reset();
      await onSubmitted?.();
    } catch (error) {
      const friendly =
        error instanceof Error && error.message.length > 0
          ? error.message
          : "Something went wrong while saving the incident report. Please try again.";
      setFormError(friendly);
      setToast({ type: "error", message: friendly });
    } finally {
      setIsSubmitting(false);
    }
  }

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

      <form className="incident-form" ref={formRef} onSubmit={handleSubmit} noValidate>
        <section className="form-section" aria-labelledby="volunteer-info">
          <h4 id="volunteer-info">Volunteer Information</h4>
          <div className="form-grid">
            <div className="field field--full">
              <label htmlFor="Darbar_Location">
                Darbar Location <span className="required">*</span>
              </label>
              <select
                id="Darbar_Location"
                name="Darbar_Location"
                required
                value={selectedDarbarName}
                disabled={isLocationLoading}
                onChange={(event) => {
                  setSelectedDarbarName(event.target.value);
                  setSelectedRegionalCouncilName("");
                  setSelectedLocalCouncilName("");
                }}
              >
                <option value="" disabled>
                  {isLocationLoading ? "Loading Darbar Locations..." : "Select Darbar Location"}
                </option>
                {darbarLocationOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              {fieldErrors.Darbar_Location ? <p className="field-error">{fieldErrors.Darbar_Location}</p> : null}
              {lookupError ? (
                <p className="field-error" role="status">
                  {lookupError}
                </p>
              ) : null}
            </div>

            <div className="form-row form-row--responsive volunteer-contact-row">
              <div className="field">
                <label htmlFor="VolunteerName">
                  Name of Volunteer <span className="required">*</span>
                </label>
                <input id="VolunteerName" name="VolunteerName" required />
                {fieldErrors.VolunteerName ? <p className="field-error">{fieldErrors.VolunteerName}</p> : null}
              </div>

              <div className="field">
                <label htmlFor="VolunteerPhone">
                  Phone Number of Volunteer <span className="required">*</span>
                </label>
                <input
                  id="VolunteerPhone"
                  name="VolunteerPhone"
                  inputMode="tel"
                  placeholder="0346-9750336"
                  required
                  value={phone}
                  onChange={(event) => setPhone(formatVolunteerPhone(event.target.value))}
                />
                {fieldErrors.VolunteerPhone ? <p className="field-error">{fieldErrors.VolunteerPhone}</p> : null}
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
              {fieldErrors.IncidentCategory ? <p className="field-error">{fieldErrors.IncidentCategory}</p> : null}
            </div>
          </div>
        </section>

        <section className="form-section" aria-labelledby="incident-details">
          <h4 id="incident-details">Concerned Incident / Individual Details</h4>
          <div className="form-grid">
            <div className="field field--full">
              <label htmlFor="IncidentTitle">
                What is the incident about? <span className="required">*</span>
              </label>
              <input id="IncidentTitle" name="IncidentTitle" placeholder="Person, accident, fire, or any issue" required />
              {fieldErrors.IncidentTitle ? <p className="field-error">{fieldErrors.IncidentTitle}</p> : null}
            </div>

            <div className="form-row form-row--responsive form-row--councils">
              <div className="field">
                <label htmlFor="Region">
                  Regional Council <span className="required">*</span>
                </label>
                <select
                  id="Region"
                  name="Region"
                  required
                  disabled={!selectedDarbarName}
                  value={selectedRegionalCouncilName}
                  onChange={(event) => {
                    setSelectedRegionalCouncilName(event.target.value);
                    setSelectedLocalCouncilName("");
                  }}
                >
                  <option value="" disabled>
                    {selectedDarbarName ? "Select Regional Council" : "Select Darbar Location first"}
                  </option>
                  {regionalCouncilOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
                {fieldErrors.Region ? <p className="field-error">{fieldErrors.Region}</p> : null}
              </div>

              <div className="field">
                <label htmlFor="LocalCouncil">
                  Local Council <span className="required">*</span>
                </label>
                <select
                  id="LocalCouncil"
                  name="LocalCouncil"
                  required
                  disabled={!selectedRegionalCouncilName}
                  value={selectedLocalCouncilName}
                  onChange={(event) => setSelectedLocalCouncilName(event.target.value)}
                >
                  <option value="" disabled>
                    {selectedRegionalCouncilName ? "Select Local Council" : "Select Regional Council first"}
                  </option>
                  {localCouncilOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
                <p className="help-text" aria-live="polite">
                  {selectedRegionalCouncilName
                    ? `${localCouncilOptions.length} Local Councils available for ${selectedRegionalCouncilName}.`
                    : "Local Councils will appear after selecting Regional Council."}
                </p>
                {fieldErrors.LocalCouncil ? <p className="field-error">{fieldErrors.LocalCouncil}</p> : null}
              </div>
            </div>

            <div className="field field--full">
              <label htmlFor="VillageLocation">
                Village / Location <span className="required">*</span>
              </label>
              <textarea id="VillageLocation" name="VillageLocation" placeholder="Enter village or area" required />
              {fieldErrors.VillageLocation ? <p className="field-error">{fieldErrors.VillageLocation}</p> : null}
            </div>

            <div className="field field--full">
              <label htmlFor="IncidentDescription">
                Describe what happened <span className="required">*</span>
              </label>
              <textarea
                id="IncidentDescription"
                name="IncidentDescription"
                placeholder="Write details of the incident in simple words"
                required
              />
              {fieldErrors.IncidentDescription ? <p className="field-error">{fieldErrors.IncidentDescription}</p> : null}
            </div>

            <div className="field field--full">
              <label htmlFor="IncidentPlace">
                Where did it happen? <span className="required">*</span>
              </label>
              <textarea id="IncidentPlace" name="IncidentPlace" placeholder="Exact location of incident" required />
              {fieldErrors.IncidentPlace ? <p className="field-error">{fieldErrors.IncidentPlace}</p> : null}
            </div>

            <div className="form-row form-row--responsive form-row--team-severity">
              <div className="field">
                <label htmlFor="ResponsibleTeam">
                  Which team should handle this? <span className="required">*</span>
                </label>
                <select id="ResponsibleTeam" name="ResponsibleTeam" required defaultValue="">
                  <option value="" disabled>
                    Select responsible team
                  </option>
                  {categoryOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                {fieldErrors.ResponsibleTeam ? <p className="field-error">{fieldErrors.ResponsibleTeam}</p> : null}
              </div>

              <div className="field">
                <label htmlFor="IncidentSeverity">
                  How serious is the incident? <span className="required">*</span>
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
                {fieldErrors.IncidentSeverity ? <p className="field-error">{fieldErrors.IncidentSeverity}</p> : null}
              </div>
            </div>

            <div className="field field--full incident-images-panel">
              <div className="incident-images-panel__heading-block">
                <h5 className="incident-images-panel__title">Upload images if any</h5>
                <p className="help-text incident-images-panel__intro">
                  Optional. Upload up to 3 images. Each image must be 1 MB or smaller.
                </p>
              </div>
              <div className="incident-image-slots">
                {[0, 1, 2].map((index) => (
                  <div className="incident-image-slot" key={index}>
                    <label className="incident-images-panel__label" htmlFor={`IncidentImage${index + 1}`}>
                      Image {index + 1}
                    </label>
                    <input
                      id={`IncidentImage${index + 1}`}
                      type="file"
                      accept=".jpg,.jpeg,.png,.gif,.webp,image/jpeg,image/png,image/gif,image/webp"
                      className="incident-images-panel__file-input"
                      onChange={(event) =>
                        handleIncidentImageChange(index, event.target.files?.[0] ?? null, event.currentTarget)
                      }
                    />
                    {incidentImageErrors[index] ? <p className="field-error">{incidentImageErrors[index]}</p> : null}
                    {incidentImagePreviews[index] ? (
                      <img
                        src={incidentImagePreviews[index]}
                        alt={`Selected image ${index + 1} preview`}
                        className="incident-images-previews__thumb"
                      />
                    ) : null}
                    {incidentImages[index] ? (
                      <p className="help-text">
                        {incidentImages[index]?.name} · {((incidentImages[index]?.size ?? 0) / 1024).toFixed(1)} KB
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
              {fieldErrors.IncidentImages ? <p className="field-error">{fieldErrors.IncidentImages}</p> : null}
            </div>
          </div>
        </section>

        <div className="form-actions">
          <button className="primary-button" type="submit" disabled={isSubmitting || incidentImageErrors.some(Boolean)}>
            {isSubmitting ? "Uploading images and submitting..." : "Submit Incident Report"}
          </button>
          {message ? <p className="status-message">{message}</p> : null}
          {formError ? <p className="status-message status-message--error">{formError}</p> : null}
        </div>
      </form>
    </>
  );
}
