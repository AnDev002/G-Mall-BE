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
exports.BlogController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const client_1 = require("@prisma/client");
const blog_service_1 = require("./blog.service");
const create_blog_dto_1 = require("./dto/create-blog.dto");
const update_blog_dto_1 = require("./dto/update-blog.dto");
const blog_query_dto_1 = require("./dto/blog-query.dto");
const reorder_blog_dto_1 = require("./dto/reorder-blog.dto");
const jwt_guard_1 = require("../../modules/auth/guards/jwt.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const user_decorator_1 = require("../../common/decorators/user.decorator");
let BlogController = class BlogController {
    blogService;
    constructor(blogService) {
        this.blogService = blogService;
    }
    create(user, createBlogDto) {
        return this.blogService.create(user.id, createBlogDto);
    }
    findAll(query) {
        return this.blogService.findAll(query);
    }
    findOne(idOrSlug) {
        return this.blogService.findOne(idOrSlug);
    }
    update(id, updateBlogDto) {
        return this.blogService.update(id, updateBlogDto);
    }
    remove(id) {
        return this.blogService.remove(id);
    }
    updateOrder(body) {
        return this.blogService.updateOrder(body.items);
    }
};
exports.BlogController = BlogController;
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Create a new blog post' }),
    __param(0, (0, user_decorator_1.User)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_blog_dto_1.CreateBlogDto]),
    __metadata("design:returntype", void 0)
], BlogController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'List all blogs with pagination and filtering' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [blog_query_dto_1.BlogQueryDto]),
    __metadata("design:returntype", void 0)
], BlogController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':idOrSlug'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Get blog details by ID or Slug' }),
    __param(0, (0, common_1.Param)('idOrSlug')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], BlogController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Update blog post' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_blog_dto_1.UpdateBlogDto]),
    __metadata("design:returntype", void 0)
], BlogController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Delete blog post' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], BlogController.prototype, "remove", null);
__decorate([
    (0, common_1.Patch)('reorder/items'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Update sort order of blogs' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [reorder_blog_dto_1.ReorderBlogDto]),
    __metadata("design:returntype", void 0)
], BlogController.prototype, "updateOrder", null);
exports.BlogController = BlogController = __decorate([
    (0, swagger_1.ApiTags)('Admin - Blogs'),
    (0, common_1.Controller)('admin/blogs'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, swagger_1.ApiBearerAuth)(),
    __metadata("design:paramtypes", [blog_service_1.BlogService])
], BlogController);
//# sourceMappingURL=blog.controller.js.map