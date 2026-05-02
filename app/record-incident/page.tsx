import { IncidentForm } from "@/components/IncidentForm";
import { LogoutButton } from "@/components/LogoutButton";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export default function RecordIncidentPage() {
  return (
    <div className="app-shell">
      <SiteHeader />

      <main className="record-page">
        <section className="hero record-page__hero" aria-labelledby="record-title">
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p className="brand__eyebrow">Data Entry</p>
              <LogoutButton />
            </div>
            <h2 id="record-title">Record Incident Report</h2>
            <p>
              <strong>Initiation:</strong>
              <br />
              Incidents are reported by a volunteer on the ground through submitting form or via mobile, voice note or
              radio communication
              <br />
              If reported via radio, voice note, call, an assigned Incident Agent will create the ticket in the system.
              <br />
              Information to Capture in the Ticket:
            </p>
          </div>
        </section>

        <article className="panel record-page__panel">
          <div className="panel__header">
            <h3>Record Incident Report</h3>
            <p>Required fields are marked with an asterisk. Attachments are optional.</p>
          </div>
          <IncidentForm />
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}
