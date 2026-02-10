import { z } from "zod";

/**
 * Schema for syncing a Firebase Auth user to our PostgreSQL database.
 * Called after first sign-in to create the local user profile.
 */
export const syncUserSchema = z.object({
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
});

/**
 * Schema for updating user preferences.
 */
export const updatePreferencesSchema = z.object({
  preferredLang: z.string().optional(),
  displayName: z.string().min(1).max(50).optional(),
});

export type SyncUserInput = z.infer<typeof syncUserSchema>;
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;
