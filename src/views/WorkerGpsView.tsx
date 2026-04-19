import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Clock, CheckCircle, XCircle, Play, Pause, Navigation } from 'lucide-react';
import { api } from '../services/api';

interface Props {
  workerId: number | null;
}

export function WorkerGpsView({ workerId }: Props) {
  const [tracking, setTracking] = useState(false);
  const [inZone, setInZone] = useState<boolean | null>(null);
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');
  const [checkedIn, setCheckedIn] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const watchRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current);
    };
  }, []);

  const startTracking = () => {
    if (!workerId) {
      setError('Вы не привязаны как работник. Обратитесь к директору.');
      return;
    }
    if (!navigator.geolocation) {
      setError('GPS не поддерживается в вашем браузере');
      return;
    }

    setTracking(true);
    setError('');
    setCheckedIn(true);

    // Check-in
    api.checkin(workerId).catch(console.error);

    // Start GPS watch
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setPosition({ lat: latitude, lng: longitude });
      },
      (err) => { setError(`GPS ошибка: ${err.message}`); },
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
    );

    // Send GPS every 30 seconds
    intervalRef.current = window.setInterval(async () => {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 });
        });
        const result = await api.logGps(workerId, pos.coords.latitude, pos.coords.longitude);
        setInZone(result.in_zone);
        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      } catch (e) { console.error('GPS log error:', e); }
    }, 30000);

    // Timer
    const startTime = Date.now();
    timerRef.current = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    // Immediate first log
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const result = await api.logGps(workerId, pos.coords.latitude, pos.coords.longitude);
          setInZone(result.in_zone);
          setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        } catch (e) { console.error(e); }
      },
      (err) => setError(`GPS: ${err.message}`),
      { enableHighAccuracy: true }
    );
  };

  const stopTracking = () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (watchRef.current) { navigator.geolocation.clearWatch(watchRef.current); watchRef.current = null; }
    
    setTracking(false);
    
    if (workerId) {
      api.checkout(workerId).catch(console.error);
      setCheckedIn(false);
    }
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <div className={`rounded-3xl p-8 text-center transition-colors ${
        tracking 
          ? inZone 
            ? 'bg-gradient-to-br from-green-500 to-emerald-600' 
            : 'bg-gradient-to-br from-red-500 to-rose-600'
          : 'bg-gradient-to-br from-gray-700 to-gray-900'
      }`}>
        <div className="text-white">
          {tracking ? (
            <>
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-white/20 flex items-center justify-center">
                {inZone ? <CheckCircle className="w-10 h-10" /> : <XCircle className="w-10 h-10" />}
              </div>
              <h2 className="text-2xl font-bold mb-1">
                {inZone === null ? 'Определяем...' : inZone ? 'Вы на объекте ✅' : 'Вы вне зоны ⚠️'}
              </h2>
              <p className="text-white/70 text-sm">GPS-трекинг активен • каждые 30 сек</p>
            </>
          ) : (
            <>
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-white/10 flex items-center justify-center">
                <Navigation className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-bold mb-1">SOLTO GPS</h2>
              <p className="text-white/70 text-sm">Начните смену для отслеживания</p>
            </>
          )}
        </div>
      </div>

      {/* Timer */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Время работы</p>
        <p className="text-5xl font-bold tracking-tight text-gray-900 font-mono">{formatTime(elapsed)}</p>
      </div>

      {/* Start/Stop Button */}
      <button
        onClick={tracking ? stopTracking : startTracking}
        className={`w-full py-4 rounded-2xl text-lg font-bold flex items-center justify-center gap-3 transition-all active:scale-95 ${
          tracking
            ? 'bg-red-500 text-white hover:bg-red-600'
            : 'bg-indigo-600 text-white hover:bg-indigo-700'
        }`}
      >
        {tracking ? <><Pause size={24} /> Завершить смену</> : <><Play size={24} /> Начать смену</>}
      </button>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-600">
          {error}
        </div>
      )}

      {/* Position Info */}
      {position && (
        <div className="bg-gray-50 rounded-2xl p-4">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Текущие координаты</p>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <MapPin size={14} className="text-indigo-500" />
            <span className="font-mono">{position.lat.toFixed(6)}, {position.lng.toFixed(6)}</span>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="bg-blue-50 rounded-2xl p-4 space-y-2">
        <p className="text-xs font-bold text-blue-700">📋 Инструкция</p>
        <ul className="text-xs text-blue-600 space-y-1">
          <li>1. Включите GPS на телефоне</li>
          <li>2. Нажмите «Начать смену» когда придёте на объект</li>
          <li>3. Не закрывайте приложение во время работы</li>
          <li>4. Нажмите «Завершить смену» по окончании рабочего дня</li>
        </ul>
      </div>
    </div>
  );
}
