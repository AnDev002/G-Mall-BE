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
exports.BrandController = void 0;
const common_1 = require("@nestjs/common");
const brand_service_1 = require("./brand.service");
const brand_crawler_service_1 = require("./brand-crawler.service");
const category_service_1 = require("../category/category.service");
const create_brand_dto_1 = require("./dto/create-brand.dto");
const update_brand_dto_1 = require("./dto/update-brand.dto");
const jwt_guard_1 = require("../auth/guards/jwt.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const client_1 = require("@prisma/client");
const public_decorator_1 = require("../../common/decorators/public.decorator");
let BrandController = class BrandController {
    brandService;
    brandCrawler;
    categoryService;
    constructor(brandService, brandCrawler, categoryService) {
        this.brandService = brandService;
        this.brandCrawler = brandCrawler;
        this.categoryService = categoryService;
    }
    async crawlBrand(dto) {
        return this.brandCrawler.crawlByUrl(dto?.url);
    }
    async getActiveBrands(categoryId, limit) {
        if (categoryId) {
            const ids = await this.categoryService.getDescendantIds(categoryId);
            const lim = limit ? Math.min(Math.max(Number(limit) || 12, 1), 30) : 12;
            return this.brandService.findActiveByCategoryIds(ids, lim);
        }
        return this.brandService.findAllActive();
    }
    async getBrandsAdmin(search, page, limit) {
        const pageNum = page ? Number(page) : 1;
        const limitNum = limit ? Number(limit) : 10;
        return this.brandService.findAllAdmin({
            search,
            page: Number.isFinite(pageNum) && pageNum > 0 ? pageNum : 1,
            limit: Number.isFinite(limitNum) && limitNum > 0 ? limitNum : 10,
        });
    }
    async getBrandById(id) {
        return this.brandService.findById(id);
    }
    async create(dto) {
        return this.brandService.create(dto);
    }
    async update(id, dto) {
        return this.brandService.update(id, dto);
    }
    async toggleStatus(id) {
        return this.brandService.toggleStatus(id);
    }
    async delete(id) {
        return this.brandService.delete(id);
    }
};
exports.BrandController = BrandController;
__decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.SELLER),
    (0, common_1.Post)('brands/crawl'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], BrandController.prototype, "crawlBrand", null);
__decorate([
    (0, common_1.Get)('brands'),
    (0, public_decorator_1.Public)(),
    __param(0, (0, common_1.Query)('categoryId')),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], BrandController.prototype, "getActiveBrands", null);
__decorate([
    (0, common_1.Get)('admin/brands'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    __param(0, (0, common_1.Query)('search')),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], BrandController.prototype, "getBrandsAdmin", null);
__decorate([
    (0, common_1.Get)('admin/brands/:id'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], BrandController.prototype, "getBrandById", null);
__decorate([
    (0, common_1.Post)('admin/brands'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_brand_dto_1.CreateBrandDto]),
    __metadata("design:returntype", Promise)
], BrandController.prototype, "create", null);
__decorate([
    (0, common_1.Put)('admin/brands/:id'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, update_brand_dto_1.UpdateBrandDto]),
    __metadata("design:returntype", Promise)
], BrandController.prototype, "update", null);
__decorate([
    (0, common_1.Patch)('admin/brands/:id/status'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], BrandController.prototype, "toggleStatus", null);
__decorate([
    (0, common_1.Delete)('admin/brands/:id'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], BrandController.prototype, "delete", null);
exports.BrandController = BrandController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [brand_service_1.BrandService,
        brand_crawler_service_1.BrandCrawlerService,
        category_service_1.CategoryService])
], BrandController);
//# sourceMappingURL=brand.controller.js.map