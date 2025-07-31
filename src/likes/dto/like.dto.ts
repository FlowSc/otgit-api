import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  Min,
} from 'class-validator';

export class SendLikeDto {
  @IsString()
  @IsNotEmpty()
  sender_id: string;

  @IsString()
  @IsNotEmpty()
  receiver_id: string;
}

export class LikeResponseDto {
  id: string;
  sender_id: string;
  receiver_id: string;
  created_at: string;
  status?: string; // pending, accepted, rejected
  responded_at?: string;
  is_match?: boolean; // 매칭 여부
}

export class GetLikesDto {
  @IsString()
  @IsNotEmpty()
  user_id: string;

  @IsString()
  @IsOptional()
  type?: 'sent' | 'received' = 'received'; // 보낸 좋아요 또는 받은 좋아요

  @IsNumber()
  @IsOptional()
  @Min(1)
  page?: number = 1;

  @IsNumber()
  @IsOptional()
  @Min(1)
  limit?: number = 20;
}

export class LikesListResponseDto {
  likes: LikeWithUserDto[];
  total: number;
  page: number;
  limit: number;
  type: 'sent' | 'received';
}

export class LikeWithUserDto {
  id: string;
  sender_id: string;
  receiver_id: string;
  created_at: string;
  user: {
    id: string;
    name: string;
    age: number;
    gender: string;
    profile_photo?: {
      id: string;
      file_url: string;
      file_name: string;
    };
  };
  is_match?: boolean;
}

export class MatchResponseDto {
  id: string;
  user1_id: string;
  user2_id: string;
  matched_at: string;
  is_active: boolean;
}

export class GetMatchesDto {
  @IsString()
  @IsNotEmpty()
  user_id: string;

  @IsNumber()
  @IsOptional()
  @Min(1)
  page?: number = 1;

  @IsNumber()
  @IsOptional()
  @Min(1)
  limit?: number = 20;

  @IsBoolean()
  @IsOptional()
  active_only?: boolean = true;
}

export class AcceptLikeDto {
  @IsString()
  @IsNotEmpty()
  like_id: string;

  @IsString()
  @IsOptional()
  receiver_id?: string; // JWT에서 가져올 예정
}

export class AcceptLikeResponseDto {
  like: LikeResponseDto;
  chat_room?: {
    id: string;
    user1_id: string;
    user2_id: string;
    created_at: string;
  };
  message: string;
}
