import { IsString, IsNumber, IsOptional } from 'class-validator';

export class WithdrawFromPublicationDTO {
  @IsString()
  userTgId: string;

  @IsString()
  userTgName: string;

  @IsString()
  forPublicationUid: string;

  @IsNumber()
  amount: number;

  @IsOptional()
  @IsString()
  comment?: string;
}
