import React, { useState } from 'react';
import { useLearnerStore } from '../store/learner';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, XCircle, ArrowRight, BookOpen, Brain, Sparkles, ChevronLeft } from 'lucide-react';
import { useTranslation } from '../lib/i18n';
import { SUBJECTS } from '../constants';
import Markdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';

interface Question {
  id: number;
  type: 'mcq' | 'structured';
  question: string;
  options?: string[];
  correct?: string;
  explanation?: string;
  markScheme?: string[];
  sampleAnswer?: string;
}

export default function Practice() {
  const profile = useLearnerStore(state => state.profile);
  const { t } = useTranslation(profile?.languageCode || 'en');
  const [subject, setSubject] = useState('Biology');
  const [topic, setTopic] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const learnTopic = async () => {
    if (!topic.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, subject, learnerProfile: profile })
      });
      
      if (!res.ok) {
        throw new Error('Failed to generate academic explanation.');
      }
      
      const data = await res.json();
      setExplanation(data.explanation);
      setShowExplanation(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const startPractice = async () => {
    if (!topic.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/practice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, subject, learnerProfile: profile })
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error (Status ${res.status}). Please try again.`);
      }
      
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error("Invalid JSON response:", text);
        throw new Error('Received invalid response from server. Please try again.');
      }
      setQuestions(data.questions || []);
      setCurrentIndex(0);
      setScore(0);
      setIsFinished(false);
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswer = (option: string) => {
    if (selectedAnswer !== null) return;
    setSelectedAnswer(option);
    if (option.startsWith(questions[currentIndex].correct!)) {
      setScore(s => s + 1);
    }
  };

  const nextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(c => c + 1);
      setSelectedAnswer(null);
    } else {
      setIsFinished(true);
    }
  };

  if (showExplanation && explanation) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 pb-32">
        <div className="flex items-center gap-3">
          <button onClick={() => setShowExplanation(false)} className="p-2 hover:bg-bg-secondary rounded-full transition-colors">
            <ChevronLeft className="w-5 h-5 text-text-secondary" />
          </button>
          <div>
            <h1 className="text-xl font-black text-text-primary uppercase tracking-tight">{topic}</h1>
            <p className="text-[10px] text-accent-cyan font-bold uppercase tracking-widest">{subject} Theory</p>
          </div>
        </div>

        <div className="glass p-6 md:p-8 space-y-6">
          <div className="markdown-body prose prose-invert prose-emerald max-w-none">
            <Markdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
              {explanation}
            </Markdown>
          </div>
          
          <div className="pt-6 border-t border-border-default/50">
            <button 
              onClick={() => {
                setShowExplanation(false);
                startPractice();
              }} 
              className="btn-primary w-full py-4 text-lg flex items-center justify-center gap-3 shadow-accent"
            >
              <Brain className="w-5 h-5" /> Start Practice Assessment
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center space-y-4 py-20">
        <Brain className="w-16 h-16 text-accent-cyan animate-pulse" />
        <p className="font-bold text-text-muted">{t('analyzing')}</p>
      </div>
    );
  }

  if (isFinished) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center space-y-8 py-12">
        <div className="space-y-4">
          <h1 className="text-4xl font-black text-text-primary">{t('mastery')}</h1>
          <p className="text-text-secondary font-medium">You've explored {topic} with BridgeMind.</p>
        </div>
        <div className="glass p-10 space-y-4 max-w-sm mx-auto shadow-accent">
          <div className="text-6xl font-bold text-accent-cyan tracking-tighter">{Math.round((score / questions.length) * 100)}%</div>
          <p className="font-bold text-text-muted uppercase tracking-widest text-[10px]">{score} Correct / {questions.length} Total</p>
        </div>
        <button onClick={() => setQuestions([])} className="btn-primary w-full max-w-sm">
          {t('finishPractice')}
        </button>
      </motion.div>
    );
  }

  if (questions.length > 0) {
    const q = questions[currentIndex];
    return (
      <div className="space-y-8 pb-12">
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {questions.map((_, i) => (
              <div 
                key={i} 
                className={`w-6 h-1.5 rounded-full transition-colors ${
                  i === currentIndex ? 'bg-accent-cyan' : i < currentIndex ? 'bg-accent-cyan/30' : 'bg-bg-secondary'
                }`} 
              />
            ))}
          </div>
          <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{t('challenge')} {currentIndex + 1}/5</span>
        </div>

        <h2 className="text-2xl font-bold leading-tight text-text-primary">{q.question}</h2>

        <div className="space-y-4">
          {q.options?.map(opt => {
            const isCorrect = opt.startsWith(q.correct!);
            const isSelected = selectedAnswer === opt;
            const showResult = selectedAnswer !== null;

            return (
              <button
                key={opt}
                onClick={() => handleAnswer(opt)}
                disabled={showResult}
                className={`w-full text-left p-5 rounded-2xl border-2 transition-all font-bold ${
                  showResult
                    ? isCorrect
                      ? 'bg-emerald-900/20 border-emerald-500 text-emerald-400'
                      : isSelected
                        ? 'bg-red-900/20 border-red-500 text-red-400'
                        : 'border-bg-secondary opacity-40 text-text-muted'
                    : 'bg-bg-primary border-border-default hover:border-accent-cyan/50 hover:bg-bg-secondary text-text-secondary'
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>

        <AnimatePresence>
          {selectedAnswer !== null && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="glass p-6 space-y-4 shadow-accent"
            >
              <div className="flex items-center gap-2">
                {selectedAnswer.startsWith(q.correct!) ? (
                  <CheckCircle2 className="text-accent-cyan w-5 h-5 shadow-sm" />
                ) : (
                  <XCircle className="text-accent-red w-5 h-5 shadow-sm" />
                )}
                <span className="font-bold text-text-primary">
                  {selectedAnswer.startsWith(q.correct!) ? 'Brilliant Insight!' : 'Keep pushing.'}
                </span>
              </div>
              <p className="text-sm text-text-secondary leading-relaxed">{q.explanation}</p>
              <button onClick={nextQuestion} className="btn-primary w-full flex items-center justify-center gap-2 py-4">
                {t('continue')} <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-black text-text-primary">{t('practiceTitle')}</h1>
        <p className="text-text-secondary font-medium">{t('practiceDesc')}</p>
      </div>

      <div className="space-y-6">
        <div className="space-y-3 px-1">
          <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{t('activeModule')}</label>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-2 px-2 no-scrollbar">
            {SUBJECTS.map(s => (
              <button
                key={s.id}
                onClick={() => setSubject(s.name)}
                className={`flex-shrink-0 p-4 rounded-2xl border-2 font-bold text-sm transition-all flex flex-col items-center gap-2 ${
                  subject === s.name ? 'bg-bg-secondary border-accent-cyan text-accent-cyan' : 'bg-bg-primary border-border-default text-text-muted'
                }`}
              >
                <span className="text-xl">{s.icon}</span>
                {s.name}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3 px-1">
          <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{t('targetConcept')}</label>
          <input
            value={topic}
            onChange={e => setTopic(e.target.value)}
            placeholder="e.g. Osmosis, Quadratic Equations..."
            className="w-full bg-bg-primary border-2 border-border-default p-5 rounded-2xl focus:outline-none focus:border-accent-cyan transition-all font-bold text-text-primary"
          />
        </div>

        {error && (
          <div className="p-4 bg-accent-red/10 border border-accent-red/20 text-accent-red text-sm rounded-2xl font-bold">
            ⚠️ {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <button 
            onClick={learnTopic} 
            disabled={!topic.trim() || isLoading} 
            className="p-4 rounded-2xl bg-bg-secondary border border-border-default text-accent-cyan font-bold hover:bg-bg-elevated transition-all flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" /> Learn & Explain
          </button>
          <button 
            onClick={startPractice} 
            disabled={!topic.trim() || isLoading} 
            className="btn-primary py-4 flex items-center justify-center gap-2"
          >
            <Brain className="w-4 h-4" /> Challenge Me
          </button>
        </div>
      </div>
    </div>
  );
}
