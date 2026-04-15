import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useState, useEffect } from "react";
import { USER_ID } from "@/constants/user";
import { API_BASE_URL } from "@/constants/api";

export default function Partner() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const userId = (params.id as string) || USER_ID;
  const [pairingCode, setPairingCode] = useState("");
  const [partnerCode, setPartnerCode] = useState((params.code as string) || "");
  const [loading, setLoading] = useState(true);
  const [pairing, setPairing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchPairingCode = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/user/${userId}/pairing-code`
        );
        const data = await response.json();
        setPairingCode(data.pairingCode || "");
      } catch (error) {
        console.error("Failed to fetch pairing code:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPairingCode();
  }, [userId]);

  const handlePairWithBuddy = async () => {
    if (!partnerCode.trim()) {
      setError("Please enter your partner's code");
      return;
    }

    setPairing(true);
    setError("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/user/${userId}/buddy/${partnerCode.trim().toUpperCase()}`,
        { method: "PUT" }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to pair with buddy");
      }

      // Pairing successful, navigate to dashboard
      router.push(`/dashboard?id=${userId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setPairing(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => router.back()}>
        <Text style={styles.backArrow}>←</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Partner</Text>

      <Text style={styles.subText}>Your pairing code</Text>
      {loading ? (
        <ActivityIndicator size="large" color="#39d2b4" />
      ) : (
        <View style={styles.codeBox}>
          <Text style={styles.codeText}>{pairingCode}</Text>
        </View>
      )}

      <Text style={styles.subText}>Enter partner&apos;s code</Text>

      <View style={{ alignItems: "center", marginVertical: 20 }}>
        <Text style={{ color: "#777" }}>or</Text>
      </View>

      <TextInput
        style={styles.input}
        placeholder="Enter code here"
        placeholderTextColor="#666"
        value={partnerCode}
        onChangeText={(text) => {
          setPartnerCode(text);
          setError("");
        }}
      />

      {error && <Text style={styles.errorText}>{error}</Text>}

      <TouchableOpacity
        style={[styles.shareButton, pairing && styles.shareButtonDisabled]}
        onPress={handlePairWithBuddy}
        disabled={pairing}
      >
        <Text style={styles.shareText}>
          {pairing ? "Pairing..." : "Pair with partner"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    padding: 30,
    paddingTop: 80,
  },
  backArrow: {
    color: "#fff",
    fontSize: 28,
    marginBottom: 10,
  },
  title: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "600",
    marginBottom: 40,
  },
  codeBox: {
    backgroundColor: "#2a2a2a",
    paddingVertical: 30,
    borderRadius: 20,
    alignItems: "center",
    marginBottom: 20,
  },
  codeText: {
    color: "#39d2b4",
    fontSize: 28,
    letterSpacing: 3,
    fontWeight: "600",
  },
  subText: {
    color: "#aaa",
    marginBottom: 10,
  },
  input: {
    backgroundColor: "#1a1a1a",
    borderWidth: 1,
    borderColor: "#333",
    color: "#fff",
    paddingVertical: 15,
    paddingHorizontal: 15,
    borderRadius: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  shareButton: {
    backgroundColor: "#39d2b4",
    paddingVertical: 18,
    borderRadius: 50,
    alignItems: "center",
    marginTop: 20,
  },
  shareButtonDisabled: {
    backgroundColor: "#999",
    opacity: 0.6,
  },
  shareText: {
    color: "#000",
    fontWeight: "600",
    fontSize: 16,
  },
  errorText: {
    color: "#ff6b6b",
    fontSize: 14,
    marginBottom: 10,
    textAlign: "center",
  },
});