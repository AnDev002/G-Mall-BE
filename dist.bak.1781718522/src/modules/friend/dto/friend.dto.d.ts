export declare class FriendRequestDto {
    receiverId: string;
}
export declare class InviteByEmailDto {
    email: string;
    message: string;
}
export declare class HandleRequestDto {
    requestId: string;
    action: 'ACCEPT' | 'REJECT';
}
