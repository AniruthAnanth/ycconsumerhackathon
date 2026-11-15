import { View, type StyleProp, type ViewStyle } from "react-native";
import { SvgXml } from "react-native-svg";

import { ARTWORK, type ArtworkName } from "./artworkCatalog";

type Props = {
  name: ArtworkName;
  /** Width and height in points; every illustration is square. */
  size: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * One decorative illustration. It is hidden from screen readers and never takes a tap, so it can
 * sit inside a button or card without changing what that control announces or where it leads.
 */
export function Artwork({ name, size, style }: Props) {
  return (
    <View
      style={[{ width: size, height: size }, style]}
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
    >
      <SvgXml xml={ARTWORK[name]} width={size} height={size} />
    </View>
  );
}
