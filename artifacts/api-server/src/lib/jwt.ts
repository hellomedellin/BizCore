import jwt from "jsonwebtoken";

const SECRET = process.env["JWT_SECRET"] ?? "bizcore-dev-secret-change-in-production";

export interface TokenPayload {
  sub: string;        // appUser.id
  businessId: string;
  role: string;
  employeeId?: string;
  username: string;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: "90d" });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, SECRET) as TokenPayload;
}
