import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import axios from 'axios';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  constructor(private configService: ConfigService) {}

  // ... (Giữ nguyên phần MoMo) ...
  async createMomoPayment(orderId: string, amount: number) {
    // Code MoMo cũ giữ nguyên
    return { payUrl: "https://momo.vn/dummy" }; 
  }
  verifyMomoSignature(body: any) { return true; }

  // [UPDATED] Thêm tham số description (mặc định nếu không truyền)
  async createPay2SPayment(
      orderId: string, 
      amount: number, 
      description: string = 'Thanh toan don hang'
  ) {
        const apiUrl = this.configService.get('PAY2S_API_URL');
        const partnerCode = this.configService.get('PAY2S_MERCHANT_ID');
        const accessKey = this.configService.get('PAY2S_ACCESS_KEY');
        const secretKey = this.configService.get('PAY2S_SECRET_KEY');
        const returnUrl = this.configService.get('PAY2S_RETURN_URL');
        const ipnUrl = this.configService.get('PAY2S_IPN_URL');
        
        const bankAccountNo = this.configService.get('PAY2S_BANK_NO') || '99999999';
        const bankId = this.configService.get('PAY2S_BANK_ID') || 'MB';

        if (!accessKey || !secretKey || !partnerCode) {
            throw new BadRequestException('Thiếu cấu hình Pay2S');
        }

        const requestId = String(Date.now());
        const strAmount = String(Math.floor(amount));
        const requestType = 'pay2s';

        // [LOGIC MỚI] Xử lý Order Info kết hợp Description và OrderId
        const cleanRef = orderId.replace(/[^a-zA-Z0-9]/g, ''); 
        const cleanDesc = description.replace(/[^a-zA-Z0-9\s]/g, ''); // Loại bỏ ký tự lạ
        
        let safeOrderInfo = `${cleanDesc} ${cleanRef}`;
        
        // Cắt chuỗi nếu quá dài (Pay2S thường giới hạn 50-100 ký tự)
        if (safeOrderInfo.length > 50) safeOrderInfo = safeOrderInfo.substring(0, 50);
        // Đảm bảo không quá ngắn
        if (safeOrderInfo.length < 5) safeOrderInfo = (safeOrderInfo + "00000").substring(0, 10);

        // Tạo chữ ký
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
            const response = await axios.post(apiUrl, payload);
            if (response.data?.payUrl) return response.data.payUrl;
            if (response.data?.paymentUrl) return response.data.paymentUrl;
            // Một số trường hợp API trả về data lồng nhau
            if (response.data?.data?.payUrl) return response.data.data.payUrl;
            
            this.logger.error(`Pay2S Response: ${JSON.stringify(response.data)}`);
            throw new Error(response.data?.message || 'Lỗi Pay2S không trả về link thanh toán');
        } catch (error) {
            this.logger.error(`Lỗi tạo Link Pay2S: ${error.message}`);
            throw new BadRequestException('Lỗi kết nối cổng thanh toán');
        }
    }

  // (Giữ nguyên verifyPay2SSignature cũ của bạn)
  verifyPay2SSignature(query: any): boolean {
    const secretKey = this.configService.get('PAY2S_SECRET_KEY');
    const accessKey = this.configService.get('PAY2S_ACCESS_KEY');
    const { amount, extraData, message, orderId, orderInfo, orderType, partnerCode, payType, requestId, responseTime, resultCode, transId, signature } = query;
    const safeExtraData = extraData || '';
    const safeTransId = transId || '';
    const rawHash = `accessKey=${accessKey}&amount=${amount}&extraData=${safeExtraData}&message=${message}&orderId=${orderId}&orderInfo=${orderInfo}&orderType=${orderType}&partnerCode=${partnerCode}&payType=${payType}&requestId=${requestId}&responseTime=${responseTime}&resultCode=${resultCode}&transId=${safeTransId}`;
    const mySignature = crypto.createHmac('sha256', secretKey).update(rawHash).digest('hex');
    return mySignature === signature;
  }
}