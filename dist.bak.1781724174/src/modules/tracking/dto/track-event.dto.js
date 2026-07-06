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
exports.TrackBatchDto = exports.TrackEventDto = exports.EventType = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
var EventType;
(function (EventType) {
    EventType["VIEW_PAGE"] = "view_page";
    EventType["VIEW_PRODUCT"] = "view_product";
    EventType["CLICK_PRODUCT"] = "click_product";
    EventType["ADD_TO_CART"] = "add_to_cart";
    EventType["SEARCH"] = "search";
    EventType["FILTER_PRODUCTS"] = "filter_products";
    EventType["BEGIN_CHECKOUT"] = "begin_checkout";
    EventType["PURCHASE"] = "purchase";
    EventType["IDENTIFY"] = "identify";
    EventType["ADD_SHIPPING_INFO"] = "add_shipping_info";
    EventType["CLICK_PLACE_ORDER"] = "click_place_order";
    EventType["VIEW_ORDER_SUCCESS"] = "view_order_success";
    EventType["APPROVE_SELLER"] = "approve_seller";
    EventType["REJECT_SELLER"] = "reject_seller";
    EventType["BAN_SHOP"] = "ban_shop";
    EventType["UNBAN_SHOP"] = "unban_shop";
    EventType["CREATE_USER"] = "create_user";
    EventType["BAN_USER"] = "ban_user";
    EventType["UNBAN_USER"] = "unban_user";
    EventType["DELETE_USER"] = "DELETE_USER";
})(EventType || (exports.EventType = EventType = {}));
class TrackEventDto {
    id;
    type;
    targetId;
    metadata;
}
exports.TrackEventDto = TrackEventDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], TrackEventDto.prototype, "id", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(EventType),
    __metadata("design:type", String)
], TrackEventDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], TrackEventDto.prototype, "targetId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], TrackEventDto.prototype, "metadata", void 0);
class TrackBatchDto {
    events;
}
exports.TrackBatchDto = TrackBatchDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(50),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => TrackEventDto),
    __metadata("design:type", Array)
], TrackBatchDto.prototype, "events", void 0);
//# sourceMappingURL=track-event.dto.js.map