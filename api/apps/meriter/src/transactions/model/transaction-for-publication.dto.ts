import { IsString, IsNumber } from 'class-validator';

export class TransactionForPublicationDTO {
  @IsString()
  fromUserTgId: string;

  @IsString()
  fromUserTgName: string;

  @IsString()
  forPublicationUid: string;

  @IsNumber()
  amount: number;

  @IsString()
  comment: string;
}
