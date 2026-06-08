'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, BookOpen, Clock, ChevronRight, CheckCircle2,
  HelpCircle, Award, ChevronDown
} from 'lucide-react';
import { getCourseById } from '@/lib/academy-data';
import type { Lesson, QuizQuestion } from '@/lib/academy-data';
import Link from 'next/link';

function MarkdownRenderer({ content }: { content: string }) {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let inTable = false;
  let tableRows: string[][] = [];
  let tableHeaders: string[] = [];

  const processInline = (text: string): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;
    while (remaining.length > 0) {
      const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
      const codeMatch = remaining.match(/`(.+?)`/);
      const match = [boldMatch, codeMatch].filter(Boolean).sort((a, b) => (a?.index ?? 999) - (b?.index ?? 999))[0];
      if (match && match.index !== undefined) {
        if (match.index > 0) parts.push(<span key={key++}>{remaining.slice(0, match.index)}</span>);
        if (match === boldMatch) parts.push(<strong key={key++} className="text-white font-semibold">{match[1]}</strong>);
        else parts.push(<code key={key++} className="bg-[#0F172A] px-1.5 py-0.5 rounded text-[#3B82F6] text-xs">{match[1]}</code>);
        remaining = remaining.slice(match.index + match[0].length);
      } else {
        parts.push(<span key={key++}>{remaining}</span>);
        remaining = '';
      }
    }
    return parts;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const cells = trimmed.split('|').filter(Boolean).map(c => c.trim());
      if (cells.every(c => /^[-:]+$/.test(c))) continue;
      if (!inTable) { inTable = true; tableHeaders = cells; tableRows = []; continue; }
      tableRows.push(cells);
      if (i === lines.length - 1 || !(lines[i + 1]?.trim().startsWith('|'))) {
        elements.push(
          <div key={i} className="overflow-x-auto my-3">
            <table className="w-full text-sm">
              <thead><tr>{tableHeaders.map((h, hi) => <th key={hi} className="text-left text-[10px] uppercase text-[#64748B] px-3 py-2 border-b border-[#334155] font-medium">{h}</th>)}</tr></thead>
              <tbody>{tableRows.map((row, ri) => <tr key={ri} className="border-b border-[#334155]/50">{row.map((cell, ci) => <td key={ci} className="px-3 py-2 text-[#94A3B8]">{cell}</td>)}</tr>)}</tbody>
            </table>
          </div>
        );
        inTable = false;
      }
      continue;
    }
    inTable = false;

    if (trimmed.startsWith('# ')) {
      elements.push(<h2 key={i} className="text-xl font-bold text-white mt-6 mb-3">{trimmed.slice(2)}</h2>);
    } else if (trimmed.startsWith('## ')) {
      elements.push(<h3 key={i} className="text-lg font-semibold text-white mt-5 mb-2">{trimmed.slice(3)}</h3>);
    } else if (trimmed.startsWith('### ')) {
      elements.push(<h4 key={i} className="text-base font-semibold text-[#3B82F6] mt-4 mb-2">{trimmed.slice(4)}</h4>);
    } else if (trimmed.startsWith('> ')) {
      elements.push(
        <blockquote key={i} className="border-l-2 border-[#F59E0B] pl-4 py-2 my-3 bg-[#F59E0B]/5 rounded-r-lg">
          <p className="text-sm text-[#F59E0B] italic">{processInline(trimmed.slice(2))}</p>
        </blockquote>
      );
    } else if (trimmed.startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) { codeLines.push(lines[i]); i++; }
      elements.push(
        <pre key={i} className="bg-[#0F172A] rounded-lg p-4 my-3 overflow-x-auto">
          <code className="text-sm text-[#22C55E]">{codeLines.join('\n')}</code>
        </pre>
      );
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const isCheck = trimmed.includes('✅') || trimmed.includes('❌') || trimmed.includes('⚠️') || trimmed.includes('✔');
      elements.push(
        <div key={i} className={`flex items-start gap-2 my-1 ${isCheck ? '' : 'ml-2'}`}>
          {!isCheck && <span className="text-[#3B82F6] mt-1.5">•</span>}
          <p className="text-sm text-[#94A3B8] leading-relaxed">{processInline(trimmed.slice(2))}</p>
        </div>
      );
    } else if (/^\d+\.\s/.test(trimmed)) {
      const num = trimmed.match(/^(\d+)/)?.[1] ?? '';
      const text = trimmed.replace(/^\d+\.\s/, '');
      elements.push(
        <div key={i} className="flex items-start gap-2 my-1 ml-2">
          <span className="text-[#3B82F6] font-medium text-sm min-w-[20px]">{num}.</span>
          <p className="text-sm text-[#94A3B8] leading-relaxed">{processInline(text)}</p>
        </div>
      );
    } else if (trimmed === '') {
      elements.push(<div key={i} className="h-2" />);
    } else {
      elements.push(<p key={i} className="text-sm text-[#94A3B8] leading-relaxed my-1">{processInline(trimmed)}</p>);
    }
  }
  return <div>{elements}</div>;
}

