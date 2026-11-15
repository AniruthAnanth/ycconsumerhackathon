import ActivityKit
import SwiftUI
import WidgetKit

/// Lineup's Live Activity: a scoreboard on the lock screen and in the Dynamic Island.
///
/// It has two faces, chosen by ContentState.kind. A quick-time drop shows the task, the gesture,
/// what it pays and a countdown the system keeps running. The weekly matchup shows both scores,
/// the slots proven and the time left in the week.
struct LineupLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: LineupActivityAttributes.self) { context in
      LockScreenBoard(state: context.state)
        .activityBackgroundTint(Brand.board)
        .activitySystemActionForegroundColor(Brand.ink)
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          ExpandedLeading(state: context.state)
        }
        DynamicIslandExpandedRegion(.trailing) {
          ExpandedTrailing(state: context.state)
        }
        DynamicIslandExpandedRegion(.bottom) {
          ExpandedBottom(state: context.state)
        }
      } compactLeading: {
        CompactLeading(state: context.state)
      } compactTrailing: {
        CompactTrailing(state: context.state)
      } minimal: {
        MinimalMark(state: context.state)
      }
      .keylineTint(context.state.isDrop ? Brand.lime : Brand.lime)
    }
  }
}

typealias BoardState = LineupActivityAttributes.ContentState

/// The app's dark-surface palette (theme/tokens.ts: dark, lime, lightInk), so the lock screen and
/// home screen match the restyled app: a deep green board, lime for labels and the leading score.
enum Brand {
  static let lime = Color(red: 216 / 255, green: 242 / 255, blue: 154 / 255)
  static let board = Color(red: 16 / 255, green: 47 / 255, blue: 36 / 255)
  static let ink = Color(red: 233 / 255, green: 240 / 255, blue: 230 / 255)
  static let dim = ink.opacity(0.65)
}

extension LineupActivityAttributes.ContentState {
  var isDrop: Bool {
    return kind == "drop"
  }

  var endsAt: Date {
    return Date(timeIntervalSince1970: endsAtMs / 1000)
  }

  /// From now to the end. Never inverted: a ClosedRange whose end is in the past traps, and a
  /// drop can close a moment before its last update is drawn.
  var countdown: ClosedRange<Date> {
    let now = Date()
    return now...max(now, endsAt)
  }

  var iAmAhead: Bool {
    return myScore >= opponentScore
  }

  var slotsLabel: String {
    return "\(slotsCleared)/\(slotsTotal)"
  }
}

// MARK: - Shared pieces

/// A countdown the system redraws every second, so it runs while the app is suspended.
struct Countdown: View {
  let state: BoardState

  var body: some View {
    Text(timerInterval: state.countdown, countsDown: true)
      .monospacedDigit()
      .multilineTextAlignment(.trailing)
  }
}

/// One square per lineup slot, green once it is proven: the "3/5" of the week at a glance.
struct SlotPips: View {
  let state: BoardState

  var body: some View {
    HStack(spacing: 3) {
      ForEach(0..<max(state.slotsTotal, 0), id: \.self) { index in
        RoundedRectangle(cornerRadius: 2)
          .fill(index < state.slotsCleared ? Brand.lime : Brand.ink.opacity(0.25))
          .frame(width: 10, height: 10)
      }
    }
  }
}

/// A player's name over their score, the way a scoreboard stacks them. The leader's score is green.
struct ScoreColumn: View {
  let name: String
  let score: Int
  let ahead: Bool
  let alignment: HorizontalAlignment
  var scoreSize: CGFloat = 30

  var body: some View {
    VStack(alignment: alignment, spacing: 0) {
      Text(name.uppercased())
        .font(.system(size: 11, weight: .semibold))
        .foregroundColor(Brand.dim)
        .lineLimit(1)
      Text("\(score)")
        .font(.system(size: scoreSize, weight: .heavy, design: .rounded))
        .monospacedDigit()
        .foregroundColor(ahead ? Brand.lime : Brand.ink)
        .lineLimit(1)
        .minimumScaleFactor(0.6)
    }
  }
}

/// The small caps line that names what the board is showing.
struct BoardLabel: View {
  let text: String
  let color: Color

  var body: some View {
    Text(text)
      .font(.system(size: 11, weight: .bold))
      .kerning(0.6)
      .foregroundColor(color)
      .lineLimit(1)
  }
}

