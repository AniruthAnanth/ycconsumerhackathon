import SwiftUI
import WidgetKit

/// Everything the extension offers to the system. The Live Activity is the only entry today.
@main
struct LineupWidgets: WidgetBundle {
  var body: some Widget {
    LineupLiveActivity()
  }
}
