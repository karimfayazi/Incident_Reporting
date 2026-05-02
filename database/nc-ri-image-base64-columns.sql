/* Run only if Image1, Image2, or Image3 are not already NVARCHAR(MAX). */

ALTER TABLE [_rifiiorg_db].[rifiiorg].[NC_RI_Incident_Reporting]
ALTER COLUMN [Image1] NVARCHAR(MAX) NULL;

ALTER TABLE [_rifiiorg_db].[rifiiorg].[NC_RI_Incident_Reporting]
ALTER COLUMN [Image2] NVARCHAR(MAX) NULL;

ALTER TABLE [_rifiiorg_db].[rifiiorg].[NC_RI_Incident_Reporting]
ALTER COLUMN [Image3] NVARCHAR(MAX) NULL;
