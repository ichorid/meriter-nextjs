import { IsString, IsOptional } from 'class-validator';

export class RestGetmeDto {
  @IsString()
  chatsIds: string;

  @IsString()
  name: string;

  @IsString()
  tgUserId: string;

  @IsString()
  token: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;
}

