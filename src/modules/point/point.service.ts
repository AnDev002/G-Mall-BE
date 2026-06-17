import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { RedisService } from '../../database/redis/redis.service';
import { PointType, Prisma } from '@prisma/client';
import { MailerService } from '@nestjs-modules/mailer'; // [FIX 3] Import MailerService
import moment from 'moment';

const DEFAULT_RATE = 10000;

@Injectable()
export class PointService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService, // Tên biến là 'redis'
    private mailerService: MailerService, // [FIX 3] Inject MailerService
  ) {}

  // 1. Lấy thông tin ví & checkin
  async getMyPointInfo(userId: string) {
    const wallet = await this.prisma.pointWallet.findUnique({ where: { userId } });
    const checkIn = await this.prisma.dailyCheckIn.findUnique({ where: { userId } });

    const isCheckedInToday = checkIn 
      ? moment(checkIn.lastCheckInDate).isSame(moment(), 'day') 
      : false;

    const dayOfWeek = moment().isoWeekday();

    return {
      points: wallet?.balance || 0,
      streak: checkIn?.currentStreak || 0,
      isCheckedInToday,
      dayOfWeek,
    };
  }

  async getConversionRate(): Promise<number> {
    // 1. Thử lấy từ Redis cho nhanh (nếu có cache)
    const cached = await this.redis.get('POINT_RATE');
    if (cached) return Number(cached);

    // 2. Nếu không có cache, lấy từ DB
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key: 'POINT_CONVERSION_RATE' }
    });

    const rate = setting ? Number(setting.value) : DEFAULT_RATE;

    // 3. Cache lại 1 ngày (hoặc đến khi có update)
    await this.redis.set('POINT_RATE', String(rate), 86400); 
    
    return rate;
  }

  // [NEW] Cập nhật tỷ lệ (Dành cho Admin)
  async updateConversionRate(amount: number) {
    if (amount < 1000) throw new BadRequestException('Tỷ lệ quá thấp (tối thiểu 1000đ/xu)');
    
    await this.prisma.systemSetting.upsert({
      where: { key: 'POINT_CONVERSION_RATE' },
      update: { value: String(amount) },
      create: { 
        key: 'POINT_CONVERSION_RATE', 
        value: String(amount), 
        description: 'Số tiền VND tương ứng với 1 Xu' 
      }
    });

    // Xóa cache để lần sau lấy giá trị mới
    await this.redis.del('POINT_RATE');
    
    return { success: true, rate: amount };
  }

  // 2. Hàm cộng/trừ điểm an toàn
  async addPoints(
    userId: string, 
    amount: number, 
    type: PointType, 
    referenceId: string, 
    description: string, 
    tx: Prisma.TransactionClient
  ) {
    const wallet = await tx.pointWallet.upsert({
      where: { userId },
      create: { userId, balance: amount > 0 ? amount : 0 },
      update: { balance: { increment: amount } },
    });

    if (wallet.balance < 0) {
      throw new BadRequestException('Số dư không đủ.');
    }

    await tx.pointHistory.create({
      data: {
        userId,
        amount,
        type,
        source: 'GAME',
        description,
        // [FIX 5] Bỏ refId vì schema không có
      }
    });

    return wallet.balance;
  }

  // 3. Wrapper Transaction
  async processTransaction(
    userId: string, 
    amount: number, 
    type: PointType, 
    referenceId: string, 
    description: string
  ) {
    return this.prisma.$transaction(async (tx) => {
       const newBalance = await this.addPoints(userId, amount, type, referenceId, description, tx);
       return { newBalance };
    });
  }

  // 4. Điểm danh hàng ngày
  // G3 (wiki 0044/0045): theo spec Require GMall §8 — 3000 xu/ngày, bonus 10000
  // khi streak chẵn 10 ngày liên tục. Trước đây code thưởng theo thứ trong tuần
  // (100/150/.../1000) — không khớp spec, không có bonus streak.
  // Streak reset khi:
  //   - Lần đầu điểm danh (record chưa có) → streak = 1
  //   - Bỏ qua ngày (không liên tục) → streak = 1
  // Bonus 10k cộng vào ngày thứ 10, 20, 30... — khuyến khích duy trì lâu dài.
  async dailyCheckIn(userId: string) {
    const DAILY_REWARD = 3000;
    const STREAK_BONUS = 10000;
    const STREAK_THRESHOLD = 10;

    const lockKey = `lock:checkin:${userId}`;
    const isLocked = await this.redis.setNX(lockKey, '1', 5);
    if (!isLocked) throw new BadRequestException('Thao tác quá nhanh.');

    // [FIX H8 - wiki 0088] CHIA SẺ chung khoá-ngày với /events/daily-checkin (DailyService dùng
    // cùng key `checkin:${userId}:${today}`). Trước đây 2 endpoint điểm danh dedup RIÊNG (DB record
    // vs Redis) → gọi cả hai cùng ngày = nhận thưởng EARN_DAILY 2 lần. Giờ ai claim trước thì
    // endpoint kia bị chặn.
    // [FIX review-H8 - wiki 0088] dùng ngày LOCAL (moment) — khớp với DB check `now.isSame(...,'day')`
    // dùng moment local. Trước đây dùng toISOString (UTC): server GMT+7 → 1 ngày local trải 2 ngày UTC
    // → khoá-ngày lệch giữa 2 endpoint quanh nửa đêm UTC (07:00 local) → vẫn double-award. DailyService
    // cũng đổi sang cùng format để key TRÙNG nhau.
    const today = moment().format('YYYY-MM-DD');
    const dayKey = `checkin:${userId}:${today}`;
    const dayClaim = await this.redis.setNX(dayKey, '1', 86400);
    if (!dayClaim) {
      await this.redis.del(lockKey);
      throw new BadRequestException('Hôm nay bạn đã điểm danh rồi.');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        let record = await tx.dailyCheckIn.findUnique({ where: { userId } });
        const now = moment();

        if (!record) {
          // Fix B-NEW-7 (wiki 0026): dùng `now.clone()` vì moment.subtract() mutates!
          record = await tx.dailyCheckIn.create({
            data: { userId, lastCheckInDate: now.clone().subtract(1, 'day').toDate(), currentStreak: 0 }
          });
        }

        const lastCheckIn = moment(record.lastCheckInDate);
        if (now.isSame(lastCheckIn, 'day')) {
           throw new BadRequestException('Hôm nay đã điểm danh rồi.');
        }

        const isConsecutive = now.clone().subtract(1, 'day').isSame(lastCheckIn, 'day');
        const newStreak = isConsecutive ? record.currentStreak + 1 : 1;

        let earned = DAILY_REWARD;
        let bonusApplied = false;
        if (newStreak > 0 && newStreak % STREAK_THRESHOLD === 0) {
          earned += STREAK_BONUS;
          bonusApplied = true;
        }

        await tx.dailyCheckIn.update({
          where: { userId },
          data: { lastCheckInDate: now.toDate(), currentStreak: newStreak }
        });

        const description = bonusApplied
          ? `Điểm danh ngày ${newStreak} (streak +${STREAK_BONUS} bonus)`
          : `Điểm danh ngày ${newStreak}`;
        await this.addPoints(userId, earned, PointType.EARN_DAILY, `DAILY_${now.format('YYYYMMDD')}`, description, tx);

        return { earned, streak: newStreak, bonusApplied };
      });
    } catch (e: any) {
      // [FIX H8] Chỉ NHẢ khoá-ngày khi award LỖI THẬT (tx rollback → chưa cộng điểm) để user thử
      // lại; nếu lỗi là "đã điểm danh" (DB record đã có hôm nay) thì GIỮ khoá để chặn nhận 2 lần
      // qua /events/daily-checkin.
      const msg = String(e?.message || '').toLowerCase();
      if (!msg.includes('đã điểm danh')) {
        await this.redis.del(dayKey);
      }
      throw e;
    } finally {
      await this.redis.del(lockKey);
    }
  }

  // 5. Lấy lịch sử
  async getHistory(userId: string) {
    return this.prisma.pointHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
  }

  // 6. Reset Test
  async resetDailyTest(userId: string) {
    const today = new Date().toISOString().split('T')[0];
    const checkinKey = `checkin:${userId}:${today}`;
    const gachaKey = `gacha:${userId}:${today}`;
    
    await this.redis.del(checkinKey);
    await this.redis.del(gachaKey);
    
    return { message: 'Đã reset! Bạn có thể điểm danh lại.' };
  }

  // --- 7. CHUYỂN XU (ĐÃ FIX LỖI) ---
  async initiateTransfer(senderId: string, receiverId: string, amount: number) {
    if (amount <= 0) throw new BadRequestException('Số xu chuyển phải lớn hơn 0');
    if (senderId === receiverId) throw new BadRequestException('Không thể tự chuyển cho chính mình');

    // [FIX 1] point -> pointWallet, amount -> balance
    const senderWallet = await this.prisma.pointWallet.findUnique({ where: { userId: senderId } });
    if (!senderWallet || senderWallet.balance < amount) { 
      throw new BadRequestException('Số dư không đủ để thực hiện giao dịch.');
    }

    const receiver = await this.prisma.user.findUnique({ where: { id: receiverId } });
    if (!receiver) throw new BadRequestException('Người nhận không tồn tại.');

    const sender = await this.prisma.user.findUnique({ where: { id: senderId } });
    if (!sender) throw new BadRequestException('Người gửi không hợp lệ.');

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const transferData = JSON.stringify({ receiverId, amount, otp });
    
    // [FIX 2] redisService -> redis
    await this.redis.set(`transfer_otp:${senderId}`, transferData, 300);

    if(sender.email && sender.email != null && sender.email != undefined && sender.email != "")
    {
      // [FIX 3] mailerService đã có
      await this.mailerService.sendMail({
        to: sender.email,
        subject: '[Gmall] Mã xác thực chuyển Xu',
        html: `
          <h3>Xác thực chuyển xu</h3>
          <p>Bạn đang thực hiện chuyển <b>${amount} xu</b> cho tài khoản <b>${receiver.email}</b>.</p>
          <p>Mã OTP của bạn là: <b style="font-size: 20px; color: red;">${otp}</b></p>
          <p>Mã có hiệu lực trong 5 phút.</p>
        `,
      });
  
      return { message: 'Mã OTP đã được gửi về email của bạn.' };
    }
  }

  async confirmTransfer(senderId: string, inputOtp: string) {
    // [round14 FIX H6] Khoá mỗi-sender NGAY ĐẦU để chỉ 1 confirm chạy cùng lúc.
    // Trước đây 2 request confirm song song cùng OTP có thể cùng qua verify (đọc OTP
    // trước khi nhau xoá) → chuyển 2× xu cho 1 OTP. setNX (SET ... EX 30 NX) → chỉ 1
    // request giành được khoá; request còn lại bị chặn. try/finally để luôn nhả khoá.
    const lockKey = `lock:transfer:${senderId}`;
    const locked = await this.redis.setNX(lockKey, '1', 30);
    if (!locked) {
      throw new BadRequestException('Đang xử lý, thử lại');
    }

    try {
    // [round14 FIX H6] CONSUME OTP ATOMIC bằng GETDEL: fetch + delete trong 1 lệnh TRƯỚC khi
    // chạy transfer → loại bỏ cửa sổ TOCTOU giữa get rồi mới del. Lấy về value để validate;
    // nếu key đã biến mất (null) → OTP đã dùng/hết hạn → reject. OTP SAI cũng đã bị xoá ở đây,
    // nhưng đó là hành vi an toàn (1 OTP = 1 lần thử confirm; sai thì phải xin OTP mới).
    const dataStr = await this.redis.getClient().getdel(`transfer_otp:${senderId}`);
    if (!dataStr) {
      throw new BadRequestException('Giao dịch hết hạn hoặc không tồn tại.');
    }

    const { receiverId, amount, otp } = JSON.parse(dataStr);

    if (otp !== inputOtp) {
      throw new BadRequestException('Mã OTP không chính xác.');
    }

    // [TỐI ƯU 1]: Thực hiện Transaction DB
    const result = await this.prisma.$transaction(async (tx) => {
        // [FIX C1 - wiki 0088] ATOMIC GUARDED decrement chống TOCTOU.
        // initiateTransfer chỉ check số dư lúc gửi OTP; giữa init và confirm người
        // gửi có thể đã tiêu hết xu (đặt đơn dùng xu...). Trước đây decrement VÔ ĐIỀU
        // KIỆN → ví ÂM + người nhận +amount → ĐÚC xu (POINT_CONVERSION_RATE=1 = tiền thật).
        // Dùng updateMany có guard balance>=amount + count check (pattern như order path).
        const claim = await tx.pointWallet.updateMany({
            where: { userId: senderId, balance: { gte: amount } },
            data: { balance: { decrement: amount } },
        });
        if (claim.count === 0) {
            throw new BadRequestException('Số dư không đủ để thực hiện giao dịch.');
        }

        // 2. Cộng tiền người nhận
        await tx.pointWallet.upsert({
            where: { userId: receiverId },
            update: { balance: { increment: amount } },
            create: { userId: receiverId, balance: amount }
        });

        // 3. Ghi log (Chạy song song bằng Promise.all để tiết kiệm thời gian)
        await Promise.all([
          tx.pointHistory.create({
              data: {
                  userId: senderId,
                  amount: -amount,
                  type: PointType.TRANSFER_SENT, 
                  source: 'TRANSFER',
                  description: `Chuyển ${amount} xu cho user ${receiverId}`
              }
          }),
          tx.pointHistory.create({
              data: {
                  userId: receiverId,
                  amount: amount,
                  type: PointType.TRANSFER_RECEIVED,
                  source: 'TRANSFER',
                  description: `Nhận ${amount} xu từ user ${senderId}`
              }
          })
        ]);

        const senderWallet = await tx.pointWallet.findUnique({ where: { userId: senderId } });
        return { success: true, newBalance: senderWallet?.balance ?? 0 };
    }, {
        // [FIX LỖI]: Tăng thời gian timeout lên 20 giây (Mặc định là 5s)
        timeout: 20000,
        maxWait: 5000
    });

    // OTP đã được consume (GETDEL) ATOMIC ở trên trước khi vào tx → không cần xoá lại ở đây.
    return result;
    } finally {
      // [round14 FIX H6] Luôn nhả khoá mỗi-sender dù thành công hay lỗi.
      await this.redis.del(lockKey);
    }
  }
}