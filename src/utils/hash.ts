import argon2 from 'argon2';

export const hashPassword = async (password: string) => {
  return argon2.hash(password);
};

export const verifyPassword = async (hash: string, plain: string) => {
  return argon2.verify(hash, plain);
};
