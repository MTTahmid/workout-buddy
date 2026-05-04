import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/auth";
import { API_BASE_URL } from "@/constants/api";

// ─── types ────────────────────────────────────────────────────────────────────

type WeekProgress = {
  weekStartDate: string;
  weekEndDate: string;
  occurrenceCount: number;
  targetCount: number;
  status: "green" | "red";
  met: boolean;
};

type Habit = {
  habitId: string;
  name: string;
  category: "good" | "bad";
  source: string;
  goalType: "do" | "avoid";
  targetCount: number;
  isActive: boolean;
  weeklyProgress: WeekProgress[];
};

type Week = {
  weekStartDate: string;
  weekEndDate: string;
  weekKey: string;
};

type HabitData = {
  weeks: Week[];
  goodHabits: Habit[];
  badHabits: Habit[];
};

type Library = {
  good: string[];
  bad: string[];
};

// ─── helpers ──────────────────────────────────────────────────────────────────

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"]; // Mon=0 … Sun=6

function todayIndex() {
  const d = new Date().getDay(); // JS: 0=Sun … 6=Sat
  return d === 0 ? 6 : d - 1;   // convert to Mon=0 … Sun=6
}

function weekDots(habit: Habit) {
  const today = todayIndex();
  const current = habit.weeklyProgress[habit.weeklyProgress.length - 1];
  const logged = current?.occurrenceCount ?? 0;

  return DAY_LABELS.map((label, i) => {
    const isFuture = i > today;
    const isLogged = i < logged; // fill from Monday up to logged count
    const isPast = i < today;

    let color = "#2a2a2a";
    if (!isFuture) {
      color = isLogged ? "#39d2b4" : isPast ? "#e05555" : "#2a2a2a";
    }

    return { label, color, isToday: i === today };
  });
}

// ─── habit row ────────────────────────────────────────────────────────────────

