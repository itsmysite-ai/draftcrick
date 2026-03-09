import { ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { YStack, XStack } from "tamagui";
import { Text } from "../../components/SportText";
import { BackButton, Card, formatUIText } from "@draftplay/ui";
import { HeaderControls } from "../../components/HeaderControls";

function LegalSection({ title, body }: { title: string; body: string }) {
  return (
    <YStack marginBottom="$4">
      <Text fontFamily="$mono" fontWeight="600" fontSize={13} color="$color" marginBottom="$2">
        {formatUIText(title)}
      </Text>
      <Text fontFamily="$body" fontSize={13} color="$colorSecondary" lineHeight={20}>
        {body}
      </Text>
    </YStack>
  );
}

export default function TermsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <YStack flex={1} paddingTop={insets.top} backgroundColor="$background" testID="terms-screen">
      <XStack
        justifyContent="space-between"
        alignItems="center"
        paddingHorizontal="$4"
        paddingTop={8}
        paddingBottom="$3"
      >
        <XStack alignItems="center" gap="$3">
          <BackButton onPress={() => router.back()} />
          <Text fontFamily="$mono" fontWeight="500" fontSize={17} color="$color" letterSpacing={-0.5}>
            {formatUIText("terms of service")}
          </Text>
        </XStack>
        <HeaderControls />
      </XStack>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }}
      >
        <Card marginBottom="$4">
          <Text fontFamily="$mono" fontWeight="600" fontSize={10} color="$colorMuted" letterSpacing={0.5} marginBottom="$3">
            {formatUIText("last updated: march 2026")}
          </Text>

          <LegalSection
            title="1. acceptance of terms"
            body="By creating a DraftPlay account, you agree to these Terms of Service. If you do not agree, do not use the app. We may update these terms from time to time — continued use constitutes acceptance of changes."
          />

          <LegalSection
            title="2. eligibility"
            body="You must be at least 13 years old to use DraftPlay. By creating an account, you confirm that you meet this age requirement. Users under 18 may need parental consent depending on their jurisdiction."
          />

          <LegalSection
            title="3. no betting or gambling"
            body="DraftPlay is a subscription-based fantasy sports management platform. We do not offer real-money contests, betting, wagering, or prize pools of any kind. DraftPlay is not a gambling service. Our revenue comes exclusively from optional subscription plans."
          />

          <LegalSection
            title="4. subscription model"
            body="DraftPlay offers free and paid subscription tiers (Pro, Elite). Subscriptions auto-renew unless cancelled before the renewal date. You can cancel anytime through your app store account settings. Refunds are handled per Apple App Store and Google Play Store policies."
          />

          <LegalSection
            title="5. user accounts"
            body="You are responsible for maintaining the security of your account credentials. Each user may have only one account. We reserve the right to suspend or terminate accounts that violate these terms."
          />

          <LegalSection
            title="6. user content"
            body="You retain ownership of content you create (team names, league names, etc.). By using DraftPlay, you grant us a license to display this content within the app. We do not sell or share your content with third parties."
          />

          <LegalSection
            title="7. fair use"
            body="You agree not to: use bots or automated tools, attempt to manipulate rankings, harass other users, reverse-engineer the app, or use the service for any illegal purpose."
          />

          <LegalSection
            title="8. limitation of liability"
            body="DraftPlay is provided 'as is'. We are not liable for any indirect, incidental, or consequential damages arising from your use of the service. Our total liability is limited to the amount you paid for your subscription in the 12 months preceding any claim."
          />

          <LegalSection
            title="9. termination"
            body="You may delete your account at any time from the Profile screen. We may terminate or suspend accounts for violations of these terms. Upon deletion, your data is permanently removed in accordance with our Privacy Policy."
          />

          <LegalSection
            title="10. contact"
            body="For questions about these terms, contact us at support@draftplay.ai"
          />
        </Card>
      </ScrollView>
    </YStack>
  );
}
