import React, { useState, useEffect, useMemo } from 'react';
import { CalendarDays, Plus, Trash2, X, ChevronLeft, ChevronRight, GripVertical } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../services/api';
import { Project } from '../types';

interface ScheduleTask {
  id: number;
  project_id: number;
  title: string;
  start_date: string;
  end_date: string;
  progress: number;
  status: string;
  color: string;
  sort_order: number;
}

interface Props {
  projects: Project[];
  selectedProject: Project | null;
}

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#0ea5e9', '#3b82f6'];

export function GanttView({ projects, selectedProject }: Props) {
  const [tasks, setTasks] = useState<ScheduleTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [viewOffset, setViewOffset] = useState(0); // weeks offset from today
  const [newTask, setNewTask] = useState({ title: '', start_date: '', end_date: '', color: COLORS[0] });

  const projectId = selectedProject?.id;

  useEffect(() => {
    if (projectId) loadTasks();
  }, [projectId]);

  const loadTasks = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const data = await api.getSchedule(projectId);
      setTasks(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const addTask = async () => {
    if (!projectId || !newTask.title || !newTask.start_date || !newTask.end_date) return;
    try {
      await api.createScheduleTask({
        project_id: projectId,
        title: newTask.title,
        start_date: newTask.start_date,
        end_date: newTask.end_date,
        color: newTask.color,
      });
      setNewTask({ title: '', start_date: '', end_date: '', color: COLORS[Math.floor(Math.random() * COLORS.length)] });
      setShowAddModal(false);
      loadTasks();
    } catch (e) { console.error(e); }
  };

  const updateProgress = async (id: number, progress: number) => {
    const clamped = Math.max(0, Math.min(100, progress));
    try {
      await api.updateScheduleTask(id, { progress: clamped, status: clamped >= 100 ? 'completed' : clamped > 0 ? 'in_progress' : 'planned' });
      setTasks(prev => prev.map(t => t.id === id ? { ...t, progress: clamped, status: clamped >= 100 ? 'completed' : clamped > 0 ? 'in_progress' : 'planned' } : t));
    } catch (e) { console.error(e); }
  };

  const deleteTask = async (id: number) => {
    if (!confirm('Удалить этап?')) return;
    try {
      await api.deleteScheduleTask(id);
      setTasks(prev => prev.filter(t => t.id !== id));
    } catch (e) { console.error(e); }
  };

  // Generate visible days (4 weeks)
  const visibleDays = useMemo(() => {
    const days: Date[] = [];
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - start.getDay() + 1 + viewOffset * 7); // Start from Monday
    for (let i = 0; i < 28; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    return days;
  }, [viewOffset]);

  const startDate = visibleDays[0];
  const endDate = visibleDays[visibleDays.length - 1];

  const getTaskPosition = (task: ScheduleTask) => {
    const taskStart = new Date(task.start_date);
    const taskEnd = new Date(task.end_date);
    const totalDays = 28;
    const dayWidth = 100 / totalDays;

    const startDiff = Math.max(0, (taskStart.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const endDiff = Math.min(totalDays, (taskEnd.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24) + 1);

    if (endDiff <= 0 || startDiff >= totalDays) return null;

    return {
      left: `${Math.max(0, startDiff * dayWidth)}%`,
      width: `${Math.max(dayWidth, (endDiff - Math.max(0, startDiff)) * dayWidth)}%`,
    };
  };

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const monthNames = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
  const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  if (!selectedProject) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <CalendarDays size={48} className="mb-4 opacity-30" />
        <p className="text-lg font-medium">Выберите проект</p>
        <p className="text-sm mt-1">Для просмотра графика выберите проект в меню</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <CalendarDays size={28} className="text-indigo-600" />
            График работ
          </h2>
          <p className="text-sm text-gray-500 mt-1">{selectedProject.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setViewOffset(v => v - 4)} className="p-2 hover:bg-gray-100 rounded-xl"><ChevronLeft size={20} /></button>
          <button onClick={() => setViewOffset(0)} className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-xl font-medium">Сегодня</button>
          <button onClick={() => setViewOffset(v => v + 4)} className="p-2 hover:bg-gray-100 rounded-xl"><ChevronRight size={20} /></button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 text-sm font-medium"
          >
            <Plus size={16} /> Добавить этап
          </button>
        </div>
      </div>

      {/* Gantt Chart */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {/* Timeline Header - Months */}
        <div className="flex border-b border-gray-100">
          <div className="w-56 flex-shrink-0 p-3 bg-gray-50 border-r border-gray-100 text-xs font-semibold text-gray-500 uppercase">
            Этапы
          </div>
          <div className="flex-1 relative">
            <div className="flex">
              {visibleDays.map((day, i) => {
                const isToday = day.toISOString().split('T')[0] === todayStr;
                const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                const showMonth = i === 0 || day.getDate() === 1;
                return (
                  <div
                    key={i}
                    className={`flex-1 text-center border-r border-gray-50 py-1 ${isWeekend ? 'bg-gray-50' : ''} ${isToday ? 'bg-indigo-50' : ''}`}
                  >
                    {showMonth && (
                      <div className="text-[9px] font-bold text-indigo-600 uppercase">{monthNames[day.getMonth()]}</div>
                    )}
                    <div className={`text-[10px] ${isToday ? 'text-indigo-600 font-bold' : 'text-gray-400'}`}>
                      {day.getDate()}
                    </div>
                    <div className={`text-[8px] ${isToday ? 'text-indigo-500' : 'text-gray-300'}`}>
                      {dayNames[(day.getDay() + 6) % 7]}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Tasks */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <CalendarDays size={36} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">Нет этапов</p>
            <p className="text-sm mt-1">Добавьте первый этап строительства</p>
          </div>
        ) : (
          tasks.map(task => {
            const pos = getTaskPosition(task);
            const statusColors: Record<string, string> = {
              planned: 'text-gray-500', in_progress: 'text-blue-600', completed: 'text-green-600'
            };
            return (
              <div key={task.id} className="flex border-b border-gray-50 group hover:bg-gray-50/50">
                {/* Task Info */}
                <div className="w-56 flex-shrink-0 p-3 border-r border-gray-100 flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: task.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] font-medium ${statusColors[task.status] || 'text-gray-400'}`}>
                        {task.progress}%
                      </span>
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${task.progress}%`, backgroundColor: task.color }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 flex gap-1">
                    <button onClick={() => updateProgress(task.id, task.progress + 10)} className="p-1 hover:bg-green-100 rounded text-green-600 text-xs font-bold" title="+10%">+</button>
                    <button onClick={() => deleteTask(task.id)} className="p-1 hover:bg-red-100 rounded text-red-400"><Trash2 size={12} /></button>
                  </div>
                </div>

                {/* Bar */}
                <div className="flex-1 relative h-12 flex items-center">
                  {/* Background grid */}
                  {visibleDays.map((day, i) => {
                    const isToday = day.toISOString().split('T')[0] === todayStr;
                    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                    return (
                      <div key={i} className={`absolute top-0 bottom-0 border-r border-gray-50 ${isWeekend ? 'bg-gray-50/50' : ''} ${isToday ? 'bg-indigo-50/50' : ''}`}
                        style={{ left: `${(i / 28) * 100}%`, width: `${100 / 28}%` }} />
                    );
                  })}
                  {/* Today line */}
                  {(() => {
                    const todayDiff = (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
                    if (todayDiff >= 0 && todayDiff < 28) {
                      return <div className="absolute top-0 bottom-0 w-0.5 bg-red-400 z-10" style={{ left: `${(todayDiff / 28) * 100}%` }} />;
                    }
                    return null;
                  })()}
                  {/* Task Bar */}
                  {pos && (
                    <motion.div
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      className="absolute h-7 rounded-lg shadow-sm z-20 flex items-center justify-center cursor-pointer"
                      style={{
                        left: pos.left,
                        width: pos.width,
                        backgroundColor: task.color + '22',
                        border: `2px solid ${task.color}`,
                        originX: 0,
                      }}
                      title={`${task.title}: ${task.start_date} — ${task.end_date} (${task.progress}%)`}
                    >
                      <div className="absolute left-0 top-0 bottom-0 rounded-l-md" style={{ width: `${task.progress}%`, backgroundColor: task.color + '44' }} />
                      <span className="relative text-[10px] font-bold truncate px-2" style={{ color: task.color }}>
                        {task.title}
                      </span>
                    </motion.div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Summary Stats */}
      {tasks.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{tasks.length}</div>
            <div className="text-xs text-gray-500 mt-1">Всего этапов</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{tasks.filter(t => t.status === 'completed').length}</div>
            <div className="text-xs text-gray-500 mt-1">Завершено</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
            <div className="text-2xl font-bold text-indigo-600">
              {tasks.length > 0 ? Math.round(tasks.reduce((acc, t) => acc + t.progress, 0) / tasks.length) : 0}%
            </div>
            <div className="text-xs text-gray-500 mt-1">Общий прогресс</div>
          </div>
        </div>
      )}

      {/* Add Task Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold">Новый этап</h3>
                <button onClick={() => setShowAddModal(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Название</label>
                  <input
                    type="text"
                    value={newTask.title}
                    onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))}
                    placeholder="Фундаментные работы"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Начало</label>
                    <input
                      type="date"
                      value={newTask.start_date}
                      onChange={e => setNewTask(p => ({ ...p, start_date: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Конец</label>
                    <input
                      type="date"
                      value={newTask.end_date}
                      onChange={e => setNewTask(p => ({ ...p, end_date: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Цвет</label>
                  <div className="flex gap-2 flex-wrap">
                    {COLORS.map(c => (
                      <button
                        key={c}
                        onClick={() => setNewTask(p => ({ ...p, color: c }))}
                        className={`w-8 h-8 rounded-lg transition-all ${newTask.color === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'hover:scale-105'}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                <button
                  onClick={addTask}
                  disabled={!newTask.title || !newTask.start_date || !newTask.end_date}
                  className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Добавить этап
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
