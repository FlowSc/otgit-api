import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  ValidationPipe,
  BadRequestException,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { LikesService } from './likes.service';
import {
  SendLikeDto,
  LikeResponseDto,
  GetLikesDto,
  LikesListResponseDto,
  GetMatchesDto,
  AcceptLikeDto,
  AcceptLikeResponseDto,
} from './dto/like.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('likes')
export class LikesController {
  constructor(private readonly likesService: LikesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async sendLike(
    @Body(ValidationPipe) sendLikeDto: SendLikeDto,
    @Request() req: any,
  ): Promise<LikeResponseDto> {
    const senderId = req.user.userId;
    return this.likesService.sendLike({ ...sendLikeDto, sender_id: senderId });
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getLikes(
    @Query(ValidationPipe) getLikesDto: GetLikesDto,
    @Request() req: any,
  ): Promise<LikesListResponseDto> {
    const userId = req.user.userId;
    return this.likesService.getLikes({ ...getLikesDto, user_id: userId });
  }

  @Get('matches')
  @UseGuards(JwtAuthGuard)
  async getMatches(
    @Query(ValidationPipe) getMatchesDto: GetMatchesDto,
    @Request() req: any,
  ) {
    const userId = req.user.userId;
    return this.likesService.getMatches({ ...getMatchesDto, user_id: userId });
  }

  @Post('accept')
  @UseGuards(JwtAuthGuard)
  async acceptLike(
    @Body(ValidationPipe) acceptLikeDto: AcceptLikeDto,
    @Request() req: any,
  ): Promise<AcceptLikeResponseDto> {
    const receiverId = req.user.userId;
    return this.likesService.acceptLike({
      ...acceptLikeDto,
      receiver_id: receiverId,
    });
  }
}
