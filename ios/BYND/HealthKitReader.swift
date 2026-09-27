import Foundation
import HealthKit

enum HealthError: LocalizedError {
    case message(String)
    var errorDescription: String? { if case .message(let text) = self { return text }; return nil }
}

/// Foreground, read-only access. A completed authorization request cannot reveal read permission.
final class HealthKitReader {
    private let store = HKHealthStore()
    private let calendar = Calendar.current
    private let queue = DispatchQueue(label: "cc.ccwu.bynd.health")
    private var types: [String: HKSampleType] {
        ["sleep": HKObjectType.categoryType(forIdentifier: .sleepAnalysis)!,
         "steps": HKObjectType.quantityType(forIdentifier: .stepCount)!,
         "exercise": HKObjectType.quantityType(forIdentifier: .appleExerciseTime)!,
         "cycle": HKObjectType.categoryType(forIdentifier: .menstrualFlow)!]
    }
    func perform(action: String, types names: [String], completion: @escaping (Result<[String: Any], Error>) -> Void) {
        guard HKHealthStore.isHealthDataAvailable() else { completion(.failure(HealthError.message("此设备不支持 Apple 健康"))); return }
        let chosen = Set(names)
        guard !chosen.isEmpty, chosen.count == names.count, chosen.allSatisfy({ types[$0] != nil }) else {
            completion(.failure(HealthError.message("健康数据类型无效"))); return
        }
        if action == "authorize" {
            store.requestAuthorization(toShare: [], read: Set(chosen.compactMap { types[$0] as HKObjectType? })) { success, error in
                if let error = error { completion(.failure(error)) }
                else if success { completion(.success(["authorizationCompleted": true])) }
                else { completion(.failure(HealthError.message("健康授权请求未完成"))) }
            }
        } else if action == "read" { read(chosen, completion: completion) }
        else { completion(.failure(HealthError.message("不支持的健康操作"))) }
    }
    private func dateString(_ date: Date) -> String {
        let formatter = DateFormatter(); formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.calendar = calendar; formatter.timeZone = calendar.timeZone; formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }
    private func iso(_ date: Date) -> String { ISO8601DateFormatter().string(from: date) }
    private func samples(type: HKSampleType, start: Date, end: Date, completion: @escaping ([HKSample], Error?) -> Void) -> HKSampleQuery {
        let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: [])
        let query = HKSampleQuery(sampleType: type, predicate: predicate, limit: 20000,
                                  sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: true)]) { _, values, error in
            completion(values ?? [], error)
        }
        store.execute(query); return query
    }
    private func read(_ names: Set<String>, completion: @escaping (Result<[String: Any], Error>) -> Void) {
        queue.async { self.readQueued(names, completion: completion) }
    }
    private func readQueued(_ names: Set<String>, completion: @escaping (Result<[String: Any], Error>) -> Void) {
        let now = Date(), start = calendar.startOfDay(for: Date())
        let previous = calendar.date(byAdding: .day, value: -1, to: start)!
        let group = DispatchGroup()
        var records: [[String: Any]] = [], flowDays: [String] = [], errors: [Error] = [], queries: [HKQuery] = []
        // All result mutations and the timeout/completion decision use one serial queue.
        var finished = false
        for name in names {
            let type = types[name]!
            group.enter()
            let since = name == "cycle" ? calendar.date(byAdding: .day, value: -180, to: start)! : name == "sleep" ? previous : start
            let query = samples(type: type, start: since, end: now) { [weak self] values, error in
                guard let self = self else { return }
                self.queue.async {
                    defer { group.leave() }
                    if finished { return }
                    if let error = error { errors.append(error); return }
                    if values.count >= 20000 { errors.append(HealthError.message("健康样本过多，无法安全汇总")); return }
                    if name == "cycle" {
                        flowDays = Array(Set(values.compactMap { sample -> String? in
                            guard let sample = sample as? HKCategorySample, sample.value != HKCategoryValueMenstrualFlow.none.rawValue else { return nil }
                            return self.dateString(sample.startDate)
                        })).sorted()
                    } else if name == "sleep" {
                        // asleepUnspecified = 1; asleepCore/Deep/REM = 3/4/5. Exclude inBed=0 and awake=2.
                        let intervals = values.compactMap { sample -> (Date, Date)? in
                            guard let sample = sample as? HKCategorySample, [1, 3, 4, 5].contains(sample.value) else { return nil }
                            let a = max(sample.startDate, previous), b = min(sample.endDate, now)
                            return b > a ? (a, b) : nil
                        }.sorted { $0.0 < $1.0 }
                        // Partition by wake-day, then union overlaps across phone/watch sources.
                        let days = Dictionary(grouping: intervals, by: { self.dateString($0.1) })
                        for (day, pieces) in days {
                            var union: [(Date, Date)] = []
                            for piece in pieces {
                                if let last = union.last, piece.0 <= last.1 { union[union.count - 1] = (last.0, max(last.1, piece.1)) }
                                else { union.append(piece) }
                            }
                            guard let first = union.first, let last = union.last else { continue }
                            let minutes = Int(union.reduce(0.0) { $0 + $1.1.timeIntervalSince($1.0) } / 60)
                            records.append(["date": day, "observedAt": self.iso(last.1), "values": ["sleepMinutes": min(minutes, 1440), "bedtime": self.iso(first.0), "wakeTime": self.iso(last.1)]])
                        }
                    } else {
                        // StatisticsQuery aggregates cumulative quantities across sources; never sum raw step samples.
                        guard let observed = values.map(\.endDate).filter({ $0 <= now }).max(), let quantity = type as? HKQuantityType else { return }
                        group.enter()
                        let predicate = HKQuery.predicateForSamples(withStart: start, end: now, options: .strictStartDate)
                        let statistic = HKStatisticsQuery(quantityType: quantity, quantitySamplePredicate: predicate, options: .cumulativeSum) { _, result, error in
                            self.queue.async {
                                defer { group.leave() }
                                if finished { return }
                                if let error = error { errors.append(error); return }
                                if let sum = result?.sumQuantity() {
                                    let amount = sum.doubleValue(for: name == "steps" ? .count() : .minute())
                                    if amount.isFinite && amount >= 0 {
                                        records.append(["date": self.dateString(start), "observedAt": self.iso(observed), "values": [name == "steps" ? "steps" : "exerciseMinutes": Int(amount.rounded())]])
                                    }
                                }
                            }
                        }
                        queries.append(statistic); self.store.execute(statistic)
                    }
                }
            }
            queries.append(query)
        }
        queue.asyncAfter(deadline: .now() + 45) {
            guard !finished else { return }; finished = true
            queries.forEach { self.store.stop($0) }
            completion(.failure(HealthError.message("健康读取超时")))
        }
        group.notify(queue: queue) {
            guard !finished else { return }; finished = true
            if let error = errors.first { completion(.failure(error)) }
            else { completion(.success(["version": 1, "records": records, "flowDays": flowDays])) }
        }
    }
}
