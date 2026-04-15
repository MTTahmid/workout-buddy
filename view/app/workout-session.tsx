import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
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

function findFirstIncomplete(progress: ProgressEntry[], startIndex = 0) {
  for (let index = startIndex; index < progress.length; index += 1) {
    if (!progress[index]?.completed) {
      return index;
    }
  }

  return -1;
}

function formatSeconds(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function WorkoutSession() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const userId = (params.id as string) || USER_ID;

  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingIndex, setUpdatingIndex] = useState<number | null>(null);
  const [ending, setEnding] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [exerciseElapsed, setExerciseElapsed] = useState(0);
  const [exerciseStartAt, setExerciseStartAt] = useState<number | null>(null);
  const [isResting, setIsResting] = useState(false);
  const [restRemaining, setRestRemaining] = useState(0);
  const [pendingNextIndex, setPendingNextIndex] = useState<number | null>(null);

  useEffect(() => {
    fetchSession();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (isResting) {
        setRestRemaining((previous) => {
          if (previous <= 1) {
            setIsResting(false);

            if (
              pendingNextIndex !== null
              && session
              && pendingNextIndex >= 0
              && pendingNextIndex < session.progress.length
            ) {
              setActiveIndex(pendingNextIndex);
              setExerciseElapsed(0);
              setExerciseStartAt(Date.now());
            } else {
              setActiveIndex(-1);
              setExerciseElapsed(0);
              setExerciseStartAt(null);
            }

            setPendingNextIndex(null);
            return 0;
          }

          return previous - 1;
        });

        return;
      }

      if (activeIndex >= 0 && exerciseStartAt) {
        const elapsedSeconds = Math.max(1, Math.floor((Date.now() - exerciseStartAt) / 1000));
        setExerciseElapsed(elapsedSeconds);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activeIndex, exerciseStartAt, isResting, pendingNextIndex, session]);

  const fetchSession = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/user/${userId}/active-workout-model-session/tracker`
      );
      if (res.ok) {
        const data = await res.json();
        const s = data.session || data;
        setSession(s);

        if (Array.isArray(s?.progress)) {
          const firstIncomplete = findFirstIncomplete(s.progress);
          setActiveIndex(firstIncomplete);
          setIsResting(false);
          setRestRemaining(0);
          setPendingNextIndex(null);

          if (firstIncomplete >= 0) {
            setExerciseElapsed(0);
            setExerciseStartAt(Date.now());
          } else {
            setExerciseElapsed(0);
            setExerciseStartAt(null);
          }
        }
      } else {
        setSession(null);
        setActiveIndex(-1);
      }
    } catch {
      setSession(null);
      setActiveIndex(-1);
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

  const completeCurrentExercise = async () => {
    if (!session || isResting || activeIndex < 0) {
      return;
    }

    const entry = session.progress[activeIndex];
    if (!entry || entry.completed) {
      return;
    }

    const timeTaken = Math.max(1, exerciseElapsed);

    setUpdatingIndex(activeIndex);
    try {
      const res = await fetch(
        `${API_BASE_URL}/user/${userId}/active-workout-model-session/update`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            exerciseId: getExerciseId(entry.exercise),
            progressIndex: activeIndex,
            timeTaken,
          }),
        }
      );
      if (res.ok) {
        const updatedProgress = session.progress.map((progressEntry, index) => (
          index === activeIndex
            ? { ...progressEntry, completed: true, timeTaken }
            : progressEntry
        ));

        setSession({ ...session, progress: updatedProgress });

        const nextIndex = findFirstIncomplete(updatedProgress, activeIndex + 1);
        if (nextIndex === -1) {
          setActiveIndex(-1);
          setExerciseStartAt(null);
          setExerciseElapsed(0);
          setPendingNextIndex(null);
          setIsResting(false);
          setRestRemaining(0);
        } else {
          const restSeconds = Math.max(0, Number(entry.rest) || 0);
          if (restSeconds > 0) {
            setIsResting(true);
            setRestRemaining(restSeconds);
            setPendingNextIndex(nextIndex);
            setExerciseStartAt(null);
            setExerciseElapsed(0);
          } else {
            setActiveIndex(nextIndex);
            setExerciseStartAt(Date.now());
            setExerciseElapsed(0);
          }
        }
      } else {
        const data = await res.json();
        Alert.alert("Error", data.message || "Failed to update.");
      }
    } catch {
      Alert.alert("Error", "Something went wrong.");
    } finally {
      setUpdatingIndex(null);
    }
  };

  const performEndSession = async () => {
    const sessionId = session?._id;
    if (!sessionId) {
      router.replace(`/workout-models?id=${userId}`);
      return;
    }

    setEnding(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/user/${userId}/active-workout-model-session/end/${sessionId}`,
        { method: "DELETE" }
      );
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        router.replace(`/workout-models?id=${userId}`);
      } else {
        const message = data?.message || "Failed to end session.";
        const alreadyEnded = res.status === 404 && /session not found/i.test(message);

        if (alreadyEnded) {
          router.replace(`/workout-models?id=${userId}`);
          return;
        }

        Alert.alert("Error", message);
      }
    } catch {
      Alert.alert("Error", "Something went wrong.");
    } finally {
      setEnding(false);
    }
  };

  const handleEndSession = () => {
    void performEndSession();
  };

  const getModelName = () => {
    if (!session) return "";
    if (typeof session.modelId === "object" && session.modelId?.title)
      return session.modelId.title;
    return "Workout";
  };

  const completedCount = session?.progress?.filter((p) => p.completed).length || 0;
  const totalCount = session?.progress?.length || 0;
  const currentEntry =
    session && activeIndex >= 0 && activeIndex < session.progress.length
      ? session.progress[activeIndex]
      : null;
  const upcomingIndex = pendingNextIndex ?? (session ? findFirstIncomplete(session.progress, activeIndex + 1) : -1);
  const upcomingEntry =
    session && upcomingIndex >= 0 && upcomingIndex < session.progress.length
      ? session.progress[upcomingIndex]
      : null;

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
        {completedCount === totalCount ? (
          <View style={styles.currentCard}>
            <Text style={styles.currentLabel}>Session Complete</Text>
            <Text style={styles.currentExercise}>All exercises are done.</Text>
            <Text style={styles.currentMeta}>Tap End Session to save it.</Text>
          </View>
        ) : isResting ? (
          <View style={styles.currentCard}>
            <Text style={styles.currentLabel}>Rest Interval</Text>
            <Text style={styles.restCountdown}>{formatSeconds(restRemaining)}</Text>
            <Text style={styles.currentMeta}>Next exercise starts automatically.</Text>
            {upcomingEntry && (
              <View style={styles.nextBlock}>
                <Text style={styles.nextTitle}>Up Next</Text>
                <Text style={styles.nextExercise}>{getExerciseName(upcomingEntry.exercise)}</Text>
                <Text style={styles.nextMeta}>
                  {upcomingEntry.sets}×{upcomingEntry.reps} · {upcomingEntry.rest}s rest
                </Text>
              </View>
            )}
          </View>
        ) : currentEntry ? (
          <View style={styles.currentCard}>
            <Text style={styles.currentLabel}>Current Exercise</Text>
            <Text style={styles.currentExercise}>{getExerciseName(currentEntry.exercise)}</Text>
            <Text style={styles.currentMeta}>
              {currentEntry.sets}×{currentEntry.reps} · {currentEntry.rest}s rest after completion
            </Text>
            <Text style={styles.exerciseTimer}>{formatSeconds(exerciseElapsed)}</Text>
            <TouchableOpacity
              style={[
                styles.completeBtn,
                updatingIndex === activeIndex && { opacity: 0.6 },
              ]}
              onPress={completeCurrentExercise}
              disabled={updatingIndex === activeIndex}
            >
              <Text style={styles.completeBtnText}>
                {updatingIndex === activeIndex ? "Saving..." : "Mark Exercise Done"}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Completed Exercises</Text>
          {session.progress.filter((entry) => entry.completed).length === 0 ? (
            <Text style={styles.emptySectionText}>No exercises completed yet.</Text>
          ) : (
            session.progress
              .filter((entry) => entry.completed)
              .map((entry, index) => (
                <View key={`${index}-${getExerciseName(entry.exercise)}`} style={styles.completedRow}>
                  <Text style={styles.completedName}>{getExerciseName(entry.exercise)}</Text>
                  <Text style={styles.completedTime}>{formatSeconds(entry.timeTaken || 0)}</Text>
                </View>
              ))
          )}
        </View>

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
  currentCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 14,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#2f2f2f",
  },
  currentLabel: {
    color: "#39d2b4",
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  currentExercise: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "700",
  },
  currentMeta: {
    color: "#9a9a9a",
    fontSize: 14,
    marginTop: 8,
  },
  exerciseTimer: {
    color: "#fff",
    fontSize: 42,
    fontWeight: "800",
    marginTop: 18,
    marginBottom: 18,
    letterSpacing: 1,
  },
  restCountdown: {
    color: "#39d2b4",
    fontSize: 48,
    fontWeight: "800",
    marginVertical: 10,
    letterSpacing: 1,
  },
  nextBlock: {
    marginTop: 16,
    paddingTop: 12,
    borderTopColor: "#2a2a2a",
    borderTopWidth: 1,
  },
  nextTitle: {
    color: "#888",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  nextExercise: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    marginTop: 4,
  },
  nextMeta: {
    color: "#999",
    fontSize: 13,
    marginTop: 2,
  },
  completeBtn: {
    backgroundColor: "#39d2b4",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: "center",
  },
  completeBtnText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "700",
  },
  sectionBlock: {
    backgroundColor: "#121212",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 10,
  },
  emptySectionText: {
    color: "#777",
    fontSize: 13,
  },
  completedRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomColor: "#242424",
    borderBottomWidth: 1,
  },
  completedName: {
    color: "#d5d5d5",
    fontSize: 14,
    flex: 1,
    paddingRight: 8,
  },
  completedTime: {
    color: "#666",
    fontSize: 13,
    fontWeight: "700",
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
