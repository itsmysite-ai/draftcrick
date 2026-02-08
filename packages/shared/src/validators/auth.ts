import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email("Invalid email address").optional(),
  phone: z
    .string()
    .regex(/^\+[1-9]\d{6,14}$/, "Invalid phone number (use E.164 format)")
    .optional(),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must be at most 20 characters")
    .regex(
      /^[a-zA-Z0-9_]+$/,
      "Username can only contain letters, numbers, and underscores"
    ),
  displayName: z
    .string()
    .min(1, "Display name is required")
    .max(50, "Display name must be at most 50 characters"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .optional(),
});

export const loginSchema = z.object({
  identifier: z.string().min(1, "Email, phone, or username required"),
  password: z.string().min(1, "Password is required"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
