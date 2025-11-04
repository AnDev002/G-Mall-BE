// Backend/auth/auth.service.ts
import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { UserService } from 'src/user/user.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { RegisterAuthDto } from './dto/register-auth.dto';
import { User } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterAuthDto) {
    const existingUser = await this.userService.findOne({ username: dto.username });
    if (existingUser) {
      throw new ConflictException('Username already exists');
    }
    const hashedPassword = await bcrypt.hash(dto.password, 10);
    
    const user = await this.userService.create({
      // name: dto.name, // <-- SỬA: Xóa trường 'name'
      username: dto.username,
      password_hash: hashedPassword, 
      role: dto.role || 'Donor', 
    });
    
    const { password_hash, ...result } = user;
    return result;
  }

  async validateUser(username: string, pass: string): Promise<any> {
    const user = await this.userService.findOne({ username });
    
    if (user && (await bcrypt.compare(pass, user.password_hash))) {
      const { password_hash, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: Omit<User, 'password_hash'>) {
    const payload = { username: user.username, sub: user.id, role: user.role };
    
    return {
      access_token: this.jwtService.sign(payload),
      user: user, 
    };
  }

  async getMe(userId: number) { 
    const user = await this.userService.findOne({ id: userId });
    
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    
    const { password_hash, ...result } = user;
    return result;
  }
}