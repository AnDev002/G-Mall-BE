"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = void 0;
const common_1 = require("@nestjs/common");
exports.User = (0, common_1.createParamDecorator)((data, ctx) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    if (!data)
        return user;
    if (data === 'id' && user?.id)
        return user.id;
    return user ? user[data] : null;
});
//# sourceMappingURL=user.decorator.js.map