import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export const generateToken = (payload: object, expiresIn: string | number = env.JWT_EXPIRES_IN) => {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn } as jwt.SignOptions);
};

export const verifyToken = (token: string) => {
  return jwt.verify(token, env.JWT_SECRET);
};
