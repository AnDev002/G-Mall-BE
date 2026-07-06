import { GachaService } from './gacha.service';
export declare class GameController {
    private readonly gachaService;
    constructor(gachaService: GachaService);
    spin(user: any): Promise<{
        won: boolean;
        reward: number;
        message: string;
    }>;
}
