'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Clock, ChevronRight, Award, Star, GraduationCap } from 'lucide-react';
import { COURSES } from '@/lib/academy-data';
import Link from 'next/link';

export function AcademyClient() {
  const [filter, setFilter] = useState<'all' | 'Başlangıç' | 'Orta' | 'İleri'>('all');

  const filtered = filter === 'all' ? COURSES : COURSES.filter(c => c.level === filter);

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'Başlangıç': return 'bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/30';
      case 'Orta': return 'bg-[#3B82F6]/10 text-[#3B82F6] border-[#3B82F6]/30';
      case 'İleri': return 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/30';
      default: return 'bg-[#94A3B8]/10 text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#8B5CF6]/10 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-[#8B5CF6]" />
            </div>
            Master Academy
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Profesyonel trader olmak için gereken tüm bilgiler</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Toplam Kurs', value: COURSES.length, icon: BookOpen, color: '#3B82F6' },
          { label: 'Toplam Ders', value: COURSES.reduce((s, c) => s + c.totalLessons, 0), icon: Star, color: '#22C55E' },
          { label: 'Toplam Süre', value: '4+ saat', icon: Clock, color: '#F59E0B' },
          { label: 'Sertifika', value: 'Yakında', icon: Award, color: '#8B5CF6' },
        ].map((stat, idx) => (
          <div key={idx} className="glass-card rounded-xl p-4 border border-black/[0.08] dark:border-white/[0.08]">
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
              <span className="text-xs text-muted-foreground">{stat.label}</span>
            </div>
            <p className="text-xl font-bold text-foreground">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex glass-card rounded-lg p-1 gap-1 w-fit">
        {[
          { key: 'all', label: 'Tümü' },
          { key: 'Başlangıç', label: '🟢 Başlangıç' },
          { key: 'Orta', label: '🔵 Orta' },
          { key: 'İleri', label: '🟡 İleri' },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key as any)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              filter === f.key
                ? 'bg-[#3B82F6] text-white'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Course Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((course, idx) => (
          <motion.div
            key={course.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
          >
            <Link href={`/academy/${course.id}`}>
              <div className="glass-card rounded-xl hover:border-[#3B82F6]/50 transition-all duration-300 overflow-hidden group cursor-pointer h-full">
                {/* Icon header */}
                <div className="p-6 pb-3">
                  <div className="flex items-start justify-between mb-4">
                    <div
                      className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl"
                      style={{ backgroundColor: `${course.color}15` }}
                    >
                      {course.icon}
                    </div>
                    <span className={`text-[10px] px-2 py-1 rounded-full border font-medium ${getLevelColor(course.level)}`}>
                      {course.level}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-foreground group-hover:text-[#3B82F6] transition-colors">
                    {course.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                    {course.description}
                  </p>
                </div>

                {/* Footer */}
                <div className="px-6 pb-5 pt-3 flex items-center justify-between">
                  <div className="flex items-center gap-4 text-xs text-slate-400 dark:text-slate-500">
                    <span className="flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5" />
                      {course.totalLessons} ders
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {course.estimatedTime}
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-[#3B82F6] transition-colors" />
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      <div className="text-center py-4">
        <p className="text-xs text-slate-400 dark:text-slate-500">
          ⚠️ Tüm eğitim içerikleri bilgilendirme amaçlıdır. Yatırım tavsiyesi değildir.
        </p>
      </div>
    </div>
  );
}
