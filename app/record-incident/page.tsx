import { IncidentForm } from "@/components/IncidentForm";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export default function RecordIncidentPage() {
  return (
    <div className="app-shell">
      <SiteHeader />

      <main className="record-page">
        <section className="hero record-page__hero" aria-labelledby="record-title">
          <div>
            <p className="brand__eyebrow">Data Entry</p>
            <h2 id="record-title">Incident Reporting (Safety and Security)</h2>
            <p>Complete the form below to record a safety, security, health, or other incident.</p>
          </div>
        </section>

        <article className="panel record-page__panel">
          <div className="panel__header">
            <h3>Record Incident</h3>
            <p>Required fields are marked with an asterisk. Attachments are optional.</p>
          </div>
          <IncidentForm useCouncilDropdowns requireAllFields />
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}
