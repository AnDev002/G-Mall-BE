export declare const ALLOWED_MIMES: string[];
export declare const ALLOWED_FOLDERS: string[];
export declare class PresignDto {
    fileName: string;
    fileType: string;
}
export declare class UploadUrlDto extends PresignDto {
    folder?: string;
}
