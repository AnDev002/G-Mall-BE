export declare class RegisterDto {
    email: string;
    password: string;
    name: string;
}
export declare class RegisterSellerDto {
    email: string;
    password: string;
    name: string;
    shopName: string;
    phoneNumber: string;
    pickupAddress: string;
    taxCode: string;
}
export declare class LoginDto {
    email: string;
    password: string;
}
export declare class SendOtpDto {
    email: string;
}
export declare class VerifyOtpDto {
    email: string;
    otp: string;
}
