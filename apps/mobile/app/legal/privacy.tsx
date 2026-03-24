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

export default function PrivacyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <YStack flex={1} paddingTop={insets.top} backgroundColor="$background" testID="privacy-screen">
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
            {formatUIText("privacy policy")}
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
            title="1. data we collect"
            body="We collect only the minimum data needed to provide the service: your email address (for login and communications) and a display name / gamertag you choose. We do not collect your real name, phone number, date of birth, physical address, or government ID."
          />

          <LegalSection
            title="2. payment data"
            body="If you subscribe to a paid plan, payment processing is handled entirely by Stripe or Razorpay. We never see, store, or have access to your card number, bank details, or UPI credentials. We only store a payment reference ID to manage your subscription status."
          />

          <LegalSection
            title="3. how we use your data"
            body="Your email is used for: account authentication, subscription confirmations, and optional notifications (which you can disable). Your gamertag is displayed within the app for leagues and social features. We do not sell, rent, or share your data with third parties for advertising."
          />

          <LegalSection
            title="4. data storage"
            body="Your data is stored on secure cloud infrastructure (Google Cloud Platform). We use industry-standard encryption for data in transit (TLS) and at rest."
          />

          <LegalSection
            title="5. cookies and tracking"
            body="DraftPlay does not use advertising cookies or cross-app tracking. We collect basic analytics (app version, OS type) for crash reporting and service improvement only."
          />

          <LegalSection
            title="6. your rights"
            body="Regardless of where you live, you have the right to: access your personal data, correct inaccuracies, delete your account and all associated data, and export your data. These rights apply globally — not just in GDPR/CCPA jurisdictions."
          />

          <LegalSection
            title="7. account deletion"
            body="You can permanently delete your account from the Profile screen at any time. Deletion removes all your data from our systems including your email, gamertag, teams, leagues, and subscription records. This action is irreversible."
          />

          <LegalSection
            title="8. children's privacy"
            body="DraftPlay is not directed at children under 13. We do not knowingly collect data from children under 13. If you believe a child under 13 has created an account, contact us and we will delete it immediately."
          />

          <LegalSection
            title="9. changes to this policy"
            body="We may update this privacy policy from time to time. We will notify you of significant changes via email or in-app notification. Continued use of DraftPlay after changes constitutes acceptance."
          />

          <LegalSection
            title="10. contact"
            body="For privacy-related questions or data requests, contact us at support@playorparty.com"
          />
        </Card>
      </ScrollView>
    </YStack>
  );
}
