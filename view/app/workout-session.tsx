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
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { USER_ID } from "@/constants/user";
import { API_BASE_URL } from "@/constants/api";

type ProgressEntry = {
  exercise: string | { _id: string; title: string };
  sets: number;
  reps: number;
  rest: number;
  completed: boolean;
  timeTaken: number | null;
};

type SessionData = {
  _id: string;
  modelId: string | { _id: string; title: string; category: string };
  startTime: string;
  progress: ProgressEntry[];
};

export default function WorkoutSession() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const userId = (params.id as string) || USER_ID;

  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeInputs, setTimeInputs] = useState<Record<number, string>>({});
  const [updating, setUpdating] = useState<number | null>(null);
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    fetchSession();
  }, []);

  const fetchSession = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/user/${userId}/active-workout-model-session/tracker`
      );
      if (res.ok) {
        const data = await res.json();
        // Could be data.session or data directly
        const s = data.session || data;
        setSession(s);
        // Pre-fill time inputs for completed exercises
        if (s?.progress) {
          const prefilled: Record<number, string> = {};
          s.progress.forEach((p: ProgressEntry, i: number) => {
            if (p.timeTaken != null) {
              prefilled[i] = String(p.timeTaken);
            }
          });
          setTimeInputs(prefilled);
        }
      } else {
        setSession(null);
      }
    } catch {
      setSession(null);
    } finally {
      setLoading(false);
    }
  };

  const getExerciseName = (exercise: string | { _id: string; title: string }) => {
    if (typeof exercise === "object" && exercise?.title) return exercise.title;
    if (typeof exercise === "string") return exercise.substring(0, 12) + "...";
    return "Exercise";
  };

  const getExerciseId = (exercise: string | { _id: string; title: string }) => {
    if (typeof exercise === "object" && exercise?._id) return exercise._id;
    return exercise as string;
  };

  const handleComplete = async (index: number) => {
    if (!session) return;
    const entry = session.progress[index];
    const time = parseInt(timeInputs[index] || "0");
    if (!time || time < 1) {
      Alert.alert("Time Required", "Enter the time taken (in seconds).");
      return;
    }

    setUpdating(index);
    try {
      const res = await fetch(
        `${API_BASE_URL}/user/${userId}/active-workout-model-session/update`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            exerciseId: getExerciseId(entry.exercise),
            timeTaken: time,
          }),
        }
      );
      if (res.ok) {
        fetchSession();
      } else {
        const data = await res.json();
        Alert.alert("Error", data.message || "Failed to update.");
      }
    } catch {
      Alert.alert("Error", "Something went wrong.");
    } finally {
      setUpdating(null);
    }
  };

  const handleEndSession = async () => {
    Alert.alert("End Session", "End your current workout session?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "End",
        style: "destructive",
        onPress: async () => {
          setEnding(true);
          try {
            const res = await fetch(
              `${API_BASE_URL}/user/${userId}/active-workout-model-session/end`,
              { method: "DELETE" }
            );
            const data = await res.json();
            if (res.ok) {
              Alert.alert(
                "Session Ended",
                data.message || "Workout saved to history!",
                [
                  {
                    text: "OK",
                    onPress: () =>
                      router.replace(`/workout-models?id=${userId}`),
                  },
                ]
              );
            } else {
              Alert.alert("Error", data.message || "Failed to end session.");
            }
          } catch {
            Alert.alert("Error", "Something went wrong.");
          } finally {
            setEnding(false);
          }
        },
      },
    ]);
  };

  const getModelName = () => {
    if (!session) return "";
    if (typeof session.modelId === "object" && session.modelId?.title)
      return session.modelId.title;
    return "Workout";
  };

  const completedCount = session?.progress?.filter((p) => p.completed).length || 0;
  const totalCount = session?.progress?.length || 0;

  const getElapsedTime = () => {
    if (!session?.startTime) return "";
    const start = new Date(session.startTime).getTime();
    const now = Date.now();
    const mins = Math.floor((now - start) / 60000);
    if (mins < 1) return "Just started";
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m`;
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color="#39d2b4" size="large" style={{ marginTop: 100 }} />
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.container}>
        <TouchableOpacity
          onPress={() => router.replace(`/workout-models?id=${userId}`)}
        >
          <Text style={styles.back}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>No Active Session</Text>
        <Text style={styles.emptyText}>
          Start a session from your workout models.
        </Text>
        <TouchableOpacity
          style={styles.goBackBtn}
          onPress={() => router.replace(`/workout-models?id=${userId}`)}
        >
          <Text style={styles.goBackBtnText}>Go to Models</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={() => router.replace(`/workout-models?id=${userId}`)}
      >
        <Text style={styles.back}>←</Text>
      </TouchableOpacity>

      <Text style={styles.title}>{getModelName()}</Text>

      {/* Progress header */}
      <View style={styles.progressHeader}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                width:
                  totalCount > 0
                    ? `${(completedCount / totalCount) * 100}%`
                    : "0%",
              },
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          {completedCount}/{totalCount} completed
        </Text>
        <Text style={styles.elapsedText}>{getElapsedTime()}</Text>
      </View>

      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {session.progress.map((entry, index) => (
          <View
            key={index}
            style={[styles.card, entry.completed && styles.cardCompleted]}
          >
            <View style={styles.cardTop}>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.exerciseName,
                    entry.completed && styles.exerciseNameDone,
                  ]}
                >
                  {getExerciseName(entry.exercise)}
                </Text>
                <Text style={styles.exerciseDetail}>
                  {entry.sets}×{entry.reps} · {entry.rest}s rest
                </Text>
              </View>
              {entry.completed && (
                <View style={styles.checkBadge}>
                  <Text style={styles.checkText}>✓</Text>
                </View>
              )}
            </View>

            {!entry.completed && (
              <View style={styles.completeRow}>
                <View style={styles.timeInputWrapper}>
                  <TextInput
                    style={styles.timeInput}
                    placeholder="Time (s)"
                    placeholderTextColor="#666"
                    keyboardType="numeric"
                    value={timeInputs[index] || ""}
                    onChangeText={(v) =>
                      setTimeInputs({ ...timeInputs, [index]: v })
                    }
                  />
                </View>
                <TouchableOpacity
                  style={[
                    styles.completeBtn,
                    updating === index && { opacity: 0.6 },
                  ]}
                  onPress={() => handleComplete(index)}
                  disabled={updating === index}
                >
                  <Text style={styles.completeBtnText}>
                    {updating === index ? "..." : "Done"}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {entry.completed && entry.timeTaken != null && (
              <Text style={styles.timeTakenText}>
                Completed in {entry.timeTaken}s
              </Text>
            )}
          </View>
        ))}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* End Session Button */}
      <TouchableOpacity
        style={[styles.endBtn, ending && { opacity: 0.6 }]}
        onPress={handleEndSession}
        disabled={ending}
      >
        <Text style={styles.endBtnText}>
          {ending ? "Ending..." : "End Session"}
        </Text>
      </TouchableOpacity>
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
    marginBottom: 16,
  },
  emptyText: {
    color: "#666",
    fontSize: 16,
    textAlign: "center",
    marginTop: 20,
  },
  goBackBtn: {
    backgroundColor: "#39d2b4",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 30,
  },
  goBackBtnText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "700",
  },

  // Progress
  progressHeader: {
    marginBottom: 20,
  },
  progressBar: {
    height: 6,
    backgroundColor: "#2a2a2a",
    borderRadius: 3,
    marginBottom: 8,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#39d2b4",
    borderRadius: 3,
  },
  progressText: {
    color: "#999",
    fontSize: 14,
  },
  elapsedText: {
    color: "#666",
    fontSize: 13,
    marginTop: 2,
  },

  list: {
    flex: 1,
  },
  card: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardCompleted: {
    borderLeftWidth: 3,
    borderLeftColor: "#39d2b4",
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  exerciseName: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
  },
  exerciseNameDone: {
    color: "#888",
  },
  exerciseDetail: {
    color: "#999",
    fontSize: 14,
    marginTop: 2,
  },
  checkBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#39d2b4",
    alignItems: "center",
    justifyContent: "center",
  },
  checkText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "700",
  },

  completeRow: {
    flexDirection: "row",
    marginTop: 14,
    gap: 10,
    alignItems: "center",
  },
  timeInputWrapper: {
    flex: 1,
  },
  timeInput: {
    backgroundColor: "#2a2a2a",
    color: "#fff",
    fontSize: 15,
    padding: 10,
    borderRadius: 8,
  },
  completeBtn: {
    backgroundColor: "#39d2b4",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  completeBtnText: {
    color: "#000",
    fontSize: 15,
    fontWeight: "700",
  },
  timeTakenText: {
    color: "#666",
    fontSize: 13,
    marginTop: 8,
  },

  endBtn: {
    position: "absolute",
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: "#ff4444",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  endBtnText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
});
