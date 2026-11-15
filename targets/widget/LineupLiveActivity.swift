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
        .activitySystemActionForegroundColor(.white)
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
      .keylineTint(context.state.isDrop ? Brand.green : Brand.blue)
    }
  }
}

typealias BoardState = LineupActivityAttributes.ContentState

/// The app's blue and green (accent and tabActive in theme/tokens.ts) on a scoreboard's near-black.
enum Brand {
  static let blue = Color(red: 11 / 255, green: 105 / 255, blue: 255 / 255)
  static let green = Color(red: 0 / 255, green: 166 / 255, blue: 81 / 255)
  static let board = Color(red: 9 / 255, green: 13 / 255, blue: 24 / 255)
  static let dim = Color.white.opacity(0.6)
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
          .fill(index < state.slotsCleared ? Brand.green : Color.white.opacity(0.25))
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
        .foregroundColor(ahead ? Brand.green : .white)
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
            .foregroundColor(Brand.green)
          BoardLabel(text: "QUICK-TIME DROP", color: Brand.green)
        }
        Text(state.title)
          .font(.system(size: 22, weight: .heavy))
          .foregroundColor(.white)
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
          .foregroundColor(Brand.green)
        Countdown(state: state)
          .font(.system(size: 20, weight: .bold, design: .rounded))
          .foregroundColor(.white)
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
        BoardLabel(text: state.leagueName.uppercased(), color: Brand.blue)
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
          .foregroundColor(.white)
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
          .foregroundColor(Brand.green)
        Text("+\(state.points)")
          .foregroundColor(.white)
      }
      .font(.system(size: 13, weight: .bold, design: .rounded))
    } else {
      Text("\(state.myScore)")
        .font(.system(size: 14, weight: .heavy, design: .rounded))
        .monospacedDigit()
        .foregroundColor(state.iAmAhead ? Brand.green : .white)
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
        .foregroundColor(Brand.green)
        .frame(maxWidth: 56)
    } else {
      Text("\(state.opponentScore)")
        .font(.system(size: 14, weight: .heavy, design: .rounded))
        .monospacedDigit()
        .foregroundColor(state.iAmAhead ? .white : Brand.green)
    }
  }
}

/// The single dot shown when another app's activity shares the island.
struct MinimalMark: View {
  let state: BoardState

  var body: some View {
    if state.isDrop {
      Image(systemName: "bolt.fill")
        .foregroundColor(Brand.green)
    } else {
      Text("\(state.myScore)")
        .font(.system(size: 12, weight: .heavy, design: .rounded))
        .monospacedDigit()
        .minimumScaleFactor(0.5)
        .foregroundColor(state.iAmAhead ? Brand.green : .white)
    }
  }
}

// MARK: - Dynamic Island, expanded

struct ExpandedLeading: View {
  let state: BoardState

  var body: some View {
    if state.isDrop {
      VStack(alignment: .leading, spacing: 0) {
        BoardLabel(text: "DROP", color: Brand.green)
        Text("+\(state.points)")
          .font(.system(size: 28, weight: .heavy, design: .rounded))
          .foregroundColor(.white)
      }
      .padding(.leading, 4)
    } else {
      ScoreColumn(name: state.myName, score: state.myScore, ahead: state.iAmAhead, alignment: .leading)
        .padding(.leading, 4)
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
          .foregroundColor(Brand.green)
          .frame(maxWidth: 110, alignment: .trailing)
      }
      .padding(.trailing, 4)
    } else {
      ScoreColumn(name: state.opponentName, score: state.opponentScore, ahead: !state.iAmAhead, alignment: .trailing)
        .padding(.trailing, 4)
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
          .foregroundColor(.white)
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
              .foregroundColor(Brand.blue)
          }
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(.horizontal, 4)
    } else {
      HStack(spacing: 6) {
        SlotPips(state: state)
        Text("\(state.slotsLabel) slots")
          .font(.system(size: 13, weight: .semibold))
          .foregroundColor(.white)
        Spacer(minLength: 8)
        HStack(spacing: 3) {
          Text("ENDS IN")
          Text(state.endsAt, style: .relative)
        }
        .font(.system(size: 12, weight: .semibold))
        .foregroundColor(Brand.dim)
        .lineLimit(1)
      }
      .padding(.horizontal, 4)
    }
  }
}
