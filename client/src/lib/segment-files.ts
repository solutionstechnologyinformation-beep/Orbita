const SEGMENT_FILE_PATTERN = /\.(kmz|kml)$/i;

export function isSupportedSegmentFileName(fileName: string): boolean {
  return SEGMENT_FILE_PATTERN.test(fileName.trim());
}

export function getSegmentBaseName(fileName: string): string {
  return fileName.trim().replace(SEGMENT_FILE_PATTERN, "");
}
