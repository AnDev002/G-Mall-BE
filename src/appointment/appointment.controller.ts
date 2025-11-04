// Backend/appointment/appointment.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { AppointmentService } from './appointment.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard';

// Bất kỳ ai cũng có thể đặt lịch (nếu Public)
// Hoặc yêu cầu đăng nhập (nếu bỏ @Public và bật @UseGuards)
// @UseGuards(JwtAuthGuard) 
@Controller('appointments')
export class AppointmentController {
  constructor(private readonly appointmentService: AppointmentService) {}

  @Post()
  create(@Body(ValidationPipe) createAppointmentDto: CreateAppointmentDto) {
    // Dùng ValidationPipe để đảm bảo DTO hợp lệ
    return this.appointmentService.create(createAppointmentDto);
  }

  @Get()
  findAll() {
    return this.appointmentService.findAll();
  }
}