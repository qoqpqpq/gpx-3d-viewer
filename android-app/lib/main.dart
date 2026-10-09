/// 山径 Ridgeline Android 客户端 - 主入口
/// 最小闭环：定位 → 匹配 → 偏航告警
library;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'navigation/guidance.dart';
import 'models/types.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const RidgelineApp());
}

class RidgelineApp extends StatelessWidget {
  const RidgelineApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: '山径 Ridgeline',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF325940)),
        useMaterial3: true,
      ),
      home: const GuidancePage(),
    );
  }
}

/// 引导页面 - 最小闭环界面
class GuidancePage extends StatefulWidget {
  const GuidancePage({super.key});

  @override
  State<GuidancePage> createState() => _GuidancePageState();
}

class _GuidancePageState extends State<GuidancePage> {
  final _guidance = Guidance();
  final _methodChannel = MethodChannel('ridgeline/navigation');
  final _eventChannel = EventChannel('ridgeline/location');
  late final StreamSubscription _locationSubscription;
  
  // 状态
  Track? _track;
  GuidanceResult? _result;
  LocationFix? _lastFix;
  bool _isActive = false;
  String _statusText = '准备出发';
  String _detailText = '点击"开始引导"启动定位';

  @override
  void initState() {
    super.initState();
    _loadDemoTrack();
    _listenForLocationUpdates();
  }

  @override
  void dispose() {
    _locationSubscription.cancel();
    super.dispose();
  }

  /// 加载演示路线（合成数据）
  Future<void> _loadDemoTrack() async {
    final track = _createDemoTrack();
    setState(() {
      _track = track;
      _guidance.reset();
      _statusText = '演示路线已加载';
      _detailText = '${track.segments.length} 段 · ${track.stats.distance ~/ 1000}km';
    });
  }

  /// 创建演示 GPX 轨迹（北京香山公园）
  Track _createDemoTrack() {
    final points = <TrackPoint>[
      TrackPoint(lat: 40.017, lon: 116.208, ele: 120, distance: 0, segment: 0),
      TrackPoint(lat: 40.018, lon: 116.210, ele: 135, distance: 150, segment: 0),
      TrackPoint(lat: 40.019, lon: 116.212, ele: 150, distance: 300, segment: 0),
      TrackPoint(lat: 40.020, lon: 116.214, ele: 170, distance: 450, segment: 0),
      TrackPoint(lat: 40.021, lon: 116.216, ele: 190, distance: 600, segment: 0),
      TrackPoint(lat: 40.022, lon: 116.218, ele: 210, distance: 750, segment: 0),
      TrackPoint(lat: 40.023, lon: 116.220, ele: 230, distance: 900, segment: 0),
      TrackPoint(lat: 40.024, lon: 116.222, ele: 250, distance: 1050, segment: 0),
      TrackPoint(lat: 40.025, lon: 116.224, ele: 270, distance: 1200, segment: 0),
      TrackPoint(lat: 40.026, lon: 116.226, ele: 290, distance: 1350, segment: 0),
    ];

    return Track(
      id: 'demo-xiangshan',
      name: '香山公园（演示）',
      demo: true,
      kind: 'track',
      segments: [points],
      waypoints: [],
      stats: TrackStats(
        distance: 1350,
        ascent: 170,
        descent: 0,
        max: 290,
        min: 120,
        count: 10,
        elevationCount: 10,
        duration: null,
      ),
      warnings: ['演示数据 · 仅用于测试'],
    );
  }

  /// 监听定位更新
  Future<void> _listenForLocationUpdates() async {
    _locationSubscription = _eventChannel.receiveBroadcastStream().listen(
      _onLocationUpdate,
      onError: (error) => _updateStatus('定位错误', error.toString()),
    );
  }

  /// 处理定位更新
  void _onLocationUpdate(dynamic data) {
    if (!_isActive || _track == null) return;

    final fix = LocationFix(
      crs: Crs.wgs84,
      lat: data['lat'] as double,
      lon: data['lon'] as double,
      ele: (data['ele'] as double?) ?? null,
      source: data['source'] as int?,
      timestamp: data['timestamp'] as int,
      accuracy: data['accuracy'] as double,
    );

    setState(() {
      _lastFix = fix;
      _result = _guidance.update(_track!, fix);
      _updateStatusFromResult(_result!);
    });

    // 偏航告警
    if (_result!.alert) {
      _playAlert();
    }
  }

  /// 更新状态显示
  void _updateStatusFromResult(GuidanceResult result) {
    final state = result.state;
    final match = result.match;

    switch (state) {
      case GuidanceState.onRoute:
        _statusText = '沿路线行进';
        _detailText = '距线 ${match!.distance.toStringAsFixed(0)}m · 精度 ±${_lastFix!.accuracy.toStringAsFixed(0)}m';
      case GuidanceState.pending:
        _statusText = '检测中...';
        _detailText = '距线 ${match!.distance.toStringAsFixed(0)}m · 等待确认';
      case GuidanceState.offRoute:
        _statusText = '⚠️ 已偏离路线';
        _detailText = '距线 ${match!.distance.toStringAsFixed(0)}m · 请回到路线';
      case GuidanceState.uncertain:
        _statusText = '定位不确定';
        _detailText = '等待有效定位...';
    }
  }

