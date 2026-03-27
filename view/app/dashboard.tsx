import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ScrollView,
  TouchableOpacity,
  Image,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { USER_ID } from "@/constants/user";
import SideDrawer from "./SideDrawer";

const { width } = Dimensions.get("window");

export default function Dashboard() {
  const params = useLocalSearchParams();
  const userId = (params.id as string) || USER_ID;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [userName, setUserName] = useState("x");
  const [buddyName, setBuddyName] = useState("Buddy");
  const [goalWorkouts, setGoalWorkouts] = useState(3);
  const [stake, setStake] = useState("1 Dinner");
  const [weeklyGoalId, setWeeklyGoalId] = useState<string | null>(null);
  const [proofPhotos, setProofPhotos] = useState<any[]>([]);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const slideWidth = width - 40;
  const [buddyId, setBuddyId] = useState<string | null>(null);
  const [userDays, setUserDays] = useState<any[]>([]);
  const [buddyDays, setBuddyDays] = useState<any[]>([]);
  const [userWorkouts, setUserWorkouts] = useState(0);
  const [partnerWorkouts, setPartnerWorkouts] = useState(0);
  const [daysLeft, setDaysLeft] = useState(7);
  const [dateRange, setDateRange] = useState("");

  const getFirstName = (name?: string) => {
    const trimmed = name?.trim();
    if (!trimmed) return "";
    return trimmed.split(/\s+/)[0];
  };

  const getTimeAgo = (dateStr: string) => {
    const now = new Date();
    const then = new Date(dateStr);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    return `${diffDays}d ago`;
  };

  useEffect(() => {
    const fetchNames = async () => {
      try {
        const [buddyResponse, usersResponse, goalsResponse] = await Promise.all([
          fetch(`http://localhost:5001/user/${userId}/buddy`),
          fetch("http://localhost:5001/user/users"),
          fetch(`http://localhost:5001/user/${userId}/weekly-goals`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          }),
        ]);

        if (!buddyResponse.ok || !usersResponse.ok) {
          throw new Error("Failed to fetch buddy info");
        }

        const buddyData = await buddyResponse.json();
        const users = await usersResponse.json();

        const currentUser = Array.isArray(users)
          ? users.find((item) => String(item?._id) === String(userId))
          : null;

        const currentUserName = getFirstName(currentUser?.name) || "x";
        const currentBuddyName = getFirstName(buddyData?.buddy?.name) || "Buddy";
        const fetchedBuddyId = buddyData?.buddy?._id || null;

        setUserName(currentUserName);
        setBuddyName(currentBuddyName);
        setBuddyId(fetchedBuddyId);

        if (goalsResponse.ok) {
          const goalsData = await goalsResponse.json();
          const savedGoal = goalsData?.weeklyGoal?.weeklyWorkoutGoal;
          const savedStake = goalsData?.weeklyGoal?.stake;
          const goalId = goalsData?.weeklyGoal?._id;
          const proofs = goalsData?.weeklyGoal?.proofs || [];
          if (Number.isInteger(savedGoal) && savedGoal >= 1) {
            setGoalWorkouts(savedGoal);
          }
          if (savedStake) {
            setStake(savedStake);
          }
          if (goalId) {
            setWeeklyGoalId(goalId);
            const sorted = [...proofs].sort(
              (a: any, b: any) => new Date(b.uploadedDate).getTime() - new Date(a.uploadedDate).getTime()
            );
            setProofPhotos(sorted);
          }
        }
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      }
    };

    fetchNames();
  }, [userId]);

  useEffect(() => {
    if (!weeklyGoalId) return;
    const fetchDetails = async () => {
      try {
        const res = await fetch(
          `http://localhost:5001/user/${userId}/weekly-goals/${weeklyGoalId}/details`
        );
        if (!res.ok) return;
        const data = await res.json();

        // User day statuses
        const uDays = data?.userStreak?.dayStatus?.days || [];
        setUserDays(uDays);
        setUserWorkouts(data?.userStreak?.daysCompleted || 0);

        // Buddy day statuses
        if (buddyId && Array.isArray(data?.participantProgress)) {
          const buddyProgress = data.participantProgress.find(
            (p: any) => String(p.userId) !== String(userId)
          );
          if (buddyProgress) {
            setBuddyDays(buddyProgress.dayStatus?.days || []);
            setPartnerWorkouts(buddyProgress.daysCompleted || 0);
          }
        }

        // Date range & days left
        const wg = data?.weeklyGoal;
        if (wg?.startDate && wg?.endDate) {
          const start = new Date(wg.startDate);
          const end = new Date(wg.endDate);
          const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
          setDateRange(`${fmt(start)} \u2013 ${fmt(end)}`);
          const now = new Date();
          const remaining = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86400000));
          setDaysLeft(remaining);
        }
      } catch (e) {
        console.error("Failed to fetch weekly details:", e);
      }
    };
    fetchDetails();
  }, [weeklyGoalId, buddyId]);

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

        {/* PHOTO CAROUSEL / WIN CARD */}
        {proofPhotos.length > 0 && weeklyGoalId ? (
          <View style={styles.carouselCard}>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              snapToInterval={slideWidth}
              snapToAlignment="start"
              onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
                const index = Math.round(e.nativeEvent.contentOffset.x / slideWidth);
                setActivePhotoIndex(index);
              }}
              scrollEventThrottle={16}
            >
              {proofPhotos.map((item) => (
                <View key={item._id} style={styles.carouselSlide}>
                  <Image
                    source={{
                      uri: `http://localhost:5001/user/${userId}/weekly-goals/${weeklyGoalId}/proof/${item._id}`,
                    }}
                    style={styles.proofImage}
                    resizeMode="cover"
                  />
                  <Text style={styles.proofTimestamp}>
                    {getTimeAgo(item.uploadedDate)}
                  </Text>
                </View>
              ))}
            </ScrollView>
            {proofPhotos.length > 1 && (
              <View style={styles.dotRow}>
                {proofPhotos.map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.dot,
                      i === activePhotoIndex && styles.dotActive,
                    ]}
                  />
                ))}
              </View>
            )}
          </View>
        ) : (
          <View style={styles.winCard}>
            <View style={styles.dumbellContainer}>
              <Text style={styles.dumbell}>🏋️</Text>
            </View>
            <TouchableOpacity style={styles.startButton}>
              <Text style={styles.startButtonText}>START STRONG</Text>
            </TouchableOpacity>
            <Text style={styles.winTitle}>Win the week early</Text>
            <Text style={styles.winSubtitle}>Set the tone before {buddyName} does</Text>
          </View>
        )}

        {/* THIS WEEK */}
        <View style={styles.weekCard}>
          <View style={styles.weekHeader}>
            <Text style={styles.sectionTitle}>This Week</Text>
            <Text style={styles.daysLeft}>⏱️ {daysLeft} day{daysLeft !== 1 ? "s" : ""} left</Text>
          </View>
          <Text style={styles.dateRange}>{dateRange}</Text>

          {/* WEEK ROWS */}
          <View style={styles.weekContent}>
            {/* Left Column - User */}
            <View style={styles.weekColumn}>
              <View style={styles.personHeaderRow}>
                <Text style={styles.personLabel}>{userName}</Text>
                <View style={styles.personCountBadge}>
                  <Text style={styles.personCount}>{userWorkouts}/{goalWorkouts}</Text>
                </View>
              </View>
              <View style={styles.dayGrid}>
                {(userDays.length > 0
                  ? userDays.map((d: any) => ({ label: d.dayName?.charAt(0) || "?", status: d.status }))
                  : ["F","S","S","M","T","W","T"].map((l) => ({ label: l, status: "not_yet_open" }))
                ).map((day, i) => (
                  <View
                    key={i}
                    style={[
                      styles.dayCircleSmall,
                      day.status === "done" && styles.dayCircleDone,
                      day.status === "can_be_done" && styles.dayCircleToday,
                      day.status === "false" && styles.dayCircleMissed,
                    ]}
                  >
                    <Text style={[styles.dayTextSmall, day.status === "done" && styles.dayTextDone]}>{day.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Right Column - Partner */}
            <View style={styles.weekColumn}>
              <View style={styles.personHeaderRow}>
                <Text style={styles.personLabel}>{buddyName}</Text>
                <View style={styles.personCountBadge}>
                  <Text style={styles.personCount}>{partnerWorkouts}/{goalWorkouts}</Text>
                </View>
              </View>
              <View style={styles.dayGrid}>
                {(buddyDays.length > 0
                  ? buddyDays.map((d: any) => ({ label: d.dayName?.charAt(0) || "?", status: d.status }))
                  : ["F","S","S","M","T","W","T"].map((l) => ({ label: l, status: "not_yet_open" }))
                ).map((day, i) => (
                  <View
                    key={i}
                    style={[
                      styles.dayCircleSmall,
                      day.status === "done" && styles.dayCircleDone,
                      day.status === "can_be_done" && styles.dayCircleToday,
                      day.status === "false" && styles.dayCircleMissed,
                    ]}
                  >
                    <Text style={[styles.dayTextSmall, day.status === "done" && styles.dayTextDone]}>{day.label}</Text>
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
          <Text style={styles.stakesValue}>{stake}</Text>
          <Text style={styles.stakesSubtext}>You need {Math.max(0, goalWorkouts - userWorkouts)} more workout{goalWorkouts - userWorkouts !== 1 ? "s" : ""} this week</Text>
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

  carouselCard: {
    backgroundColor: "#1a1a1a",
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 25,
    overflow: "hidden",
    marginBottom: 25,
  },

  carouselSlide: {
    width: width - 40,
    alignItems: "center",
  },

  proofImage: {
    width: "100%",
    height: 300,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
  },

  proofTimestamp: {
    color: "#888",
    fontSize: 12,
    marginTop: 10,
    marginBottom: 6,
  },

  dotRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingBottom: 14,
  },

  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#555",
  },

  dotActive: {
    width: 28,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#39d2b4",
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

  dayCircleDone: {
    backgroundColor: "#39d2b4",
    borderColor: "#39d2b4",
  },

  dayCircleToday: {
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: "#39d2b4",
  },

  dayCircleMissed: {
    backgroundColor: "#2a2a2a",
    borderColor: "#333",
  },

  dayTextSmall: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "600",
  },

  dayTextDone: {
    color: "#000",
    fontWeight: "700",
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