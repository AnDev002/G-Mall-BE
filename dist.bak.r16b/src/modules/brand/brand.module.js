"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrandModule = void 0;
const common_1 = require("@nestjs/common");
const brand_service_1 = require("./brand.service");
const brand_controller_1 = require("./brand.controller");
const brand_crawler_service_1 = require("./brand-crawler.service");
const database_module_1 = require("../../database/database.module");
const category_service_1 = require("../category/category.service");
let BrandModule = class BrandModule {
};
exports.BrandModule = BrandModule;
exports.BrandModule = BrandModule = __decorate([
    (0, common_1.Module)({
        imports: [database_module_1.DatabaseModule],
        controllers: [brand_controller_1.BrandController],
        providers: [brand_service_1.BrandService, brand_crawler_service_1.BrandCrawlerService, category_service_1.CategoryService],
        exports: [brand_service_1.BrandService, brand_crawler_service_1.BrandCrawlerService],
    })
], BrandModule);
//# sourceMappingURL=brand.module.js.map