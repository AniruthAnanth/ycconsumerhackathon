import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { type StyleProp, StyleSheet, View, type ViewStyle } from "react-native";

import { colors } from "./kit";

/**
 * A proof's photo or video, filling whatever box the caller gives it.
 * Videos autoplay muted on a loop, as the feed and the wrapped cards require;
 * they are at most ten seconds long, so there are no controls.
 */
export function ProofMedia({
  uri,
  mediaType,
  style,
}: {
  uri: string;
  mediaType: "photo" | "video";
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.box, style]}>
      {mediaType === "video" ? (
        <LoopingVideo uri={uri} />
      ) : (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
      )}
    </View>
  );
}

/** Split out so the player hook only runs for videos. */
function LoopingVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (created) => {
    created.loop = true;
    created.muted = true;
    created.play();
  });
  return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />;
}

const styles = StyleSheet.create({
  box: { overflow: "hidden", backgroundColor: colors.wash },
});
