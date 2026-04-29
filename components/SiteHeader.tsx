import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <div className="brand">
          <p className="brand__eyebrow">Safety and Security</p>
          <h1 className="brand__title">Incident Reporting (Safety and Security)</h1>
        </div>
        <Link className="record-button" href="/record-incident">
          Record Incident
        </Link>
      </div>
    </header>
  );
}
