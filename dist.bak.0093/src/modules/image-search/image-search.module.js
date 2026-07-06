"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImageSearchModule = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const database_module_1 = require("../../database/database.module");
const image_search_controller_1 = require("./image-search.controller");
const image_search_service_1 = require("./image-search.service");
const clip_client_service_1 = require("./clip-client.service");
const qdrant_client_service_1 = require("./qdrant-client.service");
const indexer_processor_1 = require("./indexer.processor");
let ImageSearchModule = class ImageSearchModule {
};
exports.ImageSearchModule = ImageSearchModule;
exports.ImageSearchModule = ImageSearchModule = __decorate([
    (0, common_1.Module)({
        imports: [
            database_module_1.DatabaseModule,
            bullmq_1.BullModule.registerQueue({ name: indexer_processor_1.PRODUCT_INDEX_QUEUE }),
        ],
        controllers: [image_search_controller_1.ImageSearchController],
        providers: [image_search_service_1.ImageSearchService, clip_client_service_1.ClipClientService, qdrant_client_service_1.QdrantClientService, indexer_processor_1.IndexerProcessor],
        exports: [image_search_service_1.ImageSearchService],
    })
], ImageSearchModule);
//# sourceMappingURL=image-search.module.js.map