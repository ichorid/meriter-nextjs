import { IsString, IsNumber } from 'class-validator';

export class TransactionForTransactionDTO {
  @IsString()
  fromUserTgId: string;

  @IsString()
  fromUserTgName: string;

  @IsString()
  inPublicationUid: string;

  @IsString()
  forTransactionUid: string;

  @IsNumber()
  amount: number;

  @IsString()
  comment: string;
}
