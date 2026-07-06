"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GhnModule = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("@nestjs/axios");
const ghn_service_1 = require("./ghn.service");
const ghn_controller_1 = require("./ghn.controller");
const database_module_1 = require("../../database/database.module");
const shop_module_1 = require("../shop/shop.module");
let GhnModule = class GhnModule {
};
exports.GhnModule = GhnModule;
exports.GhnModule = GhnModule = __decorate([
    (0, common_1.Module)({
        imports: [axios_1.HttpModule, database_module_1.DatabaseModule, shop_module_1.ShopModule],
        controllers: [ghn_controller_1.GhnController],
        providers: [ghn_service_1.GhnService],
        exports: [ghn_service_1.GhnService],
    })
], GhnModule);
//# sourceMappingURL=ghn.module.js.map