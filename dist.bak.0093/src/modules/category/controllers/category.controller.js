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
exports.CategoryController = void 0;
const common_1 = require("@nestjs/common");
const category_service_1 = require("../category.service");
const public_decorator_1 = require("../../../common/decorators/public.decorator");
const roles_decorator_1 = require("../../../common/decorators/roles.decorator");
const jwt_guard_1 = require("../../auth/guards/jwt.guard");
const roles_guard_1 = require("../../../common/guards/roles.guard");
const client_1 = require("@prisma/client");
const update_category_order_dto_1 = require("../dto/update-category-order.dto");
const create_category_dto_1 = require("../dto/create-category.dto");
const update_category_dto_1 = require("../dto/update-category.dto");
const update_category_batch_dto_1 = require("../dto/update-category-batch.dto");
let CategoryController = class CategoryController {
    categoryService;
    constructor(categoryService) {
        this.categoryService = categoryService;
    }
    async getCategories(parentId) {
        const pId = parentId === 'null' || !parentId ? undefined : parentId;
        return this.categoryService.getCategories(pId);
    }
    async search(q) {
        return this.categoryService.searchCategories(q);
    }
    async getCategoryTree() {
        return this.categoryService.getCategoryTree();
    }
    create(createCategoryDto) {
        return this.categoryService.create(createCategoryDto);
    }
    update(id, updateCategoryDto) {
        return this.categoryService.update(id, updateCategoryDto);
    }
    async updateOrder(dto) {
        return this.categoryService.updateOrder(dto);
    }
    remove(id) {
        return this.categoryService.remove(id);
    }
    async updateBatch(items) {
        return this.categoryService.updateBatch(items);
    }
    async getBreadcrumbs(id) {
        return this.categoryService.getBreadcrumbs(id);
    }
    async fixAllSlugs() {
        return this.categoryService.fixAllSlugs();
    }
};
exports.CategoryController = CategoryController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('parentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CategoryController.prototype, "getCategories", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('search'),
    __param(0, (0, common_1.Query)('q')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CategoryController.prototype, "search", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('tree'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CategoryController.prototype, "getCategoryTree", null);
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_category_dto_1.CreateCategoryDto]),
    __metadata("design:returntype", void 0)
], CategoryController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_category_dto_1.UpdateCategoryDto]),
    __metadata("design:returntype", void 0)
], CategoryController.prototype, "update", null);
__decorate([
    (0, common_1.Post)('update-order'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [update_category_order_dto_1.UpdateCategoryOrderDto]),
    __metadata("design:returntype", Promise)
], CategoryController.prototype, "updateOrder", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CategoryController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)('batch-update'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    __param(0, (0, common_1.Body)(new common_1.ParseArrayPipe({ items: update_category_batch_dto_1.UpdateCategoryBatchItemDto }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array]),
    __metadata("design:returntype", Promise)
], CategoryController.prototype, "updateBatch", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)(':id/breadcrumbs'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CategoryController.prototype, "getBreadcrumbs", null);
__decorate([
    (0, common_1.Post)('fix-all-slugs'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CategoryController.prototype, "fixAllSlugs", null);
exports.CategoryController = CategoryController = __decorate([
    (0, common_1.Controller)('categories'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [category_service_1.CategoryService])
], CategoryController);
//# sourceMappingURL=category.controller.js.map