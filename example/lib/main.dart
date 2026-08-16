import 'dart:developer' as developer;
import 'package:flutter/material.dart';
import 'package:pointer_interceptor/pointer_interceptor.dart';
import 'package:tmap_flutter_sdk/tmap_flutter_sdk.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();

  // TMAP JavaScript AppKey 초기화
  // SK OpenAPI 포털(https://openapi.sk.com)에서 발급받은 AppKey를 입력하거나,
  // 앱 실행 후 상단 열쇠(🔑) 아이콘을 눌러 키를 설정할 수 있습니다.
  AuthRepository.initialize(
    appKey: 'YOUR_TMAP_APP_KEY_HERE',
  );

  runApp(const TMapExampleApp());
}

class TMapExampleApp extends StatelessWidget {
  const TMapExampleApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'TMAP Flutter Demo',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF0064FF),
          brightness: Brightness.light,
        ),
        useMaterial3: true,
      ),
      darkTheme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF0064FF),
          brightness: Brightness.dark,
        ),
        useMaterial3: true,
      ),
      themeMode: ThemeMode.system,
      home: const MapHomeScreen(),
    );
  }
}

class MapHomeScreen extends StatefulWidget {
  const MapHomeScreen({super.key});

  @override
  State<MapHomeScreen> createState() => _MapHomeScreenState();
}

class _MapHomeScreenState extends State<MapHomeScreen> {
  TMapController? _controller;
  int _currentTab = 0;

  // 지도 상태
  LatLng _center = const LatLng(37.5665, 126.9780); // 서울시청
  int _zoom = 16;
  double _bearing = 0.0;
  double _pitch = 0.0;
  TMapType _mapType = TMapType.road;

  // 오버레이 상태
  final List<Marker> _markers = [];
  Clusterer? _clusterer;
  final List<Polyline> _polylines = [];
  final List<Polygon> _polygons = [];
  final List<Circle> _circles = [];
  final List<Rectangle> _rectangles = [];
  final List<InfoWindow> _infoWindows = [];

  String _statusMessage = 'TMAP 로딩 대기 중...';

  @override
  void initState() {
    super.initState();
    final key = AuthRepository.instance.appKey;
    if (key.isEmpty || key == 'YOUR_TMAP_APP_KEY_HERE') {
      _statusMessage = '상단 열쇠(🔑) 버튼을 눌러 TMAP AppKey를 입력해주세요.';
    }
  }

  void _onMapCreated(TMapController controller) {
    setState(() {
      _controller = controller;
      _statusMessage = '지도 준비 완료';
    });
  }

  void _onMapTap(LatLng latLng) {
    setState(() {
      _infoWindows.clear();
      _statusMessage =
          '지도 클릭: ${latLng.latitude.toStringAsFixed(5)}, ${latLng.longitude.toStringAsFixed(5)}';
    });
  }

  void _onMarkerTap(String markerId, LatLng latLng, int zoom) {
    String name = '마커 ($markerId)';
    final found = _markers.where((m) => m.markerId == markerId).firstOrNull;
    final foundLabel = found?.label;
    if (foundLabel != null && foundLabel.isNotEmpty) {
      name = foundLabel;
    } else if (markerId == 'seoul_city_hall') {
      name = '서울특별시청';
    } else if (markerId == 'gwanghwamun') {
      name = '광화문광장';
    } else if (markerId.startsWith('cluster_marker_')) {
      final num = markerId.replaceAll('cluster_marker_', '');
      name = '스팟 #$num';
    }

    setState(() {
      _infoWindows.clear();
      _infoWindows.add(
        InfoWindow(
          infoWindowId: 'marker_popup_$markerId',
          position: latLng,
          content:
              '<div style="white-space: nowrap; word-break: keep-all; padding: 6px 12px; font-weight: bold; font-size: 13px; color: #1a1a1a; display: inline-block;">📍 $name</div>',
          type: 1, // 말풍선 꼬리가 달린 TMAP InfoWindow
          anchor: 'bottom',
          offset: const Point(0, -42), // 마커 핀(높이 약 38~42px) 위로 띄워 마커 본체를 가리지 않음
        ),
      );
      _statusMessage = '마커 탭: $name';
    });
  }

