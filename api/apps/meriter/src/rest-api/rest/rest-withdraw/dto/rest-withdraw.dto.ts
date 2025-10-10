import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class RestWithdrawDto {
  @IsNumber()
  amount: number;

  @IsNumber()
  amountInternal: number;

  @IsString()
  comment: string;

  @IsBoolean()
  directionAdd: boolean;

  @IsOptional()
  @IsString()
  publicationSlug?: string;

  @IsOptional()
  @IsString()
  transactionId?: string;

  @IsBoolean()
  withdrawMerits: boolean;
}

