import { IsString, IsNumber, IsOptional } from 'class-validator';

export class WithdrawFromTransactionDTO {
  @IsString()
  userTgId: string;

  @IsString()
  userTgName: string;

  @IsString()
  forTransactionUid: string;

  @IsNumber()
  amount: number;

  @IsOptional()
  @IsString()
  comment?: string;
}
