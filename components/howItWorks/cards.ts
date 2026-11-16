/** The four cards of the "How Lineup works" intro, in order: one idea and one plain sentence each. */
export const CARDS = [
  { key: "draft", title: "Draft your week", line: "Say what you want to get done, and Lineup turns it into five tasks for your week." },
  { key: "prove", title: "Prove it", line: "Snap a photo when you finish a task, and the AI checks it and gives you the points." },
  { key: "beat", title: "Beat your friends", line: "Each week you face one friend, and whoever scores more points wins." },
  { key: "pot", title: "Win the pot", line: "Everyone puts in the same buy-in. The top scorer who clears all 5 slots takes the pot." },
] as const;

export type CardKey = (typeof CARDS)[number]["key"];

/** Where the intro goes when it ends: back where it was opened from, or on to sign-up. */
export function exitOf(source: string | undefined): "back" | "signup" | "replay" {
  if (source === "profile") return "back";
  return source === "replay" ? "replay" : "signup";
}