// MARK: - Lock screen

struct LockScreenBoard: View {
  let state: BoardState

  var body: some View {
    Group {
      if state.isDrop {
        DropBoard(state: state)
      } else {
        MatchupBoard(state: state)
      }
    }
    .padding(.horizontal, 16)
    .padding(.vertical, 14)
  }
}

struct DropBoard: View {
  let state: BoardState

  var body: some View {
    HStack(alignment: .center, spacing: 12) {
      VStack(alignment: .leading, spacing: 4) {
        HStack(spacing: 4) {
          Image(systemName: "bolt.fill")
            .font(.system(size: 11, weight: .bold))
            .foregroundColor(Brand.lime)
          BoardLabel(text: "QUICK-TIME DROP", color: Brand.lime)
        }
        Text(state.title)
          .font(.system(size: 22, weight: .heavy))
          .foregroundColor(Brand.ink)
          .lineLimit(2)
          .minimumScaleFactor(0.7)
        if !state.gesture.isEmpty {
          HStack(spacing: 4) {
            Image(systemName: "hand.raised.fill")
            Text(state.gesture)
              .lineLimit(1)
          }
          .font(.system(size: 13, weight: .medium))
          .foregroundColor(Brand.dim)
        }
      }
      Spacer(minLength: 8)
      VStack(alignment: .trailing, spacing: 2) {
        Text("+\(state.points)")
          .font(.system(size: 30, weight: .heavy, design: .rounded))
          .foregroundColor(Brand.lime)
        Countdown(state: state)
          .font(.system(size: 20, weight: .bold, design: .rounded))
          .foregroundColor(Brand.ink)
          .frame(maxWidth: 96, alignment: .trailing)
      }
    }
  }
}

struct MatchupBoard: View {
  let state: BoardState

  var body: some View {
    VStack(spacing: 8) {
      HStack {
        BoardLabel(text: state.leagueName.uppercased(), color: Brand.lime)
        Spacer(minLength: 8)
        HStack(spacing: 3) {
          Text("ENDS IN")
          Text(state.endsAt, style: .relative)
        }
        .font(.system(size: 11, weight: .semibold))
        .foregroundColor(Brand.dim)
        .lineLimit(1)
      }
      HStack(alignment: .center) {
        ScoreColumn(name: state.myName, score: state.myScore, ahead: state.iAmAhead, alignment: .leading, scoreSize: 36)
        Spacer(minLength: 8)
        Text("VS")
          .font(.system(size: 12, weight: .bold))
          .foregroundColor(Brand.dim)
        Spacer(minLength: 8)
        ScoreColumn(name: state.opponentName, score: state.opponentScore, ahead: !state.iAmAhead, alignment: .trailing, scoreSize: 36)
      }
      HStack(spacing: 6) {
        SlotPips(state: state)
        Text("\(state.slotsLabel) slots cleared")
          .font(.system(size: 12, weight: .semibold))
          .foregroundColor(Brand.ink)
        Spacer(minLength: 0)
      }
    }
  }
}

// MARK: - Dynamic Island, compact and minimal

/// Left of the camera: what is at stake. A drop's points, or my score.
struct CompactLeading: View {
  let state: BoardState

  var body: some View {
    if state.isDrop {
      HStack(spacing: 2) {
        Image(systemName: "bolt.fill")
          .foregroundColor(Brand.lime)
        Text("+\(state.points)")
          .foregroundColor(Brand.ink)
      }
      .font(.system(size: 13, weight: .bold, design: .rounded))
    } else {
      Text("\(state.myScore)")
        .font(.system(size: 14, weight: .heavy, design: .rounded))
        .monospacedDigit()
        .foregroundColor(state.iAmAhead ? Brand.lime : Brand.ink)
    }
  }
}

/// Right of the camera: what I am up against. A drop's clock, or my opponent's score.
struct CompactTrailing: View {
  let state: BoardState

  var body: some View {
    if state.isDrop {
      // A timer text asks for all the width it could ever need; the frame keeps the island small.
      Countdown(state: state)
        .font(.system(size: 13, weight: .bold, design: .rounded))
        .foregroundColor(Brand.lime)
        .frame(maxWidth: 56)
    } else {
      Text("\(state.opponentScore)")
        .font(.system(size: 14, weight: .heavy, design: .rounded))
        .monospacedDigit()
        .foregroundColor(state.iAmAhead ? Brand.ink : Brand.lime)
    }
  }
}

