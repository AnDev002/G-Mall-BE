import { DailyService } from './daily.service';
import { GachaService } from '../game/gacha.service';
export declare class EventController {
    private readonly dailyService;
    private readonly gachaService;
    constructor(dailyService: DailyService, gachaService: GachaService);
    dailyCheckIn(user: any): Promise<{
        message: string;
        reward: number;
        streak: number;
        currentPoints: number;
    }>;
    getStatus(user: any): Promise<{
        isCheckedInToday: boolean;
        hasSpunToday: boolean;
        currentStreak: number;
    }>;
    resetTest(user: any): Promise<{
        message: string;
    }>;
}
