import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useState } from "react";

interface Message {
  id: string;
  role: "user" | "guru";
  content: string;
}

const SUGGESTIONS = [
  "Who should I captain for IND vs AUS?",
  "Build me a team under 100 credits",
  "What does waiver wire mean?",
  "Preview of CSK vs MI",
];

/**
 * Cricket Guru — AI-powered assistant
 */
export default function GuruScreen() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "guru",
      content:
        "Hi! I'm your Cricket Guru. Ask me anything about fantasy cricket — team picks, rule explanations, match previews, or player comparisons.",
    },
  ]);
  const [input, setInput] = useState("");

  const sendMessage = () => {
    if (!input.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
    };

    const guruMsg: Message = {
      id: (Date.now() + 1).toString(),
      role: "guru",
      content:
        "I'm not connected to the AI backend yet. Once the AI service is integrated, I'll be able to answer your cricket questions with real-time data!",
    };

    setMessages((prev) => [...prev, userMsg, guruMsg]);
    setInput("");
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={100}
    >
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View
            style={[
              styles.messageBubble,
              item.role === "user" ? styles.userBubble : styles.guruBubble,
            ]}
          >
            {item.role === "guru" && (
              <Text style={styles.guruLabel}>Cricket Guru</Text>
            )}
            <Text style={styles.messageText}>{item.content}</Text>
          </View>
        )}
        contentContainerStyle={styles.messageList}
      />

      {/* Suggestion chips */}
      {messages.length <= 1 && (
        <View style={styles.suggestions}>
          {SUGGESTIONS.map((s) => (
            <TouchableOpacity
              key={s}
              style={styles.suggestionChip}
              onPress={() => {
                setInput(s);
              }}
            >
              <Text style={styles.suggestionText}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Input */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Ask Cricket Guru..."
          placeholderTextColor="#5E5D5A"
          value={input}
          onChangeText={setInput}
          onSubmitEditing={sendMessage}
          returnKeyType="send"
        />
        <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111210",
  },
  messageList: {
    padding: 16,
    gap: 12,
  },
  messageBubble: {
    maxWidth: "85%",
    padding: 14,
    borderRadius: 16,
  },
  userBubble: {
    backgroundColor: "#5DB882",
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
  },
  guruBubble: {
    backgroundColor: "#1C1D1B",
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: "#333432",
  },
  guruLabel: {
    fontSize: 11,
    color: "#5DB882",
    fontWeight: "700",
    marginBottom: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
    color: "#EDECEA",
  },
  suggestions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  suggestionChip: {
    backgroundColor: "#1C1D1B",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#333432",
  },
  suggestionText: {
    color: "#9A9894",
    fontSize: 13,
  },
  inputRow: {
    flexDirection: "row",
    padding: 12,
    paddingBottom: 24,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "#1C1D1B",
  },
  input: {
    flex: 1,
    backgroundColor: "#1C1D1B",
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: "#EDECEA",
    fontSize: 15,
  },
  sendButton: {
    backgroundColor: "#5DB882",
    borderRadius: 24,
    paddingHorizontal: 20,
    justifyContent: "center",
  },
  sendButtonText: {
    color: "#111210",
    fontWeight: "700",
    fontSize: 14,
  },
});