function HabitRow({
  habit,
  onLog,
  onDeletePress,
  onDeleteConfirm,
  onDeleteCancel,
  confirmingDelete,
  logging,
}: {
  habit: Habit;
  onLog: (id: string) => void;
  onDeletePress: (id: string) => void;
  onDeleteConfirm: (id: string) => void;
  onDeleteCancel: () => void;
  confirmingDelete: boolean;
  logging: boolean;
}) {
  const isGood = habit.category === "good";
  const accentColor = isGood ? "#39d2b4" : "#e07a55";

  return (
    <View style={[styles.habitRow, confirmingDelete && styles.habitRowConfirming]}>
      <View style={styles.habitLeft}>
        <Text style={styles.habitName} numberOfLines={2}>
          {habit.name}
        </Text>
        <View style={styles.dotsRow}>
          {weekDots(habit).map(({ label, color, isToday }, i) => (
            <View key={i} style={styles.dotCol}>
              <View
                style={[
                  styles.dot,
                  { backgroundColor: color },
                  isToday && styles.dotCurrent,
                  isToday && { borderColor: accentColor },
                ]}
              />
              <Text style={[styles.dotLabel, isToday && { color: accentColor }]}>
                {label}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {confirmingDelete ? (
        <View style={styles.confirmRow}>
          <TouchableOpacity style={styles.cancelBtn} onPress={onDeleteCancel}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.confirmBtn}
            onPress={() => onDeleteConfirm(habit.habitId)}
          >
            <Text style={styles.confirmBtnText}>Delete</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.habitActions}>
          <TouchableOpacity
            style={[styles.logBtn, { borderColor: accentColor }, logging && styles.logBtnDisabled]}
            onPress={() => onLog(habit.habitId)}
            disabled={logging}
          >
            {logging ? (
              <ActivityIndicator size="small" color={accentColor} />
            ) : (
              <>
                <Text style={[styles.logBtnText, { color: accentColor }]}>
                  {isGood ? "✓" : "✗"}
                </Text>
                <Text style={[styles.logBtnLabel, { color: accentColor }]}>
                  {isGood ? "Done" : "Slipped"}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => onDeletePress(habit.habitId)}
          >
            <Text style={styles.deleteBtnText}>🗑</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── main screen ──────────────────────────────────────────────────────────────

export default function HabitsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id ?? "";

  const [data, setData] = useState<HabitData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingId, setLoggingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [library, setLibrary] = useState<Library | null>(null);
  const [tab, setTab] = useState<"library" | "custom">("library");
  const [addCategory, setAddCategory] = useState<"good" | "bad">("good");
  const [selectedLibraryName, setSelectedLibraryName] = useState<string | null>(null);
  const [customName, setCustomName] = useState("");
  const [targetCount, setTargetCount] = useState("1");
  const [adding, setAdding] = useState(false);

  const fetchHabits = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/user/${userId}/habits`);
      if (!res.ok) return;
      const json = await res.json();
      setData(json);
    } catch {}
  }, [userId]);

  useEffect(() => {
    fetchHabits().finally(() => setLoading(false));
  }, [fetchHabits]);

  const openModal = async () => {
    setTab("library");
    setAddCategory("good");
    setSelectedLibraryName(null);
    setCustomName("");
    setTargetCount("1");
    setModalVisible(true);
    if (!library) {
      try {
        const res = await fetch(`${API_BASE_URL}/user/habits/library`);
        if (res.ok) setLibrary(await res.json());
      } catch {}
    }
  };

  const handleAdd = async () => {
    const name = tab === "library" ? selectedLibraryName : customName.trim();
    if (!name) {
      Alert.alert("Missing name", "Please choose or enter a habit name.");
      return;
    }
    const goalType = addCategory === "bad" ? "avoid" : "do";
    const count = addCategory === "bad" ? 0 : Math.max(1, parseInt(targetCount) || 1);
    setAdding(true);
    try {
      const res = await fetch(`${API_BASE_URL}/user/${userId}/habits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          category: addCategory,
          goalType,
          targetCount: count,
          source: tab === "library" ? "predefined" : "custom",
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        Alert.alert("Failed", err?.message || "Could not create habit.");
        return;
      }
      setModalVisible(false);
      await fetchHabits();
    } catch {
      Alert.alert("Error", "Could not connect to server.");
    } finally {
      setAdding(false);
    }
  };

  const handleLog = async (habitId: string) => {
    setLoggingId(habitId);
    try {
      await fetch(`${API_BASE_URL}/user/${userId}/habits/${habitId}/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      await fetchHabits();
    } catch {}
    setLoggingId(null);
  };

  const handleDeletePress = (habitId: string) => {
    setConfirmDeleteId(habitId);
  };

  const handleDeleteConfirm = async (habitId: string) => {
    setConfirmDeleteId(null);
    try {
      await fetch(`${API_BASE_URL}/user/${userId}/habits/${habitId}`, {
        method: "DELETE",
      });
      await fetchHabits();
    } catch {}
  };

  const librarySuggestions =
    library?.[addCategory === "good" ? "good" : "bad"] ?? [];

  return (
    <View style={styles.root}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Habit Tracker</Text>
        <TouchableOpacity style={styles.addHeaderBtn} onPress={openModal}>
          <Text style={styles.addHeaderBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#39d2b4" size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* GOOD HABITS */}
          <SectionHeader label="Good Habits" color="#39d2b4" icon="✅" />
          {data?.goodHabits.length === 0 ? (
            <EmptySection label="No good habits yet. Add one!" />
          ) : (
            data?.goodHabits.map((h) => (
              <HabitRow
                key={h.habitId}
                habit={h}
onLog={handleLog}
                onDeletePress={handleDeletePress}
                onDeleteConfirm={handleDeleteConfirm}
                onDeleteCancel={() => setConfirmDeleteId(null)}
                confirmingDelete={confirmDeleteId === h.habitId}
                logging={loggingId === h.habitId}
              />
            ))
          )}

          {/* BAD HABITS */}
          <SectionHeader label="Bad Habits" color="#e07a55" icon="🚫" />
          {data?.badHabits.length === 0 ? (
            <EmptySection label="No bad habits tracked yet. Add one!" />
          ) : (
            data?.badHabits.map((h) => (
              <HabitRow
                key={h.habitId}
                habit={h}
onLog={handleLog}
                onDeletePress={handleDeletePress}
                onDeleteConfirm={handleDeleteConfirm}
                onDeleteCancel={() => setConfirmDeleteId(null)}
                confirmingDelete={confirmDeleteId === h.habitId}
                logging={loggingId === h.habitId}
              />
            ))
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* ADD HABIT MODAL */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setModalVisible(false)}
          />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Add a Habit</Text>

            {/* CATEGORY TOGGLE */}
            <View style={styles.toggleRow}>
              {(["good", "bad"] as const).map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.toggleOption,
                    addCategory === cat && {
                      backgroundColor: cat === "good" ? "#39d2b4" : "#e07a55",
                    },
                  ]}
                  onPress={() => {
                    setAddCategory(cat);
                    setSelectedLibraryName(null);
                  }}
                >
                  <Text
                    style={[
                      styles.toggleOptionText,
                      addCategory === cat && styles.toggleOptionTextActive,
                    ]}
                  >
                    {cat === "good" ? "✅ Good" : "🚫 Bad"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* LIBRARY / CUSTOM TABS */}
            <View style={styles.tabRow}>
              {(["library", "custom"] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.tab, tab === t && styles.tabActive]}
                  onPress={() => {
                    setTab(t);
                    setSelectedLibraryName(null);
                    setCustomName("");
                  }}
                >
                  <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                    {t === "library" ? "From Library" : "Custom"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {tab === "library" ? (
              <ScrollView style={styles.libraryList} showsVerticalScrollIndicator={false}>
                {librarySuggestions.length === 0 ? (
                  <ActivityIndicator color="#39d2b4" style={{ marginTop: 20 }} />
                ) : (
                  librarySuggestions.map((item) => (
                    <TouchableOpacity
                      key={item}
                      style={[
                        styles.libraryItem,
                        selectedLibraryName === item && styles.libraryItemSelected,
                      ]}
                      onPress={() => setSelectedLibraryName(item)}
                    >
                      <Text
                        style={[
                          styles.libraryItemText,
                          selectedLibraryName === item && styles.libraryItemTextSelected,
                        ]}
                      >
                        {item}
                      </Text>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            ) : (
              <View style={styles.customInputArea}>
                <TextInput
                  style={styles.customInput}
                  placeholder="Habit name..."
                  placeholderTextColor="#555"
                  value={customName}
                  onChangeText={setCustomName}
                  autoFocus
                />
                {addCategory === "good" && (
                  <View style={styles.targetRow}>
                    <Text style={styles.targetLabel}>Times per week</Text>
                    <View style={styles.targetStepper}>
                      <TouchableOpacity
                        style={styles.stepperBtn}
                        onPress={() =>
                          setTargetCount((v) => String(Math.max(1, parseInt(v) - 1)))
                        }
                      >
                        <Text style={styles.stepperBtnText}>−</Text>
                      </TouchableOpacity>
                      <Text style={styles.stepperValue}>{targetCount}</Text>
                      <TouchableOpacity
                        style={styles.stepperBtn}
                        onPress={() =>
                          setTargetCount((v) => String(Math.min(7, parseInt(v) + 1)))
                        }
                      >
                        <Text style={styles.stepperBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            )}

            <TouchableOpacity
              style={[styles.addBtn, adding && { opacity: 0.6 }]}
              onPress={handleAdd}
              disabled={adding}
            >
              {adding ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.addBtnText}>Add Habit</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─── sub-components ──────────────────────────────────────────────────────────

function SectionHeader({ label, color, icon }: { label: string; color: string; icon: string }) {
  return (
    <View style={[styles.sectionHeader, { borderLeftColor: color }]}>
      <Text style={styles.sectionIcon}>{icon}</Text>
      <Text style={[styles.sectionLabel, { color }]}>{label}</Text>
    </View>
  );
}

function EmptySection({ label }: { label: string }) {
  return (
    <View style={styles.emptySection}>
      <Text style={styles.emptySectionText}>{label}</Text>
    </View>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────

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
  },
  backBtn: {
    width: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  backArrow: {
    color: "#39d2b4",
    fontSize: 32,
    lineHeight: 36,
  },
  headerTitle: {
    flex: 1,
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  addHeaderBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#39d2b4",
  },
  addHeaderBtnText: {
    color: "#39d2b4",
    fontSize: 14,
    fontWeight: "600",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    borderLeftWidth: 3,
    paddingLeft: 10,
    marginTop: 20,
    marginBottom: 10,
    gap: 8,
  },
  sectionIcon: {
    fontSize: 16,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: "700",
  },
  emptySection: {
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  emptySectionText: {
    color: "#444",
    fontSize: 14,
    fontStyle: "italic",
  },
  habitRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#1e1e1e",
    gap: 8,
  },
  habitLeft: {
    flex: 1,
    gap: 8,
  },
  habitName: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
  },
  dotsRow: {
    flexDirection: "row",
    gap: 5,
  },
  dotCol: {
    alignItems: "center",
    gap: 3,
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  dotCurrent: {
    borderWidth: 2,
  },
  dotLabel: {
    color: "#555",
    fontSize: 9,
    fontWeight: "600",
  },
  habitActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  logBtn: {
    minWidth: 52,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
  },
  logBtnDisabled: {
    opacity: 0.5,
  },
  logBtnText: {
    fontSize: 14,
    fontWeight: "700",
  },
  logBtnLabel: {
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  deleteBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteBtnText: {
    fontSize: 14,
  },
  habitRowConfirming: {
    borderColor: "#e05555",
  },
  confirmRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#2a2a2a",
  },
  cancelBtnText: {
    color: "#aaa",
    fontSize: 13,
    fontWeight: "600",
  },
  confirmBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#e05555",
  },
  confirmBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },

  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  modalSheet: {
    backgroundColor: "#111",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
    maxHeight: "80%",
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#333",
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 16,
  },
  modalTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 16,
  },
  toggleRow: {
    flexDirection: "row",
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  toggleOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  toggleOptionText: {
    color: "#777",
    fontWeight: "600",
    fontSize: 14,
  },
  toggleOptionTextActive: {
    color: "#000",
  },
  tabRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#222",
    marginBottom: 14,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: "#39d2b4",
  },
  tabText: {
    color: "#555",
    fontSize: 14,
    fontWeight: "600",
  },
  tabTextActive: {
    color: "#39d2b4",
  },
  libraryList: {
    maxHeight: 220,
    marginBottom: 16,
  },
  libraryItem: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 6,
    backgroundColor: "#1a1a1a",
  },
  libraryItemSelected: {
    backgroundColor: "rgba(57,210,180,0.15)",
    borderWidth: 1,
    borderColor: "#39d2b4",
  },
  libraryItemText: {
    color: "#aaa",
    fontSize: 14,
  },
  libraryItemTextSelected: {
    color: "#39d2b4",
    fontWeight: "600",
  },
  customInputArea: {
    marginBottom: 16,
  },
  customInput: {
    backgroundColor: "#1a1a1a",
    borderWidth: 1,
    borderColor: "#2a2a2a",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: "#fff",
    fontSize: 15,
    marginBottom: 14,
  },
  targetRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  targetLabel: {
    color: "#aaa",
    fontSize: 14,
  },
  targetStepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  stepperBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#2a2a2a",
    alignItems: "center",
    justifyContent: "center",
  },
  stepperBtnText: {
    color: "#fff",
    fontSize: 20,
    lineHeight: 22,
  },
  stepperValue: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    minWidth: 24,
    textAlign: "center",
  },
  addBtn: {
    backgroundColor: "#39d2b4",
    paddingVertical: 16,
    borderRadius: 50,
    alignItems: "center",
  },
  addBtnText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "700",
  },
});
