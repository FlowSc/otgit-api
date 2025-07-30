import { Controller, Post, Body, ValidationPipe, Get, Query, Res, BadRequestException, Param } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import { SocialLoginDto, SocialCallbackDto } from './dto/social-login.dto';
import { SendVerificationCodeDto, VerifyPhoneCodeDto } from './dto/phone-verification.dto';
import { CheckEmailDto, CheckNameDto } from './dto/check-duplicate.dto';
import { UpdateLocationDto, LocationResponseDto } from './dto/update-location.dto';
import { Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle({ short: { limit: 1, ttl: 1000 } }) // 1초에 1번만 허용
  async register(@Body(ValidationPipe) createUserDto: CreateUserDto) {
    return this.authService.register(createUserDto);
  }

  @Post('login')
  @Throttle({ short: { limit: 2, ttl: 1000 } }) // 1초에 2번만 허용
  async login(@Body(ValidationPipe) loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('social-login')
  async socialLogin(@Body(ValidationPipe) socialLoginDto: SocialLoginDto) {
    return this.authService.socialLogin(socialLoginDto);
  }

  @Get('callback')
  async handleCallback(
    @Query(ValidationPipe) callbackDto: SocialCallbackDto,
    @Res() res: Response,
  ) {
    try {
      const result = await this.authService.handleOAuthCallback(callbackDto);
      // 성공 시 클라이언트 앱으로 리다이렉트 (딥링크 또는 웹 URL)
      const redirectUrl = `${process.env.CLIENT_URL || 'otgit://'}auth/success?access_token=${result.access_token}&refresh_token=${result.refresh_token}`;
      return res.redirect(redirectUrl);
    } catch (error) {
      // 실패 시 에러 페이지로 리다이렉트
      const errorUrl = `${process.env.CLIENT_URL || 'otgit://'}auth/error?message=${encodeURIComponent(error.message)}`;
      return res.redirect(errorUrl);
    }
  }

  // 회원가입 전 전화번호 인증 코드 발송
  @Post('send-presignup-verification-code')
  @Throttle({ short: { limit: 1, ttl: 1000 }, medium: { limit: 3, ttl: 60000 } }) // 1초에 1번, 1분에 3번
  async sendPreSignupVerificationCode(@Body(ValidationPipe) sendVerificationCodeDto: SendVerificationCodeDto) {
    return this.authService.sendPreSignupVerificationCode(sendVerificationCodeDto);
  }

  // 회원가입 전 전화번호 인증 코드 검증
  @Post('verify-presignup-phone')
  @Throttle({ short: { limit: 2, ttl: 1000 }, medium: { limit: 5, ttl: 60000 } }) // 1초에 2번, 1분에 5번
  async verifyPreSignupPhoneCode(@Body(ValidationPipe) verifyPhoneCodeDto: VerifyPhoneCodeDto) {
    return this.authService.verifyPreSignupPhoneCode(verifyPhoneCodeDto);
  }

  // 기존 사용자용 전화번호 인증 코드 발송 (회원가입 후)
  @Post('send-verification-code')
  @Throttle({ short: { limit: 1, ttl: 1000 }, medium: { limit: 3, ttl: 60000 } }) // 1초에 1번, 1분에 3번
  async sendVerificationCode(@Body(ValidationPipe) sendVerificationCodeDto: SendVerificationCodeDto) {
    return this.authService.sendVerificationCode(sendVerificationCodeDto);
  }

  // 기존 사용자용 전화번호 인증 코드 검증 (회원가입 후)
  @Post('verify-phone')
  @Throttle({ short: { limit: 2, ttl: 1000 }, medium: { limit: 5, ttl: 60000 } }) // 1초에 2번, 1분에 5번
  async verifyPhoneCode(@Body(ValidationPipe) verifyPhoneCodeDto: VerifyPhoneCodeDto) {
    return this.authService.verifyPhoneCode(verifyPhoneCodeDto);
  }

  @Post('update-location')
  async updateLocation(
    @Body(ValidationPipe) updateLocationDto: UpdateLocationDto,
  ): Promise<LocationResponseDto> {
    const userId = updateLocationDto.user_id;
    if (!userId) {
      throw new BadRequestException('user_id is required');
    }
    return this.authService.updateUserLocation(userId, updateLocationDto);
  }

  @Get('location/:userId')
  async getLocation(@Param('userId') userId: string): Promise<LocationResponseDto | null> {
    return this.authService.getUserLocation(userId);
  }

  // 이메일 중복 검증
  @Post('check-email')
  @Throttle({ short: { limit: 3, ttl: 1000 }, medium: { limit: 10, ttl: 60000 } }) // 1초에 3번, 1분에 10번
  async checkEmailDuplicate(@Body(ValidationPipe) checkEmailDto: CheckEmailDto) {
    return this.authService.checkEmailDuplicate(checkEmailDto);
  }

  // 닉네임(이름) 중복 검증
  @Post('check-name')
  @Throttle({ short: { limit: 3, ttl: 1000 }, medium: { limit: 10, ttl: 60000 } }) // 1초에 3번, 1분에 10번
  async checkNameDuplicate(@Body(ValidationPipe) checkNameDto: CheckNameDto) {
    return this.authService.checkNameDuplicate(checkNameDto);
  }
}
