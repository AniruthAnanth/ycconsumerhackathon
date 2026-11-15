import ExpoModulesCore
import Vision

/// Reads a captured proof photo on the device with Apple's Vision framework.
///
/// Why Vision's built-in requests: VNClassifyImageRequest ships with iOS and runs on Core ML,
/// so the app bundles no model and makes no network call, and a still photo is read in well
/// under a second. The read is only a hint shown while the server referee works; it never
/// awards points.
public final class OnDeviceRefereeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("OnDeviceReferee")

    // False on the iOS simulator, where Vision's models are handed a blank image (see
    // PhotoAnalyzer.isSimulator). The app asks this before offering the feature at all.
    Function("isSupported") { () -> Bool in
      return !PhotoAnalyzer.isSimulator
    }

    // Expo runs an AsyncFunction body on a background queue, so the synchronous Vision calls
    // never block the UI thread. The function resolves with `available: false` instead of
    // rejecting, so a device that can't run Vision is a normal result for the caller.
    AsyncFunction("analyze") { (uri: String, detectPeople: Bool, detectHands: Bool) -> [String: Any] in
      return PhotoAnalyzer.analyze(uri: uri, detectPeople: detectPeople, detectHands: detectHands)
    }
  }
}

enum PhotoAnalyzer {
  /// Labels below this confidence are noise for a one-line hint.
  private static let minimumLabelConfidence: Float = 0.1
  private static let maximumLabels = 12
  /// Hand joints below this confidence are guesses about parts of the hand the photo hides.
  private static let minimumJointConfidence: Float = 0.3

  /// Measured on Revyl's iOS 27 simulators: the classifier and the hand-pose model run without
  /// an error but are handed a blank image, whichever way the photo is passed in (file URL,
  /// CGImage, CIImage, pixel buffer, CPU-only or not), so every photo reads as "night sky" with
  /// no hands. Saying nothing is better than saying that, so the simulator never calls Vision.
  static var isSimulator: Bool {
    #if targetEnvironment(simulator)
    return true
    #else
    return false
    #endif
  }

  static func analyze(uri: String, detectPeople: Bool, detectHands: Bool) -> [String: Any] {
    let started = Date()
    if isSimulator {
      return unavailable("Vision's models do not see the photo on the iOS simulator. Run on an iPhone.", since: started)
    }
    guard let url = localFileURL(from: uri), FileManager.default.fileExists(atPath: url.path) else {
      return unavailable("The photo is not a file on this device.", since: started)
    }
    // Created from the file so Vision applies the photo's EXIF orientation itself.
    let handler = VNImageRequestHandler(url: url, options: [:])

    var result: [String: Any] = ["available": true]
    do {
      result["labels"] = try classify(handler)
    } catch {
      return unavailable("Vision could not classify the photo here: \(error.localizedDescription)", since: started)
    }
    // People and hands are extras: when one of them fails the labels are still worth returning,
    // so the key is simply left out.
    if detectPeople, let people = try? countPeople(handler) {
      result["people"] = people
    }
    if detectHands, let fingers = try? fingersUpPerHand(handler) {
      result["fingersUp"] = fingers
    }
    result["elapsedMs"] = elapsedMs(since: started)
    return result
  }

  // MARK: - Vision requests

  private static func classify(_ handler: VNImageRequestHandler) throws -> [[String: Any]] {
    let request = VNClassifyImageRequest()
    try handler.perform([request])
    let observations = request.results ?? []
    return observations
      .filter { $0.confidence >= minimumLabelConfidence }
      .sorted { $0.confidence > $1.confidence }
      .prefix(maximumLabels)
      .map { observation -> [String: Any] in
        ["identifier": observation.identifier, "confidence": Double(observation.confidence)]
      }
  }

  private static func countPeople(_ handler: VNImageRequestHandler) throws -> Int {
    let request = VNDetectHumanRectanglesRequest()
    try handler.perform([request])
    return (request.results ?? []).count
  }

  /// One entry per detected hand: how many of its fingers are extended.
  private static func fingersUpPerHand(_ handler: VNImageRequestHandler) throws -> [Int] {
    let request = VNDetectHumanHandPoseRequest()
    request.maximumHandCount = 2
    try handler.perform([request])
    var counts: [Int] = []
    for hand in request.results ?? [] {
      let joints = try hand.recognizedPoints(.all)
      if let count = extendedFingerCount(joints) {
        counts.append(count)
      }
    }
    return counts
  }

  // MARK: - Finger counting

  /// Counts extended fingers from hand-pose joints, or nil when the wrist isn't visible.
  ///
  /// A finger is extended when its tip is clearly farther from the wrist than its middle
  /// knuckle; a curled finger folds the tip back toward the palm. The thumb folds sideways
  /// across the palm instead, so it is measured against the little finger's base knuckle.
  private static func extendedFingerCount(
    _ joints: [VNHumanHandPoseObservation.JointName: VNRecognizedPoint]
  ) -> Int? {
    guard let wrist = joints[.wrist], wrist.confidence >= minimumJointConfidence else {
      return nil
    }
    let fingers: [(tip: VNHumanHandPoseObservation.JointName, knuckle: VNHumanHandPoseObservation.JointName)] = [
      (.indexTip, .indexPIP),
      (.middleTip, .middlePIP),
      (.ringTip, .ringPIP),
      (.littleTip, .littlePIP),
    ]
    var count = 0
    for finger in fingers {
      if isFarther(joints[finger.tip], than: joints[finger.knuckle], from: wrist) {
        count += 1
      }
    }
    if let littleBase = joints[.littleMCP], littleBase.confidence >= minimumJointConfidence,
       isFarther(joints[.thumbTip], than: joints[.thumbIP], from: littleBase) {
      count += 1
    }
    return count
  }

  /// True when `tip` is at least 15% farther from `origin` than `knuckle` is. The margin keeps a
  /// half-bent finger from counting.
  private static func isFarther(_ tip: VNRecognizedPoint?, than knuckle: VNRecognizedPoint?, from origin: VNRecognizedPoint) -> Bool {
    guard let tip = tip, let knuckle = knuckle,
          tip.confidence >= minimumJointConfidence, knuckle.confidence >= minimumJointConfidence else {
      return false
    }
    return distance(tip, origin) > distance(knuckle, origin) * 1.15
  }

  private static func distance(_ a: VNRecognizedPoint, _ b: VNRecognizedPoint) -> Double {
    let dx = Double(a.location.x - b.location.x)
    let dy = Double(a.location.y - b.location.y)
    return (dx * dx + dy * dy).squareRoot()
  }

  // MARK: - Helpers

  private static func localFileURL(from uri: String) -> URL? {
    if uri.hasPrefix("/") {
      return URL(fileURLWithPath: uri)
    }
    guard let url = URL(string: uri), url.isFileURL else {
      return nil
    }
    return url
  }

  private static func unavailable(_ reason: String, since started: Date) -> [String: Any] {
    return [
      "available": false,
      "reason": reason,
      "labels": [[String: Any]](),
      "elapsedMs": elapsedMs(since: started),
    ]
  }

  private static func elapsedMs(since started: Date) -> Double {
    return Date().timeIntervalSince(started) * 1000
  }
}
