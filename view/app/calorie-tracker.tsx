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

type IntakeEntry = {
  _id?: string;
  foodName: string;
  productId?: string | null;
  grams: number;
  quantity: number;
  kcalPer100g: number;
  intakeCalories: number;
  source?: string;
  date?: string;
  createdAt?: string;
};

type FoodSuggestion = {
  productId: string | null;
  foodName: string;
  brand: string | null;
  servingSize: string | null;
  kcalPer100g: number | null;
};

type BurnEntry = {
  _id?: string;
  workout: string;
  duration: number;
  calories: number;
  date?: string;
  createdAt?: string;
};

export default function CalorieTracker() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const userId = (params.id as string) || USER_ID;

  const [history, setHistory] = useState<IntakeEntry[]>([]);
  const [burnHistory, setBurnHistory] = useState<BurnEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLog, setShowLog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchingFoods, setSearchingFoods] = useState(false);

  const [foodQuery, setFoodQuery] = useState("");
  const [foodSuggestions, setFoodSuggestions] = useState<FoodSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedFood, setSelectedFood] = useState<FoodSuggestion | null>(null);
  const [grams, setGrams] = useState("");
  const [quantity, setQuantity] = useState("1");

  useEffect(() => {
    fetchHistory();
  }, []);

  useEffect(() => {
    if (!showLog) {
      return;
    }

    const query = foodQuery.trim();
    if (query.length < 2) {
      setFoodSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchingFoods(true);
      try {
        const res = await fetch(
          `${API_BASE_URL}/user/foods/search?q=${encodeURIComponent(query)}`
        );

        if (!res.ok) {
          setFoodSuggestions([]);
          return;
        }

        const data = await res.json();
        const list = Array.isArray(data?.foods) ? data.foods : [];
        setFoodSuggestions(list);
      } catch {
        setFoodSuggestions([]);
      } finally {
        setSearchingFoods(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [foodQuery, showLog]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const [intakeRes, burnRes] = await Promise.all([
        fetch(`${API_BASE_URL}/user/${userId}/calories/intake/history`),
        fetch(`${API_BASE_URL}/user/${userId}/calories/history`),
      ]);

      if (intakeRes.ok) {
        const intakeData = await intakeRes.json();
        const intakeList = Array.isArray(intakeData) ? intakeData : intakeData.entries || [];
        setHistory(intakeList);
      } else {
        setHistory([]);
      }

      if (burnRes.ok) {
        const burnData = await burnRes.json();
        const burnList = Array.isArray(burnData) ? burnData : burnData.entries || [];
        setBurnHistory(burnList);
      } else {
        setBurnHistory([]);
      }
    } catch {
      setHistory([]);
      setBurnHistory([]);
    } finally {
      setLoading(false);
    }
  };

  const handleLog = async () => {
    const parsedGrams = parseFloat(grams);
    const parsedQuantity = parseFloat(quantity);

    if (!selectedFood?.foodName) {
      Alert.alert("Error", "Select a food from suggestions.");
      return;
    }

    if (!parsedGrams || parsedGrams <= 0) {
      Alert.alert("Error", "Enter grams greater than 0.");
      return;
    }

    if (!parsedQuantity || parsedQuantity <= 0) {
      Alert.alert("Error", "Enter quantity greater than 0.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/user/${userId}/calories/intake/log`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            foodName: selectedFood.foodName,
            productId: selectedFood.productId,
            grams: parsedGrams,
            quantity: parsedQuantity,
            kcalPer100g: selectedFood.kcalPer100g,
          }),
        }
      );
      const data = await res.json();
      if (res.ok) {
        Alert.alert("Logged", "Calorie intake entry saved!");
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
    setFoodQuery("");
    setFoodSuggestions([]);
    setShowSuggestions(false);
    setSelectedFood(null);
    setGrams("");
    setQuantity("1");
  };

  const totalCalories = history.reduce((sum, e) => sum + (e.intakeCalories || 0), 0);
  const totalBurned = burnHistory.reduce((sum, e) => sum + (e.calories || 0), 0);
  const netCalories = totalCalories - totalBurned;
  const avgCalories =
    history.length > 0 ? Math.round(totalCalories / history.length) : 0;

  const parsedPreviewGrams = parseFloat(grams);
  const parsedPreviewQty = parseFloat(quantity);
  const intakePreview =
    selectedFood?.kcalPer100g != null
    && Number.isFinite(parsedPreviewGrams)
    && parsedPreviewGrams > 0
    && Number.isFinite(parsedPreviewQty)
    && parsedPreviewQty > 0
      ? Math.round((selectedFood.kcalPer100g * parsedPreviewGrams * parsedPreviewQty) / 100)
      : null;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={() => router.replace(`/dashboard?id=${userId}`)}
      >
        <Text style={styles.back}>←</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Calorie Tracker</Text>

      <View style={styles.modeHintCard}>
        <Text style={styles.modeHintTitle}>Calorie Intake</Text>
        <Text style={styles.modeHintText}>
          Food-based intake is live now. Burned calories can be added in a later update.
        </Text>
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{history.length}</Text>
          <Text style={styles.summaryLabel}>Intake Entries</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{totalCalories}</Text>
          <Text style={styles.summaryLabel}>Intake Cal</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{totalBurned}</Text>
          <Text style={styles.summaryLabel}>Burned Cal</Text>
        </View>
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryCardWide}>
          <Text style={styles.summaryValue}>{netCalories}</Text>
          <Text style={styles.summaryLabel}>Net (Intake - Burned)</Text>
        </View>
        <View style={styles.summaryCardWide}>
          <Text style={styles.summaryValue}>{avgCalories}</Text>
          <Text style={styles.summaryLabel}>Avg Intake</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Intake History</Text>

      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator color="#39d2b4" style={{ marginTop: 40 }} />
        ) : history.length === 0 ? (
          <Text style={styles.emptyText}>No entries yet. Log your first food intake.</Text>
        ) : (
          history.map((entry, index) => (
            <View key={entry._id || index} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.cardWorkout}>{entry.foodName}</Text>
              </View>
              <View style={styles.cardStats}>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{entry.intakeCalories}</Text>
                  <Text style={styles.statLabel}>cal</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{entry.grams}</Text>
                  <Text style={styles.statLabel}>g</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{entry.quantity}</Text>
                  <Text style={styles.statLabel}>qty</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{entry.kcalPer100g}</Text>
                  <Text style={styles.statLabel}>/100g</Text>
                </View>
              </View>
              {(entry.date || entry.createdAt) && (
                <Text style={styles.cardDate}>
                  {new Date(entry.date || entry.createdAt || "").toLocaleDateString()}
                </Text>
              )}
            </View>
          ))
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => setShowLog(true)}>
        <Text style={styles.fabText}>+ Log Intake</Text>
      </TouchableOpacity>

      <Modal visible={showLog} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Log Calorie Intake</Text>

            <Text style={styles.label}>Food</Text>
            <TextInput
              style={styles.input}
              placeholder="Type food name"
              placeholderTextColor="#666"
              value={foodQuery}
              onChangeText={(value) => {
                setFoodQuery(value);
                setSelectedFood(null);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
            />

            {showSuggestions && (
              <View style={styles.suggestionBox}>
                {searchingFoods ? (
                  <Text style={styles.suggestionHint}>Searching foods...</Text>
                ) : foodSuggestions.length === 0 ? (
                  <Text style={styles.suggestionHint}>Type at least 2 letters to search.</Text>
                ) : (
                  <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
                    {foodSuggestions.map((item, idx) => (
                      <TouchableOpacity
                        key={`${item.productId || item.foodName}-${idx}`}
                        style={styles.suggestionItem}
                        onPress={() => {
                          setSelectedFood(item);
                          setFoodQuery(item.foodName);
                          setShowSuggestions(false);
                        }}
                      >
                        <Text style={styles.suggestionName}>{item.foodName}</Text>
                        <Text style={styles.suggestionMeta}>
                          {item.brand || "Unknown brand"}
                          {item.kcalPer100g != null ? ` · ${item.kcalPer100g} kcal/100g` : " · kcal unavailable"}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>
            )}

            <Text style={styles.label}>Grams (g)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 150"
              placeholderTextColor="#666"
              keyboardType="numeric"
              value={grams}
              onChangeText={setGrams}
            />

            <Text style={styles.label}>Quantity</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 1"
              placeholderTextColor="#666"
              keyboardType="numeric"
              value={quantity}
              onChangeText={setQuantity}
            />

            <View style={styles.previewBox}>
              <Text style={styles.previewTitle}>Estimated Intake</Text>
              <Text style={styles.previewValue}>
                {intakePreview != null ? `${intakePreview} kcal` : "Select food + grams + quantity"}
              </Text>
            </View>

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
                  {saving ? "Saving..." : "Log Intake"}
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
    marginBottom: 14,
  },

  modeHintCard: {
    backgroundColor: "#121212",
    borderColor: "#2d2d2d",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 18,
  },
  modeHintTitle: {
    color: "#39d2b4",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  modeHintText: {
    color: "#aaa",
    fontSize: 12,
  },

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
  summaryCardWide: {
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
  suggestionBox: {
    backgroundColor: "#0f0f0f",
    borderColor: "#2a2a2a",
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 12,
    overflow: "hidden",
  },
  suggestionHint: {
    color: "#777",
    fontSize: 13,
    padding: 12,
  },
  suggestionItem: {
    borderBottomColor: "#1f1f1f",
    borderBottomWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  suggestionName: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  suggestionMeta: {
    color: "#8c8c8c",
    fontSize: 12,
    marginTop: 2,
  },
  previewBox: {
    backgroundColor: "#101816",
    borderColor: "#1e3f38",
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  previewTitle: {
    color: "#8ecdc0",
    fontSize: 12,
    marginBottom: 4,
  },
  previewValue: {
    color: "#39d2b4",
    fontSize: 18,
    fontWeight: "700",
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
