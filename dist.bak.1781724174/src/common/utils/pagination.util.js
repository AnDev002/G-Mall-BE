"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPagination = getPagination;
function getPagination(page, limit, opts = {}) {
    const { defaultLimit = 10, maxLimit = 100 } = opts;
    const p = Math.max(1, Math.floor(Number(page)) || 1);
    const l = Math.min(maxLimit, Math.max(1, Math.floor(Number(limit)) || defaultLimit));
    return { page: p, limit: l, skip: (p - 1) * l };
}
//# sourceMappingURL=pagination.util.js.map