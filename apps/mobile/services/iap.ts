/**
 * In-App Purchase service — RevenueCat SDK wrapper.
 *
 * Handles Apple IAP (iOS) and Google Play Billing (Android) via RevenueCat.
 * On web, falls back to Razorpay (server-side checkout URLs).
 *
 * RevenueCat identifies users by our internal UUID (app_user_id).
 * All subscription state lives in our DB — RevenueCat webhooks keep it in sync.
 */

import { Platform } from "react-native";
import type { PurchasePlatform } from "@draftplay/shared";

// RevenueCat SDK is only available on native platforms
let Purchases: typeof import("react-native-purchases").default | null = null;

/** Get the current platform for payment routing */
export function getPlatform(): PurchasePlatform {
  if (Platform.OS === "ios") return "ios";
  if (Platform.OS === "android") return "android";
  return "web";
}

/** Whether the current platform supports native IAP (RevenueCat) */
export function supportsNativeIAP(): boolean {
  return Platform.OS === "ios" || Platform.OS === "android";
}

/**
 * Initialize RevenueCat SDK. Call once on app start.
 * No-op on web.
 */
export async function initializeRevenueCat(): Promise<void> {
  if (!supportsNativeIAP()) return;

  const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY;
  if (!apiKey) {
    console.warn("[IAP] EXPO_PUBLIC_REVENUECAT_API_KEY not set, skipping RevenueCat init");
    return;
  }

  try {
    const RNPurchases = require("react-native-purchases").default;
    Purchases = RNPurchases;
    await Purchases!.configure({ apiKey });
  } catch (err) {
    console.warn("[IAP] Failed to initialize RevenueCat:", err);
  }
}

/**
 * Identify the user with RevenueCat using our internal UUID.
 * Must be called after authentication.
 */
export async function identifyUser(userId: string): Promise<void> {
  if (!Purchases) return;

  try {
    await Purchases.logIn(userId);
  } catch (err) {
    console.warn("[IAP] Failed to identify user:", err);
  }
}

/**
 * Log out from RevenueCat (call on user sign-out).
 */
export async function logOutRevenueCat(): Promise<void> {
  if (!Purchases) return;

  try {
    await Purchases.logOut();
  } catch {
    // Silent — logout failures are non-critical
  }
}

/**
 * Purchase a product via Apple/Google native payment sheet.
 * Returns true if purchase succeeded, false if cancelled or failed.
 */
export async function purchaseProduct(productId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  if (!Purchases) {
    return { success: false, error: "RevenueCat not initialized" };
  }

  try {
    // Get the product (offering) from RevenueCat
    const products = await Purchases.getProducts([productId]);
    const product = products.find((p) => p.identifier === productId);

    if (!product) {
      return { success: false, error: `Product not found: ${productId}` };
    }

    // Present the native payment sheet
    const { customerInfo } = await Purchases.purchaseStoreProduct(product);

    // Check if the expected entitlement is now active
    const activeEntitlements = Object.keys(customerInfo.entitlements.active);
    if (activeEntitlements.length > 0) {
      return { success: true };
    }

    return { success: true }; // Purchase went through, webhook will activate
  } catch (err: any) {
    // RevenueCat throws specific error codes
    if (err.userCancelled) {
      return { success: false, error: "Purchase cancelled" };
    }
    return { success: false, error: err.message ?? "Purchase failed" };
  }
}

/**
 * Restore previous purchases (required by Apple).
 * Returns true if any active entitlements were found.
 */
export async function restorePurchases(): Promise<{
  restored: boolean;
  error?: string;
}> {
  if (!Purchases) {
    return { restored: false, error: "RevenueCat not initialized" };
  }

  try {
    const customerInfo = await Purchases.restorePurchases();
    const activeEntitlements = Object.keys(customerInfo.entitlements.active);
    return { restored: activeEntitlements.length > 0 };
  } catch (err: any) {
    return { restored: false, error: err.message ?? "Restore failed" };
  }
}

/**
 * Get currently active entitlements from RevenueCat.
 */
export async function getActiveEntitlements(): Promise<string[]> {
  if (!Purchases) return [];

  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return Object.keys(customerInfo.entitlements.active);
  } catch {
    return [];
  }
}
