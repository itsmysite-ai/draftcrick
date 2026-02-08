import { View, Text, StyleSheet } from "react-native";

export default function SocialScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.emptyState}>
        <Text style={styles.title}>Social</Text>
        <Text style={styles.subtitle}>Your activity feed will appear here</Text>
        <Text style={styles.subtext}>
          See what your friends are doing, chat in leagues, and challenge others
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A1628",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emptyState: {
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: "#6C757D",
    marginBottom: 4,
  },
  subtext: {
    fontSize: 13,
    color: "#6C757D",
    textAlign: "center",
  },
});
