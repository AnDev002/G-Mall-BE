// Backend/customer/dto/update-customer.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateCustomerDto } from './create-customer.dto'; // Sửa DTO cơ sở

export class UpdateCustomerDto extends PartialType(CreateCustomerDto) {}