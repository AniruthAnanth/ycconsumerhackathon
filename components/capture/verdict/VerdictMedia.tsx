import { useVideoPlayer, VideoView } from "expo-video";
import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";

import { colors } from "@/theme";

import type { Capture } from "../proofRoute";

function LoopingVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = true;
    instance.muted = true;
    instance.play();
  });
  return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />;
}

/** The player's proof, dimmed so the overlay and the stamp stay readable on top of it. */
export function VerdictMedia({ capture }: { capture: Capture }) {
  return (
    <View style={styles.frame}>
      {capture.mediaType === "photo" && (
        <Image source={{ uri: capture.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
      )}
      {capture.mediaType === "video" && <LoopingVideo uri={capture.uri} />}
      <View style={styles.dim} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { ...StyleSheet.absoluteFill, backgroundColor: colors.text },
  dim: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.4)" },
});
