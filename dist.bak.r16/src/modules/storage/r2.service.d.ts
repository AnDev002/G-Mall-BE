import { ConfigService } from '@nestjs/config';
export declare class R2Service {
    private configService;
    private s3Client;
    private bucketName;
    private publicDomain;
    constructor(configService: ConfigService);
    generatePresignedUrl(fileName: string, fileType: string, folder?: string): Promise<{
        uploadUrl: string;
        fileUrl: string;
    }>;
    uploadDirect(buffer: Buffer, originalName: string, mime: string, folder?: string): Promise<{
        url: string;
        key: string;
    }>;
    deleteFile(key: string): Promise<void>;
}
