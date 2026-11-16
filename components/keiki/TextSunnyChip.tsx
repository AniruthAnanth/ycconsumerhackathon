import { OutlinedPillButton } from "@/components/ui";

import { useTextSunny } from "./useTextSunny";

/** "Text Sunny instead": the same agent as the in-app chat, from Messages. */
export function TextSunnyChip() {
  const sunny = useTextSunny();
  if (!sunny.ready) return null;
  return (
    <OutlinedPillButton
      label="Text Sunny instead"
      accessibilityLabel={`Text Sunny instead, at ${sunny.number}`}
      onPress={() => void sunny.open()}
    />
  );
}
