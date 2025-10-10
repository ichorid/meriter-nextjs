import { IsString, IsNumber } from 'class-validator';

export class WithdrawFromTransactionDTO {
  @IsString()
  userTgId: string;

  @IsString()
  userTgName: string;

  @IsString()
  forTransactionUid: string;

  @IsNumber()
  amount: number;

  @IsString()
  comment: string;
}
