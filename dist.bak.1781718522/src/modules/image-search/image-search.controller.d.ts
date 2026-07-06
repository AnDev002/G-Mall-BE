import { ImageSearchService, ImageSearchHit } from './image-search.service';
import { SearchByImageQueryDto } from './dto/search-by-image.dto';
export declare class ImageSearchController {
    private readonly imageSearch;
    constructor(imageSearch: ImageSearchService);
    searchByImage(file: Express.Multer.File, query: SearchByImageQueryDto): Promise<{
        hits: ImageSearchHit[];
    }>;
    searchByText(body: {
        text: string;
    }, query: SearchByImageQueryDto): Promise<{
        hits: ImageSearchHit[];
    }>;
    stats(): Promise<{
        pending: number;
        indexed: number;
        failed: number;
        skipped: number;
        qdrantCount: number;
    }>;
}
