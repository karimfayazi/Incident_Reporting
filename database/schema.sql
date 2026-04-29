IF SCHEMA_ID('rifiiorg') IS NULL
BEGIN
    EXEC('CREATE SCHEMA rifiiorg');
END;

IF OBJECT_ID('rifiiorg.Incident_Reporting', 'U') IS NULL
BEGIN
    CREATE TABLE rifiiorg.Incident_Reporting
    (
        IncidentID INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Incident_Reporting PRIMARY KEY,
        VolunteerName NVARCHAR(150) NOT NULL,
        VolunteerPhone NVARCHAR(30) NULL,
        IncidentCategory NVARCHAR(50) NOT NULL,
        ConcernedPersonName NVARCHAR(150) NULL,
        RegionalCouncil NVARCHAR(150) NULL,
        LocalCouncil NVARCHAR(150) NULL,
        IncidentType NVARCHAR(MAX) NULL,
        IncidentLocation NVARCHAR(MAX) NULL,
        AdditionalNotes NVARCHAR(MAX) NULL,
        ResponsibleTeam NVARCHAR(50) NULL,
        AttachmentPath NVARCHAR(500) NULL,
        Image1Path NVARCHAR(500) NULL,
        Image2Path NVARCHAR(500) NULL,
        Image3Path NVARCHAR(500) NULL,
        Image4Path NVARCHAR(500) NULL,
        Image5Path NVARCHAR(500) NULL,
        IncidentSeverity NVARCHAR(50) NOT NULL,
        CreatedBy NVARCHAR(100) NULL,
        CreatedDate DATETIME2(0) NOT NULL CONSTRAINT DF_Incident_Reporting_CreatedDate DEFAULT GETDATE(),
        UpdatedBy NVARCHAR(100) NULL,
        UpdatedDate DATETIME2(0) NULL,
        IsActive BIT NOT NULL CONSTRAINT DF_Incident_Reporting_IsActive DEFAULT 1
    );
END;
