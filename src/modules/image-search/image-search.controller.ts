import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  ParseFilePipeBuilder,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { ImageSearchService, ImageSearchHit } from './image-search.service';
import { SearchByImageQueryDto } from './dto/search-by-image.dto';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

@ApiTags('image-search')
@Controller('products/search')
export class ImageSearchController {
  constructor(private readonly imageSearch: ImageSearchService) {}

  /** Public — anonymous users can also search by image. */
  @Post('by-image')
  @HttpCode(200)
  @ApiOperation({ summary: 'Tìm sản phẩm bằng hình ảnh upload' })
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: MAX_IMAGE_BYTES } }))
  async searchByImage(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: /^image\/(jpeg|png|webp)$/ })
        .addMaxSizeValidator({ maxSize: MAX_IMAGE_BYTES })
        .build({ fileIsRequired: true }),
    )
    file: Express.Multer.File,
    @Query() query: SearchByImageQueryDto,
  ): Promise<{ hits: ImageSearchHit[] }> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('image file is empty');
    }
    const hits = await this.imageSearch.searchByImageBuffer(
      file.buffer,
      query.limit,
      query.minSimilarity,
    );
    return { hits };
  }

  /** Hybrid path: text caption → same vector space as images. */
  @Post('by-text')
  @HttpCode(200)
  @ApiOperation({ summary: 'Tìm sản phẩm bằng mô tả text (CLIP text encoder)' })
  async searchByText(
    @Body() body: { text: string },
    @Query() query: SearchByImageQueryDto,
  ): Promise<{ hits: ImageSearchHit[] }> {
    const text = (body?.text ?? '').trim();
    if (!text) throw new BadRequestException('text is required');
    if (text.length > 200) throw new BadRequestException('text too long (max 200 chars)');
    const hits = await this.imageSearch.searchByText(text, query.limit, query.minSimilarity);
    return { hits };
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: thống kê trạng thái index vector' })
  stats() {
    return this.imageSearch.stats();
  }
}
