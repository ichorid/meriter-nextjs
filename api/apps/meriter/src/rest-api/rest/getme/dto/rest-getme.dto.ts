import { IsString } from 'class-validator';

export class RestGetmeDto {
  @IsString()
  chatsIds: string;

  @IsString()
  name: string;

  @IsString()
  tgUserId: string;

  @IsString()
  token: string;
}

