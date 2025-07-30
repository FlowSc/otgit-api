import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  ValidationPipe,
  BadRequestException,
  Param,
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

@Controller('likes')
export class LikesController {
  constructor(private readonly likesService: LikesService) {}

  @Post()
  async sendLike(
    @Body(ValidationPipe) sendLikeDto: SendLikeDto,
  ): Promise<LikeResponseDto> {
    return this.likesService.sendLike(sendLikeDto);
  }

  @Get()
  async getLikes(
    @Query(ValidationPipe) getLikesDto: GetLikesDto,
  ): Promise<LikesListResponseDto> {
    return this.likesService.getLikes(getLikesDto);
  }

  @Get('matches')
  async getMatches(@Query(ValidationPipe) getMatchesDto: GetMatchesDto) {
    return this.likesService.getMatches(getMatchesDto);
  }

  @Post('accept')
  async acceptLike(
    @Body(ValidationPipe) acceptLikeDto: AcceptLikeDto,
  ): Promise<AcceptLikeResponseDto> {
    return this.likesService.acceptLike(acceptLikeDto);
  }
}
