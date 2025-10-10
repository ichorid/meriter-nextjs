import { IsString, IsNumber } from 'class-validator';

export class WithdrawFromPublicationDTO {
  @IsString()
  userTgId: string;

  @IsString()
  userTgName: string;

  @IsString()
  forPublicationUid: string;

  @IsNumber()
  amount: number;

  @IsString()
  comment: string;
}
