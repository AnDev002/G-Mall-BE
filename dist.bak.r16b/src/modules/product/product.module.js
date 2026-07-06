"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductModule = void 0;
const common_1 = require("@nestjs/common");
const product_read_service_1 = require("./services/product-read.service");
const product_write_service_1 = require("./services/product-write.service");
const product_cache_service_1 = require("./services/product-cache.service");
const seller_product_controller_1 = require("./controllers/seller-product.controller");
const store_product_controller_1 = require("./controllers/store-product.controller");
const admin_product_controller_1 = require("./controllers/admin-product.controller");
const category_module_1 = require("../category/category.module");
const product_auto_tag_service_1 = require("./services/product-auto-tag.service");
const image_search_module_1 = require("../image-search/image-search.module");
let ProductModule = class ProductModule {
};
exports.ProductModule = ProductModule;
exports.ProductModule = ProductModule = __decorate([
    (0, common_1.Module)({
        imports: [
            category_module_1.CategoryModule,
            image_search_module_1.ImageSearchModule,
        ],
        controllers: [
            store_product_controller_1.StoreProductController,
            seller_product_controller_1.SellerProductController,
            admin_product_controller_1.AdminProductController,
        ],
        providers: [
            product_read_service_1.ProductReadService,
            product_write_service_1.ProductWriteService,
            product_cache_service_1.ProductCacheService,
            product_auto_tag_service_1.ProductAutoTagService
        ],
        exports: [
            product_read_service_1.ProductReadService,
            product_write_service_1.ProductWriteService,
            product_cache_service_1.ProductCacheService
        ],
    })
], ProductModule);
//# sourceMappingURL=product.module.js.map