  void _updateStatus(String status, String detail) {
    setState(() {
      _statusText = status;
      _detailText = detail;
    });
  }

  /// 播放偏航告警
  Future<void> _playAlert() async {
    try {
      await SystemChannels.platform.invokeMethod('ridgeline/playAlert');
    } catch (_) {
      // 忽略播放失败
    }
  }

  /// 开始引导
  Future<void> _startGuidance() async {
    if (_track == null) return;
    try {
      await _methodChannel.invokeMethod('startLocation');
      setState(() {
        _isActive = true;
        _guidance.reset();
        _updateStatus('正在启动定位...', '请确保已授权位置权限');
      });
    } catch (e) {
      _updateStatus('启动失败', e.toString());
    }
  }

  /// 停止引导
  Future<void> _stopGuidance() async {
    await _methodChannel.invokeMethod('stopLocation');
    setState(() {
      _isActive = false;
      _updateStatus('引导已停止', '点击开始可重新开始');
    });
  }

  @override
  Widget build(BuildContext context) {
    final isOnRoute = _result?.state == GuidanceState.onRoute;
    final isOffRoute = _result?.state == GuidanceState.offRoute;

    return Scaffold(
      appBar: AppBar(
        title: const Text('山径 Ridgeline'),
        actions: [
          IconButton(
            icon: const Icon(Icons.navigation),
            onPressed: () => _showMap(),
            tooltip: '打开地图',
          ),
        ],
      ),
      body: Column(
        children: [
          // 状态卡片
          Container(
            margin: const EdgeInsets.all(16),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: isOnRoute
                  ? Colors.green.shade100
                  : isOffRoute
                      ? Colors.red.shade100
                      : Colors.grey.shade100,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: isOnRoute
                    ? Colors.green.shade400
                    : isOffRoute
                        ? Colors.red.shade400
                        : Colors.grey.shade300,
              ),
            ),
            child: Column(
              children: [
                Icon(
                  isOnRoute
                      ? Icons.directions_walk
                      : isOffRoute
                          ? Icons.warning_amber_rounded
                          : Icons.explore,
                  size: 48,
                  color: isOnRoute
                      ? Colors.green.shade700
                      : isOffRoute
                          ? Colors.red.shade700
                          : Colors.grey.shade600,
                ),
                const SizedBox(height: 8),
                Text(
                  _statusText,
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  _detailText,
                  style: const TextStyle(
                    fontSize: 14,
                    color: Colors.grey,
                  ),
                ),
              ],
            ),
          ),

          // 进度信息
          if (_result?.match != null)
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 16),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.grey.shade50,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  _buildStat('沿线进度', '${((_result!.match!.progress) / 1000).toStringAsFixed(2)} km'),
                  _buildStat('距线距离', '${_result!.match!.distance.toStringAsFixed(0)} m'),
                  _buildStat('定位精度', '±${_lastFix!.accuracy.toStringAsFixed(0)} m'),
                ],
              ),
            ),

          const Spacer(),

          // 控制按钮
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Expanded(
                  child: FilledButton(
                    onPressed: _isActive ? null : _startGuidance,
                    child: const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.play_arrow),
                        SizedBox(width: 8),
                        Text('开始引导'),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: OutlinedButton(
                    onPressed: _isActive ? _stopGuidance : null,
                    child: const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.stop),
                        SizedBox(width: 8),
                        Text('停止'),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),

          // 提示信息
          const Padding(
            padding: EdgeInsets.all(16),
            child: Text(
              '最小闭环原型：定位 → 匹配 → 偏航告警\n\n'
              '• 开始引导后需要位置权限\n'
              '• 偏航超过 40m 持续 5 秒触发告警\n'
              '• 回到 20m 内持续 3 秒清除告警\n'
              '• 锁屏状态下持续定位和提醒',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 12,
                color: Colors.grey,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStat(String label, String value) {
    return Column(
      children: [
        Text(label, style: const TextStyle(fontSize: 12, color: Colors.grey)),
        const SizedBox(height: 4),
        Text(
          value,
          style: const TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
          ),
        ),
      ],
    );
  }

  /// 打开地图（WebView）
  void _showMap() {
    showDialog(
      context: context,
      builder: (context) => Dialog(
        backgroundColor: Colors.transparent,
        child: Stack(
          children: [
            Positioned.fill(
              child: WebView(
                initialUrl: 'http://127.0.0.1:5173/',
                javascriptMode: JavascriptMode.unrestricted,
                onWebViewCreated: (controller) {
                  controller.addJavaScriptChannel(
                    'RidgelineBridge',
                    onMessageReceived: (message) {
                      print('WebView message: ${message.message}');
                    },
                  );
                },
              ),
            ),
            Positioned(
              top: 16,
              right: 16,
              child: IconButton(
                icon: const Icon(Icons.close, color: Colors.white),
                onPressed: () => Navigator.pop(context),
                style: ButtonStyle(
                  backgroundColor: WidgetStateProperty.all(Colors.black54),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
