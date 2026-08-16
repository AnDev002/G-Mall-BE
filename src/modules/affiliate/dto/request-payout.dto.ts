import { IsInt, IsString, IsNotEmpty, Min, MaxLength } from 'class-validator';

/**
 * wiki 0105 — người tiếp thị yêu cầu rút hoa hồng đã chốt sổ.
 *
 * Dùng lại nguyên `FinanceService.requestPayout` của seller: nó trừ ví ATOMIC
 * (`walletBalance: { gte: amt }`) rồi mới tạo yêu cầu, nên không rút vượt số dư kể cả
 * khi bấm hai lần cùng lúc.
 */
export class RequestPayoutDto {
  @IsInt({ message: 'Số tiền rút phải là số nguyên.' })
  @Min(1, { message: 'Số tiền rút phải lớn hơn 0.' })
  amount: number;

  /** Định dạng dùng chung với seller: "Tên ngân hàng - Số tài khoản - Chủ tài khoản". */
  @IsString()
  @IsNotEmpty({ message: 'Thiếu thông tin ngân hàng nhận tiền.' })
  @MaxLength(255)
  bankInfo: string;
}
