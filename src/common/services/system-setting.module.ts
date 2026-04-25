import { Global, Module, OnModuleInit } from '@nestjs/common';
import { SystemSettingService } from './system-setting.service';

/**
 * Global module — service tự seed defaults lúc start, không cần module nào
 * khác setup. AppModule chỉ cần import 1 lần.
 */
@Global()
@Module({
  providers: [SystemSettingService],
  exports: [SystemSettingService],
})
export class SystemSettingModule implements OnModuleInit {
  constructor(private readonly service: SystemSettingService) {}

  async onModuleInit() {
    await this.service.seedDefaults();
  }
}
