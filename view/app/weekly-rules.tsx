import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Pressable, Alert, ActivityIndicator, TextInput, Modal } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useState, useEffect } from "react";
import { USER_ID } from "@/constants/user";

export default function WeeklyRules() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const userId = (params.id as string) || USER_ID;
  const [selectedStake, setSelectedStake] = useState("");
  const [stakes, setStakes] = useState<Array<{ id: string; label: string }>>([]);
  const [goal, setGoal] = useState(3);
  const [saving, setSaving] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customStake, setCustomStake] = useState("");
  const [addingCustom, setAddingCustom] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [stakesRes, currentRes] = await Promise.all([
          fetch(`http://localhost:5001/user/${userId}/weekly-goals/allowed-stakes`),
          fetch(`http://localhost:5001/user/${userId}/weekly-goals`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          }),
        ]);

        const stakesData = await stakesRes.json();
        const formattedStakes = (stakesData.allowedStakes || []).map((stake: string, index: number) => ({
          id: `stake-${index}`,
          label: stake,
        }));
        setStakes(formattedStakes);

        if (currentRes.ok) {
          const currentData = await currentRes.json();
          const savedGoal = currentData?.weeklyGoal?.weeklyWorkoutGoal;
          const savedStake = currentData?.weeklyGoal?.stake;

          if (Number.isInteger(savedGoal) && savedGoal >= 1 && savedGoal <= 7) {
            setGoal(savedGoal);
          }
          if (savedStake) {
            setSelectedStake(savedStake);
          } else if (formattedStakes.length > 0) {
            setSelectedStake(formattedStakes[0].label);
          }
        } else if (formattedStakes.length > 0) {
          setSelectedStake(formattedStakes[0].label);
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
      }
    };

    fetchData();
  }, [userId]);

  const handleSave = async () => {
    if (!selectedStake) {
      Alert.alert("Error", "Please select a stake.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`http://localhost:5001/user/${userId}/weekly-goals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weeklyWorkoutGoal: goal,
          stake: selectedStake,
          status: "active",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        Alert.alert("Error", data.message || "Failed to save.");
        return;
      }

      Alert.alert("Saved", data.message || "Weekly goal updated!", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error) {
      Alert.alert("Error", "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => router.replace(`/dashboard?id=${userId}`)}>
        <Text style={styles.back}>←</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Edit Rules</Text>

      <Text style={styles.sectionTitle}>Weekly workout goal</Text>

      <View style={styles.goalBox}>
        <View style={styles.goalRow}>
          <TouchableOpacity
            style={styles.goalArrow}
            onPress={() => setGoal((prev) => Math.max(1, prev - 1))}
          >
            <Text style={styles.goalArrowText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.goalHighlight}>{goal} days</Text>
          <TouchableOpacity
            style={styles.goalArrow}
            onPress={() => setGoal((prev) => Math.min(7, prev + 1))}
          >
            <Text style={styles.goalArrowText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Wager for missed workout</Text>
      <Text style={styles.sub}>
        If you win a week, your partner owes you this.
      </Text>

      <View style={styles.optionsRow}>
        {stakes.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[
              styles.option,
              selectedStake === item.label && styles.optionSelected,
            ]}
            onPress={() => setSelectedStake(item.label)}
          >
            <Text
              style={[
                styles.optionText,
                selectedStake === item.label && styles.optionTextSelected,
              ]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.createButton} onPress={() => setShowCustomInput(true)}>
        <Text style={styles.createText}>Create your own</Text>
      </TouchableOpacity>

      <Modal visible={showCustomInput} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Custom Stake</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. 1 Movie Night"
              placeholderTextColor="#666"
              value={customStake}
              onChangeText={setCustomStake}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => { setShowCustomInput(false); setCustomStake(""); }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalAdd, addingCustom && { opacity: 0.6 }]}
                disabled={addingCustom}
                onPress={async () => {
                  const trimmed = customStake.trim();
                  if (!trimmed) return;
                  setAddingCustom(true);
                  try {
                    const res = await fetch(`http://localhost:5001/user/${userId}/weekly-goals/allowed-stakes`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ stake: trimmed }),
                    });
                    const data = await res.json();
                    if (res.ok) {
                      const updatedStakes = (data.allowedStakes || []).map((s: string, i: number) => ({
                        id: `stake-${i}`,
                        label: s,
                      }));
                      setStakes(updatedStakes);
                      setSelectedStake(trimmed);
                    } else {
                      Alert.alert("Error", data.message || "Failed to add stake.");
                    }
                  } catch {
                    Alert.alert("Error", "Something went wrong.");
                  } finally {
                    setAddingCustom(false);
                    setShowCustomInput(false);
                    setCustomStake("");
                  }
                }}
              >
                {addingCustom ? (
                  <ActivityIndicator color="#000" size="small" />
                ) : (
                  <Text style={styles.modalAddText}>Add</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Pressable
        style={({ pressed }) => [
          styles.saveButton,
          pressed && styles.saveButtonPressed,
          saving && { opacity: 0.6 },
        ]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#000" />
        ) : (
          <Text style={styles.saveText}>Save</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    padding: 25,
    paddingTop: 70,
  },

  back: {
    color: "#fff",
    fontSize: 28,
    marginBottom: 10,
  },

  title: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 30,
  },

  sectionTitle: {
    color: "#aaa",
    fontSize: 18,
    marginBottom: 10,
  },

  sub: {
    color: "#666",
    marginBottom: 20,
  },

  goalBox: {
    backgroundColor: "#111",
    borderRadius: 20,
    paddingVertical: 20,
    alignItems: "center",
    marginBottom: 30,
  },

  goalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 30,
  },

  goalArrow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#222",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#444",
  },

  goalArrowText: {
    color: "#39d2b4",
    fontSize: 24,
    fontWeight: "600",
  },

  goalHighlight: {
    color: "#39d2b4",
    fontSize: 28,
    fontWeight: "600",
  },

  optionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 20,
  },

  option: {
    backgroundColor: "#1a1a1a",
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 14,
    marginBottom: 10,
  },

  optionSelected: {
    borderColor: "#39d2b4",
    borderWidth: 1,
    backgroundColor: "rgba(57,210,180,0.08)",
  },

  optionText: {
    color: "#ccc",
  },

  optionTextSelected: {
    color: "#39d2b4",
  },

  createButton: {
    borderWidth: 1,
    borderColor: "#444",
    borderStyle: "dashed",
    paddingVertical: 15,
    borderRadius: 15,
    alignItems: "center",
    marginBottom: 40,
  },

  createText: {
    color: "#aaa",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },

  modalBox: {
    backgroundColor: "#1a1a1a",
    borderRadius: 20,
    padding: 25,
    width: "85%",
    borderWidth: 1,
    borderColor: "#333",
  },

  modalTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 15,
    textAlign: "center",
  },

  modalInput: {
    backgroundColor: "#111",
    borderWidth: 1,
    borderColor: "#444",
    color: "#fff",
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 12,
    fontSize: 16,
    marginBottom: 20,
  },

  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },

  modalCancel: {
    flex: 1,
    backgroundColor: "#333",
    paddingVertical: 14,
    borderRadius: 30,
    alignItems: "center",
  },

  modalCancelText: {
    color: "#888",
    fontWeight: "600",
  },

  modalAdd: {
    flex: 1,
    backgroundColor: "#39d2b4",
    paddingVertical: 14,
    borderRadius: 30,
    alignItems: "center",
  },

  modalAddText: {
    color: "#000",
    fontWeight: "600",
  },

  saveButton: {
    backgroundColor: "#333",
    paddingVertical: 20,
    borderRadius: 40,
    alignItems: "center",
  },

  saveButtonPressed: {
    backgroundColor: "#39d2b4",
  },

  saveText: {
    color: "#888",
    fontSize: 16,
  },
});