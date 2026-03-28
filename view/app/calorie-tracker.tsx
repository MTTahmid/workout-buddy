import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { USER_ID } from "@/constants/user";
import { API_BASE_URL } from "@/constants/api";

type CalorieEntry = {
  _id?: string;
  weight: number;
  goal: number;
  workout: string;
  duration: number;
  calories: number;
  goalMet?: boolean;
  createdAt?: string;
};

export default function CalorieTracker() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const userId = (params.id as string) || USER_ID;

  const [history, setHistory] = useState<CalorieEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLog, setShowLog] = useState(false);
  const [saving, setSaving] = useState(false);

  // Log form
  const [weight, setWeight] = useState("");
  const [goal, setGoal] = useState("");
  const [workout, setWorkout] = useState("");
  const [duration, setDuration] = useState("");
  const [calories, setCalories] = useState("");

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/user/${userId}/calories/history`
      );
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.history || data.entries || [];
        setHistory(list);
      } else {
        setHistory([]);
      }
    } catch {
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  const handleLog = async () => {
    const w = parseFloat(weight);
    const g = parseFloat(goal);
    const d = parseFloat(duration);
    const c = parseFloat(calories);

    if (!w || !g || !workout.trim() || !d || !c) {
      Alert.alert("Error", "All fields are required.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/user/${userId}/calories/log`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            weight: w,
            goal: g,
            workout: workout.trim(),
            duration: d,
            calories: c,
          }),
        }
      );
      const data = await res.json();
      if (res.ok) {
        Alert.alert("Logged", "Calorie entry saved!");
        setShowLog(false);
        resetForm();
        fetchHistory();
      } else {
        Alert.alert("Error", data.message || "Failed to log.");
      }
    } catch {
      Alert.alert("Error", "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setWeight("");
    setGoal("");
    setWorkout("");
    setDuration("");
    setCalories("");
  };

  const totalCalories = history.reduce((sum, e) => sum + (e.calories || 0), 0);
  const avgCalories =
    history.length > 0 ? Math.round(totalCalories / history.length) : 0;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={() => router.replace(`/dashboard?id=${userId}`)}
      >
        <Text style={styles.back}>←</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Calorie Tracker</Text>

      {/* Summary */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{history.length}</Text>
          <Text style={styles.summaryLabel}>Entries</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{totalCalories}</Text>
          <Text style={styles.summaryLabel}>Total Cal</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{avgCalories}</Text>
          <Text style={styles.summaryLabel}>Avg Cal</Text>
        </View>
      </View>

      {/* History */}
      <Text style={styles.sectionTitle}>History</Text>

      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator color="#39d2b4" style={{ marginTop: 40 }} />
        ) : history.length === 0 ? (
          <Text style={styles.emptyText}>No entries yet. Log your first!</Text>
        ) : (
          history.map((entry, index) => (
            <View key={entry._id || index} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.cardWorkout}>{entry.workout}</Text>
                {entry.goalMet != null && (
                  <View
                    style={[
                      styles.goalBadge,
                      entry.goalMet
                        ? styles.goalMetBadge
                        : styles.goalMissedBadge,
                    ]}
                  >
                    <Text style={styles.goalBadgeText}>
                      {entry.goalMet ? "Goal Met" : "Missed"}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.cardStats}>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{entry.calories}</Text>
                  <Text style={styles.statLabel}>cal</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{entry.duration}</Text>
                  <Text style={styles.statLabel}>min</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{entry.weight}</Text>
                  <Text style={styles.statLabel}>kg</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{entry.goal}</Text>
                  <Text style={styles.statLabel}>goal</Text>
                </View>
              </View>
              {entry.createdAt && (
                <Text style={styles.cardDate}>
                  {new Date(entry.createdAt).toLocaleDateString()}
                </Text>
              )}
            </View>
          ))
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Floating Log Button */}
      <TouchableOpacity style={styles.fab} onPress={() => setShowLog(true)}>
        <Text style={styles.fabText}>+ Log Calories</Text>
      </TouchableOpacity>

      {/* Log Modal */}
      <Modal visible={showLog} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Log Calorie Entry</Text>

            <Text style={styles.label}>Weight (kg)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 75"
              placeholderTextColor="#666"
              keyboardType="numeric"
              value={weight}
              onChangeText={setWeight}
            />

            <Text style={styles.label}>Calorie Goal</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 2500"
              placeholderTextColor="#666"
              keyboardType="numeric"
              value={goal}
              onChangeText={setGoal}
            />

            <Text style={styles.label}>Workout Type</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Running"
              placeholderTextColor="#666"
              value={workout}
              onChangeText={setWorkout}
            />

            <Text style={styles.label}>Duration (minutes)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 30"
              placeholderTextColor="#666"
              keyboardType="numeric"
              value={duration}
              onChangeText={setDuration}
            />

            <Text style={styles.label}>Calories Burned</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 350"
              placeholderTextColor="#666"
              keyboardType="numeric"
              value={calories}
              onChangeText={setCalories}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setShowLog(false);
                  resetForm();
                }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={handleLog}
                disabled={saving}
              >
                <Text style={styles.saveBtnText}>
                  {saving ? "Saving..." : "Log"}
                </Text>
              </TouchableOpacity>
            </View>
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
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  back: {
    color: "#fff",
    fontSize: 28,
    marginBottom: 10,
  },
  title: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 20,
  },

  // Summary
  summaryRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 24,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  summaryValue: {
    color: "#39d2b4",
    fontSize: 22,
    fontWeight: "700",
  },
  summaryLabel: {
    color: "#888",
    fontSize: 12,
    marginTop: 4,
  },

  sectionTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 14,
  },
  list: {
    flex: 1,
  },
  emptyText: {
    color: "#666",
    fontSize: 16,
    textAlign: "center",
    marginTop: 40,
  },

  // Card
  card: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  cardWorkout: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
  },
  goalBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  goalMetBadge: {
    backgroundColor: "rgba(57, 210, 180, 0.2)",
  },
  goalMissedBadge: {
    backgroundColor: "rgba(255, 68, 68, 0.2)",
  },
  goalBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#39d2b4",
  },
  cardStats: {
    flexDirection: "row",
    gap: 16,
  },
  stat: {
    alignItems: "center",
  },
  statValue: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  statLabel: {
    color: "#888",
    fontSize: 11,
    marginTop: 2,
  },
  cardDate: {
    color: "#555",
    fontSize: 12,
    marginTop: 10,
  },

  // FAB
  fab: {
    position: "absolute",
    bottom: 30,
    right: 20,
    backgroundColor: "#39d2b4",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 30,
  },
  fabText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "700",
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    padding: 20,
  },
  modalBox: {
    backgroundColor: "#1a1a1a",
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 20,
  },
  label: {
    color: "#999",
    fontSize: 14,
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#2a2a2a",
    color: "#fff",
    fontSize: 16,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#444",
    alignItems: "center",
  },
  cancelBtnText: {
    color: "#fff",
    fontSize: 16,
  },
  saveBtn: {
    flex: 1,
    backgroundColor: "#39d2b4",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  saveBtnText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "700",
  },
});
