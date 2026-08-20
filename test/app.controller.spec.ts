import { Test, TestingModule } from '@nestjs/testing';
// wiki 0111: hai dòng import này vốn là `./app.controller` — đường dẫn của file mẫu do
// NestJS sinh ra khi spec nằm CẠNH `src/`, còn ở đây nó nằm trong `test/`. Hệ quả: `npx tsc
// --noEmit` luôn đỏ 2 lỗi TS2307, và một dự án luôn-đỏ thì không ai còn nhận ra lỗi mới.
import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });
});
