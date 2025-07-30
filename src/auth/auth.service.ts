import {
  Injectable,
  ConflictException,
  InternalServerErrorException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import { SocialLoginDto, SocialCallbackDto } from './dto/social-login.dto';
import {
  SendVerificationCodeDto,
  VerifyPhoneCodeDto,
} from './dto/phone-verification.dto';
import { CheckEmailDto, CheckNameDto } from './dto/check-duplicate.dto';
import {
  UpdateLocationDto,
  LocationResponseDto,
} from './dto/update-location.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { createSupabaseClient } from '../config/supabase.config';
import { TicketsSchedulerService } from '../tickets/tickets-scheduler.service';
import { NCPSMSService } from '../config/ncp-sms.config';

@Injectable()
export class AuthService {
  private supabase: SupabaseClient;

  constructor(
    private configService: ConfigService,
    private ticketsSchedulerService: TicketsSchedulerService,
    private ncpSmsService: NCPSMSService,
  ) {
    this.supabase = createSupabaseClient(this.configService);
  }

  async register(createUserDto: CreateUserDto) {
    const { name, email, phone, password, gender, age } = createUserDto;

    try {
      // 인증된 전화번호인지 확인
      const { data: verifiedPhone, error: verificationError } =
        await this.supabase
          .from('phone_verifications')
          .select('*')
          .eq('phone', phone)
          .eq('is_verified', true)
          .gte(
            'verified_at',
            new Date(Date.now() - 10 * 60 * 1000).toISOString(),
          ) // 10분 이내
          .order('verified_at', { ascending: false })
          .limit(1)
          .single();

      if (verificationError && verificationError.code !== 'PGRST116') {
        throw new InternalServerErrorException(
          'Failed to check phone verification',
        );
      }

      if (!verifiedPhone) {
        throw new BadRequestException(
          'Phone number must be verified before registration. Please verify your phone number first.',
        );
      }

      // Check if email already exists
      const { data: existingEmail } = await this.supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single();

      if (existingEmail) {
        throw new ConflictException('Email already exists');
      }

      // Check if phone already exists (double check)
      const { data: existingPhone } = await this.supabase
        .from('users')
        .select('id')
        .eq('phone', phone)
        .single();

      if (existingPhone) {
        throw new ConflictException('Phone number already exists');
      }

      // Hash password
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Create user profile in users table (일반 회원가입은 자체 시스템 사용)
      const { data, error } = await this.supabase
        .from('users')
        .insert([
          {
            name,
            email,
            phone,
            password_hash: passwordHash,
            gender,
            age,
            phone_verified: true, // 이미 인증되었으므로 true로 설정
            login_type: 'email',
          },
        ])
        .select('id, email, name, phone, gender, age, created_at')
        .single();

      if (error) {
        throw new InternalServerErrorException('Failed to create user profile');
      }

      // 새로 가입한 사용자에게 초기 티켓 지급
      await this.ticketsSchedulerService.grantInitialTicket(data.id);

      return {
        message:
          'User registered successfully. Please verify your phone number.',
        user: data,
      };
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      console.error('Registration error:', error);
      throw new InternalServerErrorException(
        `Registration failed: ${error.message}`,
      );
    }
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    try {
      // 사용자 찾기
      const { data: user, error: userError } = await this.supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      if (userError || !user) {
        throw new UnauthorizedException('Invalid email or password');
      }

      // 소셜 로그인 사용자 확인 (password_hash가 비어있으면 소셜 로그인 사용자)
      if (!user.password_hash) {
        throw new UnauthorizedException(
          'Please use social login for this account',
        );
      }

      // 비밀번호 확인
      const isPasswordValid = await bcrypt.compare(
        password,
        user.password_hash,
      );
      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid email or password');
      }

      // 자체 JWT 토큰 생성 (일반 로그인)
      const jwtSecret = this.configService.get('JWT_SECRET');
      if (!jwtSecret) {
        throw new InternalServerErrorException('JWT_SECRET is not configured');
      }
      const payload = {
        sub: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        gender: user.gender,
        age: user.age,
        login_type: user.login_type,
        iat: Math.floor(Date.now() / 1000),
      };

      const accessToken = jwt.sign(payload, jwtSecret, { expiresIn: '1h' });
      const refreshToken = jwt.sign({ sub: user.id }, jwtSecret, {
        expiresIn: '7d',
      });

      return {
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone,
          gender: user.gender,
          age: user.age,
          login_type: user.login_type,
        },
        access_token: accessToken,
        refresh_token: refreshToken,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new InternalServerErrorException('Login failed');
    }
  }

  async socialLogin(socialLoginDto: SocialLoginDto) {
    const { provider, redirectTo } = socialLoginDto;

    // Supabase OAuth URL 생성
    const { data, error } = await this.supabase.auth.signInWithOAuth({
      provider: provider as 'google' | 'apple',
      options: {
        redirectTo:
          redirectTo || `${this.configService.get('API_URL')}/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) {
      throw new InternalServerErrorException(
        `Failed to initialize ${provider} login`,
      );
    }

    return {
      url: data.url,
      provider,
      message: `Redirecting to ${provider} login...`,
    };
  }

  async handleOAuthCallback(callbackDto: SocialCallbackDto) {
    const { code } = callbackDto;

    if (!code) {
      throw new BadRequestException('Authorization code is required');
    }

    try {
      // OAuth 코드를 사용하여 세션 교환
      const { data: authData, error: authError } =
        await this.supabase.auth.exchangeCodeForSession(code);

      if (authError) {
        throw new InternalServerErrorException(
          'Failed to exchange code for session',
        );
      }

      const { user, session } = authData;

      // Supabase Auth 사용자 정보로 users 테이블 업데이트 또는 생성
      const { data: existingUser, error: userError } = await this.supabase
        .from('users')
        .select('*')
        .eq('email', user.email)
        .single();

      if (userError && userError.code !== 'PGRST116') {
        // PGRST116 = Row not found
        throw new InternalServerErrorException('Failed to check existing user');
      }

      let userData: any;

      if (!existingUser) {
        // 소셜 로그인 제공자 확인
        const provider = user.app_metadata?.provider || 'google';
        const loginType = provider === 'apple' ? 'apple' : 'google';

        // 새 사용자 생성 (소셜 로그인 사용자는 비밀번호 없음)
        const { data: newUser, error: createError } = await this.supabase
          .from('users')
          .insert([
            {
              id: user.id, // Supabase Auth user ID 사용
              email: user.email,
              name:
                user.user_metadata?.full_name ||
                user.user_metadata?.name ||
                'User',
              password_hash: '', // 소셜 로그인 사용자는 비밀번호 없음
              phone: user.phone || '',
              gender: 'male', // 기본값, 나중에 프로필 업데이트에서 변경 가능
              age: 20, // 기본값, 나중에 프로필 업데이트에서 변경 가능
              phone_verified: !!user.phone_confirmed_at,
              login_type: loginType,
            },
          ])
          .select()
          .single();

        if (createError) {
          throw new InternalServerErrorException(
            'Failed to create user profile',
          );
        }

        userData = newUser;
      } else {
        userData = existingUser;
      }

      return {
        user: userData,
        session,
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        provider_token: session.provider_token,
        provider_refresh_token: session.provider_refresh_token,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'OAuth callback processing failed',
      );
    }
  }

  // 6자리 인증 코드 생성
  private generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // NCP SMS를 통한 인증번호 전송
  private async sendSMS(phone: string, code: string): Promise<void> {
    try {
      // 개발 환경에서는 콘솔 로그와 함께 실제 SMS도 전송
      if (process.env.NODE_ENV !== 'production') {
        console.log(`📱 [DEV] SMS to ${phone}: Your verification code is ${code}`);
      }

      // 전화번호 형식 검증
      if (!this.ncpSmsService.isValidPhoneNumber(phone)) {
        throw new BadRequestException('Invalid phone number format');
      }

      // 전화번호 정규화
      const normalizedPhone = this.ncpSmsService.normalizePhoneNumber(phone);
      
      // NCP SMS API를 통해 인증번호 전송
      const result = await this.ncpSmsService.sendVerificationCode(normalizedPhone, code);
      
      console.log(`✅ SMS sent successfully to ${normalizedPhone}:`, {
        requestId: result.requestId,
        statusCode: result.statusCode,
        statusName: result.statusName,
      });
    } catch (error) {
      console.error('SMS send error:', error);
      
      // NCP API 에러인 경우 구체적인 에러 메시지 제공
      if (error.message?.includes('NCP SMS API Error')) {
        throw new InternalServerErrorException(`SMS 전송 실패: ${error.message}`);
      }
      
      // 전화번호 형식 오류
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      // 기타 에러
      throw new InternalServerErrorException('SMS 전송 중 오류가 발생했습니다.');
    }
  }

  // 회원가입 전 전화번호 인증 코드 발송
  async sendPreSignupVerificationCode(
    sendVerificationCodeDto: SendVerificationCodeDto,
  ) {
    const { phone } = sendVerificationCodeDto;

    try {
      // 전화번호 중복 확인
      const { data: existingUser, error: userError } = await this.supabase
        .from('users')
        .select('id')
        .eq('phone', phone)
        .single();

      if (userError && userError.code !== 'PGRST116') {
        throw new InternalServerErrorException('Failed to check existing user');
      }

      if (existingUser) {
        throw new ConflictException('Phone number is already registered');
      }

      // 기존 미완료 인증 코드 무효화
      await this.supabase
        .from('phone_verifications')
        .update({ is_verified: true }) // 만료 표시
        .eq('phone', phone)
        .eq('is_verified', false);

      // 새 인증 코드 생성
      const code = this.generateVerificationCode();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5분 후 만료

      // 인증 코드 저장
      const { error: saveError } = await this.supabase
        .from('phone_verifications')
        .insert([
          {
            phone,
            verification_code: code,
            expires_at: expiresAt.toISOString(),
          },
        ]);

      if (saveError) {
        throw new InternalServerErrorException(
          'Failed to save verification code',
        );
      }

      // SMS 전송
      await this.sendSMS(phone, code);

      return {
        message: 'Verification code sent successfully for signup',
        expires_in_minutes: 5,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      console.error('Send verification code error:', error);
      throw new InternalServerErrorException(
        'Failed to send verification code',
      );
    }
  }

  // 기존 사용자용 전화번호 인증 (회원가입 후)
  async sendVerificationCode(sendVerificationCodeDto: SendVerificationCodeDto) {
    const { phone } = sendVerificationCodeDto;

    try {
      // 해당 전화번호를 가진 사용자가 존재하는지 확인
      const { data: user, error: userError } = await this.supabase
        .from('users')
        .select('id, phone_verified')
        .eq('phone', phone)
        .single();

      if (userError && userError.code !== 'PGRST116') {
        throw new InternalServerErrorException('Failed to check user');
      }

      if (!user) {
        throw new BadRequestException('No user found with this phone number');
      }

      if (user.phone_verified) {
        throw new BadRequestException('Phone number is already verified');
      }

      // 기존 미완료 인증 코드 무효화
      await this.supabase
        .from('phone_verifications')
        .update({ is_verified: true }) // 만료 표시
        .eq('phone', phone)
        .eq('is_verified', false);

      // 새 인증 코드 생성
      const code = this.generateVerificationCode();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5분 후 만료

      // 인증 코드 저장
      const { error: saveError } = await this.supabase
        .from('phone_verifications')
        .insert([
          {
            phone,
            verification_code: code,
            expires_at: expiresAt.toISOString(),
          },
        ]);

      if (saveError) {
        throw new InternalServerErrorException(
          'Failed to save verification code',
        );
      }

      // SMS 전송
      await this.sendSMS(phone, code);

      return {
        message: 'Verification code sent successfully',
        expires_in_minutes: 5,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      console.error('Send verification code error:', error);
      throw new InternalServerErrorException(
        'Failed to send verification code',
      );
    }
  }

  // 회원가입 전 전화번호 인증 코드 검증
  async verifyPreSignupPhoneCode(verifyPhoneCodeDto: VerifyPhoneCodeDto) {
    const { phone, code } = verifyPhoneCodeDto;

    try {
      // 전화번호 중복 확인 (다시 한 번)
      const { data: existingUser, error: userError } = await this.supabase
        .from('users')
        .select('id')
        .eq('phone', phone)
        .single();

      if (userError && userError.code !== 'PGRST116') {
        throw new InternalServerErrorException('Failed to check existing user');
      }

      if (existingUser) {
        throw new ConflictException('Phone number is already registered');
      }

      // 유효한 인증 코드 찾기
      const { data: verification, error: verificationError } =
        await this.supabase
          .from('phone_verifications')
          .select('*')
          .eq('phone', phone)
          .eq('verification_code', code)
          .eq('is_verified', false)
          .gte('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

      if (verificationError && verificationError.code !== 'PGRST116') {
        throw new InternalServerErrorException(
          'Failed to check verification code',
        );
      }

      if (!verification) {
        // 시도 횟수 증가 (있다면)
        const { data: currentVerification } = await this.supabase
          .from('phone_verifications')
          .select('attempts')
          .eq('phone', phone)
          .eq('is_verified', false)
          .single();

        if (currentVerification) {
          await this.supabase
            .from('phone_verifications')
            .update({
              attempts: (currentVerification.attempts || 0) + 1,
              updated_at: new Date().toISOString(),
            })
            .eq('phone', phone)
            .eq('is_verified', false);
        }

        throw new BadRequestException('Invalid or expired verification code');
      }

      // 인증 코드를 검증됨으로 표시
      await this.supabase
        .from('phone_verifications')
        .update({
          is_verified: true,
          verified_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', verification.id);

      return {
        message: 'Phone number verified successfully for signup',
        verified: true,
        phone,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      console.error('Verify pre-signup phone code error:', error);
      throw new InternalServerErrorException('Phone verification failed');
    }
  }

  // 기존 사용자용 전화번호 인증 코드 검증
  async verifyPhoneCode(verifyPhoneCodeDto: VerifyPhoneCodeDto) {
    const { phone, code } = verifyPhoneCodeDto;

    try {
      // 유효한 인증 코드 찾기
      const { data: verification, error: verificationError } =
        await this.supabase
          .from('phone_verifications')
          .select('*')
          .eq('phone', phone)
          .eq('verification_code', code)
          .eq('is_verified', false)
          .gte('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

      if (verificationError && verificationError.code !== 'PGRST116') {
        throw new InternalServerErrorException(
          'Failed to check verification code',
        );
      }

      if (!verification) {
        // 시도 횟수 증가 (있다면)
        const { data: currentVerification } = await this.supabase
          .from('phone_verifications')
          .select('attempts')
          .eq('phone', phone)
          .eq('is_verified', false)
          .single();

        if (currentVerification) {
          await this.supabase
            .from('phone_verifications')
            .update({
              attempts: (currentVerification.attempts || 0) + 1,
              updated_at: new Date().toISOString(),
            })
            .eq('phone', phone)
            .eq('is_verified', false);
        }

        throw new BadRequestException('Invalid or expired verification code');
      }

      // 인증 코드를 검증됨으로 표시
      await this.supabase
        .from('phone_verifications')
        .update({
          is_verified: true,
          verified_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', verification.id);

      // 사용자의 phone_verified를 true로 업데이트
      const { error: updateUserError } = await this.supabase
        .from('users')
        .update({
          phone_verified: true,
          updated_at: new Date().toISOString(),
        })
        .eq('phone', phone);

      if (updateUserError) {
        throw new InternalServerErrorException(
          'Failed to update user verification status',
        );
      }

      return {
        message: 'Phone number verified successfully',
        verified: true,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      console.error('Verify phone code error:', error);
      throw new InternalServerErrorException('Phone verification failed');
    }
  }

  // 사용자 위치 업데이트
  async updateUserLocation(
    userId: string,
    updateLocationDto: UpdateLocationDto,
  ): Promise<LocationResponseDto> {
    const { latitude, longitude, location_name } = updateLocationDto;

    try {
      // 사용자 존재 확인
      const { data: user, error: userError } = await this.supabase
        .from('users')
        .select('id')
        .eq('id', userId)
        .single();

      if (userError || !user) {
        throw new BadRequestException('User not found');
      }

      // 위치 정보 업데이트
      const { data, error } = await this.supabase
        .from('users')
        .update({
          last_latitude: latitude,
          last_longitude: longitude,
          last_location_name: location_name,
          last_location_updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
        .select(
          'last_latitude, last_longitude, last_location_name, last_location_updated_at',
        )
        .single();

      if (error) {
        throw new InternalServerErrorException(
          'Failed to update user location',
        );
      }

      return {
        latitude: data.last_latitude,
        longitude: data.last_longitude,
        location_name: data.last_location_name,
        updated_at: data.last_location_updated_at,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }
      console.error('Update location error:', error);
      throw new InternalServerErrorException('Failed to update location');
    }
  }

  // 사용자 위치 조회
  async getUserLocation(userId: string): Promise<LocationResponseDto | null> {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select(
          'last_latitude, last_longitude, last_location_name, last_location_updated_at',
        )
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw new InternalServerErrorException('Failed to fetch user location');
      }

      if (!data || !data.last_latitude || !data.last_longitude) {
        return null;
      }

      return {
        latitude: data.last_latitude,
        longitude: data.last_longitude,
        location_name: data.last_location_name,
        updated_at: data.last_location_updated_at,
      };
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to get user location');
    }
  }

  // 이메일 중복 검증
  async checkEmailDuplicate(checkEmailDto: CheckEmailDto) {
    const { email } = checkEmailDto;

    try {
      const { data: existingUser, error } = await this.supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw new InternalServerErrorException(
          'Failed to check email duplicate',
        );
      }

      const isDuplicate = !!existingUser;

      return {
        email,
        is_duplicate: isDuplicate,
        available: !isDuplicate,
        message: isDuplicate ? 'Email is already in use' : 'Email is available',
      };
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      console.error('Check email duplicate error:', error);
      throw new InternalServerErrorException(
        'Failed to check email availability',
      );
    }
  }

  // 닉네임(이름) 중복 검증
  async checkNameDuplicate(checkNameDto: CheckNameDto) {
    const { name } = checkNameDto;

    try {
      const { data: existingUser, error } = await this.supabase
        .from('users')
        .select('id')
        .eq('name', name)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw new InternalServerErrorException(
          'Failed to check name duplicate',
        );
      }

      const isDuplicate = !!existingUser;

      return {
        name,
        is_duplicate: isDuplicate,
        available: !isDuplicate,
        message: isDuplicate ? 'Name is already in use' : 'Name is available',
      };
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      console.error('Check name duplicate error:', error);
      throw new InternalServerErrorException(
        'Failed to check name availability',
      );
    }
  }

  async updateProfile(userId: string, updateProfileDto: UpdateProfileDto) {
    const { mbti, personality, job, bio } = updateProfileDto;

    try {
      // 사용자 존재 확인
      const { data: existingUser, error: userError } = await this.supabase
        .from('users')
        .select('id')
        .eq('id', userId)
        .single();

      if (userError || !existingUser) {
        throw new BadRequestException('User not found');
      }

      // 업데이트할 데이터 준비 (undefined 값 제외)
      const updateData: any = {};
      if (mbti !== undefined) updateData.mbti = mbti;
      if (personality !== undefined) updateData.personality = personality;
      if (job !== undefined) updateData.job = job;
      if (bio !== undefined) updateData.bio = bio;

      // 업데이트할 데이터가 없으면 에러
      if (Object.keys(updateData).length === 0) {
        throw new BadRequestException('No data to update');
      }

      // 프로필 업데이트
      const { data, error } = await this.supabase
        .from('users')
        .update(updateData)
        .eq('id', userId)
        .select(
          'id, email, name, phone, gender, age, mbti, personality, job, bio, updated_at',
        )
        .single();

      if (error) {
        console.error('Profile update error:', error);
        throw new InternalServerErrorException('Failed to update profile');
      }

      return {
        message: 'Profile updated successfully',
        user: data,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      console.error('Update profile error:', error);
      throw new InternalServerErrorException('Failed to update profile');
    }
  }
}
