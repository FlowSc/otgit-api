import { IsString, IsOptional, IsEnum, MaxLength } from 'class-validator';

export enum MBTIType {
  ENFP = 'ENFP',
  ENFJ = 'ENFJ',
  ENTP = 'ENTP',
  ENTJ = 'ENTJ',
  ESFP = 'ESFP',
  ESFJ = 'ESFJ',
  ESTP = 'ESTP',
  ESTJ = 'ESTJ',
  INFP = 'INFP',
  INFJ = 'INFJ',
  INTP = 'INTP',
  INTJ = 'INTJ',
  ISFP = 'ISFP',
  ISFJ = 'ISFJ',
  ISTP = 'ISTP',
  ISTJ = 'ISTJ',
}

export class UpdateProfileDto {
  @IsOptional()
  @IsEnum(MBTIType)
  mbti?: MBTIType;

  @IsOptional()
  @IsString()
  @MaxLength(500, {
    message: 'Personality description must be less than 500 characters',
  })
  personality?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Job must be less than 100 characters' })
  job?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Bio must be less than 1000 characters' })
  bio?: string;
}