  // 1. 기본 마커 추가
  void _addBasicMarkers() {
    final controller = _controller;
    if (controller == null) return;

    final m1 = Marker(
      markerId: 'seoul_city_hall',
      position: const LatLng(37.5665, 126.9780),
      label: '서울시청',
      labelBackgroundColor: Colors.blue.shade700,
      labelTextColor: Colors.white,
    );

    final m2 = Marker(
      markerId: 'gwanghwamun',
      position: const LatLng(37.5759, 126.9768),
      label: '광화문광장',
      labelBackgroundColor: Colors.red.shade700,
      labelTextColor: Colors.white,
    );

    setState(() {
      _markers.clear();
      _markers.addAll([m1, m2]);
      _clusterer = null;
      _infoWindows.clear();
      _statusMessage = '기본 마커 2개 추가됨 (마커를 터치해보세요)';
    });
  }

  // 2. 50개 마커 클러스터러 생성
  void _toggleClusterer() {
    final controller = _controller;
    if (controller == null) return;

    if (_clusterer != null) {
      setState(() {
        _clusterer = null;
        _infoWindows.clear();
        _statusMessage = '클러스터러 해제됨';
      });
      return;
    }

    final clusterMarkers = <Marker>[];
    for (int i = 0; i < 50; i++) {
      final lat = 37.5665 + (i % 10 - 5) * 0.003;
      final lng = 126.9780 + (i ~/ 10 - 2.5) * 0.003;
      clusterMarkers.add(
        Marker(
          markerId: 'cluster_marker_$i',
          position: LatLng(lat, lng),
        ),
      );
    }

    setState(() {
      _markers.clear();
      _infoWindows.clear();
      _clusterer = Clusterer(
        markers: clusterMarkers,
        maxClusterZoom: 17,
        minClusterCount: 2,
        gridSize: 60,
      );
      _statusMessage = '50개 마커 클러스터러 활성화';
    });
  }

  // 3. 도형 그리기
  void _drawShapes() {
    final controller = _controller;
    if (controller == null) return;

    const polyline = Polyline(
      polylineId: 'route_line_1',
      points: [
        LatLng(37.5665, 126.9780),
        LatLng(37.5700, 126.9820),
        LatLng(37.5759, 126.9768),
      ],
      strokeColor: Colors.deepPurple,
      strokeWidth: 6,
    );

    const circle = Circle(
      circleId: 'circle_1',
      center: LatLng(37.5665, 126.9780),
      radius: 300,
      strokeColor: Colors.blue,
      fillColor: Color(0x332196F3),
    );

    const infoWindow = InfoWindow(
      infoWindowId: 'info_city_hall',
      position: LatLng(37.5665, 126.9780),
      content:
          '<div style="white-space: nowrap; word-break: keep-all; padding: 6px 10px; font-weight: bold; font-size: 12px; color: #1a1a1a;">🏢 서울특별시청 중심구역</div>',
      type: 1,
    );

    setState(() {
      _polylines.clear();
      _polylines.add(polyline);
      _circles.clear();
      _circles.add(circle);
      _infoWindows.clear();
      _infoWindows.add(infoWindow);
      _statusMessage = '선, 원, 인포윈도우 추가됨';
    });
  }

  // 4. 경로 탐색 요청 (서울시청 -> 강남역)
  Future<void> _searchRoute() async {
    final controller = _controller;
    if (controller == null) return;

    setState(() => _statusMessage = '서울시청 -> 강남역 경로 탐색 중...');

    try {
      const start = LatLng(37.5665, 126.9780); // 서울시청
      const end = LatLng(37.4979, 127.0276); // 강남역

      final route = await controller.getRoutePlan(start: start, end: end);
      if (route != null && route.path.isNotEmpty) {
        setState(() {
          _polylines.clear();
          _polylines.add(
            Polyline(
              polylineId: 'car_route_path',
              points: route.path,
              strokeColor: const Color(0xFF0064FF),
              strokeWidth: 7,
            ),
          );
          _statusMessage =
              '탐색 완료: ${(route.totalDistance / 1000).toStringAsFixed(1)}km, 약 ${(route.totalTime / 60).round()}분 (택시비 ${route.taxiFare}원)';
        });

        // 경로에 맞게 줌 조정
        await controller.fitBounds(
          const LatLngBounds(
            southWest: LatLng(37.4900, 126.9700),
            northEast: LatLng(37.5700, 127.0350),
          ),
          padding: 50,
        );
      } else {
        setState(() => _statusMessage = '경로 탐색 결과가 없습니다.');
      }
    } catch (e) {
      setState(() => _statusMessage = '경로 탐색 오류: $e');
      developer.log('Route search error: $e');
    }
  }

