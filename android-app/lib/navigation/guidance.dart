/// 导航匹配与偏航检测 - 移植自桌面版 src/core/navigation.ts
/// 核心算法完全对齐，确保测试向量一致
library;

import 'dart:math' as math;
import '../models/types.dart';

/// 局部平面坐标转换（米制）
double radians(double deg) => deg * math.pi / 180.0;

/// 将经纬度转换为局部平面坐标（米）
List<double> localXY(TrackPoint point, LocationFix fix) {
  final lat0 = radians(fix.lat);
  final lat = radians(point.lat);
  final lon = radians(point.lon - fix.lon);
  // 简化 Web Mercator 近似
  final x = fix.lon * 111320.0 * cos(lat0) + lon * 111320.0 * cos(lat0) - fix.lon * 111320.0 * cos(lat0);
  final y = lat * 110574.0 - lat0 * 110574.0;
  return [x, y];
}

/// 匹配结果
class Match {
  final double distance; // 到路线的最近距离（米）
  final double progress; // 沿线里程（米）
  final int segment; // 分段索引
  final TrackPoint point; // 最近点
  final bool requiresReanchor; // 是否需要重新锚定

  Match({
    required this.distance,
    required this.progress,
    required this.segment,
    required this.point,
    this.requiresReanchor = false,
  });
}

/// 轨迹匹配 - 对齐桌面版 matchRoute
Match matchRoute(Track track, LocationFix fix, {double? previous, double window = 400, int? activeSegment}) {
  Match? nearest, global;

  for (final segment in track.segments) {
    for (var i = 0; i < segment.length; i++) {
      final a = segment[math.max(0, i - 1)];
      final b = segment[i];
      final ax = localXY(a, fix)[0];
      final ay = localXY(a, fix)[1];
      final bx = localXY(b, fix)[0];
      final by = localXY(b, fix)[1];
      final dx = bx - ax;
      final dy = by - ay;
      final t = (dx * dx + dy * dy == 0)
          ? 0.0
          : math.max(0.0, math.min(1.0, -(ax * dx + ay * dy) / (dx * dx + dy * dy)));
      final d = math.sqrt(math.pow(ax + t * dx, 2) + math.pow(ay + t * dy, 2));
      final progress = a.distance + (b.distance - a.distance) * t;
      final candidate = Match(
        distance: d,
        progress: progress,
        segment: a.segment,
        point: t < 0.5 ? a : b,
      );

      if (global == null || d < global.distance) global = candidate;
      if ((activeSegment == null || a.segment == activeSegment) &&
          (previous == null || (progress - previous).abs() <= window) &&
          (nearest == null || d < nearest.distance)) {
        nearest = candidate;
      }
    }
  }

  // 远距离跳点需要重新锚定
  if (global != null &&
      ((previous != null && (global.progress - previous).abs() > window) ||
          (activeSegment != null && global.segment != activeSegment)) &&
      (nearest == null || nearest.distance > global.distance + 100)) {
    return Match(
      distance: global.distance,
      progress: global.progress,
      segment: global.segment,
      point: global.point,
      requiresReanchor: true,
    );
  }

  return nearest ?? global!;
}

/// 引导状态
enum GuidanceState { onRoute, pending, offRoute, uncertain }

/// 引导结果
class GuidanceResult {
  final GuidanceState state;
  final Match? match;
  final bool alert;
  final String? reason;

  GuidanceResult({
    required this.state,
    this.match,
    required this.alert,
    this.reason,
  });
}

/// 引导状态机 - 对齐桌面版 Guidance class
class Guidance {
  GuidanceState state = GuidanceState.uncertain;
  double? progress;
  int? segment;
  int? outsideAt;
  int? insideAt;
  int lastTimestamp = 0;
  bool off = false;

  void reset({double? progress, int? segment}) {
    this.progress = progress;
    this.segment = segment;
    outsideAt = null;
    insideAt = null;
    lastTimestamp = 0;
    off = false;
    state = GuidanceState.uncertain;
  }

  /// 更新引导状态
  GuidanceResult update(Track track, LocationFix fix, {int? now}) {
    now ??= DateTime.now().millisecondsSinceEpoch;

    // 验证定位数据有效性
    if (fix.crs != Crs.wgs84 ||
        !fix.timestamp.isFinite ||
        !now.isFinite ||
        !fix.accuracy.isFinite ||
        fix.accuracy < 0 ||
        fix.accuracy > 35 ||
        now - fix.timestamp > 10000 ||
        fix.timestamp > now + 1000 ||
        fix.timestamp <= lastTimestamp ||
        fix.lat.abs() > 90 ||
        fix.lon.abs() > 180) {
      outsideAt = null;
      insideAt = null;
      state = GuidanceState.uncertain;
      return GuidanceResult(state: state, alert: false);
    }

    // 定位间隔过大，重置连续计时
    if (lastTimestamp > 0 && fix.timestamp - lastTimestamp > 5000) {
      outsideAt = null;
      insideAt = null;
    }
    lastTimestamp = fix.timestamp;

    final match = matchRoute(track, fix, previous: progress, window: 400, activeSegment: segment);

    if (match.requiresReanchor) {
      outsideAt = null;
      insideAt = null;
      state = GuidanceState.uncertain;
      return GuidanceResult(state: state, match: match, alert: false, reason: 'reanchor');
    }

    // 保持附近投影移动
    if (match.distance < 200) {
      progress = match.progress;
    }

    final enterThreshold = math.max(40.0, fix.accuracy * 2);
    var alert = false;

    if (match.distance > enterThreshold) {
      insideAt = null;
      outsideAt ??= fix.timestamp;
      if (!off && fix.timestamp - outsideAt! >= 5000) {
        off = true;
        alert = true;
      }
      state = off ? GuidanceState.offRoute : GuidanceState.pending;
    } else if (match.distance < 20) {
      outsideAt = null;
      insideAt ??= fix.timestamp;
      if (off && fix.timestamp - insideAt! >= 3000) {
        off = false;
      }
      state = off ? GuidanceState.offRoute : GuidanceState.onRoute;
      if (!off) progress = match.progress;
    } else {
      outsideAt = null;
      insideAt = null;
      state = off ? GuidanceState.offRoute : GuidanceState.onRoute;
    }

    return GuidanceResult(state: state, match: match, alert: alert);
  }
}
