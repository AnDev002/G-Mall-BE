// Backend/user/user.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { User, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto'; // <-- Import UpdateUserDto

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async findOne(
    where: Prisma.UserWhereUniqueInput,
  ): Promise<User | null> {
    return this.prisma.user.findUnique({ where });
  }

  async findAll(): Promise<Omit<User, 'password_hash'>[]> {
    return this.prisma.user.findMany({
      select: {
        id: true,
        username: true,
        // name: true, // <-- SỬA LỖI: Xóa dòng này
        role: true,
        created_at: true,
      },
    });
  }

  async create(
    data: Omit<Prisma.UserCreateInput, 'password_hash'> & { password_hash: string },
  ): Promise<User> {
    return this.prisma.user.create({ data });
  }

  async createUserByAdmin(
    data: CreateUserDto,
  ): Promise<Omit<User, 'password_hash'>> {
    
    const hashedPassword = await bcrypt.hash(data.password, 10);
    
    const user = await this.prisma.user.create({
      data: {
        // name: data.name, // <-- SỬA LỖI: Xóa dòng này
        username: data.username, 
        password_hash: hashedPassword,
        role: data.role,
      },
    });
    const { password_hash, ...result } = user;
    return result;
  }

  async update(
    id: number,
    data: UpdateUserDto, // Sửa: Dùng UpdateUserDto
  ): Promise<Omit<User, 'password_hash'>> {
    
    const updateData: Prisma.UserUpdateInput = {
        // name: data.name, // <-- SỬA LỖI: Xóa dòng này
        username: data.username,
        role: data.role,
    };

    if (data.password) {
      updateData.password_hash = await bcrypt.hash(data.password, 10);
    }

    try {
      const user = await this.prisma.user.update({
        where: { id },
        data: updateData, 
      });
      const { password_hash, ...result } = user;
      return result;
    } catch (error) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
  }

  async remove(id: number): Promise<void> {
    try {
      await this.prisma.user.delete({ where: { id } });
    } catch (error) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
  }
}