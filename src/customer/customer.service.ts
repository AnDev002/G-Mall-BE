// Backend/customer/customer.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomerService {
  constructor(private prisma: PrismaService) {}

  async create(createCustomerDto: CreateCustomerDto) {
    // SỬA LỖI: Trỏ đến this.prisma.customer
    return this.prisma.customer.create({
      data: createCustomerDto,
    });
  }

  async findAll() {
    // SỬA LỖI: Trỏ đến this.prisma.customer
    return this.prisma.customer.findMany();
  }

  async findOne(id: number) {
    // SỬA LỖI: Trỏ đến this.prisma.customer
    const customer = await this.prisma.customer.findUnique({
      where: { id },
    });
    if (!customer) {
      throw new NotFoundException(`Customer with ID ${id} not found`);
    }
    return customer;
  }

  async update(id: number, updateCustomerDto: UpdateCustomerDto) {
    // SỬA LỖI: Trỏ đến this.prisma.customer
    return this.prisma.customer.update({
      where: { id },
      data: updateCustomerDto,
    });
  }

  async remove(id: number) {
    // SỬA LỖI: Trỏ đến this.prisma.customer
    return this.prisma.customer.delete({
      where: { id },
    });
  }
}