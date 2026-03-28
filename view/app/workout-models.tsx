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
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { USER_ID } from "@/constants/user";
import { API_BASE_URL } from "@/constants/api";

type Exercise = {
  _id: string;
  title: string;
  muscleGroup: string;
  exerciseType: string;
};

type WorkoutEntry = {
  exercise: string;
  exerciseName?: string;
  sets: number;
  reps: number;
  rest: number;
};

type WorkoutModel = {
  _id: string;
  userId?: string;
  category: string;
  title: string;
  workouts: WorkoutEntry[];
};

export default function WorkoutModels() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const userId = (params.id as string) || USER_ID;

  const [tab, setTab] = useState<"all" | "custom">("all");
  const [models, setModels] = useState<WorkoutModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [exercises, setExercises] = useState<Exercise[]>([]);

  // Create form state
  const [showCreate, setShowCreate] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formWorkouts, setFormWorkouts] = useState<WorkoutEntry[]>([]);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Expanded model
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Active session check
  const [activeSession, setActiveSession] = useState<any>(null);
  const [endingSession, setEndingSession] = useState(false);

  useEffect(() => {
    fetchModels();
    fetchExercises();
    checkActiveSession();
  }, [tab]);

  const checkActiveSession = async () => {
    try {
      const res = await fetch(
        `${API_BASE_URL}/user/${userId}/active-workout-model-session/tracker`
      );
      if (res.ok) {
        const data = await res.json();
        setActiveSession(data.session || data);
      } else {
        setActiveSession(null);
      }
    } catch {
      setActiveSession(null);
    }
  };

  const handleEndActiveSession = () => {
    Alert.alert("End Session", "End your current workout session?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "End",
        style: "destructive",
        onPress: async () => {
          setEndingSession(true);
          try {
            await fetch(
              `${API_BASE_URL}/user/${userId}/active-workout-model-session/end`,
              { method: "DELETE" }
            );
            setActiveSession(null);
          } catch {
            Alert.alert("Error", "Failed to end session.");
          } finally {
            setEndingSession(false);
          }
        },
      },
    ]);
  };

  const fetchModels = async () => {
    setLoading(true);
    try {
      const url =
        tab === "custom"
          ? `${API_BASE_URL}/user/${userId}/workout-models/get`
          : `${API_BASE_URL}/user/workout-models/get`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.models || data.workoutModels || [];
        setModels(list);
      } else {
        setModels([]);
      }
    } catch {
      setModels([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchExercises = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/user/workout-models/get`);
      if (!res.ok) return;
      // We need the workouts list - fetch from a known model or use a separate endpoint
      // For now we'll try to get exercises from the models
    } catch {}

    // Also try to get all workouts (exercises) from a generic endpoint
    try {
      const res = await fetch(`${API_BASE_URL}/user/workouts`);
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.workouts || [];
        if (list.length > 0) {
          setExercises(list);
          return;
        }
      }
    } catch {}
  };

  const handleDelete = (title: string) => {
    Alert.alert("Delete Model", `Delete "${title}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const res = await fetch(
              `${API_BASE_URL}/user/${userId}/workout-models/delete`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ Title: title }),
              }
            );
            if (res.ok) {
              fetchModels();
            } else {
              const data = await res.json();
              Alert.alert("Error", data.message || "Failed to delete.");
            }
          } catch {
            Alert.alert("Error", "Something went wrong.");
          }
        },
      },
    ]);
  };

  const handleCreate = async () => {
    if (!formTitle.trim() || !formCategory.trim()) {
      Alert.alert("Error", "Title and category are required.");
      return;
    }
    if (formWorkouts.length === 0) {
      Alert.alert("Error", "Add at least one exercise.");
      return;
    }
    for (const w of formWorkouts) {
      if (!w.exercise || w.sets < 1 || w.reps < 1 || w.rest < 1) {
        Alert.alert("Error", "Fill in all exercise fields.");
        return;
      }
    }

    setSaving(true);
    try {
      const body = {
        category: formCategory.trim(),
        title: formTitle.trim(),
        workouts: formWorkouts.map((w) => ({
          exercise: w.exercise,
          sets: w.sets,
          reps: w.reps,
          rest: w.rest,
        })),
      };
      const res = await fetch(
        `${API_BASE_URL}/user/${userId}/workout-models/create`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const data = await res.json();
      if (res.ok) {
        Alert.alert("Success", "Workout model created!");
        setShowCreate(false);
        resetForm();
        setTab("custom");
        fetchModels();
      } else {
        Alert.alert("Error", data.message || "Failed to create.");
      }
    } catch {
      Alert.alert("Error", "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormTitle("");
    setFormCategory("");
    setFormWorkouts([]);
  };

  const addWorkoutRow = () => {
    setFormWorkouts([
      ...formWorkouts,
      { exercise: "", exerciseName: "", sets: 3, reps: 10, rest: 60 },
    ]);
  };

  const updateWorkoutRow = (
    index: number,
    field: keyof WorkoutEntry,
    value: any
  ) => {
    const updated = [...formWorkouts];
    (updated[index] as any)[field] = value;
    setFormWorkouts(updated);
  };

  const removeWorkoutRow = (index: number) => {
    setFormWorkouts(formWorkouts.filter((_, i) => i !== index));
  };

  const handleStartSession = async (modelId: string) => {
    try {
      const res = await fetch(
        `${API_BASE_URL}/user/${userId}/active-workout-model-session/start`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ modelId }),
        }
      );
      const data = await res.json();
      if (res.ok) {
        router.push(`/workout-session?id=${userId}`);
      } else if (data.message?.includes("already has an active session")) {
        router.push(`/workout-session?id=${userId}`);
      } else {
        Alert.alert("Error", data.message || "Failed to start session.");
      }
    } catch (err) {
      console.error("Start session error:", err);
      Alert.alert("Error", "Something went wrong.");
    }
  };

  const getExerciseName = (exerciseId: string) => {
    if (!exerciseId) return "Unknown";
    const ex = exercises.find((e) => e._id === exerciseId);
    return ex?.title || exerciseId.substring(0, 8) + "...";
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={() => router.replace(`/dashboard?id=${userId}`)}
      >
        <Text style={styles.back}>←</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Workout Models</Text>

      {/* Active session banner */}
      {activeSession && (
        <View style={styles.sessionBanner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sessionBannerTitle}>Session in Progress</Text>
            <Text style={styles.sessionBannerSub}>
              {typeof activeSession.modelId === "object"
                ? activeSession.modelId.title
                : "Workout"}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.resumeBtn}
            onPress={() => router.push(`/workout-session?id=${userId}`)}
          >
            <Text style={styles.resumeBtnText}>Resume</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.endSessionBtn, endingSession && { opacity: 0.6 }]}
            onPress={handleEndActiveSession}
            disabled={endingSession}
          >
            <Text style={styles.endSessionBtnText}>End</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Tab buttons */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === "all" && styles.tabActive]}
          onPress={() => setTab("all")}
        >
          <Text
            style={[styles.tabText, tab === "all" && styles.tabTextActive]}
          >
            All Models
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === "custom" && styles.tabActive]}
          onPress={() => setTab("custom")}
        >
          <Text
            style={[
              styles.tabText,
              tab === "custom" && styles.tabTextActive,
            ]}
          >
            My Models
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator color="#39d2b4" style={{ marginTop: 40 }} />
        ) : models.length === 0 ? (
          <Text style={styles.emptyText}>
            {tab === "custom"
              ? "No custom models yet. Create one!"
              : "No workout models found."}
          </Text>
        ) : (
          models.map((model) => {
            const isExpanded = expandedId === model._id;
            return (
              <View key={model._id} style={styles.card}>
                <TouchableOpacity
                  onPress={() =>
                    setExpandedId(isExpanded ? null : model._id)
                  }
                  style={styles.cardHeader}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{model.title}</Text>
                    <Text style={styles.cardCategory}>{model.category}</Text>
                    <Text style={styles.cardCount}>
                      {model.workouts?.length || 0} exercises
                    </Text>
                  </View>
                  <Text style={styles.expandArrow}>
                    {isExpanded ? "▲" : "▼"}
                  </Text>
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.cardBody}>
                    {model.workouts?.map((w, i) => (
                      <View key={i} style={styles.exerciseRow}>
                        <Text style={styles.exerciseName}>
                          {(w as any).exercise?.title ||
                            getExerciseName(
                              typeof w.exercise === "string"
                                ? w.exercise
                                : (w.exercise as any)?._id || ""
                            )}
                        </Text>
                        <Text style={styles.exerciseDetail}>
                          {w.sets}×{w.reps} · {w.rest}s rest
                        </Text>
                      </View>
                    ))}

                    <View style={styles.cardActions}>
                      <TouchableOpacity
                        style={styles.startBtn}
                        onPress={() => handleStartSession(model._id)}
                      >
                        <Text style={styles.startBtnText}>Start Session</Text>
                      </TouchableOpacity>

                      {tab === "custom" && (
                        <TouchableOpacity
                          style={styles.deleteBtn}
                          onPress={() => handleDelete(model.title)}
                        >
                          <Text style={styles.deleteBtnText}>Delete</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                )}
              </View>
            );
          })
        )}

        {/* Spacer for create button */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Floating Create Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowCreate(true)}
      >
        <Text style={styles.fabText}>+ Create Model</Text>
      </TouchableOpacity>

      {/* Create Modal */}
      <Modal visible={showCreate} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>New Workout Model</Text>

              <Text style={styles.label}>Title</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Push Day"
                placeholderTextColor="#666"
                value={formTitle}
                onChangeText={setFormTitle}
              />

              <Text style={styles.label}>Category</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Strength, Cardio"
                placeholderTextColor="#666"
                value={formCategory}
                onChangeText={setFormCategory}
              />

              <Text style={[styles.label, { marginTop: 15 }]}>Exercises</Text>

              {formWorkouts.map((w, index) => (
                <View key={index} style={styles.exerciseForm}>
                  <TouchableOpacity
                    style={styles.exercisePickerBtn}
                    onPress={() => {
                      setPickerIndex(index);
                      setShowExercisePicker(true);
                    }}
                  >
                    <Text style={styles.exercisePickerText}>
                      {w.exerciseName || "Select Exercise ▼"}
                    </Text>
                  </TouchableOpacity>

                  <View style={styles.exerciseInputRow}>
                    <View style={styles.exerciseInputGroup}>
                      <Text style={styles.exerciseInputLabel}>Sets</Text>
                      <TextInput
                        style={styles.exerciseInput}
                        keyboardType="numeric"
                        value={String(w.sets)}
                        onChangeText={(v) =>
                          updateWorkoutRow(index, "sets", parseInt(v) || 0)
                        }
                      />
                    </View>
                    <View style={styles.exerciseInputGroup}>
                      <Text style={styles.exerciseInputLabel}>Reps</Text>
                      <TextInput
                        style={styles.exerciseInput}
                        keyboardType="numeric"
                        value={String(w.reps)}
                        onChangeText={(v) =>
                          updateWorkoutRow(index, "reps", parseInt(v) || 0)
                        }
                      />
                    </View>
                    <View style={styles.exerciseInputGroup}>
                      <Text style={styles.exerciseInputLabel}>Rest (s)</Text>
                      <TextInput
                        style={styles.exerciseInput}
                        keyboardType="numeric"
                        value={String(w.rest)}
                        onChangeText={(v) =>
                          updateWorkoutRow(index, "rest", parseInt(v) || 0)
                        }
                      />
                    </View>
                    <TouchableOpacity
                      onPress={() => removeWorkoutRow(index)}
                      style={styles.removeBtn}
                    >
                      <Text style={styles.removeBtnText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              <TouchableOpacity
                style={styles.addExerciseBtn}
                onPress={addWorkoutRow}
              >
                <Text style={styles.addExerciseText}>+ Add Exercise</Text>
              </TouchableOpacity>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => {
                    setShowCreate(false);
                    resetForm();
                  }}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                  onPress={handleCreate}
                  disabled={saving}
                >
                  <Text style={styles.saveBtnText}>
                    {saving ? "Saving..." : "Create"}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Exercise Picker Modal */}
      <Modal visible={showExercisePicker} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.pickerBox}>
            <Text style={styles.modalTitle}>Select Exercise</Text>
            <ScrollView style={{ maxHeight: 400 }}>
              {exercises.length === 0 ? (
                <Text style={styles.emptyText}>
                  No exercises available.
                </Text>
              ) : (
                exercises.map((ex) => (
                  <TouchableOpacity
                    key={ex._id}
                    style={styles.pickerItem}
                    onPress={() => {
                      if (pickerIndex !== null) {
                        updateWorkoutRow(pickerIndex, "exercise", ex._id);
                        updateWorkoutRow(
                          pickerIndex,
                          "exerciseName",
                          ex.title
                        );
                      }
                      setShowExercisePicker(false);
                      setPickerIndex(null);
                    }}
                  >
                    <Text style={styles.pickerItemTitle}>{ex.title}</Text>
                    <Text style={styles.pickerItemSub}>
                      {ex.muscleGroup} · {ex.exerciseType}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => {
                setShowExercisePicker(false);
                setPickerIndex(null);
              }}
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
  tabRow: {
    flexDirection: "row",
    marginBottom: 20,
    gap: 10,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#1a1a1a",
    alignItems: "center",
  },
  tabActive: {
    backgroundColor: "#39d2b4",
  },
  sessionBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a2e28",
    borderWidth: 1,
    borderColor: "#39d2b4",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    gap: 10,
  },
  sessionBannerTitle: {
    color: "#39d2b4",
    fontSize: 14,
    fontWeight: "700",
  },
  sessionBannerSub: {
    color: "#999",
    fontSize: 13,
    marginTop: 2,
  },
  resumeBtn: {
    backgroundColor: "#39d2b4",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  resumeBtnText: {
    color: "#000",
    fontSize: 14,
    fontWeight: "700",
  },
  endSessionBtn: {
    backgroundColor: "#ff4444",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  endSessionBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  tabText: {
    color: "#999",
    fontSize: 16,
    fontWeight: "600",
  },
  tabTextActive: {
    color: "#000",
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
  card: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    marginBottom: 12,
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  cardTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  cardCategory: {
    color: "#39d2b4",
    fontSize: 14,
    marginTop: 2,
  },
  cardCount: {
    color: "#888",
    fontSize: 13,
    marginTop: 2,
  },
  expandArrow: {
    color: "#666",
    fontSize: 14,
  },
  cardBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: "#2a2a2a",
  },
  exerciseRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#222",
  },
  exerciseName: {
    color: "#fff",
    fontSize: 15,
    flex: 1,
  },
  exerciseDetail: {
    color: "#999",
    fontSize: 14,
  },
  cardActions: {
    flexDirection: "row",
    marginTop: 14,
    gap: 10,
  },
  startBtn: {
    flex: 1,
    backgroundColor: "#39d2b4",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  startBtnText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "700",
  },
  deleteBtn: {
    backgroundColor: "#ff4444",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
  },
  deleteBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
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
    maxHeight: "85%",
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
  exerciseForm: {
    backgroundColor: "#222",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  exercisePickerBtn: {
    backgroundColor: "#333",
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  exercisePickerText: {
    color: "#ccc",
    fontSize: 15,
  },
  exerciseInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  exerciseInputGroup: {
    flex: 1,
  },
  exerciseInputLabel: {
    color: "#888",
    fontSize: 11,
    marginBottom: 4,
  },
  exerciseInput: {
    backgroundColor: "#333",
    color: "#fff",
    fontSize: 15,
    padding: 8,
    borderRadius: 6,
    textAlign: "center",
  },
  removeBtn: {
    padding: 8,
  },
  removeBtnText: {
    color: "#ff4444",
    fontSize: 18,
  },
  addExerciseBtn: {
    borderWidth: 1,
    borderColor: "#39d2b4",
    borderStyle: "dashed",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
    marginTop: 4,
    marginBottom: 20,
  },
  addExerciseText: {
    color: "#39d2b4",
    fontSize: 15,
    fontWeight: "600",
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#444",
    alignItems: "center",
    marginTop: 10,
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

  // Picker
  pickerBox: {
    backgroundColor: "#1a1a1a",
    borderRadius: 16,
    padding: 24,
    maxHeight: "70%",
  },
  pickerItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a2a",
  },
  pickerItemTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  pickerItemSub: {
    color: "#888",
    fontSize: 13,
    marginTop: 2,
  },
});
