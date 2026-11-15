import Ionicons from "@expo/vector-icons/Ionicons";
import { SymbolView } from "expo-symbols";
import type { ComponentProps } from "react";
import { Platform } from "react-native";
import type { SFSymbol } from "sf-symbols-typescript";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

type Props = {
  /** The SF Symbol iOS draws, for example "figure.strengthtraining.traditional". */
  ios: SFSymbol;
  /** The Ionicon drawn on Android and the web, where SF Symbols don't exist. */
  fallback: IoniconName;
  size?: number;
  color: string;
  weight?: "regular" | "medium" | "semibold" | "bold";
};

/**
 * An SF Symbol on iOS (the system's own icons, which is most of what makes an app read as
 * native) and the nearest Ionicon elsewhere. expo-symbols is inside Expo Go, so Expo Go on an
 * iPhone shows the real symbols too.
 */
export function Symbol({ ios, fallback, size = 20, color, weight = "regular" }: Props) {
  const ionicon = <Ionicons name={fallback} size={size} color={color} />;
  if (Platform.OS !== "ios") return ionicon;
  return (
    <SymbolView
      name={ios}
      size={size}
      tintColor={color}
      weight={weight}
      fallback={ionicon}
      style={{ width: size, height: size }}
    />
  );
}
