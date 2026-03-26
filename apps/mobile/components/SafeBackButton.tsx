import { BackButton } from "@draftplay/ui";
import { useSafeBack } from "../hooks/useSafeBack";

/**
 * BackButton with safe navigation — goes back if history exists,
 * otherwise navigates to home. Prevents dead-end pages.
 *
 * Drop-in replacement for `<BackButton onPress={() => router.back()} />`
 */
export function SafeBackButton(props: Omit<Parameters<typeof BackButton>[0], "onPress">) {
  const safeBack = useSafeBack();
  return <BackButton onPress={safeBack} {...props} />;
}
