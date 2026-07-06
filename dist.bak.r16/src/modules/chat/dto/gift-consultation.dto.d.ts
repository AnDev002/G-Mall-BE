export declare enum ConsultationStep {
    INIT = "INIT",
    ASK_RECIPIENT = "ASK_RECIPIENT",
    ASK_OCCASION = "ASK_OCCASION",
    ASK_RELATIONSHIP = "ASK_RELATIONSHIP",
    ASK_INTERESTS = "ASK_INTERESTS",
    ASK_BUDGET = "ASK_BUDGET",
    RECOMMENDING = "RECOMMENDING",
    COMPLETED = "COMPLETED"
}
export interface ConsultationState {
    step: ConsultationStep;
    data: {
        recipient?: string;
        occasion?: string;
        relationship?: string;
        interests?: string[];
        budget?: string;
        suggestedIds?: number[];
    };
    history: string[];
}
export declare class UserReplyDto {
    message: string;
    sessionId: string;
}
export declare class GiftConsultationDto {
    recipient: string;
    occasion: string;
    interests: string[];
    budgetRange: string;
}
