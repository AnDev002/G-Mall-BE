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
exports.AdminProductController = void 0;
const common_1 = require("@nestjs/common");
const product_write_service_1 = require("../services/product-write.service");
const jwt_guard_1 = require("../../auth/guards/jwt.guard");
const pagination_util_1 = require("../../../common/utils/pagination.util");
const roles_guard_1 = require("../../../common/guards/roles.guard");
const roles_decorator_1 = require("../../../common/decorators/roles.decorator");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const product_read_service_1 = require("../services/product-read.service");
const category_service_1 = require("../../category/category.service");
const product_auto_tag_service_1 = require("../services/product-auto-tag.service");
let AdminProductController = class AdminProductController {
    productWriteService;
    prisma;
    productReadService;
    categoryService;
    productAutoTagService;
    constructor(productWriteService, prisma, productReadService, categoryService, productAutoTagService) {
        this.productWriteService = productWriteService;
        this.prisma = prisma;
        this.productReadService = productReadService;
        this.categoryService = categoryService;
        this.productAutoTagService = productAutoTagService;
    }
    async findAll(status, page, limit, search, categoryId) {
        const whereCondition = {};
        const { page: pageNum, limit: limitNum, skip } = (0, pagination_util_1.getPagination)(page, limit, { defaultLimit: 20 });
        if (status && status !== 'ALL') {
            whereCondition.status = status;
        }
        if (search) {
            whereCondition.OR = [
                { name: { contains: search } },
                { slug: { contains: search } },
                { variants: { some: { sku: { contains: search } } } }
            ];
        }
        if (categoryId) {
            const allCategoryIds = await this.categoryService.getAllDescendantIds(categoryId);
            whereCondition.categoryId = { in: allCategoryIds };
        }
        const [products, total] = await this.prisma.$transaction([
            this.prisma.product.findMany({
                where: whereCondition,
                include: {
                    shop: { select: { id: true, name: true, avatar: true } },
                    brandRel: { select: { id: true, name: true } },
                    category: { select: { id: true, name: true } },
                    _count: { select: { variants: true } }
                },
                orderBy: { createdAt: 'desc' },
                take: limitNum,
                skip: skip
            }),
            this.prisma.product.count({ where: whereCondition })
        ]);
        return {
            data: products,
            meta: {
                total,
                page: pageNum,
                totalPages: Math.ceil(total / limitNum)
            }
        };
    }
    async bulkApprove(body) {
        return this.productWriteService.bulkApproveProducts(body.ids, body.status, body.reason);
    }
    async updateSystemTags(id, body) {
        return this.productWriteService.updateProductTags(id, body.systemTags);
    }
    async approveProduct(id, body) {
        return this.productWriteService.approveProduct(id, body.status, body.reason);
    }
    async getProductSelector(query) {
        return this.productReadService.getAdminProductSelector(query);
    }
    async search(query) {
        return this.productReadService.searchPublic(query);
    }
    async deleteAllProducts() {
        return this.productWriteService.deleteAll();
    }
    async searchForBlog(query) {
        if (!query)
            return [];
        return this.productReadService.searchProductsForAdmin(query);
    }
    async deleteProduct(id) {
        return this.productWriteService.delete(id);
    }
    async triggerAutoTag(body) {
        return this.productAutoTagService.scanAndTagAllProducts(body.rules);
    }
    async bulkDeleteProduct(body) {
        return this.productWriteService.bulkDelete(body.ids);
    }
    async findOne(id) {
        return this.prisma.product.findUnique({
            where: { id },
            include: {
                shop: true,
                options: { include: { values: true } },
                variants: true,
                category: true
            }
        });
    }
};
exports.AdminProductController = AdminProductController;
__decorate([
    (0, common_1.Get)(),
    (0, common_1.Header)('Cache-Control', 'no-cache, no-store, must-revalidate'),
    (0, common_1.Header)('Pragma', 'no-cache'),
    (0, common_1.Header)('Expires', '0'),
    __param(0, (0, common_1.Query)('status')),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('limit')),
    __param(3, (0, common_1.Query)('search')),
    __param(4, (0, common_1.Query)('categoryId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], AdminProductController.prototype, "findAll", null);
__decorate([
    (0, common_1.Patch)('bulk-approval'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdminProductController.prototype, "bulkApprove", null);
__decorate([
    (0, common_1.Patch)(':id/system-tags'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AdminProductController.prototype, "updateSystemTags", null);
__decorate([
    (0, common_1.Patch)(':id/approval'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AdminProductController.prototype, "approveProduct", null);
__decorate([
    (0, common_1.Get)('selector'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdminProductController.prototype, "getProductSelector", null);
__decorate([
    (0, common_1.Get)('search'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdminProductController.prototype, "search", null);
__decorate([
    (0, common_1.Delete)('delete-all/cleanup'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AdminProductController.prototype, "deleteAllProducts", null);
__decorate([
    (0, common_1.Get)('search-for-blog'),
    __param(0, (0, common_1.Query)('q')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminProductController.prototype, "searchForBlog", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminProductController.prototype, "deleteProduct", null);
__decorate([
    (0, common_1.Post)('auto-tag/scan'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdminProductController.prototype, "triggerAutoTag", null);
__decorate([
    (0, common_1.Delete)('bulk/delete'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdminProductController.prototype, "bulkDeleteProduct", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, common_1.Header)('Cache-Control', 'no-cache, no-store, must-revalidate'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminProductController.prototype, "findOne", null);
exports.AdminProductController = AdminProductController = __decorate([
    (0, common_1.Controller)('admin/products'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    __metadata("design:paramtypes", [product_write_service_1.ProductWriteService, prisma_service_1.PrismaService, product_read_service_1.ProductReadService, category_service_1.CategoryService, product_auto_tag_service_1.ProductAutoTagService])
], AdminProductController);
//# sourceMappingURL=admin-product.controller.js.map