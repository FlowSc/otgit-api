import { Injectable, ConflictException, InternalServerErrorException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import { SocialLoginDto, SocialCallbackDto, SocialProvider } from './dto/social-login.dto';
import { createSupabaseClient } from '../config/supabase.config';

@Injectable()
export class AuthService {
  private supabase: SupabaseClient;

  constructor(private configService: ConfigService) {
    this.supabase = createSupabaseClient(this.configService);
  }

  async register(createUserDto: CreateUserDto) {
    const { name, email, phone, password, gender, age } = createUserDto;

    try {
      // Check if email already exists
      const { data: existingEmail } = await this.supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single();

      if (existingEmail) {
        throw new ConflictException('Email already exists');
      }

      // Check if phone already exists
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

      // Create user
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
            phone_verified: false
          }
        ])
        .select('id, email, name, phone, gender, age, created_at')
        .single();

      if (error) {
        throw new InternalServerErrorException('Failed to create user');
      }

      return {
        message: 'User registered successfully. Please verify your phone number.',
        user: data
      };
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      throw new InternalServerErrorException('Registration failed');
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
        throw new UnauthorizedException('Please use social login for this account');
      }

      // 비밀번호 확인
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid email or password');
      }

      // Supabase Auth로 세션 생성 (이메일/비밀번호 인증)
      const { data: authData, error: authError } = await this.supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        // Supabase Auth에 사용자가 없으면 생성
        if (authError.message.includes('Invalid login credentials')) {
          const { data: signUpData, error: signUpError } = await this.supabase.auth.signUp({
            email,
            password,
          });

          if (signUpError) {
            throw new InternalServerErrorException('Failed to create auth session');
          }

          return {
            message: 'Login successful',
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
              phone: user.phone,
              gender: user.gender,
              age: user.age,
            },
            access_token: signUpData.session?.access_token,
            refresh_token: signUpData.session?.refresh_token,
          };
        }
        throw new InternalServerErrorException('Authentication failed');
      }

      return {
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone,
          gender: user.gender,
          age: user.age,
        },
        access_token: authData.session?.access_token,
        refresh_token: authData.session?.refresh_token,
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
        redirectTo: redirectTo || `${this.configService.get('API_URL')}/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) {
      throw new InternalServerErrorException(`Failed to initialize ${provider} login`);
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
      const { data: authData, error: authError } = await this.supabase.auth.exchangeCodeForSession(code);

      if (authError) {
        throw new InternalServerErrorException('Failed to exchange code for session');
      }

      const { user, session } = authData;

      // Supabase Auth 사용자 정보로 users 테이블 업데이트 또는 생성
      const { data: existingUser, error: userError } = await this.supabase
        .from('users')
        .select('*')
        .eq('email', user.email)
        .single();

      if (userError && userError.code !== 'PGRST116') { // PGRST116 = Row not found
        throw new InternalServerErrorException('Failed to check existing user');
      }

      let userData;
      
      if (!existingUser) {
        // 새 사용자 생성 (소셜 로그인 사용자는 비밀번호 없음)
        const { data: newUser, error: createError } = await this.supabase
          .from('users')
          .insert([
            {
              email: user.email,
              name: user.user_metadata?.full_name || user.user_metadata?.name || 'User',
              password_hash: '', // 소셜 로그인 사용자는 비밀번호 없음
              phone: user.phone || '',
              gender: 'male', // 기본값, 나중에 프로필 업데이트에서 변경 가능
              age: 20, // 기본값, 나중에 프로필 업데이트에서 변경 가능
              phone_verified: !!user.phone_confirmed_at,
            }
          ])
          .select()
          .single();

        if (createError) {
          throw new InternalServerErrorException('Failed to create user profile');
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
      if (error instanceof BadRequestException || error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new InternalServerErrorException('OAuth callback processing failed');
    }
  }
}
