import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { PressScale } from "@/components/motion";
import { Icon, OutlinedPillButton, TextField } from "@/components/ui";
import { BORDER, colors, hairline, layout, radius, spacing, tabular, type } from "@/theme";

import { ChoiceCard } from "./ChoiceCard";
import {
  CUSTOM_STAKE_CHOICE,
  FORMAT_CHOICES,
  isPresetStake,
  isRecommended,
  KIND_CHOICES,
  MAX_NAME_LENGTH,
  parseStake,
  PAYOUT_CHOICES,
  potExample,
  potExplanation,
  recommendedLines,
  reviewRows,
  SEASON_WEEKS_CHOICES,
  STAKE_CHOICES,
  type Choice,
  type Draft,
} from "./wizard";

/** What every step is given: the answers so far, and how to change one. */
export type StepProps = {
  draft: Draft;
  change: (patch: Partial<Draft>) => void;
  /** True while the league is being created. */
  disabled: boolean;
};

/** The question a step asks, and one line of plain words under it. */
function StepIntro({ title, line }: { title: string; line: string }) {
  return (
    <View style={styles.intro}>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      <Text style={styles.line}>{line}</Text>
    </View>
  );
}

/** A set of answers of which exactly one is picked, with an optional small heading. */
function ChoiceGroup<Value extends string | number>({
  title,
  choices,
  value,
  onChange,
  disabled,
}: {
  title?: string;
  choices: readonly Choice<Value>[];
  value: Value;
  onChange: (value: Value) => void;
  disabled: boolean;
}) {
  return (
    <View style={styles.choices} accessibilityRole="radiogroup" accessibilityLabel={title}>
      {title ? <Text style={styles.groupTitle}>{title.toUpperCase()}</Text> : null}
      {choices.map((choice) => (
        <ChoiceCard
          key={String(choice.value)}
          label={choice.label}
          explanation={choice.explanation}
          example={choice.example}
          selected={choice.value === value}
          onPress={() => onChange(choice.value)}
          disabled={disabled}
        />
      ))}
    </View>
  );
}

export function NameStep({ draft, change, disabled }: StepProps) {
  return (
    <View style={styles.step}>
      <StepIntro title="Name your league" line="Your friends see this name on their invite. Keep our suggestion or type your own." />
      <TextField
        label="League name"
        value={draft.name}
        onChangeText={(name) => change({ name })}
        maxLength={MAX_NAME_LENGTH}
        editable={!disabled}
        returnKeyType="done"
        selectTextOnFocus
      />
    </View>
  );
}

export function KindStep({ draft, change, disabled }: StepProps) {
  return (
    <View style={styles.step}>
      <StepIntro title="Who's playing?" line="A league for your group, or a one-week duel with one friend." />
      <ChoiceGroup choices={KIND_CHOICES} value={draft.kind} onChange={(kind) => change({ kind })} disabled={disabled} />
      {draft.kind === "versus" ? (
        <Text style={styles.note}>Next takes you to pick your friend and the stake. A versus has no season to set up.</Text>
      ) : null}
    </View>
  );
}

export function StakeStep({ draft, change, disabled }: StepProps) {
  // The step remounts each time it is shown, so these start from the answer already given.
  const [custom, setCustom] = useState(!isPresetStake(draft.stakeUsd));
  const [customText, setCustomText] = useState(custom && draft.stakeUsd !== null ? String(draft.stakeUsd) : "");
  return (
    <View style={styles.step}>
      <StepIntro title="Set the stakes" line={potExplanation(draft.settings.payout)} />
      <View style={styles.choices} accessibilityRole="radiogroup">
        {STAKE_CHOICES.map((choice) => (
          <ChoiceCard
            key={choice.value}
            label={choice.label}
            explanation={choice.explanation}
            accessibilityLabel={`Stake ${choice.label}`}
            selected={!custom && draft.stakeUsd === choice.value}
            onPress={() => {
              setCustom(false);
              change({ stakeUsd: choice.value });
            }}
            disabled={disabled}
          />
        ))}
        <ChoiceCard
          label={CUSTOM_STAKE_CHOICE.label}
          explanation={CUSTOM_STAKE_CHOICE.explanation}
          accessibilityLabel={`Stake ${CUSTOM_STAKE_CHOICE.label}`}
          selected={custom}
          onPress={() => {
            setCustom(true);
            change({ stakeUsd: parseStake(customText) });
          }}
          disabled={disabled}
        />
      </View>
      {custom ? (
        <TextField
          label="Buy-in in dollars"
          value={customText}
          onChangeText={(text) => {
            setCustomText(text);
            change({ stakeUsd: parseStake(text) });
          }}
          placeholder="10"
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={5}
          editable={!disabled}
          returnKeyType="done"
        />
      ) : null}
      <View style={styles.panel}>
        <Text style={styles.groupTitle}>EXAMPLE</Text>
        <Text style={[styles.figure, tabular]} accessibilityLiveRegion="polite">
          {potExample(draft.stakeUsd)}
        </Text>
      </View>
    </View>
  );
}

