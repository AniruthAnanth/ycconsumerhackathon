import SwiftUI
import WidgetKit

/// Lineup's home-screen widget: where I stand in my league this week, at a glance.
///
/// Small shows my place, my points and the slots I have cleared. Medium adds the task to do next
/// and the league's name. The widget never talks to the server: the app writes one snapshot to
/// the App Group whenever its own data changes, and this file only reads and draws it.
struct LineupHomeWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "LineupHomeWidget", provider: HomeWidgetProvider()) { (entry: HomeWidgetEntry) in
      HomeWidgetView(entry: entry)
        .containerBackground(for: .widget) { Brand.board }
    }
    .configurationDisplayName("Lineup")
    .description("Your rank, points and next task.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}

// MARK: - The data

/// What the app hands the widget. The keys are the keys of WidgetSnapshot in lib/widgetSnapshot.ts,
/// which builds it: change both together. Every key is always present and every number is whole.
struct WidgetSnapshot: Codable {
  let leagueName: String
  /// 1-based place in the league this week.
  let rank: Int
  let memberCount: Int
  let points: Int
  let slotsCleared: Int
  let slotsTotal: Int
  /// Empty when every task is done or nothing is drafted.
  let nextTaskTitle: String
  let nextTaskPoints: Int
}

extension WidgetSnapshot {
  /// "1ST", "2ND", "3RD", "11TH": a place the way a league table prints it.
  var placeLabel: String {
    let lastTwoDigits: Int = rank % 100
    if lastTwoDigits >= 11 && lastTwoDigits <= 13 {
      return "\(rank)TH"
    }
    switch rank % 10 {
    case 1:
      return "\(rank)ST"
    case 2:
      return "\(rank)ND"
    case 3:
      return "\(rank)RD"
    default:
      return "\(rank)TH"
    }
  }

  /// Made-up numbers for the two places no real ones belong: the widget gallery before the app
  /// has ever run, and the greyed-out skeleton the system draws while the widget loads.
  static let sample: WidgetSnapshot = WidgetSnapshot(
    leagueName: "Sunday League",
    rank: 2,
    memberCount: 6,
    points: 140,
    slotsCleared: 3,
    slotsTotal: 5,
    nextTaskTitle: "Leg day at the gym",
    nextTaskPoints: 30
  )

  /// The App Group is named after the app's bundle identifier (plugins/withAppGroup.js), which
  /// changes with the team that signs the app. This extension's own identifier is the app's plus
  /// ".widgets" (expo-target.config.js), so the app's is recovered by dropping that suffix.
  static var appGroup: String {
    let extensionId: String = Bundle.main.bundleIdentifier ?? ""
    let suffix: String = ".widgets"
    let appId: String = extensionId.hasSuffix(suffix) ? String(extensionId.dropLast(suffix.count)) : extensionId
    return "group." + appId
  }

  /// What the app last wrote to the App Group, the only storage the app and this extension share
  /// (they are separate processes). Nil on a fresh install, and when the JSON is not the shape
  /// this build expects: the placeholder is better than a half-decoded scoreboard.
  static func stored() -> WidgetSnapshot? {
    guard let defaults: UserDefaults = UserDefaults(suiteName: appGroup) else {
      return nil
    }
    guard let json: String = defaults.string(forKey: "widgetSnapshot") else {
      return nil
    }
    return try? JSONDecoder().decode(WidgetSnapshot.self, from: Data(json.utf8))
  }
}

struct HomeWidgetEntry: TimelineEntry {
  let date: Date
  /// Nil until the app has written a snapshot.
  let snapshot: WidgetSnapshot?
}

struct HomeWidgetProvider: TimelineProvider {
  func placeholder(in context: Context) -> HomeWidgetEntry {
    return HomeWidgetEntry(date: Date(), snapshot: WidgetSnapshot.sample)
  }

  func getSnapshot(in context: Context, completion: @escaping (HomeWidgetEntry) -> Void) {
    // The gallery should show what the widget looks like in use, not an instruction.
    let fallback: WidgetSnapshot? = context.isPreview ? WidgetSnapshot.sample : nil
    completion(HomeWidgetEntry(date: Date(), snapshot: WidgetSnapshot.stored() ?? fallback))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<HomeWidgetEntry>) -> Void) {
    // One entry and no refresh date: nothing here changes with the clock. The app reloads the
    // timeline each time it writes a new snapshot (setWidgetSnapshot in LiveActivityModule.swift).
    let entry: HomeWidgetEntry = HomeWidgetEntry(date: Date(), snapshot: WidgetSnapshot.stored())
    let timeline: Timeline<HomeWidgetEntry> = Timeline(entries: [entry], policy: .never)
    completion(timeline)
  }
}

// MARK: - The views

struct HomeWidgetView: View {
  @Environment(\.widgetFamily) var family
  let entry: HomeWidgetEntry

