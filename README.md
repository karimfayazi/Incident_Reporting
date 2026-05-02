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

## SQL Server Deployment Connectivity

Local `.env.local` values work only on the development machine. For Vercel or another deployed host, add the database variables in the hosting provider's environment-variable settings, then redeploy.

Required variables: `DB_SERVER` or `DB_HOST`, `DB_DATABASE` or `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_PORT` (usually `1433`), and `DB_ENCRYPT`.

If `/api/db-health` reports `ESOCKET` or `tcpReachable: false`, the deployed server cannot open TCP to SQL Server. Check:

- SQL Server Configuration Manager: enable TCP/IP and restart the SQL Server service.
- SQL Server: enable remote connections, enable SQL Server Authentication, and confirm SQL Server listens on port `1433` or the configured `DB_PORT`.
- Firewall: allow inbound TCP `1433` in Windows Firewall, allow the SQL Server executable if needed, and check any hosting/cloud firewall.
- Vercel: outbound IPs are not fixed. If SQL Server allows only selected IPs, Vercel may be blocked.
- Production options: host the Next.js backend on a VPS/server with static IP near SQL Server, create a secure backend API/proxy on the SQL Server network, use a database provider reachable from Vercel, or use Vercel Secure Compute/static egress if available for the plan.

Use `GET /api/db-health` for safe diagnostics. It returns only boolean env flags, the port, TCP reachability, and SQL test status. It never returns `DB_PASSWORD` or secret values.
