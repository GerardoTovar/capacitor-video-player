export type videoExtension = keyof typeof videoTypes;
export type videoMimeType = (typeof videoTypes)[videoExtension];

export const videoTypes = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  cmaf: 'video/mp4',
  cmfv: 'video/mp4',
  m3u8: 'application/x-mpegURL',
  ogg: 'video/ogg',
  ogv: 'video/ogg',
  mov: 'video/quicktime',
  avi: 'video/x-msvideo',
  mkv: 'video/x-matroska',
  flv: 'video/x-flv',
  wmv: 'video/x-ms-wmv',
} as const;
