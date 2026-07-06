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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemSettingModule = void 0;
const common_1 = require("@nestjs/common");
const system_setting_service_1 = require("./system-setting.service");
let SystemSettingModule = class SystemSettingModule {
    service;
    constructor(service) {
        this.service = service;
    }
    async onModuleInit() {
        await this.service.seedDefaults();
    }
};
exports.SystemSettingModule = SystemSettingModule;
exports.SystemSettingModule = SystemSettingModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        providers: [system_setting_service_1.SystemSettingService],
        exports: [system_setting_service_1.SystemSettingService],
    }),
    __metadata("design:paramtypes", [system_setting_service_1.SystemSettingService])
], SystemSettingModule);
//# sourceMappingURL=system-setting.module.js.map