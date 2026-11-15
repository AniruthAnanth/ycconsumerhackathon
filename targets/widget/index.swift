import SwiftUI
import WidgetKit

/// Everything the extension offers to the system: the Live Activity on the lock screen and in the
/// Dynamic Island, and the home-screen widget.
@main
struct LineupWidgets: WidgetBundle {
  var body: some Widget {
    LineupLiveActivity()
    LineupHomeWidget()
  }
}
