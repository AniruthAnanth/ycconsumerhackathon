import ActivityKit
import Foundation

// This file exists twice, byte for byte: in modules/live-activity/ios (compiled into the app,
// which starts and updates the activity) and in targets/widget (compiled into the widget
// extension, which draws it). ActivityKit pairs the two by this type's name and by the JSON
// shape of ContentState, so the copies must not drift. lib/liveActivityFiles.test.ts fails
// when they differ.

/// One Live Activity for Lineup. Everything it shows changes while it runs, so it all lives in
/// ContentState and the fixed attributes are empty.
@available(iOS 16.2, *)
struct LineupActivityAttributes: ActivityAttributes {
  /// What the lock screen and the Dynamic Island draw. The keys are the ones lib/liveActivityState.ts
  /// writes: the app sends this struct as JSON.
  struct ContentState: Codable, Hashable {
    /// "drop" for a quick-time drop, "matchup" for the weekly head-to-head.
    var kind: String
    var leagueName: String
    /// A drop's task, for example "20 push-ups". Empty for a matchup.
    var title: String
    /// The gesture a drop's photo must show. Empty when there is none.
    var gesture: String
    /// What the drop pays.
    var points: Int
    /// When the drop closes or the week ends, in epoch milliseconds. The system draws the
    /// countdown from it, so the clock keeps running while the app is suspended.
    var endsAtMs: Double
    var myName: String
    var opponentName: String
    var myScore: Int
    var opponentScore: Int
    /// Lineup slots proven so far, out of slotsTotal.
    var slotsCleared: Int
    var slotsTotal: Int
  }
}
