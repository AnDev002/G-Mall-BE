// Backend/user/dto/update-user.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';

// PartialType sẽ tự động tạo một phiên bản của CreateUserDto
// với tất cả các trường là tùy chọn (optional).
export class UpdateUserDto extends PartialType(CreateUserDto) {}