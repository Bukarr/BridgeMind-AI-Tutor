import React, { useEffect, useState } from 'react';
import { useLearnerStore } from '../store/learner';
import { motion } from 'motion/react';
import { Sparkles, Search, BookOpen, Clock, ChevronRight } from 'lucide-react';
import { getDB } from '../lib/db';
import { Link, useNavigate } from 'react-router-dom';

import { useTranslation } from '../lib/i18n';

import { SUBJECTS } from '../constants';

export default function Home() {
  const profile = useLearnerStore(state => state.profile);
  const [greeting, setGreeting] = useState('');
  const [sessions, setSessions] = useState<any[]>([]);
  const navigate = useNavigate();
  const { t } = useTranslation(profile?.languageCode || 'en');

  useEffect(() => {
    async function init() {
      if (!profile) return;
      
      const db = await getDB();
      const today = new Date().toISOString().split('T')[0];
      const cacheKey = `${today}_${profile.languageCode}`;
      const cached = await db.get('daily_cache', cacheKey);

      if (cached) {
        setGreeting(cached.greeting);
      } else {
        const fallback = `Welcome back${profile?.name ? ', ' + profile.name : ''}! Ready to continue your studies?`;
        setGreeting(fallback);
        await db.put('daily_cache', { date: cacheKey, greeting: fallback, focusTopic: null });
      }

      const allSessions = await db.getAllFromIndex('sessions', 'by-updated');
      setSessions(allSessions.reverse().slice(0, 5));
    }
    init();
  }, [profile?.languageCode]);

  return (
    <div className="space-y-8 pb-32">
      {/* Header */}
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-black tracking-tight text-accent-cyan">BridgeMind</h1>
        <div className="flex items-center gap-2 px-3 py-1 bg-cyan-500/10 rounded-full border border-cyan-500/20">
          <div className="w-1.5 h-1.5 rounded-full bg-accent-cyan animate-pulse" />
          <span className="text-[10px] text-accent-cyan font-bold uppercase tracking-wider">Africa Live</span>
        </div>
      </header>

      {/* Greeting */}
      <section className="space-y-4">
        {greeting ? (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="p-8 glass shadow-accent relative overflow-hidden"
          >
            <div className="relative z-10">
              <p className="text-xl font-bold leading-tight bg-gradient-to-r from-text-primary to-accent-cyan bg-clip-text text-transparent">
                {greeting}
              </p>
            </div>
            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-accent-cyan/20 rounded-full blur-3xl opacity-50 transition-all group-hover:scale-110"></div>
          </motion.div>
        ) : (
          <div className="h-32 w-full bg-bg-secondary border border-border-default animate-pulse rounded-3xl" />
        )}
      </section>

      {/* Quick Ask */}
      <div 
        onClick={() => navigate('/tutor')}
        className="bg-bg-primary/50 backdrop-blur-md border border-border-default rounded-[2rem] p-1.5 flex items-center gap-3 cursor-pointer group transition-all hover:border-cyan-500/50 hover:shadow-accent"
      >
        <div className="flex-1 px-4 py-3 text-text-secondary text-sm font-medium">
          {t('ask')}
        </div>
        <div className="p-3 rounded-[1.5rem] bg-bg-secondary text-accent-cyan group-hover:bg-accent-cyan group-hover:text-bg-base transition-all mr-1 shadow-lg shadow-cyan-500/10">
          <Search className="w-5 h-5" />
        </div>
      </div>

      {/* Recent Sessions */}
      {sessions.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-black text-text-muted uppercase tracking-widest">{t('recent')}</h2>
            <Link to="/history" className="text-accent-cyan text-xs font-bold flex items-center gap-1">
              {t('viewAll')} <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-4 -mx-6 px-6 no-scrollbar">
            {sessions.map(session => (
              <Link
                to={`/tutor?session=${session.id}`}
                key={session.id}
                className="glass p-5 min-w-[200px] space-y-4 flex-shrink-0 hover:border-accent-cyan/50 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 bg-bg-secondary/50 rounded-xl flex items-center justify-center text-xl shadow-inner">
                    {SUBJECTS.find(s => s.id === session.subject)?.icon || '📚'}
                  </div>
                  <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                    {new Date(session.updatedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <div>
                  <p className="font-bold text-text-primary group-hover:text-accent-cyan transition-colors line-clamp-1">{session.topic}</p>
                  <p className="text-[10px] text-text-muted font-bold uppercase tracking-tighter mt-1">{session.subject}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Subjects Grid */}
      <section className="space-y-4">
        <h2 className="text-sm font-black text-text-muted uppercase tracking-widest px-1">{t('modules')}</h2>
        <div className="grid grid-cols-2 gap-4">
          {SUBJECTS.map(subject => (
            <Link
              to={`/tutor?subject=${subject.id}`}
              key={subject.id}
              className="glass p-6 flex flex-col items-center gap-4 hover:border-accent-cyan/50 hover:shadow-accent transition-all text-center group"
            >
              <div className="w-14 h-14 bg-bg-secondary/50 border border-border-default rounded-2xl flex items-center justify-center text-3xl group-hover:scale-110 group-hover:bg-accent-cyan/10 transition-all shadow-inner">
                {subject.icon}
              </div>
              <span className="text-sm font-bold text-text-secondary group-hover:text-white transition-colors">{subject.name}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
