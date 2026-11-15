import type { DraftTask } from "./types";

export function renameTask(tasks: DraftTask[], index: number, title: string): DraftTask[] {
  return tasks.map((task, i) => (i === index ? { ...task, title } : task));
}

/** The five core slots are the lineup's spine; only flex rows are optional. */
export function canRemoveTask(task: DraftTask): boolean {
  return task.slot === "flex";
}

export function removeTask(tasks: DraftTask[], index: number): DraftTask[] {
  if (!tasks[index] || !canRemoveTask(tasks[index])) return tasks;
  return tasks.filter((_, i) => i !== index);
}

export function canLock(tasks: DraftTask[]): boolean {
  return tasks.length > 0 && tasks.every((task) => task.title.trim().length > 0);
}

/** Stray spaces from editing in place would otherwise reach the referee as part of the task. */
export function tasksToLock(tasks: DraftTask[]): DraftTask[] {
  return tasks.map((task) => ({ ...task, title: task.title.trim() }));
}
