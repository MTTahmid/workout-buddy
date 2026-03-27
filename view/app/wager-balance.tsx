import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { USER_ID } from "@/constants/user";

type WagerEntry = {
  week: string;
  stake: string;
  loser: "you" | "buddy";
  settled: boolean;
};

export default function WagerBalance() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const userId = (params.id as string) || USER_ID;
  const [wagers, setWagers] = useState<WagerEntry[]>([]);

  const youOwe = wagers.filter((w) => w.loser === "you" && !w.settled);
  const theyOwe = wagers.filter((w) => w.loser === "buddy" && !w.settled);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={() => router.replace(`/dashboard?id=${userId}`)}
        >
          <Text style={styles.back}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Wager Balance</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {wagers.length === 0 ? (
          <>
            <View style={styles.emptyIconContainer}>
              <View style={styles.emptyIconCircle}>
                <Text style={styles.emptyIcon}>🍕</Text>
              </View>
            </View>

            <Text style={styles.emptyTitle}>You're all caught up!</Text>
            <Text style={styles.emptySub}>
              Nothing is owed you're in perfect sync.
            </Text>
          </>
        ) : (
          <>
            {youOwe.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>You Owe</Text>
                {youOwe.map((w, i) => (
                  <View key={i} style={styles.wagerRow}>
                    <View>
                      <Text style={styles.wagerStake}>{w.stake}</Text>
                      <Text style={styles.wagerWeek}>{w.week}</Text>
                    </View>
                    <View style={styles.oweBadge}>
                      <Text style={styles.oweBadgeText}>unpaid</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {theyOwe.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>They Owe You</Text>
                {theyOwe.map((w, i) => (
                  <View key={i} style={styles.wagerRow}>
                    <View>
                      <Text style={styles.wagerStake}>{w.stake}</Text>
                      <Text style={styles.wagerWeek}>{w.week}</Text>
                    </View>
                    <View style={[styles.oweBadge, styles.oweBadgeGreen]}>
                      <Text style={[styles.oweBadgeText, styles.oweBadgeTextGreen]}>
                        unpaid
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <Text style={styles.footer}>
        Couples that sweat together stay together
      </Text>
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
    marginBottom: 30,
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
  content: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 40,
  },
  emptyIconContainer: {
    marginBottom: 30,
  },
  emptyIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#2a1f00",
    justifyContent: "center",
    alignItems: "center",
  },
  emptyIcon: {
    fontSize: 44,
  },
  emptyTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "600",
    marginBottom: 10,
    textAlign: "center",
  },
  emptySub: {
    color: "#888",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  section: {
    width: "100%",
    marginBottom: 25,
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  wagerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
  },
  wagerStake: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  wagerWeek: {
    color: "#888",
    fontSize: 12,
    marginTop: 4,
  },
  oweBadge: {
    backgroundColor: "rgba(255, 100, 100, 0.15)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  oweBadgeText: {
    color: "#ff6464",
    fontSize: 12,
    fontWeight: "600",
  },
  oweBadgeGreen: {
    backgroundColor: "rgba(57, 210, 180, 0.15)",
  },
  oweBadgeTextGreen: {
    color: "#39d2b4",
  },
  footer: {
    color: "#555",
    fontSize: 13,
    textAlign: "center",
    paddingBottom: 40,
  },
});