export function SeasonStep({ draft, change, disabled, onUseRecommended }: StepProps & { onUseRecommended: () => void }) {
  // Open already when the answer so far is not the recommended one, so what was picked stays in view.
  const [advanced, setAdvanced] = useState(!isRecommended(draft.settings));
  const set = (patch: Partial<Draft["settings"]>) => change({ settings: { ...draft.settings, ...patch } });
  return (
    <View style={styles.step}>
      <StepIntro title="Pick your season" line="This is the setup most leagues start with. Take it in one tap, or open Advanced to change it." />
      <View style={styles.panel}>
        <Text style={styles.groupTitle}>RECOMMENDED</Text>
        {recommendedLines().map((line) => (
          <Text key={line} style={styles.summaryLine}>
            {line}
          </Text>
        ))}
        {/* Secondary: the screen's one filled button is Next at the bottom. */}
        <OutlinedPillButton label="Use recommended" onPress={onUseRecommended} disabled={disabled} style={styles.panelButton} />
      </View>
      <PressScale
        style={styles.expander}
        onPress={() => setAdvanced(!advanced)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel="Advanced"
        accessibilityHint="Shows the other season lengths, formats and payout timings"
        accessibilityState={{ expanded: advanced }}
      >
        <Text style={styles.expanderLabel}>Advanced</Text>
        <Icon name={advanced ? "chevron-up" : "chevron-down"} color={colors.accent} />
      </PressScale>
      {advanced ? (
        <>
          <ChoiceGroup
            title="Season length"
            choices={SEASON_WEEKS_CHOICES}
            value={draft.settings.seasonWeeks}
            onChange={(seasonWeeks) => set({ seasonWeeks })}
            disabled={disabled}
          />
          <ChoiceGroup title="Format" choices={FORMAT_CHOICES} value={draft.settings.format} onChange={(format) => set({ format })} disabled={disabled} />
          <ChoiceGroup title="Payout" choices={PAYOUT_CHOICES} value={draft.settings.payout} onChange={(payout) => set({ payout })} disabled={disabled} />
        </>
      ) : null}
    </View>
  );
}

export function ReviewStep({ draft }: Pick<StepProps, "draft">) {
  return (
    <View style={styles.step}>
      <StepIntro title="Review and create" line="Here is your league. Go back to change anything." />
      <View style={styles.review}>
        {reviewRows(draft).map((row, index) => (
          <View key={row.label} style={[styles.reviewRow, index > 0 && styles.reviewRowDivider]}>
            <Text style={styles.reviewLabel}>{row.label}</Text>
            <Text style={styles.reviewValue}>{row.value}</Text>
          </View>
        ))}
      </View>
      {draft.stakeUsd ? <Text style={styles.note}>{potExplanation(draft.settings.payout)}</Text> : null}
      <Text style={styles.note}>Next, you invite your friends with a link or from your contacts.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  step: { paddingHorizontal: layout.margin, paddingTop: spacing.lg, paddingBottom: spacing.xl, gap: spacing.lg },
  intro: { gap: spacing.sm },
  title: { ...type.heading, color: colors.text },
  line: { ...type.body, color: colors.textMuted },
  note: { ...type.small, color: colors.textMuted },
  choices: { gap: spacing.md },
  groupTitle: { ...type.caption, color: colors.textMuted, letterSpacing: 0.6 },
  panel: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: BORDER,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
  },
  panelButton: { marginTop: spacing.sm },
  figure: { ...type.subheading, color: colors.text },
  summaryLine: { ...type.body, color: colors.text },
  expander: {
    minHeight: layout.rowMin,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  expanderLabel: { ...type.label, color: colors.accent },
  review: {
    paddingHorizontal: spacing.lg,
    borderRadius: radius.card,
    borderWidth: BORDER,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
  },
  reviewRow: {
    minHeight: layout.rowMin,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: layout.columnGap,
  },
  reviewRowDivider: { borderTopWidth: hairline, borderTopColor: colors.divider },
  reviewLabel: { ...type.small, color: colors.textMuted },
  reviewValue: { ...type.label, color: colors.text, flexShrink: 1, textAlign: "right" },
});
