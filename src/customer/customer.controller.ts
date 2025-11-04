// Backend/customer/customer.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseGuards, // Thêm UseGuards
} from '@nestjs/common';
import { CustomerService } from './customer.service'; // Sửa tên service
import { CreateCustomerDto } from './dto/create-customer.dto'; // Sửa tên DTO
import { UpdateCustomerDto } from './dto/update-customer.dto'; // Sửa tên DTO
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard'; // Import Guard

@UseGuards(JwtAuthGuard) // Bảo vệ tất cả các route customer
@Controller('customers') // SỬA LỖI: Route phải là 'customers'
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {} // Sửa tên service

  @Post()
  create(@Body() createCustomerDto: CreateCustomerDto) {
    return this.customerService.create(createCustomerDto);
  }

  @Get()
  findAll() {
    return this.customerService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.customerService.findOne(id);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCustomerDto: UpdateCustomerDto,
  ) {
    return this.customerService.update(id, updateCustomerDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.customerService.remove(id);
  }
}