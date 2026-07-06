"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var PaymentService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const crypto = __importStar(require("crypto"));
const axios_1 = __importDefault(require("axios"));
let PaymentService = PaymentService_1 = class PaymentService {
    configService;
    logger = new common_1.Logger(PaymentService_1.name);
    constructor(configService) {
        this.configService = configService;
    }
    safeCompareHmac(expected, received) {
        if (typeof received !== 'string')
            return false;
        const a = Buffer.from(expected);
        const b = Buffer.from(received);
        if (a.length !== b.length)
            return false;
        return crypto.timingSafeEqual(a, b);
    }
    async createMomoPayment(orderId, amount, description = 'Thanh toan don hang Gmall') {
        const partnerCode = this.configService.get('MOMO_PARTNER_CODE');
        const accessKey = this.configService.get('MOMO_ACCESS_KEY');
        const secretKey = this.configService.get('MOMO_SECRET_KEY');
        const endpoint = this.configService.get('MOMO_ENDPOINT') ||
            'https://test-payment.momo.vn/v2/gateway/api/create';
        const redirectUrl = this.configService.get('MOMO_RETURN_URL');
        const ipnUrl = this.configService.get('MOMO_IPN_URL');
        if (!partnerCode || !accessKey || !secretKey || !redirectUrl || !ipnUrl) {
            throw new common_1.BadRequestException('MoMo chưa được cấu hình, vui lòng chọn phương thức thanh toán khác');
        }
        const requestId = `${orderId}-${Date.now()}`;
        const orderInfo = description;
        const requestType = 'captureWallet';
        const extraData = '';
        const strAmount = String(Math.floor(amount));
        const rawSignature = `accessKey=${accessKey}&amount=${strAmount}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${partnerCode}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;
        const signature = crypto
            .createHmac('sha256', secretKey)
            .update(rawSignature)
            .digest('hex');
        const payload = {
            partnerCode,
            partnerName: 'GMall',
            storeId: 'GMallStore',
            requestId,
            amount: strAmount,
            orderId,
            orderInfo,
            redirectUrl,
            ipnUrl,
            lang: 'vi',
            extraData,
            requestType,
            signature,
        };
        try {
            const response = await axios_1.default.post(endpoint, payload, { timeout: 10000 });
            if (response.data?.payUrl)
                return response.data.payUrl;
            this.logger.error(`MoMo response không có payUrl: ${JSON.stringify(response.data)}`);
            throw new Error(response.data?.message || 'MoMo không trả về link thanh toán');
        }
        catch (error) {
            this.logger.error(`Lỗi tạo link MoMo: ${error.message}`);
            throw new common_1.BadRequestException('Lỗi kết nối cổng thanh toán MoMo');
        }
    }
    verifyMomoSignature(body) {
        const secretKey = this.configService.get('MOMO_SECRET_KEY');
        const accessKey = this.configService.get('MOMO_ACCESS_KEY');
        if (!secretKey || !accessKey)
            return false;
        const { amount, extraData, message, orderId, orderInfo, orderType, partnerCode, payType, requestId, responseTime, resultCode, transId, signature, } = body || {};
        const rawHash = `accessKey=${accessKey}&amount=${amount}&extraData=${extraData || ''}&message=${message}&orderId=${orderId}&orderInfo=${orderInfo}&orderType=${orderType}&partnerCode=${partnerCode}&payType=${payType}&requestId=${requestId}&responseTime=${responseTime}&resultCode=${resultCode}&transId=${transId || ''}`;
        const expected = crypto.createHmac('sha256', secretKey).update(rawHash).digest('hex');
        return this.safeCompareHmac(expected, signature);
    }
    async createPay2SPayment(orderId, amount, description = 'Thanh toan don hang') {
        const apiUrl = this.configService.get('PAY2S_API_URL');
        const partnerCode = this.configService.get('PAY2S_MERCHANT_ID');
        const accessKey = this.configService.get('PAY2S_ACCESS_KEY');
        const secretKey = this.configService.get('PAY2S_SECRET_KEY');
        const returnUrl = this.configService.get('PAY2S_RETURN_URL');
        const ipnUrl = this.configService.get('PAY2S_IPN_URL');
        const bankAccountNo = this.configService.get('PAY2S_BANK_NO') || '99999999';
        const bankId = this.configService.get('PAY2S_BANK_ID') || 'MB';
        if (!accessKey || !secretKey || !partnerCode) {
            throw new common_1.BadRequestException('Thiếu cấu hình Pay2S');
        }
        const requestId = String(Date.now());
        const strAmount = String(Math.floor(amount));
        const requestType = 'pay2s';
        const cleanRef = orderId.replace(/[^a-zA-Z0-9]/g, '');
        const cleanDesc = description.replace(/[^a-zA-Z0-9\s]/g, '');
        let safeOrderInfo = `${cleanDesc} ${cleanRef}`;
        if (safeOrderInfo.length > 50)
            safeOrderInfo = safeOrderInfo.substring(0, 50);
        if (safeOrderInfo.length < 5)
            safeOrderInfo = (safeOrderInfo + "00000").substring(0, 10);
        const rawSignature = `accessKey=${accessKey}&amount=${strAmount}&bankAccounts=Array&ipnUrl=${ipnUrl}&orderId=${orderId}&orderInfo=${safeOrderInfo}&partnerCode=${partnerCode}&redirectUrl=${returnUrl}&requestId=${requestId}&requestType=${requestType}`;
        const signature = crypto
            .createHmac('sha256', secretKey)
            .update(rawSignature)
            .digest('hex');
        const bankAccounts = [
            { account_number: bankAccountNo, bank_id: bankId }
        ];
        const payload = {
            accessKey, partnerCode, partnerName: 'Gmall Store',
            requestId, amount: strAmount,
            orderId, orderInfo: safeOrderInfo,
            orderType: requestType, requestType,
            bankAccounts,
            redirectUrl: returnUrl, ipnUrl, signature,
        };
        try {
            const response = await axios_1.default.post(apiUrl, payload);
            if (response.data?.payUrl)
                return response.data.payUrl;
            if (response.data?.paymentUrl)
                return response.data.paymentUrl;
            if (response.data?.data?.payUrl)
                return response.data.data.payUrl;
            this.logger.error(`Pay2S Response: ${JSON.stringify(response.data)}`);
            throw new Error(response.data?.message || 'Lỗi Pay2S không trả về link thanh toán');
        }
        catch (error) {
            this.logger.error(`Lỗi tạo Link Pay2S: ${error.message}`);
            throw new common_1.BadRequestException('Lỗi kết nối cổng thanh toán');
        }
    }
    verifyPay2SSignature(query) {
        const secretKey = this.configService.get('PAY2S_SECRET_KEY');
        const accessKey = this.configService.get('PAY2S_ACCESS_KEY');
        if (!secretKey || !accessKey || !query)
            return false;
        const { amount, extraData, message, orderId, orderInfo, orderType, partnerCode, payType, requestId, responseTime, resultCode, transId, signature } = query;
        if (!signature)
            return false;
        const safeExtraData = extraData || '';
        const safeTransId = transId || '';
        const rawHash = `accessKey=${accessKey}&amount=${amount}&extraData=${safeExtraData}&message=${message}&orderId=${orderId}&orderInfo=${orderInfo}&orderType=${orderType}&partnerCode=${partnerCode}&payType=${payType}&requestId=${requestId}&responseTime=${responseTime}&resultCode=${resultCode}&transId=${safeTransId}`;
        const mySignature = crypto.createHmac('sha256', secretKey).update(rawHash).digest('hex');
        return this.safeCompareHmac(mySignature, signature);
    }
};
exports.PaymentService = PaymentService;
exports.PaymentService = PaymentService = PaymentService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], PaymentService);
//# sourceMappingURL=payment.service.js.map