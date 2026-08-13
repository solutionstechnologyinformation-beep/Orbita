CREATE TABLE IF NOT EXISTS crs_segments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  crsId INT NOT NULL,
  name VARCHAR(256) NOT NULL,
  fileName VARCHAR(256) NOT NULL,
  fileUrl TEXT NOT NULL,
  geometryJson TEXT NOT NULL,
  boundsJson TEXT NULL,
  createdById INT NOT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_crs_segments_crs_id (crsId),
  INDEX idx_crs_segments_created_by_id (createdById)
);
