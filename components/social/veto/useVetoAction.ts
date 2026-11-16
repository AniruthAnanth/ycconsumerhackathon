import { useMutation } from "convex/react";
import { useState } from "react";

import type { Id } from "@/convex/_generated/dataModel";
import { errorMessage } from "@/lib/errorMessage";
import { haptics } from "@/lib/native/haptics";

import { socialApi, type TaskVeto } from "../contract";
import { confirmAction, notify } from "../notify";

/** What tapping a veto does, shared by the chip and the long-press on an opponent's task. */
export function useVetoAction(veto: TaskVeto, leagueId: Id<"leagues">) {
  const cast = useMutation(socialApi.vetoes.cast);
  // A tap toggles my vote, so a double tap would cast and take it back; ignore taps while one is in flight.
  const [pending, setPending] = useState(false);
  const send = () => {
    if (pending) return;
    setPending(true);
    haptics.veto();
    cast({ taskId: veto.taskId, leagueId })
      .catch((error) => notify(errorMessage(error)))
      .finally(() => setPending(false));
  };
  // Casting can strike a teammate's task, so it takes a second tap like the proof veto; taking a vote back does not.
  const onPress = () => {
    if (veto.mine) return send();
    const left = veto.needed - veto.votes;
    confirmAction({
      title: `Veto ${veto.title}?`,
      message:
        left <= 1
          ? `Your vote strikes it, and ${veto.ownerName} has to swap in another task.`
          : `${veto.needed} votes strike it. You can take yours back while the vote is open.`,
      confirmLabel: "Veto",
      onConfirm: send,
    });
  };
  return onPress;
}
