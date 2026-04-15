import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { USER_ID } from "@/constants/user";
import { API_BASE_URL } from "@/constants/api";

type MemberMoney = {
  userId: string;
  points: number;
  moneyEarned: { taka: number; formatted: string };
};

export default function WagerBalance() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const userId = (params.id as string) || USER_ID;

  const [you, setYou] = useState<MemberMoney | null>(null);
  const [buddy, setBuddy] = useState<MemberMoney | null>(null);
  const [moneyEnabled, setMoneyEnabled] = useState(false);
  const [buddyName, setBuddyName] = useState("Buddy");
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [moneyRes, buddyRes] = await Promise.all([
        fetch(`${API_BASE_URL}/user/${userId}/buddy/money`),
        fetch(`${API_BASE_URL}/user/${userId}/buddy`),
      ]);
      if (moneyRes.ok) {
        const data = await moneyRes.json();
        const members: MemberMoney[] = data?.members || [];
        const me = members.find((m) => String(m.userId) === String(userId));
        const other = members.find((m) => String(m.userId) !== String(userId));
        setYou(me || null);
        setBuddy(other || null);
        setMoneyEnabled(!!data?.monetaryEnabled);
      }
      if (buddyRes.ok) {
        const bData = await buddyRes.json();
        const name = bData?.buddy?.name?.trim()?.split(/\s+/)[0] || "Buddy";
        setBuddyName(name);
      }
    } catch (e) {
      console.error("Failed to fetch money:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [userId]);

  const toggleMoney = async (val: boolean) => {
    setMoneyEnabled(val);
    try {
      const res = await fetch(`${API_BASE_URL}/user/${userId}/buddy/money/toggle`, {
        method: "PUT",
      });
      if (res.ok) {
        const data = await res.json();
        setMoneyEnabled(!!data?.monetaryEnabled);
      } else {
        setMoneyEnabled(!val);
      }
    } catch (e) {
      setMoneyEnabled(!val);
    }
  };

  const yourPts = you?.points ?? 0;
  const buddyPts = buddy?.points ?? 0;
  const diff = yourPts - buddyPts;

  const toTaka = (member: MemberMoney | null) =>
    member?.moneyEarned?.taka?.toFixed(2) ?? "0.00";
  const diffTaka = (Math.abs(diff) / 100).toFixed(2);

  const getDiffEmoji = () => {
    if (diff === 0) return "🤝";
    if (diff > 0) return "😊";
    return "😅";
  };

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

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#39d2b4" size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Score Cards */}
          <View style={styles.cardsRow}>
            <View style={[styles.scoreCard, styles.youCard]}>
              <Text style={styles.cardLabel}>You</Text>
              <Text style={styles.cardPoints}>{yourPts}</Text>
              <Text style={styles.cardTaka}>৳{toTaka(you)}</Text>
            </View>
            <View style={[styles.scoreCard, styles.buddyCard]}>
              <Text style={styles.cardLabel}>{buddyName}</Text>
              <Text style={styles.cardPoints}>{buddyPts}</Text>
              <Text style={styles.cardTakaBuddy}>৳{toTaka(buddy)}</Text>
            </View>
          </View>

          {/* Difference with emoji */}
          <View style={styles.diffCard}>
            <Text style={styles.diffEmoji}>{getDiffEmoji()}</Text>
            {diff === 0 ? (
              <>
                <Text style={styles.diffTitle}>You're tied — perfect sync!</Text>
                <Text style={styles.diffSub}>No one owes anything</Text>
              </>
            ) : diff > 0 ? (
              <>
                <Text style={styles.diffTitle}>
                  You're ahead by {diff} pts
                </Text>
                <Text style={styles.diffSub}>
                  {buddyName} owes you ৳{diffTaka}
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.diffTitle}>
                  {buddyName} is ahead by {Math.abs(diff)} pts
                </Text>
                <Text style={styles.diffSub}>
                  You owe {buddyName} ৳{diffTaka}
                </Text>
              </>
            )}
          </View>

          {/* Points → Taka info */}
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>💰 Points → Taka</Text>
            <Text style={styles.infoLine}>100 points = ৳1.00</Text>
            <Text style={styles.infoSub}>
              Earn points by completing mini bet challenges
            </Text>
          </View>

          {/* Monetary Mode Toggle */}
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleLabel}>Monetary mode</Text>
              <Text style={styles.toggleSub}>
                Track Taka balances between you and {buddyName}
              </Text>
            </View>
            <Switch
              value={moneyEnabled}
              onValueChange={toggleMoney}
              trackColor={{ false: "#333", true: "#39d2b4" }}
              thumbColor="#fff"
            />
          </View>
        </ScrollView>
      )}

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
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    paddingBottom: 40,
  },
  cardsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  scoreCard: {
    flex: 1,
    borderRadius: 18,
    padding: 20,
    alignItems: "center",
  },
  youCard: {
    backgroundColor: "rgba(57,210,180,0.12)",
  },
  buddyCard: {
    backgroundColor: "rgba(255,180,50,0.12)",
  },
  cardLabel: {
    color: "#aaa",
    fontSize: 13,
    marginBottom: 6,
  },
  cardPoints: {
    color: "#fff",
    fontSize: 36,
    fontWeight: "700",
  },
  cardTaka: {
    color: "#39d2b4",
    fontSize: 14,
    marginTop: 4,
  },
  cardTakaBuddy: {
    color: "#ffb432",
    fontSize: 14,
    marginTop: 4,
  },
  diffCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    marginBottom: 16,
  },
  diffEmoji: {
    fontSize: 32,
    marginBottom: 10,
  },
  diffTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  diffSub: {
    color: "#39d2b4",
    fontSize: 13,
    marginTop: 4,
    textAlign: "center",
  },
  infoCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
  },
  infoTitle: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 6,
  },
  infoLine: {
    color: "#aaa",
    fontSize: 13,
  },
  infoSub: {
    color: "#666",
    fontSize: 12,
    marginTop: 4,
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
  },
  toggleLabel: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  toggleSub: {
    color: "#888",
    fontSize: 12,
    marginTop: 2,
  },
  footer: {
    color: "#555",
    fontSize: 13,
    textAlign: "center",
    paddingBottom: 40,
  },
});
