import { Injectable, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
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
}
