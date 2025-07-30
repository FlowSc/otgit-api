import { IsEmail, IsString, MinLength, IsNotEmpty, IsEnum, IsInt, Min, Max, Matches } from 'class-validator';

export enum Gender {
  MALE = 'male',
  FEMALE = 'female'
}

export class CreateUserDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  @Matches(/^010-\d{4}-\d{4}$/, {
    message: 'Phone number must be in format 010-XXXX-XXXX'
  })
  phone: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
  })
  password: string;

  @IsNotEmpty()
  @IsEnum(Gender)
  gender: Gender;

  @IsNotEmpty()
  @IsInt()
  @Min(18)
  @Max(100)
  age: number;
}