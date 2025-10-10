import { IsOptional, IsString, IsArray, IsObject } from 'class-validator';

export class FindTransactionDto {
  @IsOptional()
  @IsString()
  uid?: string;

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
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  focusAssetUri?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  relatedAssetsUris?: string[];

  @IsOptional()
  @IsObject()
  meta?: Record<string, unknown>;
}