/// The single dot shown when another app's activity shares the island.
struct MinimalMark: View {
  let state: BoardState

  var body: some View {
    if state.isDrop {
      Image(systemName: "bolt.fill")
        .foregroundColor(Brand.lime)
    } else {
      Text("\(state.myScore)")
        .font(.system(size: 12, weight: .heavy, design: .rounded))
        .monospacedDigit()
        .minimumScaleFactor(0.5)
        .foregroundColor(state.iAmAhead ? Brand.lime : Brand.ink)
    }
  }
}

// MARK: - Dynamic Island, expanded

/// The expanded island's corners are round enough to cut into a label set flush in one: on an
/// iPhone 18 Pro the "D" of "DROP" lost its left edge at an inset of 4.
enum Island {
  static let cornerInset: CGFloat = 12
  static let topInset: CGFloat = 4
}

struct ExpandedLeading: View {
  let state: BoardState

  var body: some View {
    if state.isDrop {
      VStack(alignment: .leading, spacing: 0) {
        BoardLabel(text: "DROP", color: Brand.lime)
        Text("+\(state.points)")
          .font(.system(size: 28, weight: .heavy, design: .rounded))
          .foregroundColor(Brand.ink)
      }
      .padding(.leading, Island.cornerInset)
      .padding(.top, Island.topInset)
    } else {
      ScoreColumn(name: state.myName, score: state.myScore, ahead: state.iAmAhead, alignment: .leading)
        .padding(.leading, Island.cornerInset)
        .padding(.top, Island.topInset)
    }
  }
}

struct ExpandedTrailing: View {
  let state: BoardState

  var body: some View {
    if state.isDrop {
      VStack(alignment: .trailing, spacing: 0) {
        BoardLabel(text: "ENDS IN", color: Brand.dim)
        Countdown(state: state)
          .font(.system(size: 24, weight: .heavy, design: .rounded))
          .foregroundColor(Brand.lime)
          .frame(maxWidth: 110, alignment: .trailing)
      }
      .padding(.trailing, Island.cornerInset)
      .padding(.top, Island.topInset)
    } else {
      ScoreColumn(name: state.opponentName, score: state.opponentScore, ahead: !state.iAmAhead, alignment: .trailing)
        .padding(.trailing, Island.cornerInset)
        .padding(.top, Island.topInset)
    }
  }
}

struct ExpandedBottom: View {
  let state: BoardState

  var body: some View {
    if state.isDrop {
      VStack(alignment: .leading, spacing: 6) {
        Text(state.title)
          .font(.system(size: 18, weight: .heavy))
          .foregroundColor(Brand.ink)
          .lineLimit(1)
          .minimumScaleFactor(0.7)
        HStack(spacing: 8) {
          if !state.gesture.isEmpty {
            HStack(spacing: 4) {
              Image(systemName: "hand.raised.fill")
              Text(state.gesture)
                .lineLimit(1)
            }
            .font(.system(size: 13, weight: .medium))
            .foregroundColor(Brand.dim)
          }
          Spacer(minLength: 0)
          // The week's score stays in view during a drop: it is what the drop's points are for.
          // A player with no opponent this week has no score line to show.
          if !state.opponentName.isEmpty {
            Text("\(state.myScore) - \(state.opponentScore)")
              .font(.system(size: 13, weight: .bold, design: .rounded))
              .monospacedDigit()
              .foregroundColor(Brand.lime)
          }
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(.horizontal, Island.cornerInset)
    } else {
      HStack(spacing: 6) {
        SlotPips(state: state)
        Text("\(state.slotsLabel) slots")
          .font(.system(size: 13, weight: .semibold))
          .foregroundColor(Brand.ink)
        Spacer(minLength: 8)
        HStack(spacing: 3) {
          Text("ENDS IN")
          Text(state.endsAt, style: .relative)
        }
        .font(.system(size: 12, weight: .semibold))
        .foregroundColor(Brand.dim)
        .lineLimit(1)
      }
      .padding(.horizontal, Island.cornerInset)
    }
  }
}
