import { Controller, Post, Body, ValidationPipe, Get, Query, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import { SocialLoginDto, SocialCallbackDto } from './dto/social-login.dto';
import { Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body(ValidationPipe) createUserDto: CreateUserDto) {
    return this.authService.register(createUserDto);
  }

  @Post('login')
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
}
