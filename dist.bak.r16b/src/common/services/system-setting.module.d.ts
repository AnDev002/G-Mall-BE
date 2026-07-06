import { OnModuleInit } from '@nestjs/common';
import { SystemSettingService } from './system-setting.service';
export declare class SystemSettingModule implements OnModuleInit {
    private readonly service;
    constructor(service: SystemSettingService);
    onModuleInit(): Promise<void>;
}
