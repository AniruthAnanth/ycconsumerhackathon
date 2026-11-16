import { ScrollView, StyleSheet, Text, View } from "react-native";

import { ProgressFill } from "@/components/motion";
import { BORDER, colors, radius, SCREEN_MARGIN, spacing, tabular, type } from "@/theme";

import { formatChance } from "./chartGeometry";
import { marketQuestions } from "./marketQuestions";
import type { Market } from "./useMarket";

const CARD_WIDTH = 240;

/** A swipeable row of question cards on the League tab: odds only, nothing to bet. */
export function MarketsStrip({ market }: { market: Market }) {
  const questions = marketQuestions(market);
  if (questions.length === 0) return null;
  return (
    <View testID="markets-strip">
      <Text style={styles.heading}>Markets</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_WIDTH + spacing.md}
        decelerationRate="fast"
        contentContainerStyle={styles.track}
      >
        {questions.map((question) => (
          <View key={question.key} style={styles.card} accessible accessibilityLabel={`${question.question} ${formatChance(question.chance)} chance`}>
            <Text style={styles.question} numberOfLines={2}>
              {question.question}
            </Text>
            <View style={styles.answerRow}>
              <Text style={styles.chance}>{formatChance(question.chance)}</Text>
              <Text style={styles.chanceLabel}>chance</Text>
            </View>
            <ProgressFill ratio={question.chance} height={4} />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { ...type.subheading, color: colors.text, marginHorizontal: SCREEN_MARGIN, marginTop: spacing.lg },
  track: { paddingHorizontal: SCREEN_MARGIN, paddingVertical: spacing.md, gap: spacing.md },
  card: {
    width: CARD_WIDTH,
    padding: spacing.lg,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: BORDER,
    borderColor: colors.divider,
  },
  question: { ...type.label, color: colors.text, minHeight: 40 },
  answerRow: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm },
  chanceLabel: { ...type.small, color: colors.textMuted },
  chance: { ...type.heading, color: colors.text, ...tabular },
});
