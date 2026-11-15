import ActivityKit
import ExpoModulesCore
import Foundation
import WidgetKit

/// Starts, updates and ends Lineup's Live Activity with ActivityKit. JavaScript reaches it through
/// lib/liveActivity.ts; the views are in the widget extension (targets/widget).
///
/// The state crosses the bridge as a JSON string and is decoded straight into the activity's
/// ContentState, so there is one definition of its shape on each side and no hand-written mapping.
///
/// It also hands the home-screen widget its data (setWidgetSnapshot, called from lib/homeWidget.ts):
/// the widget is drawn by the same extension as the activity, so one module feeds both.
public class LiveActivityModule: Module {
  public func definition() -> ModuleDefinition {
    Name("LiveActivity")

    // False before iOS 16.2 and when the player switched Live Activities off for Lineup in Settings.
    Function("areActivitiesEnabled") { () -> Bool in
      guard #available(iOS 16.2, *) else {
        return false
      }
      return ActivityAuthorizationInfo().areActivitiesEnabled
    }

    AsyncFunction("start") { (stateJson: String) async throws in
      guard #available(iOS 16.2, *) else {
        return
      }
      let state = try decodeState(stateJson)
      let content = ActivityContent(state: state, staleDate: nil)

      // A running activity is updated in place: ending it and requesting another would make the
      // island blink out and back every time a drop takes over from the matchup.
      if let running = runningActivity() {
        await running.update(content)
        return
      }
      // An activity that has ended can stay on the lock screen for hours. Clear those so the new
      // one is not shown beside a stale scoreboard.
      await endAllActivities()

      // pushType nil: this activity is updated only by the app while it is open.
      // REMOTE UPDATES (not built): pass pushType .token here, send activity.pushTokenUpdates to
      // Convex, and post new content-state to APNs from a Convex action. That needs an APNs auth key.
      _ = try Activity<LineupActivityAttributes>.request(
        attributes: LineupActivityAttributes(),
        content: content,
        pushType: nil
      )
    }

    AsyncFunction("update") { (stateJson: String) async throws in
      guard #available(iOS 16.2, *) else {
        return
      }
      guard let running = runningActivity() else {
        return
      }
      let state = try decodeState(stateJson)
      await running.update(ActivityContent(state: state, staleDate: nil))
    }

    AsyncFunction("end") { () async in
      guard #available(iOS 16.2, *) else {
        return
      }
      await endAllActivities()
    }

    // Hands the home-screen widget its data. The widget extension is a separate process, so the
    // only thing the two share is the App Group's UserDefaults.
    AsyncFunction("setWidgetSnapshot") { (snapshotJson: String) in
      UserDefaults(suiteName: "group.com.lineup.app")?.set(snapshotJson, forKey: "widgetSnapshot")
      WidgetCenter.shared.reloadAllTimelines()
    }
  }
}

@available(iOS 16.2, *)
private func decodeState(_ json: String) throws -> LineupActivityAttributes.ContentState {
  return try JSONDecoder().decode(LineupActivityAttributes.ContentState.self, from: Data(json.utf8))
}

/// The activity that can still be updated, if there is one.
@available(iOS 16.2, *)
private func runningActivity() -> Activity<LineupActivityAttributes>? {
  return Activity<LineupActivityAttributes>.activities.first { activity in
    activity.activityState == .active || activity.activityState == .stale
  }
}

/// Ends every Lineup activity and takes it off the lock screen and the island at once.
@available(iOS 16.2, *)
private func endAllActivities() async {
  for activity in Activity<LineupActivityAttributes>.activities {
    await activity.end(nil, dismissalPolicy: .immediate)
  }
}
