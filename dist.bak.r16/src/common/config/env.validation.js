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
exports.EnvVars = void 0;
exports.validateEnv = validateEnv;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
var NodeEnv;
(function (NodeEnv) {
    NodeEnv["Development"] = "development";
    NodeEnv["Production"] = "production";
    NodeEnv["Test"] = "test";
})(NodeEnv || (NodeEnv = {}));
class EnvVars {
    NODE_ENV;
    PORT;
    DATABASE_URL;
    JWT_SECRET;
    REDIS_HOST;
    REDIS_PORT;
    REDIS_PASSWORD;
    JWT_EXPIRATION_TIME;
    CORS_ORIGINS;
    FE_URL;
    MAIL_HOST;
    MAIL_USER;
    MAIL_PASS;
    GOOGLE_CLIENT_ID;
    GOOGLE_CLIENT_SECRET;
    GOOGLE_CALLBACK_URL;
    FACEBOOK_APP_ID;
    FACEBOOK_APP_SECRET;
    FACEBOOK_CALLBACK_URL;
    CLIP_SERVICE_URL;
    QDRANT_URL;
    QDRANT_API_KEY;
    QDRANT_COLLECTION;
}
exports.EnvVars = EnvVars;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(NodeEnv),
    __metadata("design:type", String)
], EnvVars.prototype, "NODE_ENV", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], EnvVars.prototype, "PORT", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'DATABASE_URL là bắt buộc (ví dụ: mysql://user:pass@host:3306/db)' }),
    __metadata("design:type", String)
], EnvVars.prototype, "DATABASE_URL", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(16, { message: 'JWT_SECRET phải dài >= 16 ký tự; tạo nhanh bằng: openssl rand -hex 32' }),
    __metadata("design:type", String)
], EnvVars.prototype, "JWT_SECRET", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], EnvVars.prototype, "REDIS_HOST", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], EnvVars.prototype, "REDIS_PORT", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EnvVars.prototype, "REDIS_PASSWORD", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EnvVars.prototype, "JWT_EXPIRATION_TIME", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EnvVars.prototype, "CORS_ORIGINS", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EnvVars.prototype, "FE_URL", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EnvVars.prototype, "MAIL_HOST", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EnvVars.prototype, "MAIL_USER", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EnvVars.prototype, "MAIL_PASS", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EnvVars.prototype, "GOOGLE_CLIENT_ID", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EnvVars.prototype, "GOOGLE_CLIENT_SECRET", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EnvVars.prototype, "GOOGLE_CALLBACK_URL", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EnvVars.prototype, "FACEBOOK_APP_ID", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EnvVars.prototype, "FACEBOOK_APP_SECRET", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EnvVars.prototype, "FACEBOOK_CALLBACK_URL", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EnvVars.prototype, "CLIP_SERVICE_URL", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EnvVars.prototype, "QDRANT_URL", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EnvVars.prototype, "QDRANT_API_KEY", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EnvVars.prototype, "QDRANT_COLLECTION", void 0);
function validateEnv(config) {
    const instance = (0, class_transformer_1.plainToInstance)(EnvVars, config, {
        enableImplicitConversion: true,
    });
    const errors = (0, class_validator_1.validateSync)(instance, { skipMissingProperties: false });
    if (errors.length > 0) {
        const messages = errors
            .map((e) => `  - ${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`)
            .join('\n');
        throw new Error(`\n❌ Env validation failed:\n${messages}\n`);
    }
    return instance;
}
//# sourceMappingURL=env.validation.js.map