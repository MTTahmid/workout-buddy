import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { io, Socket } from "socket.io-client";
import { useAuth } from "@/context/auth";
import { API_BASE_URL } from "@/constants/api";

type Message = {
  _id: string;
  senderId: string;
  text: string;
  createdAt: string;
  readAt: string | null;
};

export default function Chat() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id ?? "";

  const [buddyPairId, setBuddyPairId] = useState<string | null>(null);
  const [buddyName, setBuddyName] = useState("Buddy");
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const seenIds = useRef<Set<string>>(new Set());

  // Fetch buddy info to get buddyPairId
  useEffect(() => {
    if (!userId) return;
    fetch(`${API_BASE_URL}/user/${userId}/buddy`)
      .then((r) => r.json())
      .then((data) => {
        const pairId = data?.buddyPair?.id;
        const name = data?.buddy?.name?.split(" ")[0] || "Buddy";
        setBuddyPairId(pairId ?? null);
        setBuddyName(name);
      })
      .catch(() => {});
  }, [userId]);

  // Load messages once we have buddyPairId
  useEffect(() => {
    if (!buddyPairId || !userId) return;
    setLoading(true);
    fetch(`${API_BASE_URL}/user/${userId}/chat/${buddyPairId}/messages?limit=50`)
      .then((r) => r.json())
      .then((data) => {
        const msgs: Message[] = data?.messages ?? [];
        msgs.forEach((m) => seenIds.current.add(m._id));
        setMessages(msgs);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    // Mark messages as read
    fetch(`${API_BASE_URL}/user/${userId}/chat/${buddyPairId}/messages/read`, {
      method: "PATCH",
    }).catch(() => {});
  }, [buddyPairId, userId]);

  // Socket.IO connection
  useEffect(() => {
    if (!buddyPairId) return;

    const socket = io(API_BASE_URL, {
      transports: ["websocket"],
      reconnectionAttempts: 5,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join", { buddyPairId });
    });

    socket.on("chat:message", (msg: Message) => {
      if (seenIds.current.has(msg._id)) return;
      seenIds.current.add(msg._id);
      setMessages((prev) => [...prev, msg]);
      // Mark as read if it's from the buddy
      if (msg.senderId !== userId) {
        fetch(`${API_BASE_URL}/user/${userId}/chat/${buddyPairId}/messages/read`, {
          method: "PATCH",
        }).catch(() => {});
      }
    });

    return () => {
      socket.emit("leave", { buddyPairId });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [buddyPairId, userId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
    }
  }, [messages.length]);

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || !buddyPairId || sending) return;
    setText("");
    setSending(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/user/${userId}/chat/${buddyPairId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: trimmed }),
        }
      );
      const data = await res.json();
      const msg: Message = data?.message;
      if (msg && !seenIds.current.has(msg._id)) {
        seenIds.current.add(msg._id);
        setMessages((prev) => [...prev, msg]);
      }
    } catch {}
    setSending(false);
  }, [text, buddyPairId, userId, sending]);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const h = d.getHours();
    const m = String(d.getMinutes()).padStart(2, "0");
    const ampm = h >= 12 ? "pm" : "am";
    return `${h % 12 || 12}:${m} ${ampm}`;
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMine = item.senderId === userId;
    return (
      <View style={[styles.msgRow, isMine ? styles.msgRowRight : styles.msgRowLeft]}>
        <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleBuddy]}>
          <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>
            {item.text}
          </Text>
          <Text style={[styles.timestamp, isMine && styles.timestampMine]}>
            {formatTime(item.createdAt)}
            {isMine && item.readAt ? "  ✓✓" : ""}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{buddyName.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.headerName}>{buddyName}</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      {/* MESSAGES */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#39d2b4" size="large" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item._id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No messages yet. Say hi! 👋</Text>
            </View>
          }
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: false })
          }
        />
      )}

      {/* INPUT */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Message..."
          placeholderTextColor="#555"
          value={text}
          onChangeText={setText}
          multiline
          maxLength={500}
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!text.trim() || sending}
        >
          <Text style={styles.sendIcon}>↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a1a",
    backgroundColor: "#000",
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  backArrow: {
    color: "#39d2b4",
    fontSize: 32,
    lineHeight: 36,
  },
  headerCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(57,210,180,0.15)",
    borderWidth: 1,
    borderColor: "#39d2b4",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#39d2b4",
    fontSize: 15,
    fontWeight: "700",
  },
  headerName: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  messageList: {
    paddingHorizontal: 14,
    paddingVertical: 16,
    paddingBottom: 8,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    marginTop: 80,
  },
  emptyText: {
    color: "#555",
    fontSize: 15,
  },
  msgRow: {
    marginBottom: 10,
  },
  msgRowRight: {
    alignItems: "flex-end",
  },
  msgRowLeft: {
    alignItems: "flex-start",
  },
  bubble: {
    maxWidth: "75%",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleMine: {
    backgroundColor: "#39d2b4",
    borderBottomRightRadius: 4,
  },
  bubbleBuddy: {
    backgroundColor: "#1e1e1e",
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: "#2a2a2a",
  },
  bubbleText: {
    color: "#e0e0e0",
    fontSize: 15,
    lineHeight: 21,
  },
  bubbleTextMine: {
    color: "#000",
  },
  timestamp: {
    color: "#888",
    fontSize: 10,
    marginTop: 4,
    alignSelf: "flex-end",
  },
  timestampMine: {
    color: "rgba(0,0,0,0.45)",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 12,
    paddingBottom: Platform.OS === "ios" ? 28 : 12,
    borderTopWidth: 1,
    borderTopColor: "#1a1a1a",
    backgroundColor: "#000",
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: "#1a1a1a",
    borderWidth: 1,
    borderColor: "#2a2a2a",
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: "#fff",
    fontSize: 15,
    maxHeight: 120,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#39d2b4",
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: {
    backgroundColor: "#1e3d35",
  },
  sendIcon: {
    color: "#000",
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 22,
  },
});
