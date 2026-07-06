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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const client_1 = require("@prisma/client");
const moment_1 = __importDefault(require("moment"));
let DashboardService = class DashboardService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getStats() {
        const revenueAgg = await this.prisma.order.aggregate({
            _sum: {
                totalAmount: true,
            },
            where: {
                status: client_1.OrderStatus.DELIVERED,
            },
        });
        const totalOrders = await this.prisma.order.count();
        const totalUsers = await this.prisma.user.count();
        const activeShops = await this.prisma.shop.count({
            where: { status: client_1.ShopStatus.ACTIVE },
        });
        return {
            totalRevenue: Number(revenueAgg._sum.totalAmount) || 0,
            totalOrders,
            totalUsers,
            activeShops,
        };
    }
    async getSellerStats(sellerId) {
        const soldItems = await this.prisma.orderItem.findMany({
            where: {
                product: { is: { sellerId: sellerId } },
                order: { status: client_1.OrderStatus.DELIVERED }
            },
            select: { price: true, quantity: true }
        });
        const totalRevenue = soldItems.reduce((acc, item) => {
            return acc + (Number(item.price) * item.quantity);
        }, 0);
        const totalOrders = await this.prisma.order.count({
            where: { items: { some: { product: { is: { sellerId } } } } },
        });
        const totalProducts = await this.prisma.product.count({
            where: { sellerId },
        });
        const lowStockProducts = await this.prisma.product.count({
            where: { sellerId, stock: { lte: 5 } }
        });
        const pendingOrders = await this.prisma.order.count({
            where: {
                status: client_1.OrderStatus.PENDING,
                items: { some: { product: { is: { sellerId } } } }
            }
        });
        const shippingOrders = await this.prisma.order.count({
            where: {
                status: client_1.OrderStatus.SHIPPING,
                items: { some: { product: { is: { sellerId } } } }
            }
        });
        const confirmedOrders = await this.prisma.order.count({
            where: {
                status: client_1.OrderStatus.CONFIRMED,
                items: { some: { product: { is: { sellerId } } } }
            }
        });
        const returnedOrders = await this.prisma.order.count({
            where: {
                status: 'CANCELLED',
                items: { some: { product: { is: { sellerId } } } }
            }
        });
        const chartData = [];
        const today = new Date();
        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const startOfDay = new Date(date.setHours(0, 0, 0, 0));
            const endOfDay = new Date(date.setHours(23, 59, 59, 999));
            const dailyItems = await this.prisma.orderItem.findMany({
                where: {
                    product: { is: { sellerId } },
                    order: {
                        status: client_1.OrderStatus.DELIVERED,
                        updatedAt: {
                            gte: startOfDay,
                            lte: endOfDay
                        }
                    }
                },
                select: { price: true, quantity: true }
            });
            const dailyRevenue = dailyItems.reduce((acc, item) => acc + (Number(item.price) * item.quantity), 0);
            chartData.push({
                date: (0, moment_1.default)(startOfDay).format('DD/MM'),
                revenue: dailyRevenue
            });
        }
        const rating = 4.8;
        return {
            revenue: totalRevenue,
            orders: totalOrders,
            products: totalProducts,
            rating: rating,
            lowStockProducts,
            todo: {
                pending: pendingOrders,
                confirmed: confirmedOrders,
                shipping: shippingOrders,
                returned: returnedOrders
            },
            chart: chartData
        };
    }
};
exports.DashboardService = DashboardService;
exports.DashboardService = DashboardService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], DashboardService);
//# sourceMappingURL=dashboard.service.js.map