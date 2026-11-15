import { useCallback, useEffect, useState } from "react";

import { precheck, type Precheck, type PrecheckTask } from "@/lib/onDeviceReferee";

/**
 * Runs the on-device pre-check for a just-captured photo and holds the server verification
 * back while the player decides what to do about a photo that plainly doesn't match.
 *
 * The verdict flow uploads the photo as soon as the screen opens. This hook only stands in
 * front of the step after that, the server verification, which is the one that costs money:
 *
 * - looks fine, a video, or a build without the native module: the gate opens at once and
 *   the flow is exactly what it was without this feature;
 * - plainly something else: the gate stays shut until the player taps Send anyway. Retake
 *   replaces the screen, so the gate is never opened and no verification is spent.
 *
 * Nothing here awards points. The server referee does that.
 */
export function useOnDeviceRead(photoUri: string | undefined, task: PrecheckTask) {
  const [read, setRead] = useState<Precheck | null>(null);
  const [sentAnyway, setSentAnyway] = useState(false);
  const [gate] = useState(createGate);
  const { slot, title, gesture } = task;

  useEffect(() => {
    if (!photoUri) {
      gate.open();
      return;
    }
    let showing = true;
    void precheck(photoUri, { slot, title, gesture }).then(
      (result) => {
        // Opened even if the player has already left the screen: a proof that looked fine is
        // verified in the background, as it was before the pre-check existed.
        if (result.likelyMatch) gate.open();
        if (showing) setRead(result);
      },
      // precheck is written never to reject. If that ever changes, a hint must not hold a proof.
      () => gate.open(),
    );
    return () => {
      showing = false;
    };
  }, [gate, photoUri, slot, title, gesture]);

  const sendAnyway = useCallback(() => {
    setSentAnyway(true);
    gate.open();
  }, [gate]);

  /** Resolves when the server verification may go ahead. */
  const beforeVerify = useCallback(() => gate.opened, [gate]);

  return {
    /** What the device saw, or null until it has looked. */
    read,
    /** True while the player still has to choose between Retake and Send anyway. */
    asking: read !== null && !read.likelyMatch && !sentAnyway,
    sendAnyway,
    beforeVerify,
  };
}

/** A promise with its resolver: `opened` settles the first time `open` is called. */
function createGate() {
  let open = () => {};
  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { opened, open };
}
