import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ComplaintService } from './complaint.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

class CreateComplaintDto {
  @IsString()
  @IsIn(['shipping', 'product', 'finance', 'system', 'other'])
  category!: string;

  @IsString()
  @MaxLength(200)
  title!: string;

  @IsString()
  @MaxLength(5000)
  content!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  relatedOrderId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  attachments?: string[];
}

class UpdateStatusDto {
  @IsString()
  @IsIn(['open', 'processing', 'resolved', 'rejected'])
  status!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  adminNote?: string;
}

@Controller('complaints')
@UseGuards(JwtAuthGuard)
export class ComplaintController {
  constructor(private readonly service: ComplaintService) {}

  @Post()
  create(@Request() req, @Body() dto: CreateComplaintDto) {
    return this.service.create(req.user.userId, dto);
  }

  @Get('me')
  listMine(@Request() req, @Query() q: { page?: string; limit?: string; status?: string }) {
    return this.service.listMine(req.user.userId, {
      page: q.page ? Number(q.page) : undefined,
      limit: q.limit ? Number(q.limit) : undefined,
      status: q.status,
    });
  }

  @Get(':id')
  findOne(@Request() req, @Param('id') id: string) {
    return this.service.findOneAsOwner(req.user.userId, id);
  }
}

@Controller('admin/complaints')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminComplaintController {
  constructor(private readonly service: ComplaintService) {}

  @Get()
  list(@Query() q: { page?: string; limit?: string; status?: string }) {
    return this.service.listAll({
      page: q.page ? Number(q.page) : undefined,
      limit: q.limit ? Number(q.limit) : undefined,
      status: q.status,
    });
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto) {
    return this.service.updateStatus(id, dto.status, dto.adminNote);
  }
}