function QuizComponent({ questions, onComplete }: { questions: QuizQuestion[]; onComplete: () => void }) {
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const q = questions[currentQ];

  const handleSelect = (idx: number) => {
    if (showResult) return;
    setSelected(idx);
    setShowResult(true);
    if (idx === q.correctIndex) setScore(s => s + 1);
  };

  const handleNext = () => {
    if (currentQ < questions.length - 1) {
      setCurrentQ(c => c + 1);
      setSelected(null);
      setShowResult(false);
    } else {
      setFinished(true);
    }
  };

  if (finished) {
    const percent = Math.round((score / questions.length) * 100);
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#1E293B] rounded-xl border border-[#334155] p-6 text-center"
      >
        <Award className={`w-12 h-12 mx-auto mb-3 ${percent >= 70 ? 'text-[#22C55E]' : 'text-[#F59E0B]'}`} />
        <h3 className="text-xl font-bold text-white mb-1">Quiz Tamamlandı!</h3>
        <p className="text-3xl font-bold mt-3" style={{ color: percent >= 70 ? '#22C55E' : '#F59E0B' }}>
          %{percent}
        </p>
        <p className="text-sm text-[#94A3B8] mt-2">
          {questions.length} sorudan {score} doğru
        </p>
        <p className="text-sm text-[#94A3B8] mt-1">
          {percent >= 70 ? '🎉 Harika! Dersi başarıyla tamamladınız.' : '📚 Tekrar çalışmanızı öneririz.'}
        </p>
        <button onClick={onComplete} className="mt-4 px-6 py-2 bg-[#3B82F6] text-white rounded-lg text-sm font-medium">
          Devam Et
        </button>
      </motion.div>
    );
  }

  return (
    <div className="bg-[#1E293B] rounded-xl border border-[#334155] p-6">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs text-[#64748B]">
          Soru {currentQ + 1}/{questions.length}
        </span>
        <div className="flex gap-1">
          {questions.map((_, qi) => (
            <div key={qi} className={`w-2 h-2 rounded-full ${qi < currentQ ? 'bg-[#22C55E]' : qi === currentQ ? 'bg-[#3B82F6]' : 'bg-[#334155]'}`} />
          ))}
        </div>
      </div>
      <h4 className="text-base font-semibold text-white mb-4">
        <HelpCircle className="w-4 h-4 inline mr-2 text-[#3B82F6]" />
        {q.question}
      </h4>
      <div className="space-y-2">
        {q.options.map((opt, oi) => {
          let bg = 'bg-[#0F172A] border-[#334155] hover:border-[#3B82F6]/50';
          if (showResult) {
            if (oi === q.correctIndex) bg = 'bg-[#22C55E]/10 border-[#22C55E]';
            else if (oi === selected) bg = 'bg-[#EF4444]/10 border-[#EF4444]';
            else bg = 'bg-[#0F172A] border-[#334155] opacity-50';
          } else if (oi === selected) {
            bg = 'bg-[#3B82F6]/10 border-[#3B82F6]';
          }
          return (
            <button
              key={oi}
              onClick={() => handleSelect(oi)}
              disabled={showResult}
              className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-all ${bg}`}
            >
              <span className="text-[#94A3B8]">{String.fromCharCode(65 + oi)}.</span>{' '}
              <span className="text-white">{opt}</span>
            </button>
          );
        })}
      </div>
      {showResult && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4">
          <div className={`p-3 rounded-lg text-sm ${selected === q.correctIndex ? 'bg-[#22C55E]/5 border border-[#22C55E]/20' : 'bg-[#EF4444]/5 border border-[#EF4444]/20'}`}>
            <p className={selected === q.correctIndex ? 'text-[#22C55E]' : 'text-[#EF4444]'}>
              {selected === q.correctIndex ? '✅ Doğru!' : '❌ Yanlış!'}
            </p>
            <p className="text-[#94A3B8] mt-1">{q.explanation}</p>
          </div>
          <button onClick={handleNext} className="mt-3 px-4 py-2 bg-[#3B82F6] text-white rounded-lg text-sm font-medium">
            {currentQ < questions.length - 1 ? 'Sonraki Soru' : 'Sonuçları Gör'}
          </button>
        </motion.div>
      )}
    </div>
  );
}

export function CourseDetailClient({ courseId }: { courseId: string }) {
  const course = getCourseById(courseId);
  const [activeLesson, setActiveLesson] = useState(0);
  const [completedLessons, setCompletedLessons] = useState<Set<number>>(new Set());
  const [showQuiz, setShowQuiz] = useState(false);

  if (!course) {
    return (
      <div className="text-center py-20">
        <BookOpen className="w-12 h-12 text-[#64748B] mx-auto mb-3" />
        <p className="text-[#94A3B8]">Kurs bulunamadı</p>
        <Link href="/academy" className="text-[#3B82F6] text-sm mt-2 inline-block">Geri Dön</Link>
      </div>
    );
  }

  const lesson = course.lessons[activeLesson];
  const progress = Math.round((completedLessons.size / course.totalLessons) * 100);

  const handleCompleteLesson = () => {
    const newSet = new Set(completedLessons);
    newSet.add(activeLesson);
    setCompletedLessons(newSet);
    setShowQuiz(false);
    if (activeLesson < course.lessons.length - 1) {
      setActiveLesson(activeLesson + 1);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/academy" className="p-2 rounded-lg bg-[#1E293B] hover:bg-[#334155] text-[#94A3B8] transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{course.icon}</span>
            <div>
              <h1 className="text-xl font-bold text-white">{course.title}</h1>
              <p className="text-sm text-[#94A3B8]">{course.lessons.length} ders • {course.estimatedTime}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="bg-[#1E293B] rounded-xl border border-[#334155] p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-[#94A3B8]">İlerleme</span>
          <span className="text-sm font-medium text-white">%{progress}</span>
        </div>
        <div className="h-2 bg-[#0F172A] rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-[#3B82F6] rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar - lesson list */}
        <div className="lg:col-span-1">
          <div className="bg-[#1E293B] rounded-xl border border-[#334155] overflow-hidden">
            <div className="p-4 border-b border-[#334155]">
              <h3 className="text-sm font-semibold text-white">Dersler</h3>
            </div>
            <div className="divide-y divide-[#334155]/50">
              {course.lessons.map((l, idx) => (
                <button
                  key={l.id}
                  onClick={() => { setActiveLesson(idx); setShowQuiz(false); }}
                  className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${
                    idx === activeLesson ? 'bg-[#3B82F6]/10' : 'hover:bg-[#0F172A]/50'
                  }`}
                >
                  {completedLessons.has(idx) ? (
                    <CheckCircle2 className="w-4 h-4 text-[#22C55E] flex-shrink-0" />
                  ) : (
                    <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                      idx === activeLesson ? 'border-[#3B82F6]' : 'border-[#334155]'
                    }`} />
                  )}
                  <div className="min-w-0">
                    <p className={`text-sm font-medium truncate ${
                      idx === activeLesson ? 'text-[#3B82F6]' : 'text-white'
                    }`}>{l.title}</p>
                    <p className="text-[10px] text-[#64748B]">{l.duration}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          <AnimatePresence mode="wait">
            {showQuiz && lesson.quiz ? (
              <motion.div
                key="quiz"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-[#F59E0B]" />
                  Quiz: {lesson.title}
                </h3>
                <QuizComponent questions={lesson.quiz} onComplete={handleCompleteLesson} />
              </motion.div>
            ) : (
              <motion.div
                key={`lesson-${activeLesson}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-[#1E293B] rounded-xl border border-[#334155] p-6"
              >
                <MarkdownRenderer content={lesson.content} />

                <div className="mt-6 pt-4 border-t border-[#334155] flex flex-col sm:flex-row gap-3">
                  {lesson.quiz && lesson.quiz.length > 0 ? (
                    <button
                      onClick={() => setShowQuiz(true)}
                      className="flex items-center gap-2 px-4 py-2.5 bg-[#F59E0B] hover:bg-[#D97706] text-black rounded-lg text-sm font-medium transition-colors"
                    >
                      <HelpCircle className="w-4 h-4" />
                      Quiz'e Başla
                    </button>
                  ) : (
                    <button
                      onClick={handleCompleteLesson}
                      className="flex items-center gap-2 px-4 py-2.5 bg-[#22C55E] hover:bg-[#16A34A] text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Dersi Tamamla
                    </button>
                  )}
                  {activeLesson < course.lessons.length - 1 && (
                    <button
                      onClick={() => { setActiveLesson(activeLesson + 1); setShowQuiz(false); }}
                      className="flex items-center gap-2 px-4 py-2.5 bg-[#1E293B] hover:bg-[#334155] text-white rounded-lg text-sm font-medium transition-colors border border-[#334155]"
                    >
                      Sonraki Ders
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="text-center py-4">
        <p className="text-xs text-[#64748B]">
          ⚠️ Tüm eğitim içerikleri bilgilendirme amaçlıdır. Yatırım tavsiyesi değildir.
        </p>
      </div>
    </div>
  );
}
