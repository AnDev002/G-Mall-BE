// Backend/appointment/appointment.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';

@Injectable()
export class AppointmentService {
  constructor(private prisma: PrismaService) {}

  // Service để TẠO MỚI lịch hẹn
  async create(createAppointmentDto: CreateAppointmentDto) {
    return this.prisma.appointment.create({
      data: {
        ...createAppointmentDto,
        status: 'Pending', // Mặc định khi mới tạo
      },
    });
  }

  // (Tùy chọn) Service để LẤY TẤT CẢ lịch hẹn
  async findAll() {
    return this.prisma.appointment.findMany({
      orderBy: {
        created_at: 'desc',
      },
    });
  }
  
  // (Bạn có thể thêm findOne, update, remove sau)
}