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
exports.TrackingController = void 0;
const common_1 = require("@nestjs/common");
const tracking_service_1 = require("../tracking.service");
const track_event_dto_1 = require("../dto/track-event.dto");
const optional_jwt_guard_1 = require("../../auth/guards/optional-jwt.guard");
const public_decorator_1 = require("../../../common/decorators/public.decorator");
let TrackingController = class TrackingController {
    trackingService;
    constructor(trackingService) {
        this.trackingService = trackingService;
    }
    async trackBatch(req, body, headerDeviceId, queryDeviceId, userAgent, ip) {
        const userId = req.user?.userId || null;
        const guestId = headerDeviceId || queryDeviceId || 'unknown_device';
        if (body.events && body.events.length > 0) {
            const enrichedEvents = body.events.map(event => ({
                ...event,
                userId,
                guestId,
                metadata: {
                    ...event.metadata,
                    ip,
                    userAgent,
                }
            }));
            Promise.all(enrichedEvents.map(event => this.trackingService.trackEvent(userId, guestId, event))).catch(err => console.error("Tracking Push Error:", err.message));
        }
        return { success: true };
    }
    async getRecommendations(req, deviceId) {
        const userId = req.user?.userId || null;
        const guestId = deviceId || 'unknown_device';
        const productIds = await this.trackingService.getRecommendations(userId, guestId);
        return { productIds };
    }
    async getTrendingKeywords(limitRaw) {
        const limit = Math.min(Math.max(Number(limitRaw) || 8, 1), 20);
        return this.trackingService.getTrendingKeywords(limit);
    }
};
exports.TrackingController = TrackingController;
__decorate([
    (0, common_1.Post)('batch'),
    (0, public_decorator_1.Public)(),
    (0, common_1.UseGuards)(optional_jwt_guard_1.OptionalJwtAuthGuard),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('x-device-id')),
    __param(3, (0, common_1.Query)('deviceId')),
    __param(4, (0, common_1.Headers)('user-agent')),
    __param(5, (0, common_1.Ip)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, track_event_dto_1.TrackBatchDto, String, String, String, String]),
    __metadata("design:returntype", Promise)
], TrackingController.prototype, "trackBatch", null);
__decorate([
    (0, common_1.Get)('recommendations'),
    (0, public_decorator_1.Public)(),
    (0, common_1.UseGuards)(optional_jwt_guard_1.OptionalJwtAuthGuard),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Headers)('x-device-id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], TrackingController.prototype, "getRecommendations", null);
__decorate([
    (0, common_1.Get)('trending-keywords'),
    (0, public_decorator_1.Public)(),
    __param(0, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TrackingController.prototype, "getTrendingKeywords", null);
exports.TrackingController = TrackingController = __decorate([
    (0, common_1.Controller)('tracking'),
    __metadata("design:paramtypes", [tracking_service_1.TrackingService])
], TrackingController);
//# sourceMappingURL=tracking.controller.js.map