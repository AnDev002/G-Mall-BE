import { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
export declare class RedisIoAdapter extends IoAdapter {
    private app;
    private adapterConstructor;
    constructor(app: INestApplicationContext);
    connectToRedis(): Promise<void>;
    createIOServer(port: number, options?: ServerOptions): any;
}
