import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ValidationPipe,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Request,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PhotosService } from './photos.service';
import {
  UploadProfilePhotoDto,
  ProfilePhotoResponseDto,
} from './dto/profile-photo.dto';
import {
  UploadTravelPhotoDto,
  UpdateTravelPhotoDto,
  QueryTravelPhotosDto,
  TravelPhotoResponseDto,
} from './dto/travel-photo.dto';
import {
  FindNearbyUsersDto,
  FindNearbyUsersResponseDto,
} from './dto/nearby-users.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('photos')
export class PhotosController {
  constructor(private readonly photosService: PhotosService) {}

  // Profile Photo Endpoints
  @Post('profile')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
      },
      fileFilter: (req, file, callback) => {
        if (!file.mimetype.startsWith('image/')) {
          return callback(
            new BadRequestException('Only image files are allowed'),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  async uploadProfilePhoto(
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ): Promise<ProfilePhotoResponseDto> {
    const userId = req.user.userId;

    const uploadDto: UploadProfilePhotoDto = {
      file_name: file.originalname,
      file_size: file.size,
      mime_type: file.mimetype,
    };

    return this.photosService.uploadProfilePhoto(userId, uploadDto, file);
  }

  @Get('profile/:userId')
  async getProfilePhoto(
    @Param('userId') userId: string,
  ): Promise<ProfilePhotoResponseDto | null> {
    return this.photosService.getProfilePhoto(userId);
  }

  @Delete('profile')
  @UseGuards(JwtAuthGuard)
  async deleteProfilePhoto(@Request() req: any): Promise<{ message: string }> {
    const userId = req.user.userId;
    return this.photosService.deleteProfilePhoto(userId);
  }

  // Travel Photo Endpoints
  @Post('travel')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
      },
      fileFilter: (req, file, callback) => {
        if (!file.mimetype.startsWith('image/')) {
          return callback(
            new BadRequestException('Only image files are allowed'),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  async uploadTravelPhoto(
    @UploadedFile() file: Express.Multer.File,
    @Body(ValidationPipe) body: any, // We'll parse this manually due to multipart form
    @Request() req: any,
  ): Promise<TravelPhotoResponseDto> {
    // Get user ID from JWT token
    const userId = req.user.userId;

    // Parse and validate the body data
    const uploadDto: UploadTravelPhotoDto = {
      latitude: parseFloat(body.latitude),
      longitude: parseFloat(body.longitude),
      title: body.title,
      description: body.description,
      file_name: file.originalname,
      file_size: file.size,
      mime_type: file.mimetype,
    };

    // Validate required fields
    if (
      isNaN(uploadDto.latitude) ||
      uploadDto.latitude < -90 ||
      uploadDto.latitude > 90
    ) {
      throw new BadRequestException('Valid latitude is required (-90 to 90)');
    }
    if (
      isNaN(uploadDto.longitude) ||
      uploadDto.longitude < -180 ||
      uploadDto.longitude > 180
    ) {
      throw new BadRequestException(
        'Valid longitude is required (-180 to 180)',
      );
    }

    return this.photosService.uploadTravelPhoto(userId, uploadDto, file);
  }

  @Get('travel')
  @UseGuards(JwtAuthGuard)
  async getTravelPhotos(
    @Query(ValidationPipe) queryDto: QueryTravelPhotosDto,
    @Request() req: any,
  ): Promise<{
    photos: TravelPhotoResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const userId = req.user.userId;
    return this.photosService.getUserTravelPhotos(userId, queryDto);
  }

  @Get('travel/:photoId')
  async getTravelPhoto(
    @Param('photoId') photoId: string,
  ): Promise<TravelPhotoResponseDto> {
    return this.photosService.getTravelPhoto(photoId);
  }

  @Put('travel/:photoId')
  @UseGuards(JwtAuthGuard)
  async updateTravelPhoto(
    @Param('photoId') photoId: string,
    @Body(ValidationPipe) updateDto: UpdateTravelPhotoDto,
    @Request() req: any,
  ): Promise<TravelPhotoResponseDto> {
    const userId = req.user.userId;
    return this.photosService.updateTravelPhoto(photoId, userId, updateDto);
  }

  @Delete('travel/:photoId')
  @UseGuards(JwtAuthGuard)
  async deleteTravelPhoto(
    @Param('photoId') photoId: string,
    @Request() req: any,
  ): Promise<{ message: string }> {
    const userId = req.user.userId;
    return this.photosService.deleteTravelPhoto(photoId, userId);
  }

  // Additional endpoint to search travel photos by location
  @Get('travel/search/nearby')
  async searchNearbyTravelPhotos(
    @Query('latitude', ValidationPipe) latitude: number,
    @Query('longitude', ValidationPipe) longitude: number,
    @Query('radius_km') radiusKm: number = 10,
    @Query('limit') limit: number = 20,
    @Query('is_public') isPublic: boolean = true,
  ): Promise<{ photos: TravelPhotoResponseDto[]; total: number }> {
    const queryDto: QueryTravelPhotosDto = {
      center_latitude: latitude,
      center_longitude: longitude,
      radius_km: radiusKm,
      limit,
      is_public: isPublic,
    };

    const result = await this.photosService.getTravelPhotos(queryDto);
    return {
      photos: result.photos,
      total: result.total,
    };
  }

  // 내 사진 위치 기반 다른 성별 사용자 검색
  @Post('find-nearby-users')
  async findNearbyUsers(
    @Body(ValidationPipe) findNearbyUsersDto: FindNearbyUsersDto,
  ): Promise<FindNearbyUsersResponseDto> {
    return this.photosService.findNearbyUsers(findNearbyUsersDto);
  }
}
