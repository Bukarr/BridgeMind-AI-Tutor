import React, { useEffect, useState } from 'react';
import { getDB } from '../lib/db';
import { Link } from 'react-router-dom';
import { Clock, BookOpen, ChevronRight, Search, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from '../lib/i18n';
import { useLearnerStore } from '../store/learner';

export default function History() {
  const profile = useLearnerStore(state => state.profile);
  const { t } = useTranslation(profile?.languageCode || 'en');
  const [sessions, setSessions] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState<{ id: string | 'all', type: 'single' | 'all' } | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const db = await getDB();
    const all = await db.getAllFromIndex('sessions', 'by-updated');
    setSessions(all.reverse());
  }

  const deleteSession = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setShowDeleteModal({ id, type: 'single' });
  };

  const clearHistory = async () => {
    setShowDeleteModal({ id: 'all', type: 'all' });
  };

  const handleConfirmDelete = async () => {
    if (!showDeleteModal) return;
    
    const db = await getDB();
    if (showDeleteModal.type === 'all') {
      await db.clear('sessions');
    } else {
      await db.delete('sessions', showDeleteModal.id);
    }
    
    setShowDeleteModal(null);
    load();
  };

  const filteredSessions = sessions.filter(s => 
    s.topic.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.subject.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 pb-24">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-black text-text-primary">{t('archive')}</h1>
          <p className="text-text-secondary font-medium">{t('neuralArchiveDesc')}</p>
        </div>
        {sessions.length > 0 && (
          <button 
            onClick={clearHistory}
            className="p-3 text-text-muted hover:text-accent-red transition-colors"
            title={t('clearHistory')}
          >
            <Trash2 className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="bg-bg-primary border border-border-default p-1 flex items-center gap-2 rounded-2xl shadow-sm">
        <Search className="w-4 h-4 text-text-muted ml-3" />
        <input 
          placeholder={t('scan')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 bg-transparent p-3 text-sm focus:outline-none font-bold text-text-primary placeholder:text-text-muted"
        />
      </div>

      <div className="space-y-4">
        {filteredSessions.map(session => (
          <Link
            to={`/tutor?session=${session.id}`}
            key={session.id}
            className="bg-bg-primary border border-border-default p-6 block hover:border-accent-cyan/50 transition-all rounded-3xl group shadow-sm relative overflow-hidden"
          >
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-bg-secondary text-accent-cyan px-3 py-1 rounded-full font-bold uppercase tracking-wider border border-border-default">
                        {session.subject}
                    </span>
                    <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">
                        {new Date(session.updatedAt).toLocaleDateString([], { month: 'long', day: 'numeric' })}
                    </span>
                </div>
                <div className="flex items-center gap-4">
                  <Clock className="w-4 h-4 text-text-muted" />
                  <button 
                    onClick={(e) => deleteSession(e, session.id)}
                    className="p-2 -mr-2 text-text-muted hover:text-accent-red opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
            </div>
            <h3 className="font-bold text-xl mb-2 text-text-primary group-hover:text-accent-cyan transition-colors">{session.topic}</h3>
            <p className="text-sm text-text-secondary line-clamp-2 leading-relaxed">
                {session.messages[session.messages.length - 1]?.content.replace(/#|[*]/g, '')}
            </p>
          </Link>
        ))}
        {filteredSessions.length === 0 && (
          <div className="text-center py-12 opacity-30">
            <BookOpen className="w-12 h-12 mx-auto mb-4 text-text-muted" />
            <p className="text-text-muted font-medium">{t('noSessions')}</p>
          </div>
        )}
      </div>

      {/* Custom Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-bg-base/80 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm bg-bg-primary border border-border-default rounded-[2.5rem] p-8 shadow-2xl shadow-accent-red/10"
          >
            <div className="w-16 h-16 bg-accent-red/10 rounded-2xl flex items-center justify-center mb-6">
              <Trash2 className="w-8 h-8 text-accent-red" />
            </div>
            <h3 className="text-xl font-black text-text-primary mb-2">{t('confirmDelete')}</h3>
            <p className="text-sm text-text-secondary leading-relaxed mb-8">{t('deleteWarning')}</p>
            
            <div className="flex gap-3">
              <button 
                onClick={() => setShowDeleteModal(null)}
                className="flex-1 px-6 py-4 rounded-2xl bg-bg-secondary text-text-primary font-bold text-sm hover:bg-bg-elevated transition-colors"
              >
                {t('cancel')}
              </button>
              <button 
                onClick={handleConfirmDelete}
                className="flex-1 px-6 py-4 rounded-2xl bg-accent-red text-white font-bold text-sm hover:opacity-90 shadow-lg shadow-accent-red/20 transition-all"
              >
                {t('confirm')}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
