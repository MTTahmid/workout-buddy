import Constants from "expo-constants";

function resolveExpoHost() {
	const constantsAny = Constants as any;
	const candidates = [
		constantsAny?.expoConfig?.hostUri,
		constantsAny?.expoGoConfig?.debuggerHost,
		constantsAny?.manifest2?.extra?.expoClient?.hostUri,
		constantsAny?.manifest?.debuggerHost,
	];

	for (const value of candidates) {
		if (typeof value === "string" && value.trim()) {
			return value.split(":")[0];
		}
	}

	return null;
}

const explicitBaseUrl = process.env.EXPO_PUBLIC_API_URL;
const expoHost = resolveExpoHost();

export const API_BASE_URL =
	explicitBaseUrl || (expoHost ? `http://${expoHost}:5000` : "http://localhost:5000");