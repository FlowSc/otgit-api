import { IsEnum, IsNotEmpty, IsString, IsOptional } from 'class-validator';

export enum SocialProvider {
  GOOGLE = 'google',
  APPLE = 'apple',
}

export class SocialLoginDto {
  @IsEnum(SocialProvider)
  @IsNotEmpty()
  provider: SocialProvider;

  @IsString()
  @IsOptional()
  redirectTo?: string;
}

export class SocialCallbackDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsOptional()
  state?: string;
}
