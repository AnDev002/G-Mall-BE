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
exports.FriendController = void 0;
const common_1 = require("@nestjs/common");
const friend_service_1 = require("./friend.service");
const jwt_guard_1 = require("../../modules/auth/guards/jwt.guard");
const friend_dto_1 = require("./dto/friend.dto");
const user_decorator_1 = require("../../common/decorators/user.decorator");
let FriendController = class FriendController {
    friendService;
    constructor(friendService) {
        this.friendService = friendService;
    }
    async sendRequest(req, dto) {
        return this.friendService.sendFriendRequest(req.user.id, dto.receiverId);
    }
    async handleRequest(req, dto) {
        return this.friendService.handleFriendRequest(req.user.id, dto.requestId, dto.action);
    }
    async getMyFriends(req) {
        return this.friendService.getFriendList(req.user.id);
    }
    async getPendingRequests(req) {
        console.log("Current User ID getting pending requests:", req.user.id);
        return this.friendService.getPendingRequests(req.user.id);
    }
    async inviteByEmail(user, dto) {
        return this.friendService.inviteByEmail(user.id, dto.email, dto.message);
    }
    async searchNewFriends(req, q) {
        return this.friendService.searchUsers(req.user.id, q);
    }
    async unfriend(req, friendId) {
        return this.friendService.unfriend(req.user.id, friendId);
    }
};
exports.FriendController = FriendController;
__decorate([
    (0, common_1.Post)('request'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, friend_dto_1.FriendRequestDto]),
    __metadata("design:returntype", Promise)
], FriendController.prototype, "sendRequest", null);
__decorate([
    (0, common_1.Post)('response'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, friend_dto_1.HandleRequestDto]),
    __metadata("design:returntype", Promise)
], FriendController.prototype, "handleRequest", null);
__decorate([
    (0, common_1.Get)('my-friends'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], FriendController.prototype, "getMyFriends", null);
__decorate([
    (0, common_1.Get)('pending'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], FriendController.prototype, "getPendingRequests", null);
__decorate([
    (0, common_1.Post)('invite-by-email'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    __param(0, (0, user_decorator_1.User)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, friend_dto_1.InviteByEmailDto]),
    __metadata("design:returntype", Promise)
], FriendController.prototype, "inviteByEmail", null);
__decorate([
    (0, common_1.Get)('search'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('q')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], FriendController.prototype, "searchNewFriends", null);
__decorate([
    (0, common_1.Delete)(':friendId'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('friendId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], FriendController.prototype, "unfriend", null);
exports.FriendController = FriendController = __decorate([
    (0, common_1.Controller)('friends'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [friend_service_1.FriendService])
], FriendController);
//# sourceMappingURL=friend.controller.js.map