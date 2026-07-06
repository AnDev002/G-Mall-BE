import { R2Service } from './r2.service';
import { PresignDto, UploadUrlDto } from './dto/presign.dto';
export declare class StorageController {
    private readonly r2Service;
    constructor(r2Service: R2Service);
    getPresignedUrl(body: PresignDto): Promise<{
        uploadUrl: string;
        fileUrl: string;
    }>;
    getUploadUrl(body: UploadUrlDto): Promise<{
        uploadUrl: string;
        fileUrl: string;
    }>;
    uploadDirect(file: Express.Multer.File): Promise<{
        url: string;
    }>;
}
