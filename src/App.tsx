/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { useLearnerStore } from './store/learner';
import Onboarding from './components/Onboarding';
import Home from './components/Home';
import Tutor from './components/Tutor';
import Practice from './components/Practice';
import History from './components/History';
import Settings from './components/Settings';
import InstallPrompt from './components/InstallPrompt';
import { Home as HomeIcon, MessageSquare, BookOpen, History as HistoryIcon, Settings as SettingsIcon, Sparkles } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { useTranslation } from './lib/i18n';

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const profile = useLearnerStore(state => state.profile);
  const { t } = useTranslation(profile?.languageCode || 'en');

  useEffect(() => {
    if (profile?.theme === 'light') {
      document.documentElement.classList.add('light-theme');
    } else {
      document.documentElement.classList.remove('light-theme');
    }
  }, [profile?.theme]);

  if (!profile || !profile.onboarded) {
    return <Onboarding />;
  }

  return (
    <div className="min-h-screen bg-bg-base">
      <header className="sticky top-0 z-[60] bg-bg-base/80 backdrop-blur-xl border-b border-border-default/50 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent-cyan flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Sparkles className="w-5 h-5 text-bg-base" />
            </div>
            <h1 className="text-xl font-black text-text-primary tracking-tighter">Bridge<span className="text-accent-cyan">Mind</span></h1>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-accent-cyan/10 rounded-full border border-accent-cyan/20">
            <div className="w-1.5 h-1.5 rounded-full bg-accent-cyan animate-pulse" />
            <span className="text-[10px] text-accent-cyan font-black uppercase tracking-widest">{profile?.languageCode}</span>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8 pb-32">
        <AnimatePresence mode="wait">
          {children}
        </AnimatePresence>
      </main>
      
      <nav className="fixed bottom-0 left-0 right-0 bg-bg-primary/95 backdrop-blur-md border-t border-border-default px-6 py-3 pb-8 z-50">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <NavItem to="/" icon={<HomeIcon />} label={t('hub')} />
          <NavItem to="/tutor" icon={<MessageSquare />} label={t('tutor')} />
          <NavItem to="/practice" icon={<BookOpen />} label={t('labs')} />
          <NavItem to="/history" icon={<HistoryIcon />} label={t('archive')} />
          <NavItem to="/settings" icon={<SettingsIcon />} label={t('system')} />
        </div>
      </nav>
      <InstallPrompt />
    </div>
  );
}

function NavItem({ to, icon, label }: { to: string; icon: React.ReactElement; label: string }) {
  return (
    <NavLink 
      to={to} 
      className={({ isActive }) => `flex flex-col items-center gap-1 transition-all duration-300 ${
        isActive ? 'text-accent-cyan scale-110' : 'text-text-muted hover:text-text-secondary'
      }`}
    >
      {React.cloneElement(icon, { size: 20 } as any)}
      <span className="text-[10px] uppercase font-bold tracking-wider">{label}</span>
    </NavLink>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<ProtectedLayout><Home /></ProtectedLayout>} />
        <Route path="/tutor" element={<ProtectedLayout><Tutor /></ProtectedLayout>} />
        <Route path="/practice" element={<ProtectedLayout><Practice /></ProtectedLayout>} />
        <Route path="/history" element={<ProtectedLayout><History /></ProtectedLayout>} />
        <Route path="/settings" element={<ProtectedLayout><Settings /></ProtectedLayout>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

