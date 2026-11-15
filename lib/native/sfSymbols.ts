import type Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";
import type { SFSymbol } from "sf-symbols-typescript";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

/**
 * The SF Symbol iOS draws for each Ionicon the app uses, so Icon can stay keyed by Ionicon names
 * (which Android and the web still draw) while an iPhone shows the system's own icons. A name
 * missing here keeps its Ionicon on iOS too, so adding an icon never makes one disappear.
 */
export const SF_SYMBOL_FOR_IONICON: Partial<Record<IoniconName, SFSymbol>> = {
  add: "plus",
  "alert-circle-outline": "exclamationmark.circle",
  "barbell-outline": "figure.strengthtraining.traditional",
  "book-outline": "book",
  "calendar-outline": "calendar",
  "camera-outline": "camera",
  "card-outline": "creditcard",
  "caret-down": "chevron.down",
  "chatbubble-ellipses-outline": "ellipsis.bubble",
  "chatbubble-outline": "bubble.left",
  checkmark: "checkmark",
  "checkmark-circle": "checkmark.circle.fill",
  "chevron-back": "chevron.left",
  "chevron-down": "chevron.down",
  "chevron-forward": "chevron.right",
  "chevron-up": "chevron.up",
  close: "xmark",
  "ellipse-outline": "circle",
  "ellipsis-horizontal": "ellipsis",
  flame: "flame.fill",
  flash: "bolt.fill",
  "flash-outline": "bolt",
  "home-outline": "house",
  "image-outline": "photo",
  "leaf-outline": "leaf",
  "location-outline": "location",
  "lock-closed": "lock.fill",
  "mic-outline": "mic",
  people: "person.2.fill",
  "people-outline": "person.2",
  "person-outline": "person",
  refresh: "arrow.clockwise",
  search: "magnifyingglass",
  send: "paperplane.fill",
  "settings-outline": "gearshape",
  "share-outline": "square.and.arrow.up",
  "stats-chart-outline": "chart.bar",
  "time-outline": "clock",
  "trash-outline": "trash",
  "trophy-outline": "trophy",
  "videocam-outline": "video",
};
