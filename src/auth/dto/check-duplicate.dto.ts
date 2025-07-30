import { IsNotEmpty, IsString, IsEmail } from 'class-validator';

export class CheckEmailDto {
  @IsNotEmpty()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;
}

export class CheckNameDto {
  @IsNotEmpty()
  @IsString()
  name: string;
}
