import jwt from 'jsonwebtoken';
export declare const generateToken: (payload: object, expiresIn?: string) => never;
export declare const verifyToken: (token: string) => string | jwt.JwtPayload;
//# sourceMappingURL=jwt.d.ts.map