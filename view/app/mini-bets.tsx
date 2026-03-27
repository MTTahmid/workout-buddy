import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Alert,
  Image,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { USER_ID } from "@/constants/user";
import { API_BASE_URL } from "@/constants/api";
import * as ImagePicker from "expo-image-picker";

type Challenge = {
  challengeId: string;
  workoutType: string;
  points: number;
  status: string;
  deadline: string;
  createdAt: string;
  submittedAt: string | null;
  hasProof: boolean;
  challenger: string;
  target: string;
  proofUrl: string | null;
};

export default function MiniBets() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const userId = (params.id as string) || USER_ID;
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [buddyId, setBuddyId] = useState<string | null>(null);
  const [buddyName, setBuddyName] = useState("Buddy");
  const [showCreate, setShowCreate] = useState(false);
  const [workoutType, setWorkoutType] = useState("");
  const [points, setPoints] = useState("10");
  const [deadlineDays, setDeadlineDays] = useState("3");
  const [creating, setCreating] = useState(false);

  const fetchChallenges = async () => {
    try {
      const res = await fetch(
        `${API_BASE_URL}/user/${userId}/challenges`
      );
      if (!res.ok) return;
      const data = await res.json();
      setChallenges(data?.challenges || []);
    } catch (e) {
      console.error("Failed to fetch challenges:", e);
    }
  };

  const fetchBuddy = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/user/${userId}/buddy`);
      if (!res.ok) return;
      const data = await res.json();
      setBuddyId(data?.buddy?._id || null);
      const name = data?.buddy?.name?.trim()?.split(/\s+/)[0] || "Buddy";
      setBuddyName(name);
    } catch (e) {
      console.error("Failed to fetch buddy:", e);
    }
  };

  useEffect(() => {
    fetchBuddy();
    fetchChallenges();
  }, [userId]);

  const handleCreate = async () => {
    if (!buddyId) {
      Alert.alert("No buddy", "You need a buddy to create a challenge.");
      return;
    }
    if (!workoutType.trim()) {
      Alert.alert("Missing info", "Enter a workout type.");
      return;
    }
    const pts = parseInt(points, 10);
    if (!pts || pts < 1) {
      Alert.alert("Invalid points", "Points must be at least 1.");
      return;
    }
    const days = parseInt(deadlineDays, 10);
    if (!days || days < 1) {
      Alert.alert("Invalid deadline", "Deadline must be at least 1 day.");
      return;
    }

    const deadline = new Date();
    deadline.setDate(deadline.getDate() + days);
    deadline.setHours(23, 59, 59, 0);

    setCreating(true);
    try {
      const res = await fetch(`${API_BASE_URL}/user/${userId}/challenges`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetId: buddyId,
          workoutType: workoutType.trim(),
          points: pts,
          deadline: deadline.toISOString(),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        Alert.alert("Failed", err?.message || "Could not create challenge.");
        return;
      }
      setShowCreate(false);
      setWorkoutType("");
      setPoints("10");
      setDeadlineDays("3");
      fetchChallenges();
    } catch (e) {
      Alert.alert("Error", "Could not connect to server.");
    } finally {
      setCreating(false);
    }
  };

  const handleSubmitProof = async (challengeId: string) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Camera access is required.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.7,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const formData = new FormData();
    formData.append("proof", {
      uri: asset.uri,
      name: asset.uri.split("/").pop() || "proof.jpg",
      type: asset.mimeType || "image/jpeg",
    } as any);

    try {
      const res = await fetch(
        `${API_BASE_URL}/user/${userId}/challenges/${challengeId}/proof`,
        { method: "POST", body: formData }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        Alert.alert("Upload failed", err?.message || "Something went wrong.");
        return;
      }
      Alert.alert("Done!", "Proof submitted & auto-approved. Points earned!");
      fetchChallenges();
    } catch (e) {
      Alert.alert("Error", "Could not connect to server.");
    }
  };

  const getStatusStyle = (status: string) => {
    if (status === "approved") return { bg: "rgba(57,210,180,0.15)", color: "#39d2b4" };
    if (status === "rejected") return { bg: "rgba(255,100,100,0.15)", color: "#ff6464" };
    return { bg: "rgba(255,180,50,0.15)", color: "#ffb432" };
  };

  const getTimeLeft = (deadline: string) => {
    const diff = new Date(deadline).getTime() - Date.now();
    if (diff <= 0) return "Expired";
    const hrs = Math.floor(diff / 3600000);
    if (hrs < 24) return `${hrs}h left`;
    return `${Math.ceil(hrs / 24)}d left`;
  };

  const pendingForMe = challenges.filter(
    (c) => String(c.target) === String(userId) && c.status === "pending"
  );
  const activeChallenges = challenges.filter((c) => c.status !== "pending" || String(c.target) !== String(userId));

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={() => router.replace(`/dashboard?id=${userId}`)}
        >
          <Text style={styles.back}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Mini Bets</Text>
        <TouchableOpacity onPress={() => setShowCreate(true)}>
          <Text style={styles.addBtn}>+</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* PENDING CHALLENGES FOR ME */}
        {pendingForMe.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🔥 Challenges for you</Text>
            {pendingForMe.map((c) => (
              <View key={c.challengeId} style={styles.challengeCard}>
                <View style={styles.cardTop}>
                  <Text style={styles.workoutType}>{c.workoutType}</Text>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: getStatusStyle(c.status).bg },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        { color: getStatusStyle(c.status).color },
                      ]}
                    >
                      {getTimeLeft(c.deadline)}
                    </Text>
                  </View>
                </View>
                <Text style={styles.pointsText}>🏆 {c.points} pts</Text>
                <TouchableOpacity
                  style={styles.proofButton}
                  onPress={() => handleSubmitProof(c.challengeId)}
                >
                  <Text style={styles.proofButtonText}>
                    📷 Submit Proof
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* ALL CHALLENGES */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>All Bets</Text>
          {challenges.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={{ fontSize: 40, marginBottom: 15 }}>🎲</Text>
              <Text style={styles.emptyTitle}>No bets yet</Text>
              <Text style={styles.emptySub}>
                Tap + to challenge {buddyName}
              </Text>
            </View>
          ) : (
            challenges.map((c) => {
              const isMine = String(c.challenger) === String(userId);
              const ss = getStatusStyle(c.status);
              return (
                <View key={c.challengeId} style={styles.challengeCard}>
                  <View style={styles.cardTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.workoutType}>{c.workoutType}</Text>
                      <Text style={styles.roleText}>
                        {isMine ? `You → ${buddyName}` : `${buddyName} → You`}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: ss.bg }]}>
                      <Text style={[styles.statusText, { color: ss.color }]}>
                        {c.status}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.cardBottom}>
                    <Text style={styles.pointsText}>🏆 {c.points} pts</Text>
                    <Text style={styles.deadlineText}>
                      {getTimeLeft(c.deadline)}
                    </Text>
                  </View>
                  {c.hasProof && c.status === "approved" && c.proofUrl && (
                    <Image
                      source={{
                        uri: `${API_BASE_URL}${c.proofUrl}`,
                      }}
                      style={styles.proofThumb}
                      resizeMode="cover"
                    />
                  )}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* CREATE MODAL */}
      <Modal visible={showCreate} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Challenge {buddyName}
            </Text>

            <Text style={styles.inputLabel}>Workout</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Push Up x10"
              placeholderTextColor="#666"
              value={workoutType}
              onChangeText={setWorkoutType}
            />

            <Text style={styles.inputLabel}>Points</Text>
            <TextInput
              style={styles.input}
              placeholder="10"
              placeholderTextColor="#666"
              keyboardType="number-pad"
              value={points}
              onChangeText={setPoints}
            />

            <Text style={styles.inputLabel}>Deadline (days from now)</Text>
            <TextInput
              style={styles.input}
              placeholder="3"
              placeholderTextColor="#666"
              keyboardType="number-pad"
              value={deadlineDays}
              onChangeText={setDeadlineDays}
            />

            <TouchableOpacity
              style={[styles.createBtn, creating && { opacity: 0.5 }]}
              onPress={handleCreate}
              disabled={creating}
            >
              <Text style={styles.createBtnText}>
                {creating ? "Sending..." : "Send Challenge 🎯"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setShowCreate(false)}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    paddingHorizontal: 25,
    paddingTop: 70,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 25,
  },
  back: {
    color: "#fff",
    fontSize: 28,
  },
  title: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "600",
  },
  addBtn: {
    color: "#39d2b4",
    fontSize: 32,
    fontWeight: "600",
  },
  content: {
    paddingBottom: 40,
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  challengeCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  workoutType: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  roleText: {
    color: "#888",
    fontSize: 12,
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  cardBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
  },
  pointsText: {
    color: "#39d2b4",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 6,
  },
  deadlineText: {
    color: "#888",
    fontSize: 12,
  },
  proofButton: {
    backgroundColor: "#39d2b4",
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 12,
  },
  proofButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  proofThumb: {
    width: "100%",
    height: 160,
    borderRadius: 12,
    marginTop: 12,
  },
  emptyCard: {
    backgroundColor: "#0e0e0e",
    borderColor: "#39d2b4",
    borderWidth: 0.5,
    padding: 40,
    borderRadius: 20,
    alignItems: "center",
  },
  emptyTitle: {
    color: "#fff",
    fontSize: 16,
    marginBottom: 10,
  },
  emptySub: {
    color: "#777",
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#1a1a1a",
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    padding: 25,
    paddingBottom: 40,
  },
  modalTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 20,
    textAlign: "center",
  },
  inputLabel: {
    color: "#888",
    fontSize: 12,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: "#2a2a2a",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#fff",
    fontSize: 16,
  },
  createBtn: {
    backgroundColor: "#39d2b4",
    borderRadius: 50,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 24,
  },
  createBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  cancelBtn: {
    alignItems: "center",
    marginTop: 14,
  },
  cancelBtnText: {
    color: "#888",
    fontSize: 14,
  },
});
