export type videoExtension = keyof typeof videoTypes;
export type videoMimeType = (typeof videoTypes)[videoExtension];
export declare const videoTypes: {
    readonly mp4: "video/mp4";
    readonly webm: "video/webm";
    readonly cmaf: "video/mp4";
    readonly cmfv: "video/mp4";
    readonly m3u8: "application/x-mpegURL";
    readonly ogg: "video/ogg";
    readonly ogv: "video/ogg";
    readonly mov: "video/quicktime";
    readonly avi: "video/x-msvideo";
    readonly mkv: "video/x-matroska";
    readonly flv: "video/x-flv";
    readonly wmv: "video/x-ms-wmv";
};
