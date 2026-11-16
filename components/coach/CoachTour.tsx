import { useQuery } from "convex/react";
import { useIsFocused } from "expo-router";
import { type ComponentRef, createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { backend } from "@/lib/backend";
import { colors, duration, layout, radius, SCREEN_MARGIN, spacing, type } from "@/theme";

import { hasSeenTour, markTourSeen, useCoachResets } from "./store";
import { arrowOffset, bubbleSide, type CoachTargetId, isOnScreen, type Rect, TOURS, type TourId } from "./tours";

type ViewType = ComponentRef<typeof View>;

const ARROW = 16;
const RING = spacing.xs;

type Register = (id: CoachTargetId, view: ViewType | null) => void;
const CoachContext = createContext<Register | null>(null);

/** Marks the element a tour step points at. Without a CoachTour around it, it is a plain View. */
export function CoachTarget({ id, children }: { id: CoachTargetId; children: ReactNode }) {
  const register = useContext(CoachContext);
  return (
    <View ref={(view) => register?.(id, view)} collapsable={false}>
      {children}
    </View>
  );
}

type Shown = { index: number; steps: { text: string; rect: Rect }[] };

/**
 * Runs one screen's first-run tour: once the screen is focused and its content has arrived
 * (ready), it measures each step's target and walks through the ones on screen, a bubble
 * at a time. Got it or Skip tips marks the tour seen for this player on this device.
 */
export function CoachTour({ tour, ready = true, children }: { tour: TourId; ready?: boolean; children: ReactNode }) {
  const targets = useRef(new Map<CoachTargetId, ViewType>());
  const me = useQuery(backend.users.me);
  const focused = useIsFocused();
  const resets = useCoachResets();
  const screen = useWindowDimensions();
  const [shown, setShown] = useState<Shown | null>(null);
  const userId = me?._id;

  const register = useCallback<Register>((id, view) => {
    if (view) targets.current.set(id, view);
    else targets.current.delete(id);
  }, []);

  useEffect(() => {
    if (!userId || !focused || !ready) return;
    let live = true;
    // After the screen's entrance has played, so the targets are where they will stay.
    const timer = setTimeout(async () => {
      if (await hasSeenTour(userId, tour)) return;
      const measured = await Promise.all(
        TOURS[tour].map(
          ({ target, text }) =>
            new Promise<{ text: string; rect: Rect } | null>((resolve) => {
              const view = targets.current.get(target);
              if (!view) return resolve(null);
              view.measureInWindow((x, y, width, height) => resolve({ text, rect: { x, y, width, height } }));
            }),
        ),
      );
      const steps = measured.filter((step): step is { text: string; rect: Rect } => !!step && isOnScreen(step.rect, screen));
      if (live && steps.length > 0) setShown({ index: 0, steps });
    }, duration.slow * 3);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [userId, focused, ready, tour, resets, screen]);

  function finish() {
    setShown(null);
    if (userId) void markTourSeen(userId, tour);
  }

  const step = shown?.steps[shown.index];
  const last = shown ? shown.index === shown.steps.length - 1 : false;
  const next = () => (last ? finish() : setShown((now) => now && { ...now, index: now.index + 1 }));

  return (
    <CoachContext.Provider value={register}>
      {children}
      {step && shown ? (
        <Modal transparent visible animationType="fade" statusBarTranslucent onRequestClose={finish}>
          <Pressable style={StyleSheet.absoluteFill} onPress={next} accessibilityLabel="Next tip">
            <View style={[StyleSheet.absoluteFill, styles.scrim]} />
          </Pressable>
          <View
            pointerEvents="none"
            style={[
              styles.ring,
              { left: step.rect.x - RING, top: step.rect.y - RING, width: step.rect.width + RING * 2, height: step.rect.height + RING * 2 },
            ]}
          />
          <Bubble
            text={step.text}
            rect={step.rect}
            screen={screen}
            position={`${shown.index + 1} of ${shown.steps.length}`}
            last={last}
            onNext={next}
            onSkip={finish}
          />
        </Modal>
      ) : null}
    </CoachContext.Provider>
  );
}

function Bubble({
  text,
  rect,
  screen,
  position,
  last,
  onNext,
  onSkip,
}: {
  text: string;
  rect: Rect;
  screen: { width: number; height: number };
  position: string;
  last: boolean;
  onNext: () => void;
  onSkip: () => void;
}) {
  const side = bubbleSide(rect, screen.height);
  const width = screen.width - SCREEN_MARGIN * 2;
  const gap = RING + ARROW / 2 + spacing.xs;
  const arrowLeft = arrowOffset(rect, { left: SCREEN_MARGIN, width }, ARROW, radius.card);
  const place =
    side === "below"
      ? { top: Math.min(rect.y + rect.height + gap, screen.height - layout.bar * 3) }
      : { bottom: Math.min(screen.height - rect.y + gap, screen.height - layout.bar * 3) };
  return (
    <View style={[styles.bubble, { width }, place]} accessibilityViewIsModal accessibilityLiveRegion="polite">
      <View style={[styles.arrow, { left: arrowLeft }, side === "below" ? styles.arrowTop : styles.arrowBottom]} />
      <Text style={styles.text}>{text}</Text>
      <View style={styles.actions}>
        {last ? <View /> : (
          <Pressable onPress={onSkip} hitSlop={spacing.md} accessibilityRole="button" testID="coach-skip">
            <Text style={styles.skip}>Skip tips</Text>
          </Pressable>
        )}
        <View style={styles.right}>
          <Text style={styles.position}>{position}</Text>
          <Pressable onPress={onNext} style={styles.next} accessibilityRole="button" testID="coach-next">
            <Text style={styles.nextLabel}>{last ? "Got it" : "Next"}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: colors.scrim },
  ring: { position: "absolute", borderRadius: radius.md, borderWidth: 2, borderColor: colors.onAccent },
  bubble: {
    position: "absolute",
    left: SCREEN_MARGIN,
    padding: spacing.lg,
    gap: spacing.md,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  arrow: { position: "absolute", width: ARROW, height: ARROW, backgroundColor: colors.surface, transform: [{ rotate: "45deg" }] },
  arrowTop: { top: -ARROW / 2 },
  arrowBottom: { bottom: -ARROW / 2 },
  text: { ...type.body, color: colors.text },
  actions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  right: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  skip: { ...type.label, color: colors.textMuted },
  position: { ...type.small, color: colors.textFaint },
  next: {
    minHeight: layout.bar,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  nextLabel: { ...type.label, color: colors.onAccent },
});
