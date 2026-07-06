"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateBlogDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const create_blog_dto_1 = require("./create-blog.dto");
class UpdateBlogDto extends (0, swagger_1.PartialType)(create_blog_dto_1.CreateBlogDto) {
}
exports.UpdateBlogDto = UpdateBlogDto;
//# sourceMappingURL=update-blog.dto.js.map