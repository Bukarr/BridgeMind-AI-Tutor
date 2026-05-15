import React from 'react';
import { useLearnerStore } from '../store/learner';
import { User, LogOut, Shield, Database, Globe, Moon, Sun, Monitor, Zap } from 'lucide-react';
import { motion } from 'motion/react';
import { auth } from '../lib/firebase';
import { LANGUAGES, CURRICULA, REGIONS } from './Onboarding';
import { useTranslation } from '../lib/i18n';

export default function Settings() {
  const { profile, updateProfile, reset } = useLearnerStore();
  const { t } = useTranslation(profile?.languageCode || 'en');

  const toggleTheme = () => {
    updateProfile({ theme: profile?.theme === 'dark' ? 'light' : 'dark' });
  };

  return (
    <div className="space-y-8 pb-24">
      <h1 className="text-3xl font-black text-text-primary">{t('system')}</h1>

      <section className="space-y-4">
        <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest px-1">{t('interfaceMode')}</h2>
        <div className="glass overflow-hidden">
          <button 
            onClick={toggleTheme}
            className="w-full p-5 flex items-center justify-between hover:bg-bg-secondary/40 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-bg-secondary border border-border-default flex items-center justify-center">
                {profile?.theme === 'dark' ? <Moon className="text-accent-cyan w-5 h-5" /> : <Sun className="text-accent-amber w-5 h-5" />}
              </div>
              <div className="text-left">
                <p className="font-bold text-text-primary">{t('interfaceMode')}</p>
                <p className="text-xs text-text-secondary font-medium">{t('currentlyUsing')} {profile?.theme} {t('mode')}</p>
              </div>
            </div>
            <div className={`w-12 h-6 rounded-full p-1 transition-colors ${profile?.theme === 'dark' ? 'bg-accent-cyan' : 'bg-text-muted'}`}>
              <div className={`w-4 h-4 bg-white rounded-full transition-transform ${profile?.theme === 'dark' ? 'translate-x-6' : 'translate-x-0'}`} />
            </div>
          </button>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest px-1">{t('learnerIdentity')}</h2>
        <div className="glass divide-y divide-border-default/30 overflow-hidden">
          {/* Language Selector */}
          <div className="p-5 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <Globe className="text-text-muted w-5 h-5" />
              <span className="text-sm font-semibold text-text-secondary">{t('cognitiveLang')}</span>
            </div>
            <select 
              value={profile?.languageCode}
              onChange={(e) => {
                const lang = LANGUAGES.find(l => l.code === e.target.value);
                if (lang) {
                  updateProfile({ 
                    language: lang.name, 
                    languageCode: lang.code, 
                    scriptDirection: lang.dir as any 
                  });
                }
              }}
              className="w-full bg-bg-secondary border border-border-default rounded-xl p-3 text-sm font-bold text-text-primary focus:outline-none focus:border-accent-cyan appearance-none"
            >
              {LANGUAGES.map(lang => (
                <option key={lang.code} value={lang.code}>{lang.flag} {lang.name}</option>
              ))}
            </select>
          </div>

          {/* Curriculum Selector */}
          <div className="p-5 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <Shield className="text-text-muted w-5 h-5" />
              <span className="text-sm font-semibold text-text-secondary">{t('academicIntel')}</span>
            </div>
            <select 
              value={profile?.curriculum}
              onChange={(e) => {
                const cur = CURRICULA.find(c => c.name === e.target.value);
                if (cur) {
                  updateProfile({ 
                    curriculum: cur.name, 
                    curriculumRegion: cur.region 
                  });
                }
              }}
              className="w-full bg-bg-secondary border border-border-default rounded-xl p-3 text-sm font-bold text-text-primary focus:outline-none focus:border-accent-cyan appearance-none"
            >
              {CURRICULA.map(cur => (
                <option key={cur.name} value={cur.name}>{cur.name} ({cur.region})</option>
              ))}
            </select>
          </div>

          {/* Region Selector */}
          <div className="p-5 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <User className="text-text-muted w-5 h-5" />
              <span className="text-sm font-semibold text-text-secondary">{t('culturalGrounding')}</span>
            </div>
            <select 
              value={profile?.region}
              onChange={(e) => updateProfile({ region: e.target.value })}
              className="w-full bg-bg-secondary border border-border-default rounded-xl p-3 text-sm font-bold text-text-primary focus:outline-none focus:border-accent-cyan appearance-none"
            >
              {REGIONS.map(reg => (
                <option key={reg} value={reg}>{reg}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest px-1">Adaptive Intelligence</h2>
        <div className="glass p-6 space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-accent-cyan/10 border border-accent-cyan/20 flex items-center justify-center">
              <Zap className="text-accent-cyan w-6 h-6 animate-pulse" />
            </div>
            <div>
              <p className="font-bold text-text-primary text-sm">Neural Comprehension</p>
              <p className="text-xs text-text-secondary font-medium">BridgeMind is studying your learning patterns.</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider">
                <span className="text-text-muted">Concept Mastery Level</span>
                <span className="text-accent-cyan">{profile?.comprehensionLevel || 'Analyzing...'}</span>
              </div>
              <div className="h-2 bg-bg-secondary rounded-full overflow-hidden border border-border-default">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${(profile?.comprehensionLevel || 0) * 10}%` }}
                  className="h-full bg-gradient-to-r from-accent-cyan/50 to-accent-cyan shadow-[0_0_10px_rgba(34,211,238,0.5)]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-bg-secondary/50 border border-border-default/50 p-3 rounded-2xl">
                <p className="text-[8px] font-black text-text-muted uppercase tracking-widest mb-1">Learning Style</p>
                <p className="text-[10px] font-bold text-text-primary capitalize">{profile?.learningStyle || 'Observing...'}</p>
              </div>
              <div className="bg-bg-secondary/50 border border-border-default/50 p-3 rounded-2xl">
                <p className="text-[8px] font-black text-text-muted uppercase tracking-widest mb-1">Vocabulary Density</p>
                <p className="text-[10px] font-bold text-text-primary capitalize">{profile?.vocabularyRange || 'Processing...'}</p>
              </div>
            </div>

            <div className="p-3 bg-accent-cyan/5 border border-accent-cyan/10 rounded-2xl">
              <p className="text-[9px] font-medium text-text-secondary leading-relaxed italic">
                {profile?.complexityPreference === 'simple' 
                  ? "Concepts are being simplified to fundamental logic for maximum accessibility."
                  : profile?.complexityPreference === 'complex'
                  ? "Academic concepts are being delivered at maximum depth for advanced scholarship."
                  : "BridgeMind is maintaining a balanced academic standard tailored to your pace."}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest px-1">{t('persistence')}</h2>
        <div className="glass overflow-hidden shadow-accent">
          <button 
            onClick={() => {
              if (confirm(t('persistenceConfirm'))) {
                reset();
                window.location.reload();
              }
            }}
            className="w-full p-5 flex items-center gap-4 text-accent-red hover:bg-accent-red/10 transition-colors"
          >
            <Database className="w-5 h-5" />
            <span className="text-sm font-bold">{t('wipeData')}</span>
          </button>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest px-1">{t('systemEntropy')}</h2>
        <div className="glass p-6 space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-text-muted uppercase tracking-wider">{t('protocolVersion')}</span>
            <span className="text-xs font-bold text-accent-cyan bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">BM-OS 4.2.0-STABLE</span>
          </div>
          <div className="p-4 bg-bg-secondary rounded-2xl italic text-xs text-text-secondary leading-relaxed border-l-4 border-accent-cyan">
            "Engineered to bridge the continent through distributed intelligence. 
            Dedicated to the resilience and excellence of the African student."
          </div>
        </div>
      </section>

      <button onClick={() => auth.signOut()} className="btn-secondary w-full flex items-center justify-center gap-2">
        <LogOut className="w-4 h-4" /> {t('signOut')}
      </button>
    </div>
  );
}
