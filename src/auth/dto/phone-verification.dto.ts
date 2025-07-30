import { IsNotEmpty, IsString, Matches, Length } from 'class-validator';

export class SendVerificationCodeDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^010-\d{4}-\d{4}$/, {
    message: 'Phone number must be in format 010-XXXX-XXXX',
  })
  phone: string;
}

export class VerifyPhoneCodeDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^010-\d{4}-\d{4}$/, {
    message: 'Phone number must be in format 010-XXXX-XXXX',
  })
  phone: string;

  @IsString()
  @IsNotEmpty()
  @Length(6, 6, {
    message: 'Verification code must be 6 digits',
  })
  @Matches(/^\d{6}$/, {
    message: 'Verification code must contain only numbers',
  })
  code: string;
}
