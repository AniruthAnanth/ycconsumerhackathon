import { useMutation } from "convex/react";
import { makeFunctionReference } from "convex/server";
import { ConvexError } from "convex/values";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Button, Header, Screen } from "@/components/ui";
import type { Id } from "@/convex/_generated/dataModel";
import { DEFAULT_SETTINGS, type LeagueSettings } from "@/convex/lib/schedule";
import { useCurrentLeague } from "@/lib/currentLeague";
import { colors, font, spacing } from "@/theme";

import { SettingsPicker } from "./SettingsPicker";

// leagues.create as API.md has it, settings included. Bound by name, like
// lib/backend.ts, so this screen typechecks against the contract.
const createLeagueFunction = makeFunctionReference<
  "mutation",
  {
    name: string;
    stakeUsd: number;
    visibility: "private" | "public";
    settings?: Partial<LeagueSettings>;
  },
  { leagueId: Id<"leagues">; inviteCode: string }
>("leagues:create");

/**
 * The last step of Create League. Join passes the name, stake and visibility
 * it collected as route params; this screen adds the three settings, creates
 * the league and carries on to the contacts step, as joining a league does.
 */
export function LeagueSettingsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ name: string; stakeUsd: string; visibility: string }>();
  const { setLeagueId } = useCurrentLeague();
  const createLeague = useMutation(createLeagueFunction);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setCreating(true);
    setError(null);
    try {
      const { leagueId } = await createLeague({
        name: params.name,
        stakeUsd: Number(params.stakeUsd),
        visibility: params.visibility === "public" ? "public" : "private",
        settings,
      });
      setLeagueId(leagueId);
      router.replace({ pathname: "/contacts", params: { leagueId } });
    } catch (failure) {
      // A ConvexError carries the server's own sentence; anything else is a dropped connection.
      setError(
        failure instanceof ConvexError && typeof failure.data === "string"
          ? failure.data
          : "Couldn't create the league. Try again.",
      );
      setCreating(false);
    }
  }

  return (
    <Screen>
      <Header title="League Settings" onBack={router.back} />
      <ScrollView>
        <SettingsPicker value={settings} onChange={setSettings} />
      </ScrollView>
      <View style={styles.footer}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button label="Create League" onPress={create} loading={creating} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  footer: { gap: spacing.sm, padding: spacing.lg },
  error: { fontSize: font.meta, color: colors.danger, textAlign: "center" },
});
