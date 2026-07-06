import { ConfigService } from '@nestjs/config';
import { Strategy, Profile } from 'passport-facebook';
declare const FacebookStrategy_base: new (...args: [options: import("passport-facebook").StrategyOptionsWithRequest] | [options: import("passport-facebook").StrategyOptions]) => Strategy & {
    validate(...args: any[]): unknown;
};
export declare class FacebookStrategy extends FacebookStrategy_base {
    private static readonly logger;
    constructor(configService: ConfigService);
    validate(accessToken: string, refreshToken: string, profile: Profile, done: (err: any, user?: any) => void): Promise<void>;
}
export {};
