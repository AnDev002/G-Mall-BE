"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatModule = void 0;
const common_1 = require("@nestjs/common");
const chat_service_1 = require("./chat.service");
const chat_gateway_1 = require("./chat.gateway");
const chat_controller_1 = require("./controllers/chat.controller");
const ai_service_1 = require("./ai.service");
const gift_consultant_service_1 = require("./gift-consultant.service");
const product_module_1 = require("../product/product.module");
const database_module_1 = require("../../database/database.module");
const auth_module_1 = require("../auth/auth.module");
let ChatModule = class ChatModule {
};
exports.ChatModule = ChatModule;
exports.ChatModule = ChatModule = __decorate([
    (0, common_1.Module)({
        imports: [
            product_module_1.ProductModule,
            database_module_1.DatabaseModule,
            auth_module_1.AuthModule
        ],
        controllers: [chat_controller_1.ChatController],
        providers: [
            chat_gateway_1.ChatGateway,
            chat_service_1.ChatService,
            ai_service_1.AiService,
            gift_consultant_service_1.GiftConsultantService
        ],
        exports: [chat_service_1.ChatService, chat_gateway_1.ChatGateway]
    })
], ChatModule);
//# sourceMappingURL=chat.module.js.map