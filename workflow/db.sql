DROP TABLE IF EXISTS Images;
CREATE TABLE IF NOT EXISTS Images (
    ID INTEGER PRIMARY KEY,
    ImageKey TEXT,
    ImageTags TEXT,
    ImageAltText TEXT,
    InstanceID TEXT
);
