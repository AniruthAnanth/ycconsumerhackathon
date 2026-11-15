import { useLocalSearchParams } from "expo-router";

import { TaskSheet } from "@/components/capture/task/TaskSheet";

export default function TaskRoute() {
  const { taskId } = useLocalSearchParams<{ taskId: string }>();
  return <TaskSheet taskId={taskId} />;
}
