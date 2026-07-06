"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImageSearchController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const swagger_1 = require("@nestjs/swagger");
const client_1 = require("@prisma/client");
const jwt_guard_1 = require("../auth/guards/jwt.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const roles_guard_1 = require("../../common/guards/roles.guard");
const image_search_service_1 = require("./image-search.service");
const search_by_image_dto_1 = require("./dto/search-by-image.dto");
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
let ImageSearchController = class ImageSearchController {
    imageSearch;
    constructor(imageSearch) {
        this.imageSearch = imageSearch;
    }
    async searchByImage(file, query) {
        if (!file?.buffer?.length) {
            throw new common_1.BadRequestException('image file is empty');
        }
        const hits = await this.imageSearch.searchByImageBuffer(file.buffer, query.limit, query.minSimilarity);
        return { hits };
    }
    async searchByText(body, query) {
        const text = (body?.text ?? '').trim();
        if (!text)
            throw new common_1.BadRequestException('text is required');
        if (text.length > 200)
            throw new common_1.BadRequestException('text too long (max 200 chars)');
        const hits = await this.imageSearch.searchByText(text, query.limit, query.minSimilarity);
        return { hits };
    }
    stats() {
        return this.imageSearch.stats();
    }
};
exports.ImageSearchController = ImageSearchController;
__decorate([
    (0, common_1.Post)('by-image'),
    (0, common_1.HttpCode)(200),
    (0, swagger_1.ApiOperation)({ summary: 'Tìm sản phẩm bằng hình ảnh upload' }),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('image', { limits: { fileSize: MAX_IMAGE_BYTES } })),
    __param(0, (0, common_1.UploadedFile)(new common_1.ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: /^image\/(jpeg|png|webp)$/ })
        .addMaxSizeValidator({ maxSize: MAX_IMAGE_BYTES })
        .build({ fileIsRequired: true }))),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, search_by_image_dto_1.SearchByImageQueryDto]),
    __metadata("design:returntype", Promise)
], ImageSearchController.prototype, "searchByImage", null);
__decorate([
    (0, common_1.Post)('by-text'),
    (0, common_1.HttpCode)(200),
    (0, swagger_1.ApiOperation)({ summary: 'Tìm sản phẩm bằng mô tả text (CLIP text encoder)' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, search_by_image_dto_1.SearchByImageQueryDto]),
    __metadata("design:returntype", Promise)
], ImageSearchController.prototype, "searchByText", null);
__decorate([
    (0, common_1.Get)('stats'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Admin: thống kê trạng thái index vector' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ImageSearchController.prototype, "stats", null);
exports.ImageSearchController = ImageSearchController = __decorate([
    (0, swagger_1.ApiTags)('image-search'),
    (0, common_1.Controller)('products/search'),
    __metadata("design:paramtypes", [image_search_service_1.ImageSearchService])
], ImageSearchController);
//# sourceMappingURL=image-search.controller.js.map