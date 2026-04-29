"use client";

import { useState } from "react";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

const SUPPORT_EMAIL = "karim.fayazi@sjdap.org";
const SUPPORT_PHONE_DISPLAY = "0346-9750336";
const SUPPORT_NAME = "Karim Fayazi";
const TEL_HREF = "tel:+923469750336";
const WHATSAPP_HREF = "https://wa.me/923469750336";

function ContactIcon({ type }: { type: "person" | "email" | "phone" }) {
  if (type === "person") {
    return (
      <svg className="contact-card__icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <path d="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
      </svg>
    );
  }
  if (type === "email") {
    return (
      <svg className="contact-card__icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2Z" />
        <path d="m22 6-10 7L2 6" />
      </svg>
    );
  }
  return (
    <svg className="contact-card__icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

export default function SettingPage() {
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);

  return (
    <div className="app-shell">
      <SiteHeader />

      <div className={`workspace ${isSidebarExpanded ? "workspace--expanded" : "workspace--collapsed"}`}>
        <DashboardSidebar
          activeLabel="Setting"
          isExpanded={isSidebarExpanded}
          onToggle={() => setIsSidebarExpanded((current) => !current)}
        />

        <main className="setting-page">
          <section className="hero record-page__hero" aria-labelledby="setting-title">
            <div>
              <p className="brand__eyebrow">Application</p>
              <h2 id="setting-title">Setting</h2>
              <p className="setting-page__intro">
                For any technical issue, system access problem, dashboard error, or application support, please
                contact the MIS support person below.
              </p>
            </div>
          </section>

          <article className="panel setting-panel">
            <div className="panel__header">
              <h3>Technical Support Contact</h3>
              <p>For any technical issue, please contact:</p>
            </div>

            <div className="contact-card-grid">
              <div className="contact-card">
                <div className="contact-card__icon-wrap" aria-hidden="true">
                  <ContactIcon type="person" />
                </div>
                <div className="contact-card__body">
                  <p className="contact-card__label">Name</p>
                  <p className="contact-card__value">{SUPPORT_NAME}</p>
                </div>
              </div>

              <div className="contact-card">
                <div className="contact-card__icon-wrap" aria-hidden="true">
                  <ContactIcon type="email" />
                </div>
                <div className="contact-card__body">
                  <p className="contact-card__label">Email Address</p>
                  <p className="contact-card__value">
                    <a className="contact-card__link" href={`mailto:${SUPPORT_EMAIL}`}>
                      {SUPPORT_EMAIL}
                    </a>
                  </p>
                </div>
              </div>

              <div className="contact-card">
                <div className="contact-card__icon-wrap" aria-hidden="true">
                  <ContactIcon type="phone" />
                </div>
                <div className="contact-card__body">
                  <p className="contact-card__label">Contact Number / WhatsApp</p>
                  <p className="contact-card__value">
                    <a className="contact-card__link" href={TEL_HREF}>
                      {SUPPORT_PHONE_DISPLAY}
                    </a>
                  </p>
                  <p className="contact-card__actions">
                    <a className="contact-card__link contact-card__link--secondary" href={WHATSAPP_HREF} rel="noopener noreferrer" target="_blank">
                      Open in WhatsApp
                    </a>
                  </p>
                </div>
              </div>
            </div>
          </article>
        </main>
      </div>

      <SiteFooter />
    </div>
  );
}