  // 모든 오버레이 삭제
  void _clearAllOverlays() {
    _controller?.clearAll();
    setState(() {
      _markers.clear();
      _clusterer = null;
      _polylines.clear();
      _polygons.clear();
      _circles.clear();
      _rectangles.clear();
      _infoWindows.clear();
      _statusMessage = '모든 오버레이 초기화됨';
    });
  }

  // AppKey 설정 다이얼로그
  void _showAppKeyDialog() {
    final textController =
        TextEditingController(text: AuthRepository.instance.appKey);
    showDialog<void>(
      context: context,
      builder: (ctx) => PointerInterceptor(
        child: AlertDialog(
          title: const Text('TMAP AppKey 설정'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'TMAP OpenAPI 웹사이트에서 발급받은 JavaScript AppKey를 입력해주세요.',
                style: TextStyle(fontSize: 13),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: textController,
                autofocus: true,
                decoration: const InputDecoration(
                  border: OutlineInputBorder(),
                  labelText: 'AppKey',
                  hintText: '발급받은 키 입력',
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('취소'),
            ),
            FilledButton(
              onPressed: () {
                final newKey = textController.text.trim();
                if (newKey.isNotEmpty) {
                  AuthRepository.instance.appKey = newKey;
                  Navigator.of(ctx).pop();
                  setState(() {
                    _statusMessage = 'AppKey가 업데이트되었습니다. 지도를 새로고침합니다.';
                  });
                }
              },
              child: const Text('적용'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'TMAP Flutter SDK',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.vpn_key_outlined),
            tooltip: 'AppKey 설정',
            onPressed: _showAppKeyDialog,
          ),
          IconButton(
            icon: const Icon(Icons.delete_outline),
            tooltip: '오버레이 초기화',
            onPressed: _clearAllOverlays,
          ),
        ],
      ),
      body: Column(
        children: [
          // 상단 상태 바
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            color: Theme.of(context).colorScheme.surfaceContainerHighest,
            child: Text(
              _statusMessage,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),

          // 지도 영역
          Expanded(
            child: Stack(
              children: [
                TMap(
                  key: ValueKey(AuthRepository.instance.appKey),
                  center: _center,
                  zoom: _zoom,
                  bearing: _bearing,
                  pitch: _pitch,
                  mapType: _mapType,
                  markers: _markers,
                  clusterer: _clusterer,
                  polylines: _polylines,
                  polygons: _polygons,
                  circles: _circles,
                  rectangles: _rectangles,
                  infoWindows: _infoWindows,
                  onMapCreated: _onMapCreated,
                  onMapTap: _onMapTap,
                  onMarkerTap: _onMarkerTap,
                  onCameraIdle: (center, zoom, bearing, pitch) {
                    setState(() {
                      _center = center;
                      _zoom = zoom;
                      _bearing = bearing;
                      _pitch = pitch;
                    });
                  },
                ),

                // 우측 빠른 줌 컨트롤
                Positioned(
                  right: 16,
                  bottom: 16,
                  child: PointerInterceptor(
                    child: Column(
                      children: [
                        FloatingActionButton.small(
                          heroTag: 'zoom_in',
                          onPressed: () => _controller?.zoomIn(),
                          child: const Icon(Icons.add),
                        ),
                        const SizedBox(height: 8),
                        FloatingActionButton.small(
                          heroTag: 'zoom_out',
                          onPressed: () => _controller?.zoomOut(),
                          child: const Icon(Icons.remove),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),

          // 하단 컨트롤 패널
          _buildControlPanel(),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentTab,
        onDestinationSelected: (index) => setState(() => _currentTab = index),
        destinations: const [
          NavigationDestination(
              icon: Icon(Icons.camera_alt_outlined), label: '3D 제어'),
          NavigationDestination(
              icon: Icon(Icons.pin_drop_outlined), label: '마커/클러스터'),
          NavigationDestination(
              icon: Icon(Icons.polyline_outlined), label: '도형'),
          NavigationDestination(
              icon: Icon(Icons.route_outlined), label: 'TData 경로'),
        ],
      ),
    );
  }

  Widget _buildControlPanel() {
    switch (_currentTab) {
      case 0:
        return _build3DCameraTab();
      case 1:
        return _buildMarkerTab();
      case 2:
        return _buildShapesTab();
      case 3:
        return _buildTDataTab();
      default:
        return const SizedBox.shrink();
    }
  }

  Widget _build3DCameraTab() {
    return Container(
      padding: const EdgeInsets.all(12),
      color: Theme.of(context).cardColor,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              const Text('기울기 (Pitch): ', style: TextStyle(fontSize: 12)),
              Expanded(
                child: Slider(
                  value: _pitch,
                  min: 0,
                  max: 60,
                  divisions: 6,
                  label: '${_pitch.round()}°',
                  onChanged: (v) {
                    setState(() => _pitch = v);
                    _controller?.setPitch(v);
                  },
                ),
              ),
              Text('${_pitch.round()}°', style: const TextStyle(fontSize: 12)),
            ],
          ),
          Row(
            children: [
              const Text('회전 (Bearing): ', style: TextStyle(fontSize: 12)),
              Expanded(
                child: Slider(
                  value: _bearing,
                  min: 0,
                  max: 360,
                  divisions: 12,
                  label: '${_bearing.round()}°',
                  onChanged: (v) {
                    setState(() => _bearing = v);
                    _controller?.setBearing(v);
                  },
                ),
              ),
              Text('${_bearing.round()}°',
                  style: const TextStyle(fontSize: 12)),
            ],
          ),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: TMapType.values.map((type) {
                final isSelected = _mapType == type;
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    label: Text(type.name.toUpperCase()),
                    selected: isSelected,
                    onSelected: (_) {
                      setState(() => _mapType = type);
                      _controller?.setMapType(type);
                    },
                  ),
                );
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMarkerTab() {
    return Container(
      padding: const EdgeInsets.all(12),
      color: Theme.of(context).cardColor,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: [
          ElevatedButton.icon(
            onPressed: _addBasicMarkers,
            icon: const Icon(Icons.add_location_alt),
            label: const Text('기본 마커 2개'),
          ),
          ElevatedButton.icon(
            onPressed: _toggleClusterer,
            icon: const Icon(Icons.hub_outlined),
            label: Text(_clusterer == null ? '클러스터 켜기' : '클러스터 끄기'),
          ),
        ],
      ),
    );
  }

  Widget _buildShapesTab() {
    return Container(
      padding: const EdgeInsets.all(12),
      color: Theme.of(context).cardColor,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: [
          ElevatedButton.icon(
            onPressed: _drawShapes,
            icon: const Icon(Icons.draw_outlined),
            label: const Text('도형/인포윈도우 추가'),
          ),
          OutlinedButton.icon(
            onPressed: _clearAllOverlays,
            icon: const Icon(Icons.clear),
            label: const Text('지우기'),
          ),
        ],
      ),
    );
  }

  Widget _buildTDataTab() {
    return Container(
      padding: const EdgeInsets.all(12),
      color: Theme.of(context).cardColor,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: [
          ElevatedButton.icon(
            onPressed: _searchRoute,
            icon: const Icon(Icons.directions_car),
            label: const Text('시청 → 강남역 경로'),
          ),
          ElevatedButton.icon(
            onPressed: () async {
              final controller = _controller;
              if (controller == null) return;
              setState(() => _statusMessage = '주변 맛집 POI 검색 중...');
              final list = await controller.searchPoi(
                keyword: '맛집',
                center: const LatLng(37.5665, 126.9780),
                radius: 1,
                count: 10,
              );
              if (list.isNotEmpty) {
                final poiMarkers = <Marker>[];
                for (int i = 0; i < list.length; i++) {
                  final poi = list[i];
                  poiMarkers.add(
                    Marker(
                      markerId: 'poi_${poi.id}_$i',
                      position: poi.point,
                      label: poi.name,
                      labelBackgroundColor: Colors.orange.shade800,
                      labelTextColor: Colors.white,
                    ),
                  );
                }
                setState(() {
                  _markers.clear();
                  _markers.addAll(poiMarkers);
                  _statusMessage =
                      '맛집 ${list.length}곳 발견: ${list.map((e) => e.name).take(3).join(', ')}...';
                });
              } else {
                setState(() => _statusMessage = '검색된 주변 맛집이 없습니다.');
              }
            },
            icon: const Icon(Icons.restaurant),
            label: const Text('주변 맛집 POI'),
          ),
        ],
      ),
    );
  }
}
