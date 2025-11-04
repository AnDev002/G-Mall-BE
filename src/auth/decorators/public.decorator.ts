import { SetMetadata } from '@nestjs/common';

// Key này sẽ được dùng để kiểm tra xem 1 API có public hay không
export const IS_PUBLIC_KEY = 'isPublic';

// Khi bạn dùng @Public(), nó sẽ gán metadata IS_PUBLIC_KEY = true
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);