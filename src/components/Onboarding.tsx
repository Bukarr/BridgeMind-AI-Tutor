import React, { useState } from 'react';
import { useLearnerStore, LearnerProfile } from '../store/learner';
import { motion, AnimatePresence } from 'motion/react';
import { Globe, GraduationCap, MapPin, ChevronRight, Activity } from 'lucide-react';

export const LANGUAGES = [
  { name: 'Hausa', code: 'ha', dir: 'ltr', flag: '🇳🇬' },
  { name: 'Yoruba', code: 'yo', dir: 'ltr', flag: '🇳🇬' },
  { name: 'Igbo', code: 'ig', dir: 'ltr', flag: '🇳🇬' },
  { name: 'Swahili', code: 'sw', dir: 'ltr', flag: '🇰🇪' },
  { name: 'Amharic', code: 'am', dir: 'ltr', flag: '🇪🇹' },
  { name: 'Amharic (Geez)', code: 'am-geez', dir: 'ltr', flag: '🇪🇹' },
  { name: 'Zulu', code: 'zu', dir: 'ltr', flag: '🇿🇦' },
  { name: 'Xhosa', code: 'xh', dir: 'ltr', flag: '🇿🇦' },
  { name: 'Twi', code: 'ak', dir: 'ltr', flag: '🇬🇭' },
  { name: 'Wolof', code: 'wo', dir: 'ltr', flag: '🇸🇳' },
  { name: 'Somali', code: 'so', dir: 'ltr', flag: '🇸🇴' },
  { name: 'Chichewa', code: 'ny', dir: 'ltr', flag: '🇲🇼' },
  { name: 'Shona', code: 'sn', dir: 'ltr', flag: '🇿🇼' },
  { name: 'Lingala', code: 'ln', dir: 'ltr', flag: '🇨🇩' },
  { name: 'Fula', code: 'ff', dir: 'ltr', flag: '🇬🇳' },
  { name: 'Oromo', code: 'om', dir: 'ltr', flag: '🇪🇹' },
  { name: 'Tigrinya', code: 'ti', dir: 'ltr', flag: '🇪🇷' },
  { name: 'English', code: 'en', dir: 'ltr', flag: '🌍' },
  { name: 'French', code: 'fr', dir: 'ltr', flag: '🌍' },
];

export const CURRICULA = [
  { name: 'WAEC/SSCE', region: 'West Africa (WASSCE)' },
  { name: 'JAMB/UTME', region: 'Nigeria' },
  { name: 'KCSE', region: 'Kenya (Secondary)' },
  { name: 'Matric', region: 'South Africa (NSC)' },
  { name: 'UNEB', region: 'Uganda' },
  { name: 'ZIMSEC', region: 'Zimbabwe' },
  { name: 'Baccalauréat', region: 'Francophone Africa' },
  { name: 'IGCSE', region: 'International' },
];

export const REGIONS = ['Nigeria', 'Kenya', 'Ethiopia', 'South Africa', 'Ghana', 'Senegal', 'Tanzania', 'Uganda', 'Zimbabwe'];

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const setProfile = useLearnerStore(state => state.setProfile);
  
  const [data, setData] = useState<Partial<LearnerProfile>>({
    language: '',
    languageCode: '',
    scriptDirection: 'ltr',
    curriculum: '',
    curriculumRegion: '',
    region: '',
    country: '',
    onboarded: false
  });

  const nextStep = () => setStep(s => s + 1);

  const complete = () => {
    const finalProfile = { ...data, onboarded: true } as LearnerProfile;
    setProfile(finalProfile);
  };

  return (
    <div className="min-h-screen bg-bg-base flex flex-col items-center justify-start p-6 pt-12 overflow-y-auto no-scrollbar">
      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="w-full max-w-2xl space-y-8"
          >
            <div className="space-y-4 text-center">
              <div className="w-16 h-16 bg-bg-secondary border border-accent-cyan rounded-3xl flex items-center justify-center text-accent-cyan mx-auto shadow-xl shadow-cyan-500/10">
                <Globe className="w-8 h-8" />
              </div>
              <h1 className="text-3xl font-black tracking-tight text-white">Interface language</h1>
              <p className="text-text-secondary font-medium">Select your preferred cognitive language.</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {LANGUAGES.map(lang => (
                <button
                  key={lang.code}
                  onClick={() => {
                    setData({ ...data, language: lang.name, languageCode: lang.code, scriptDirection: lang.dir as any });
                    nextStep();
                  }}
                  className="bg-bg-primary border border-border-default p-4 text-center hover:border-accent-cyan transition-all flex flex-col items-center justify-center gap-2 rounded-2xl group shadow-sm"
                >
                  <span className="text-2xl">{lang.flag}</span>
                  <span className="font-bold text-sm text-text-secondary group-hover:text-accent-cyan">{lang.name}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="w-full max-w-md space-y-8"
          >
            <div className="space-y-4 text-center">
              <div className="w-20 h-20 bg-bg-secondary border border-accent-cyan rounded-[2rem] flex items-center justify-center text-accent-cyan mx-auto shadow-xl shadow-cyan-500/10">
                <GraduationCap className="w-10 h-10" />
              </div>
              <h1 className="text-4xl font-black tracking-tight text-white">Curriculum</h1>
              <p className="text-text-secondary font-medium">Which intelligence board defines your path?</p>
            </div>
            <div className="grid grid-cols-1 gap-4">
              {CURRICULA.map(cur => (
                <button
                  key={cur.name}
                  onClick={() => {
                    setData({ ...data, curriculum: cur.name, curriculumRegion: cur.region });
                    nextStep();
                  }}
                  className="bg-bg-primary border-2 border-border-default p-5 text-left hover:border-accent-cyan/50 hover:shadow-lg transition-all flex flex-col rounded-3xl group"
                >
                  <span className="font-bold text-text-secondary group-hover:text-white">{cur.name}</span>
                  <span className="text-xs font-black text-text-muted uppercase tracking-widest mt-1">{cur.region}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="w-full max-w-md space-y-8"
          >
            <div className="space-y-4 text-center">
              <div className="w-20 h-20 bg-bg-secondary border border-accent-cyan rounded-[2rem] flex items-center justify-center text-accent-cyan mx-auto shadow-xl shadow-cyan-500/10">
                <MapPin className="w-10 h-10" />
              </div>
              <h1 className="text-4xl font-black tracking-tight text-white">Region</h1>
              <p className="text-text-secondary font-medium">Adapting intelligence to your cultural grounding.</p>
            </div>
            <div className="grid grid-cols-1 gap-4">
              {REGIONS.map(reg => (
                <button
                  key={reg}
                  onClick={() => {
                    setData({ ...data, region: reg, country: 'Nigeria' });
                    complete();
                  }}
                  className="bg-bg-primary border-2 border-border-default p-5 text-left hover:border-accent-cyan/50 transition-all flex items-center justify-between rounded-3xl group"
                >
                  <span className="font-bold text-text-secondary group-hover:text-white">{reg}</span>
                  <ChevronRight className="w-5 h-5 text-text-muted group-hover:text-accent-cyan" />
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
