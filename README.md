# Incident Reporting (Safety and Security)

A clean Next.js dashboard for submitting and reviewing safety, security, and health incident reports. No login, authentication, or roles are included.

## Setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local`.
3. Set the SQL Server values in `.env.local`:
   `DB_SERVER`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, and `DB_ENCRYPT`.
4. Run the table script in `database/schema.sql`.
5. Start the app with `npm run dev`.

## Database

The application uses the SQL Server table `[rifiiorg].[Incident_Reporting]` with these columns:

`IncidentID`, `VolunteerName`, `VolunteerPhone`, `IncidentCategory`, `ConcernedPersonName`, `LocalCouncil`, `IncidentType`, `IncidentLocation`, `AdditionalNotes`, `ResponsibleTeam`, `AttachmentPath`, `IncidentSeverity`, `CreatedBy`, `CreatedDate`, `UpdatedBy`, `UpdatedDate`, `IsActive`.
