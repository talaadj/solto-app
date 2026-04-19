import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, Plus, X, Save, Edit3, Trash2, Phone, MapPin, Clock, 
  DollarSign, UserCheck, UserX, AlertTriangle, Map, ClipboardList,
  ChevronDown, FileText, Search
} from 'lucide-react';
import { api } from '../services/api';
import { Worker, Geofence, Attendance, Project } from '../types';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';

// Leaflet imports
import { MapContainer, TileLayer, Marker, Popup, Circle, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const greenIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});
const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

// Map click handler component
function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onMapClick(e.latlng.lat, e.latlng.lng) });
  return null;
}

interface Props {
  projects: Project[];
  selectedProject: Project | null;
}

type Tab = 'workers' | 'map' | 'attendance';

export function WorkforceView({ projects, selectedProject }: Props) {
  const [tab, setTab] = useState<Tab>('workers');
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [gpsData, setGpsData] = useState<any[]>([]);
  const [showAddWorker, setShowAddWorker] = useState(false);
  const [loading, setLoading] = useState(true);

  // Add worker form
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPosition, setNewPosition] = useState('Разнорабочий');
  const [newRate, setNewRate] = useState('');
  const [newStart, setNewStart] = useState('08:00');
  const [newEnd, setNewEnd] = useState('18:00');

  // Geofence
  const [geoRadius, setGeoRadius] = useState(200);
  const [settingGeofence, setSettingGeofence] = useState(false);

  useEffect(() => {
    loadData();
  }, [selectedProject]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [w, g, a, gps] = await Promise.all([
        api.getWorkers(selectedProject?.id),
        api.getGeofences(selectedProject?.id),
        api.getAttendance({ project_id: selectedProject?.id }),
        api.getLatestGps(),
      ]);
      setWorkers(w);
      setGeofences(g);
      setAttendance(a);
      setGpsData(gps);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleAddWorker = async () => {
    if (!newName.trim()) return;
    try {
      await api.createWorker({
        full_name: newName.trim(),
        phone: newPhone,
        position: newPosition,
        daily_rate: parseFloat(newRate) || 0,
        work_start: newStart,
        work_end: newEnd,
        project_id: selectedProject?.id,
      });
      setNewName(''); setNewPhone(''); setNewPosition('Разнорабочий');
      setNewRate(''); setNewStart('08:00'); setNewEnd('18:00');
      setShowAddWorker(false);
      loadData();
    } catch (e: any) { alert(e.message); }
  };

  const handleDeleteWorker = async (id: number) => {
    if (!confirm('Удалить работника?')) return;
    await api.deleteWorker(id);
    loadData();
  };

  const handleCheckin = async (workerId: number) => {
    try {
      await api.checkin(workerId, selectedProject?.id);
      loadData();
    } catch (e: any) { alert(e.message); }
  };

  const handleCheckout = async (workerId: number) => {
    try {
      await api.checkout(workerId);
      loadData();
    } catch (e: any) { alert(e.message); }
  };

  const handleMapClick = async (lat: number, lng: number) => {
    if (!settingGeofence) return;
    try {
      await api.createGeofence({
        project_id: selectedProject?.id,
        center_lat: lat,
        center_lng: lng,
        radius_meters: geoRadius,
        name: selectedProject?.name || 'Стройплощадка',
      });
      setSettingGeofence(false);
      loadData();
    } catch (e: any) { alert(e.message); }
  };

  const handleDeleteGeofence = async (id: number) => {
    await api.deleteGeofence(id);
    loadData();
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const todayAttendance = attendance.filter(a => a.date === todayStr);

  // Workers with today's status
  const workersWithStatus = workers.map(w => {
    const att = todayAttendance.find(a => a.worker_id === w.id);
    const gps = gpsData.find(g => g.worker_id === w.id);
    return { ...w, attendance: att, lastGps: gps };
  });

  const tabItems = [
    { id: 'workers' as Tab, label: 'Работники', icon: Users, count: workers.length },
    { id: 'map' as Tab, label: 'Карта', icon: Map },
    { id: 'attendance' as Tab, label: 'Табель', icon: ClipboardList },
  ];

  // Default center: Bishkek
  const mapCenter: [number, number] = geofences.length > 0 
    ? [geofences[0].center_lat, geofences[0].center_lng] 
    : [42.8746, 74.5698];

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-2xl">
        {tabItems.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
              tab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <t.icon size={16} />
            <span className="hidden sm:inline">{t.label}</span>
            {t.count !== undefined && (
              <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Workers Tab */}
      {tab === 'workers' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              Работники ({workers.length})
            </h3>
            <button
              onClick={() => setShowAddWorker(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors"
            >
              <Plus size={16} /> Нанять
            </button>
          </div>

          {workersWithStatus.length === 0 && !loading && (
            <div className="text-center py-12 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-400">Нет работников</p>
              <p className="text-[10px] text-gray-400 mt-1">Нажмите «Нанять» чтобы добавить</p>
            </div>
          )}

          {workersWithStatus.map(w => {
            const isPresent = w.attendance?.status === 'present';
            const isLate = w.attendance?.status === 'late';
            const isCheckedIn = !!w.attendance?.check_in && !w.attendance?.check_out;
            const inZone = w.lastGps?.in_zone;

            return (
              <Card key={w.id} className="border-l-4" style={{ borderLeftColor: isPresent ? '#22c55e' : isLate ? '#f59e0b' : '#e5e7eb' }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h4 className="font-bold text-gray-900">{w.full_name}</h4>
                      {isPresent && <Badge color="bg-green-100 text-green-700">На объекте</Badge>}
                      {isLate && <Badge color="bg-amber-100 text-amber-700">Опоздал</Badge>}
                      {!w.attendance && <Badge color="bg-gray-100 text-gray-500">Отсутствует</Badge>}
                      {inZone !== undefined && (
                        <Badge color={inZone ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>
                          {inZone ? '📍 В зоне' : '⚠️ Вне зоны'}
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><Phone size={11} /> {w.phone || '—'}</span>
                      <span className="flex items-center gap-1"><Clock size={11} /> {w.work_start}–{w.work_end}</span>
                      <span className="flex items-center gap-1"><DollarSign size={11} /> {w.daily_rate} сом/день</span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">{w.position}</p>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    {!isCheckedIn ? (
                      <button onClick={() => handleCheckin(w.id)} className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-bold hover:bg-green-600 transition-colors">
                        <UserCheck size={14} />
                      </button>
                    ) : (
                      <button onClick={() => handleCheckout(w.id)} className="px-3 py-1.5 bg-orange-500 text-white rounded-lg text-xs font-bold hover:bg-orange-600 transition-colors">
                        <UserX size={14} />
                      </button>
                    )}
                    <button onClick={() => handleDeleteWorker(w.id)} className="px-3 py-1.5 bg-gray-100 text-gray-400 rounded-lg text-xs hover:bg-red-50 hover:text-red-500 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Map Tab */}
      {tab === 'map' && (
        <div className="space-y-3">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              Геозона • {geofences.length > 0 ? `${geofences.length} зон` : 'Не установлена'}
            </h3>
            <div className="flex items-center gap-2">
              {settingGeofence && (
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500">Радиус:</label>
                  <input
                    type="range" min="50" max="500" step="50"
                    value={geoRadius}
                    onChange={e => setGeoRadius(Number(e.target.value))}
                    className="w-24"
                  />
                  <span className="text-xs font-bold text-gray-700">{geoRadius}м</span>
                </div>
              )}
              <button
                onClick={() => setSettingGeofence(!settingGeofence)}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
                  settingGeofence 
                    ? 'bg-red-100 text-red-600 hover:bg-red-200' 
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                {settingGeofence ? 'Отмена' : '+ Геозона'}
              </button>
            </div>
          </div>

          {settingGeofence && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 flex items-center gap-2">
              <MapPin size={14} /> Кликните на карту, чтобы установить центр геозоны
            </div>
          )}

          <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm" style={{ height: 400 }}>
            <MapContainer center={mapCenter} zoom={15} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapClickHandler onMapClick={handleMapClick} />
              
              {/* Geofences */}
              {geofences.map(g => (
                <Circle
                  key={g.id}
                  center={[g.center_lat, g.center_lng]}
                  radius={g.radius_meters}
                  pathOptions={{ color: '#6366f1', fillColor: '#6366f1', fillOpacity: 0.15 }}
                >
                  <Popup>
                    <div className="text-center">
                      <p className="font-bold">{g.name}</p>
                      <p className="text-xs text-gray-500">Радиус: {g.radius_meters}м</p>
                      <button onClick={() => handleDeleteGeofence(g.id)} className="mt-1 text-xs text-red-500 underline">Удалить</button>
                    </div>
                  </Popup>
                </Circle>
              ))}

              {/* Worker markers from GPS */}
              {gpsData.map(gps => {
                const worker = workers.find(w => w.id === gps.worker_id);
                return (
                  <Marker key={gps.id} position={[gps.lat, gps.lng]} icon={gps.in_zone ? greenIcon : redIcon}>
                    <Popup>
                      <b>{worker?.full_name || 'Рабочий'}</b><br/>
                      {gps.in_zone ? '✅ В зоне' : '❌ Вне зоны'}<br/>
                      <span className="text-xs text-gray-500">{new Date(gps.logged_at).toLocaleTimeString()}</span>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </div>

          {/* Geofence list */}
          {geofences.length > 0 && (
            <div className="space-y-2">
              {geofences.map(g => (
                <div key={g.id} className="flex items-center justify-between bg-white border border-gray-100 rounded-xl p-3">
                  <div>
                    <p className="text-sm font-bold text-gray-800">{g.name}</p>
                    <p className="text-[10px] text-gray-400">Радиус: {g.radius_meters}м • {g.center_lat.toFixed(4)}, {g.center_lng.toFixed(4)}</p>
                  </div>
                  <button onClick={() => handleDeleteGeofence(g.id)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Attendance Tab */}
      {tab === 'attendance' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              Табель за сегодня ({todayStr})
            </h3>
            <button
              onClick={() => {
                const html = `
                  <html><head><meta charset="utf-8"><title>Табель ${todayStr}</title>
                  <style>body{font-family:sans-serif;padding:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px;text-align:left;font-size:12px}th{background:#f5f5f5;font-weight:bold}.title{font-size:18px;font-weight:bold;margin-bottom:10px}</style>
                  </head><body>
                  <div class="title">Табель учёта рабочего времени — ${todayStr}</div>
                  <p>Проект: ${selectedProject?.name || 'Все'}</p>
                  <table>
                  <tr><th>Работник</th><th>Приход</th><th>Уход</th><th>Часов</th><th>В зоне %</th><th>Статус</th></tr>
                  ${todayAttendance.map(a => `<tr>
                    <td>${a.worker_name}</td>
                    <td>${a.check_in ? new Date(a.check_in).toLocaleTimeString() : '—'}</td>
                    <td>${a.check_out ? new Date(a.check_out).toLocaleTimeString() : '—'}</td>
                    <td>${a.hours_worked}</td>
                    <td>${a.in_zone_percent}%</td>
                    <td>${a.status === 'present' ? '✅' : a.status === 'late' ? '⚠️' : '❌'}</td>
                  </tr>`).join('')}
                  </table>
                  <p style="margin-top:10px;font-size:11px;color:#888">Итого работников: ${todayAttendance.length}</p>
                  </body></html>`;
                const w = window.open('', '_blank');
                if (w) { w.document.write(html); w.document.close(); w.print(); }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-200 transition-colors"
            >
              <FileText size={14} /> PDF
            </button>
          </div>

          {todayAttendance.length === 0 ? (
            <div className="text-center py-10 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
              <ClipboardList className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">Нет записей за сегодня</p>
              <p className="text-[10px] text-gray-400 mt-1">Отметьте работников на вкладке «Работники»</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-200">
                    <th className="text-left py-2 px-3">Работник</th>
                    <th className="text-left py-2 px-3">Приход</th>
                    <th className="text-left py-2 px-3">Уход</th>
                    <th className="text-right py-2 px-3">Часов</th>
                    <th className="text-right py-2 px-3">В зоне</th>
                    <th className="text-center py-2 px-3">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {todayAttendance.map(a => (
                    <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2.5 px-3 font-medium text-gray-800">{a.worker_name}</td>
                      <td className="py-2.5 px-3 text-gray-500">{a.check_in ? new Date(a.check_in).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                      <td className="py-2.5 px-3 text-gray-500">{a.check_out ? new Date(a.check_out).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                      <td className="py-2.5 px-3 text-right font-bold">{a.hours_worked}</td>
                      <td className="py-2.5 px-3 text-right">
                        <span className={`text-xs font-bold ${a.in_zone_percent >= 80 ? 'text-green-600' : a.in_zone_percent >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                          {a.in_zone_percent}%
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {a.status === 'present' ? '✅' : a.status === 'late' ? '⚠️' : '❌'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Summary */}
          {todayAttendance.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-green-50 rounded-2xl p-4 text-center">
                <p className="text-2xl font-bold text-green-700">{todayAttendance.filter(a => a.status === 'present').length}</p>
                <p className="text-[10px] text-green-600 font-bold uppercase">На объекте</p>
              </div>
              <div className="bg-amber-50 rounded-2xl p-4 text-center">
                <p className="text-2xl font-bold text-amber-700">{todayAttendance.filter(a => a.status === 'late').length}</p>
                <p className="text-[10px] text-amber-600 font-bold uppercase">Опоздали</p>
              </div>
              <div className="bg-gray-50 rounded-2xl p-4 text-center">
                <p className="text-2xl font-bold text-gray-700">{workers.length - todayAttendance.length}</p>
                <p className="text-[10px] text-gray-500 font-bold uppercase">Отсутствуют</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Worker Modal */}
      {showAddWorker && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowAddWorker(false)}>
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold">Нанять работника</h3>
              <button onClick={() => setShowAddWorker(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 block">ФИО *</label>
                <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Иванов Иван Иванович"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" autoFocus />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 block">Телефон</label>
                <input type="tel" value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="+996 ..."
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 block">Должность</label>
                <select value={newPosition} onChange={e => setNewPosition(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none">
                  <option>Разнорабочий</option>
                  <option>Каменщик</option>
                  <option>Арматурщик</option>
                  <option>Плотник</option>
                  <option>Сварщик</option>
                  <option>Электрик</option>
                  <option>Водитель</option>
                  <option>Другое</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 block">Начало</label>
                  <input type="time" value={newStart} onChange={e => setNewStart(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 block">Конец</label>
                  <input type="time" value={newEnd} onChange={e => setNewEnd(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 block">Ставка (сом/день)</label>
                <input type="text" inputMode="numeric" value={newRate} onChange={e => setNewRate(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="1500"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowAddWorker(false)} className="flex-1 py-3 border border-gray-200 rounded-2xl font-medium hover:bg-gray-50 transition-colors">Отмена</button>
                <button onClick={handleAddWorker} className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-colors">Нанять</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
