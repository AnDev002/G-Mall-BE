import { NewsletterService } from './newsletter.service';
declare class SubscribeDto {
    email: string;
    sourceTag?: string;
}
declare class UnsubscribeDto {
    email: string;
}
export declare class NewsletterController {
    private readonly service;
    constructor(service: NewsletterService);
    subscribe(dto: SubscribeDto): Promise<{
        ok: boolean;
        alreadySubscribed: boolean;
        reactivated?: undefined;
    } | {
        ok: boolean;
        reactivated: boolean;
        alreadySubscribed?: undefined;
    } | {
        ok: boolean;
        alreadySubscribed?: undefined;
        reactivated?: undefined;
    }>;
    unsubscribe(dto: UnsubscribeDto): Promise<{
        ok: boolean;
    }>;
}
export {};