  var body: some View {
    if let snapshot = entry.snapshot {
      switch family {
      case .systemMedium:
        MediumBoard(snapshot: snapshot)
      default:
        SmallBoard(snapshot: snapshot)
      }
    } else {
      StartYourWeek()
    }
  }
}

struct SmallBoard: View {
  let snapshot: WidgetSnapshot

  var body: some View {
    // The league's name is the heading here because small has no other room for it.
    StandingColumn(heading: snapshot.leagueName.uppercased(), snapshot: snapshot)
      .frame(maxWidth: .infinity, alignment: .leading)
  }
}

struct MediumBoard: View {
  let snapshot: WidgetSnapshot

  var body: some View {
    HStack(alignment: .top, spacing: 14) {
      // Its own width, never squeezed: a long task title on the right must not shrink the rank.
      StandingColumn(heading: "THIS WEEK", snapshot: snapshot)
        .fixedSize(horizontal: true, vertical: false)
      Rectangle()
        .fill(Color.white.opacity(0.15))
        .frame(width: 1)
      UpNextColumn(snapshot: snapshot)
    }
  }
}

/// My place, my points and my cleared slots, stacked the way a scoreboard stacks them.
/// First place is green, like the leader's score in the Live Activity.
struct StandingColumn: View {
  let heading: String
  let snapshot: WidgetSnapshot

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      BoardLabel(text: heading, color: Brand.blue)
      HStack(alignment: .firstTextBaseline, spacing: 4) {
        Text(snapshot.placeLabel)
          .font(.system(size: 38, weight: .heavy, design: .rounded))
          .foregroundColor(snapshot.rank == 1 ? Brand.green : Color.white)
        Text("OF \(snapshot.memberCount)")
          .font(.system(size: 11, weight: .bold))
          .foregroundColor(Brand.dim)
      }
      .lineLimit(1)
      .minimumScaleFactor(0.6)
      Spacer(minLength: 2)
      HStack(alignment: .firstTextBaseline, spacing: 3) {
        Text("\(snapshot.points)")
          .font(.system(size: 22, weight: .heavy, design: .rounded))
          .monospacedDigit()
          .foregroundColor(Color.white)
        Text("PTS")
          .font(.system(size: 11, weight: .bold))
          .foregroundColor(Brand.dim)
      }
      .lineLimit(1)
      Spacer(minLength: 2)
      HStack(spacing: 6) {
        ClearedPips(cleared: snapshot.slotsCleared, total: snapshot.slotsTotal)
        Text("\(snapshot.slotsCleared)/\(snapshot.slotsTotal)")
          .font(.system(size: 12, weight: .semibold))
          .foregroundColor(Color.white)
          .lineLimit(1)
      }
    }
  }
}

/// The task the Roster screen puts Submit Proof on, what it pays, and whose league this is.
struct UpNextColumn: View {
  let snapshot: WidgetSnapshot

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      BoardLabel(text: "UP NEXT", color: Brand.green)
      Spacer(minLength: 2)
      if snapshot.nextTaskTitle.isEmpty {
        // Either the week is done or nothing is drafted; the snapshot does not say which.
        Text("No open tasks")
          .font(.system(size: 17, weight: .heavy))
          .foregroundColor(Brand.dim)
          .lineLimit(1)
      } else {
        Text(snapshot.nextTaskTitle)
          .font(.system(size: 17, weight: .heavy))
          .foregroundColor(Color.white)
          .lineLimit(2)
          .minimumScaleFactor(0.8)
        Text("+\(snapshot.nextTaskPoints) PTS")
          .font(.system(size: 13, weight: .bold, design: .rounded))
          .foregroundColor(Brand.green)
          .lineLimit(1)
      }
      Spacer(minLength: 2)
      BoardLabel(text: snapshot.leagueName.uppercased(), color: Brand.dim)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

/// Shown until the app has written its first snapshot: a fresh install, or a player with no league.
struct StartYourWeek: View {
  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      BoardLabel(text: "LINEUP", color: Brand.blue)
      Spacer(minLength: 4)
      Text("Open Lineup to start your week")
        .font(.system(size: 17, weight: .heavy))
        .foregroundColor(Color.white)
        .lineLimit(3)
        .minimumScaleFactor(0.8)
      Spacer(minLength: 4)
      ClearedPips(cleared: 0, total: 5)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

/// One square per lineup slot, green once it is proven. The same mark as SlotPips in the Live
/// Activity, which can't be reused here because it reads an activity's state.
struct ClearedPips: View {
  let cleared: Int
  let total: Int

  var body: some View {
    HStack(spacing: 3) {
      ForEach(0..<max(total, 0), id: \.self) { (index: Int) in
        RoundedRectangle(cornerRadius: 2)
          .fill(index < cleared ? Brand.green : Color.white.opacity(0.25))
          .frame(width: 10, height: 10)
      }
    }
  }
}
