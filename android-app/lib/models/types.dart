/// 地理位置数据模型 - 对齐桌面版 TypeScript types.ts
library;

/// 坐标参考系
enum Crs { wgs84, gcj02 }

/// 定位数据点 - 对齐桌面版 LocationFix
class LocationFix {
  final Crs crs;
  final double lat;
  final double lon;
  final double? ele;
  final int? source; // 定位来源
  final int timestamp; // Unix 毫秒时间戳
  final double accuracy; // 米

  LocationFix({
    required this.crs,
    required this.lat,
    required this.lon,
    this.ele,
    this.source,
    required this.timestamp,
    required this.accuracy,
  });

  /// 从 Android Location 对象转换
  factory LocationFix.fromAndroid({
    required double latitude,
    required double longitude,
    double? altitude,
    required int provider,
    required int time,
    required double accuracy,
  }) {
    return LocationFix(
      crs: Crs.wgs84,
      lat: latitude,
      lon: longitude,
      ele: altitude,
      source: provider,
      timestamp: time,
      accuracy: accuracy,
    );
  }

  Map<String, dynamic> toMap() => {
    'crs': crs.name,
    'lat': lat,
    'lon': lon,
    'ele': ele,
    'source': source,
    'timestamp': timestamp,
    'accuracy': accuracy,
  };
}

/// 轨迹点 - 对齐桌面版 TrackPoint
class TrackPoint {
  final double lat;
  final double lon;
  final double? ele;
  final double distance; // 累计距离（米）
  final int? time; // 时间戳
  final int segment; // 所属分段

  TrackPoint({
    required this.lat,
    required this.lon,
    this.ele,
    required this.distance,
    this.time,
    required this.segment,
  });
}

/// 轨迹统计 - 对齐桌面版 TrackStats
class TrackStats {
  final double distance;
  final double ascent;
  final double descent;
  final double? max;
  final double? min;
  final int count;
  final int elevationCount;
  final int? duration; // 毫秒

  TrackStats({
    required this.distance,
    required this.ascent,
    required this.descent,
    this.max,
    this.min,
    required this.count,
    required this.elevationCount,
    this.duration,
  });
}

/// 航点 - 对齐桌面版 Waypoint
class Waypoint {
  final double lat;
  final double lon;
  final String name;
  final String? desc;

  Waypoint({required this.lat, required this.lon, required this.name, this.desc});
}

/// GPX 轨迹 - 对齐桌面版 Track
class Track {
  final String id;
  final String name;
  final bool demo;
  final String kind; // 'track' or 'route'
  final List<List<TrackPoint>> segments;
  final List<Waypoint> waypoints;
  final TrackStats stats;
  final List<String> warnings;

  Track({
    required this.id,
    required this.name,
    required this.demo,
    required this.kind,
    required this.segments,
    required this.waypoints,
    required this.stats,
    required this.warnings,
  });
}
