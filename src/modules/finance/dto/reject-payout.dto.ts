import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RejectPayoutDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}
