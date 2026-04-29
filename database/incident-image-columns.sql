/* Run once on existing databases if Image1Path–Image5Path are missing. */

IF COL_LENGTH('rifiiorg.Incident_Reporting', 'Image1Path') IS NULL
    ALTER TABLE [rifiiorg].[Incident_Reporting] ADD [Image1Path] NVARCHAR(500) NULL;

IF COL_LENGTH('rifiiorg.Incident_Reporting', 'Image2Path') IS NULL
    ALTER TABLE [rifiiorg].[Incident_Reporting] ADD [Image2Path] NVARCHAR(500) NULL;

IF COL_LENGTH('rifiiorg.Incident_Reporting', 'Image3Path') IS NULL
    ALTER TABLE [rifiiorg].[Incident_Reporting] ADD [Image3Path] NVARCHAR(500) NULL;

IF COL_LENGTH('rifiiorg.Incident_Reporting', 'Image4Path') IS NULL
    ALTER TABLE [rifiiorg].[Incident_Reporting] ADD [Image4Path] NVARCHAR(500) NULL;

IF COL_LENGTH('rifiiorg.Incident_Reporting', 'Image5Path') IS NULL
    ALTER TABLE [rifiiorg].[Incident_Reporting] ADD [Image5Path] NVARCHAR(500) NULL;
