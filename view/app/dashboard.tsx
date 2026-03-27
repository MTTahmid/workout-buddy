import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { USER_ID } from "@/constants/user";
import SideDrawer from "./SideDrawer";

const { width } = Dimensions.get("window");

export default function Dashboard() {
  const params = useLocalSearchParams();
  const userId = (params.id as string) || USER_ID;
  const [drawerOpen, setDrawerOpen] = useState(false);

  const days = ["F", "S", "S", "M", "T", "W", "T"];
  const userWorkouts = 0;
  const partnerWorkouts = 0;
  const goalWorkouts = 3;
  const partnerName = "Rakil";

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setDrawerOpen(true)}>
            <Text style={styles.menu}>≡</Text>
          </TouchableOpacity>

          <View style={styles.badge}>
            <Text style={styles.badgeText}>🔥 Both hit goal = streak!</Text>
          </View>
        </View>

        {/* WIN THE WEEK EARLY CARD */}
        <View style={styles.winCard}>
          <View style={styles.dumbellContainer}>
            <Text style={styles.dumbell}>🏋️</Text>
          </View>
          <TouchableOpacity style={styles.startButton}>
            <Text style={styles.startButtonText}>START STRONG</Text>
          </TouchableOpacity>
          <Text style={styles.winTitle}>Win the week early</Text>
          <Text style={styles.winSubtitle}>Set the tone before {partnerName} does</Text>
        </View>

        {/* THIS WEEK */}
        <View style={styles.weekCard}>
          <View style={styles.weekHeader}>
            <Text style={styles.sectionTitle}>This Week</Text>
            <Text style={styles.daysLeft}>⏱️ 7 days left</Text>
          </View>
          <Text style={styles.dateRange}>3/27 – 4/3</Text>

          {/* WEEK ROWS */}
          <View style={styles.weekContent}>
            {/* Left Column - User */}
            <View style={styles.weekColumn}>
              <View style={styles.personHeaderRow}>
                <Text style={styles.personLabel}>x</Text>
                <View style={styles.personCountBadge}>
                  <Text style={styles.personCount}>{userWorkouts}/{goalWorkouts}</Text>
                </View>
              </View>
              <View style={styles.dayGrid}>
                {days.map((day, i) => (
                  <View
                    key={i}
                    style={[
                      styles.dayCircleSmall,
                      i === 0 && styles.dayCircleActive,
                    ]}
                  >
                    <Text style={styles.dayTextSmall}>{day}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Right Column - Partner */}
            <View style={styles.weekColumn}>
              <View style={styles.personHeaderRow}>
                <Text style={styles.personLabel}>{partnerName}</Text>
                <View style={styles.personCountBadge}>
                  <Text style={styles.personCount}>{partnerWorkouts}/{goalWorkouts}</Text>
                </View>
              </View>
              <View style={styles.dayGrid}>
                {days.map((day, i) => (
                  <View
                    key={i}
                    style={[
                      styles.dayCircleSmall,
                      i === 0 && styles.dayCircleOutline,
                    ]}
                  >
                    <Text style={styles.dayTextSmall}>{day}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* THE STAKES */}
        <View style={styles.stakesCard}>
          <View style={styles.stakesHeader}>
            <Text style={styles.sectionTitle}>The Stakes 🎯</Text>
            <Text style={styles.infoIcon}>ℹ️</Text>
          </View>
          <Text style={styles.stakesValue}>1 Dinner</Text>
          <Text style={styles.stakesSubtext}>You need {goalWorkouts - userWorkouts} more workouts this week</Text>
        </View>
      </ScrollView>

      {/* LOG WORKOUT BUTTON */}
      <View style={styles.logButtonContainer}>
        <TouchableOpacity style={styles.logButton}>
          <Text style={styles.logButtonText}>📷 Log today's workout</Text>
        </TouchableOpacity>
      </View>

      {/* DRAWER */}
      <SideDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    paddingHorizontal: 20,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 60,
    marginBottom: 25,
  },

  menu: {
    color: "#fff",
    fontSize: 24,
  },

  badge: {
    backgroundColor: "rgba(57, 210, 180, 0.15)",
    borderWidth: 1,
    borderColor: "#39d2b4",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },

  badgeText: {
    color: "#39d2b4",
    fontSize: 13,
    fontWeight: "500",
  },

  winCard: {
    backgroundColor: "#1a1a1a",
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 25,
    padding: 30,
    alignItems: "center",
    marginBottom: 25,
  },

  dumbellContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(57, 210, 180, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(57, 210, 180, 0.3)",
    marginBottom: 20,
  },

  dumbell: {
    fontSize: 60,
  },

  startButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#39d2b4",
    paddingVertical: 8,
    paddingHorizontal: 24,
    borderRadius: 20,
    marginBottom: 20,
  },

  startButtonText: {
    color: "#39d2b4",
    fontSize: 12,
    fontWeight: "600",
  },

  winTitle: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 8,
    textAlign: "center",
  },

  winSubtitle: {
    color: "#888",
    fontSize: 14,
    textAlign: "center",
  },

  weekCard: {
    backgroundColor: "rgba(57, 210, 180, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(57, 210, 180, 0.25)",
    borderRadius: 25,
    padding: 20,
    marginBottom: 20,
  },

  weekHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },

  sectionTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },

  daysLeft: {
    color: "#888",
    fontSize: 12,
  },

  dateRange: {
    color: "#666",
    fontSize: 12,
    marginBottom: 15,
  },

  weekContent: {
    flexDirection: "row",
    gap: 20,
    justifyContent: "space-between",
  },

  weekColumn: {
    flex: 1,
    alignItems: "stretch",
    gap: 8,
  },

  personHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 4,
  },

  personLabel: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },

  personCountBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  personCount: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },

  dayRow: {
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
  },

  dayGrid: {
    flexDirection: "row",
    gap: 6,
    justifyContent: "flex-start",
    flexWrap: "wrap",
    maxWidth: 140,
  },

  dayCircleSmall: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#333",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#444",
  },

  dayCircleActive: {
    backgroundColor: "#39d2b4",
    borderColor: "#39d2b4",
  },

  dayCircleOutline: {
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: "#666",
  },

  dayTextSmall: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "600",
  },

  stakesCard: {
    backgroundColor: "rgba(57, 210, 180, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(57, 210, 180, 0.25)",
    borderRadius: 25,
    padding: 20,
    marginBottom: 20,
  },

  stakesHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },

  infoIcon: {
    fontSize: 16,
  },

  stakesValue: {
    color: "#39d2b4",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
  },

  stakesSubtext: {
    color: "#888",
    fontSize: 13,
  },

  logButtonContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#000",
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: "#333",
  },

  logButton: {
    backgroundColor: "#39d2b4",
    paddingVertical: 16,
    borderRadius: 50,
    alignItems: "center",
  },

  logButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});