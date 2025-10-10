import { IsOptional, IsString, IsArray, IsNumber, IsObject } from 'class-validator';

export class UpsertTransactionDto {
  @IsOptional()
  @IsString()
  domainName?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  initiatorsActorUris?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  subjectsActorUris?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  spacesActorUris?: string[];

  @IsOptional()
  @IsNumber()
  value?: number;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  focusPublicationUri?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  relatedPublicationsUris?: string[];

  @IsObject()
  meta: Record<string, unknown>;
}
