import React, { useState, useEffect, useRef } from 'react';
import { useLearnerStore } from '../store/learner';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Sparkles, ChevronLeft, Mic, Eraser, Lightbulb, Zap, Paperclip, X, FileText, Image as ImageIcon, ChevronDown, ChevronUp, RotateCcw, Copy, Check, ThumbsUp, ThumbsDown } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { getDB } from '../lib/db';
import { v4 as uuidv4 } from 'uuid';
import Markdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useTranslation } from '../lib/i18n';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  feedback?: 'positive' | 'negative';
  attachments?: {
    name: string;
    mimeType: string;
    data: string;
  }[];
}

export default function Tutor() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const profile = useLearnerStore(state => state.profile);
  const { t } = useTranslation(profile?.languageCode || 'en');
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>(searchParams.get('session') || uuidv4());
  const [subject, setSubject] = useState(searchParams.get('subject') || 'general');
  const [lowBandwidth, setLowBandwidth] = useState(false);
  const [attachments, setAttachments] = useState<{name: string, mimeType: string, data: string}[]>([]);
  const [isContextOpen, setIsContextOpen] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const startNewSession = () => {
    setMessages([]);
    setSessionId(uuidv4());
    setInput('');
    setAttachments([]);
    navigate('/tutor', { replace: true });
  };

  useEffect(() => {
    async function loadSession() {
      const db = await getDB();
      const existing = await db.get('sessions', sessionId);
      if (existing) {
        setMessages(existing.messages);
        setSubject(existing.subject);
      }
    }
    if (searchParams.get('session')) {
      loadSession();
    }
  }, [sessionId, searchParams]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      if (file.size > 5 * 1024 * 1024) {
        alert("File too large (max 5MB)");
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result?.toString().split(',')[1];
        if (base64) {
          setAttachments(prev => [...prev, {
            name: file.name,
            mimeType: file.type || 'application/octet-stream',
            data: base64
          }]);
        }
      };
      reader.readAsDataURL(file);
    });
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSend = async (customMessage?: Message) => {
    if (!customMessage && (!input.trim() && attachments.length === 0) && !isLoading) return;
    if (isLoading) return;

    const userMessage: Message = customMessage || {
      role: 'user',
      content: input,
      timestamp: Date.now(),
      attachments: attachments.length > 0 ? [...attachments] : undefined
    };

    if (!customMessage) {
      setMessages(prev => [...prev, userMessage]);
      setInput('');
      setAttachments([]);
    } else {
      // If regenerating, remove the last assistant message and retry
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'assistant') {
          return prev.slice(0, -1);
        }
        return prev;
      });
    }

    setIsLoading(true);

    const tutorMessages = customMessage 
      ? messages.filter(m => m !== messages[messages.length - 1]) 
      : [...messages, userMessage];

    const fetchWithRetry = async (retryCount = 0): Promise<Response> => {
      try {
        const response = await fetch('/api/tutor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: tutorMessages,
            learnerProfile: profile,
            subject,
            lowBandwidth
          })
        });

        if (response.status === 429 && retryCount < 2) {
          await new Promise(resolve => setTimeout(resolve, 2000 * (retryCount + 1)));
          return fetchWithRetry(retryCount + 1);
        }
        return response;
      } catch (err: any) {
        if (retryCount < 2) {
          await new Promise(resolve => setTimeout(resolve, 1500));
          return fetchWithRetry(retryCount + 1);
        }
        throw err;
      }
    };

    try {
      const response = await fetchWithRetry();

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'BridgeMind is busy right now. Please try again soon.');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';

      const assistantMessage: Message = {
        role: 'assistant',
        content: '',
        timestamp: Date.now()
      };

      setMessages(prev => [...prev, assistantMessage]);

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          assistantContent += chunk;
          
          setMessages(prev => {
            const newMessages = [...prev];
            newMessages[newMessages.length - 1].content = assistantContent;
            return newMessages;
          });
        }
      }

      const db = await getDB();
      await db.put('sessions', {
        id: sessionId,
        topic: tutorMessages[0]?.content || userMessage.content,
        subject,
        curriculum: profile?.curriculum || 'General',
        language: profile?.language || 'English',
        messages: [...tutorMessages, { ...assistantMessage, content: assistantContent }],
        timestamp: Date.now(),
        updatedAt: Date.now()
      });

    } catch (error: any) {
      console.error('Tutor Error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `⚠️ **Notice:** ${error.message || 'Something went wrong. Please check your connection and try again.'}`,
        timestamp: Date.now()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const copyResponse = (content: string, index: number) => {
    navigator.clipboard.writeText(content);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleFeedback = async (index: number, type: 'positive' | 'negative') => {
    const updatedMessages = [...messages];
    updatedMessages[index].feedback = type;
    setMessages(updatedMessages);

    const db = await getDB();
    await db.put('sessions', {
      id: sessionId,
      topic: messages[0]?.content || '',
      subject,
      curriculum: profile?.curriculum || 'General',
      language: profile?.language || 'English',
      messages: updatedMessages,
      timestamp: Date.now(),
      updatedAt: Date.now()
    });
  };

  const regenerateResponse = () => {
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
    if (lastUserMessage) {
      handleSend(lastUserMessage);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-bg-base flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-bg-primary/60 backdrop-blur-2xl border-b border-border-default/50 h-16 flex-shrink-0 px-6 flex items-center justify-between z-10 shadow-lg">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)} 
            className="p-2 hover:bg-bg-secondary rounded-full transition-all hover:scale-110 active:scale-95 active:bg-accent-cyan/10 group"
          >
            <ChevronLeft className="w-6 h-6 text-text-secondary group-active:text-accent-cyan transition-colors" />
          </button>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1 className="font-black text-xs uppercase tracking-widest text-accent-cyan leading-none">{subject}</h1>
              <div className="w-1.5 h-1.5 rounded-full bg-accent-cyan animate-pulse" />
            </div>
            <p className="text-[10px] text-text-muted font-bold leading-none mt-1 uppercase tracking-tighter">BridgeMind Neural Link</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {profile?.comprehensionLevel && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent-cyan/5 border border-accent-cyan/20"
            >
              <div className="flex gap-0.5">
                {[...Array(10)].map((_, i) => (
                  <div 
                    key={i} 
                    className={`w-1 h-3 rounded-full ${i < profile.comprehensionLevel! ? 'bg-accent-cyan' : 'bg-white/10'}`} 
                  />
                ))}
              </div>
              <span className="text-[10px] font-black text-accent-cyan uppercase tracking-widest">Level {profile.comprehensionLevel}</span>
            </motion.div>
          )}
          <button 
            onClick={startNewSession}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-black border border-border-default text-accent-cyan bg-bg-secondary hover:bg-bg-elevated transition-all shadow-sm hover:border-accent-cyan/50"
          >
            <Eraser className="w-3.5 h-3.5" /> {t('newSession')}
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-6 space-y-10 no-scrollbar scroll-smooth pt-8 pb-48">
        <div className="max-w-3xl mx-auto w-full space-y-10">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-8 py-20">
              <div className="relative">
                <div className="absolute inset-0 bg-accent-cyan/20 blur-3xl rounded-full" />
                <div className="relative w-24 h-24 bg-bg-secondary rounded-[2rem] flex items-center justify-center border border-border-default shadow-2xl shadow-cyan-500/10 rotate-3">
                  <Sparkles className="w-12 h-12 text-accent-cyan animate-pulse" />
                </div>
              </div>
              <div className="space-y-4">
                <h2 className="text-3xl font-black text-text-primary tracking-tighter">Hello, scholar.</h2>
                <p className="text-sm text-text-secondary max-w-sm mx-auto leading-relaxed">
                  I am BridgeMind 2.0, your African-forward intelligence partner. 
                  Ready to explore <span className="text-accent-cyan font-bold">{subject}</span> using the {profile?.curriculum} curriculum.
                </p>
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex w-full ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[90%] md:max-w-[85%] group ${
                m.role === 'user' ? 'w-auto' : 'w-full'
              }`}>
                <div className={`p-6 shadow-glass relative transition-all duration-300 ${
                  m.role === 'user' 
                    ? 'bg-accent-cyan text-bg-base font-bold shadow-cyan-500/10 rounded-[2rem] rounded-tr-sm' 
                    : 'glass text-text-primary rounded-tl-sm'
                }`}>
                  {m.attachments && m.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {m.attachments.map((file, idx) => (
                        <div key={idx} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-black ${m.role === 'user' ? 'bg-bg-base/20 text-bg-base' : 'bg-bg-secondary text-accent-cyan'}`}>
                          {file.mimeType.startsWith('image/') ? <ImageIcon size={14} /> : <FileText size={14} />}
                          <span className="truncate max-w-[120px]">{file.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="markdown-body font-medium leading-relaxed">
                    <Markdown 
                      remarkPlugins={[remarkMath, remarkGfm]} 
                      rehypePlugins={[rehypeKatex]}
                      components={{
                        code({ node, inline, className, children, ...props }: any) {
                          const match = /language-(\w+)/.exec(className || '');
                          return !inline && match ? (
                            <SyntaxHighlighter
                              style={atomDark}
                              language={match[1]}
                              PreTag="div"
                              className="rounded-2xl my-4 text-xs"
                              {...props}
                            >
                              {String(children).replace(/\n$/, '')}
                            </SyntaxHighlighter>
                          ) : (
                            <code className={`${className} bg-bg-secondary/50 px-1.5 py-0.5 rounded text-accent-cyan`} {...props}>
                              {children}
                            </code>
                          );
                        }
                      }}
                    >
                      {m.content}
                    </Markdown>
                  </div>
                  <div className="flex items-center justify-between mt-4">
                    <div className={`text-[8px] font-black opacity-40 uppercase tracking-widest ${m.role === 'user' ? 'text-bg-base' : 'text-text-muted'}`}>
                      {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    {m.role === 'assistant' && !isLoading && (
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="flex items-center gap-1 bg-bg-secondary/40 rounded-lg p-0.5 mr-2">
                          <button 
                            onClick={() => handleFeedback(i, 'positive')}
                            className={`p-1 rounded-md transition-colors ${m.feedback === 'positive' ? 'bg-accent-cyan/10 text-accent-cyan' : 'text-text-muted hover:text-white'}`}
                          >
                            <ThumbsUp size={10} />
                          </button>
                          <button 
                            onClick={() => handleFeedback(i, 'negative')}
                            className={`p-1 rounded-md transition-colors ${m.feedback === 'negative' ? 'bg-red-500/10 text-red-500' : 'text-text-muted hover:text-white'}`}
                          >
                            <ThumbsDown size={10} />
                          </button>
                        </div>
                        <button 
                          onClick={() => copyResponse(m.content, i)}
                          className="p-1.5 hover:bg-bg-secondary rounded-lg transition-colors text-text-muted hover:text-accent-cyan"
                          title="Copy Response"
                        >
                          {copiedIndex === i ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                        </button>
                        {i === messages.length - 1 && (
                          <button 
                            onClick={regenerateResponse}
                            className="p-1.5 hover:bg-bg-secondary rounded-lg transition-colors text-text-muted hover:text-accent-cyan"
                            title="Regenerate Response"
                          >
                            <RotateCcw size={12} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
          {isLoading && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start"
            >
              <div className="glass px-6 py-4 rounded-tl-sm text-accent-cyan text-xs font-black flex items-center gap-3 shadow-glass">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-accent-cyan rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 bg-accent-cyan rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 bg-accent-cyan rounded-full animate-bounce" />
                </div>
                {t('thinking')}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Footer / Input Area */}
      <div className="flex-shrink-0 bg-gradient-to-t from-bg-base via-bg-base/90 to-transparent pt-10 pb-8 px-4 md:px-6 absolute bottom-0 left-0 right-0 z-20">
        <div className="max-w-3xl mx-auto space-y-4">
          <AnimatePresence>
            {attachments.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="flex flex-wrap gap-2 mb-2 p-3 bg-bg-secondary/50 backdrop-blur-md rounded-2xl border border-border-default/50"
              >
                {attachments.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-2 px-3 py-1.5 bg-bg-primary border border-border-default rounded-xl text-[10px] font-black text-accent-cyan">
                    {file.mimeType.startsWith('image/') ? <ImageIcon size={12} /> : <FileText size={12} />}
                    <span className="truncate max-w-[120px]">{file.name}</span>
                    <button onClick={() => removeAttachment(idx)} className="text-text-muted hover:text-accent-red ml-1">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-accent-cyan/20 to-accent-cyan/10 blur opacity-0 group-focus-within:opacity-100 transition duration-500 rounded-[2.5rem]" />
            <div className={`relative flex items-end gap-2 bg-bg-primary/70 backdrop-blur-2xl border border-border-default p-2 rounded-[2.5rem] shadow-glass transition-all ${isLoading ? 'opacity-50' : ''}`}>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                className="hidden" 
                multiple
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="p-4 text-text-muted hover:text-accent-cyan transition-all hover:scale-110 active:scale-95 bg-bg-secondary rounded-full flex-shrink-0"
              >
                <Paperclip className="w-5 h-5" />
              </button>
              
              <div className="flex-1 flex flex-col py-3 px-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  rows={Math.min(5, input.split('\n').length)}
                  placeholder={t('ask')}
                  className="w-full bg-transparent border-none focus:outline-none text-sm font-bold placeholder:text-text-muted text-text-primary resize-none no-scrollbar max-h-[150px]"
                />
              </div>

              <button
                onClick={() => handleSend()}
                disabled={isLoading || (!input.trim() && attachments.length === 0)}
                className={`p-4 rounded-full bg-accent-cyan text-bg-base transition-all shadow-xl shadow-cyan-500/20 flex-shrink-0 ${
                  isLoading || (!input.trim() && attachments.length === 0) 
                    ? 'opacity-30 bg-bg-secondary grayscale' 
                    : 'hover:scale-105 active:scale-95 hover:shadow-cyan-500/40'
                }`}
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
          <p className="text-[9px] text-center text-text-muted font-black tracking-widest uppercase opacity-40">
            Frontier AI can make mistakes. Verify critical facts.
          </p>
        </div>
      </div>
    </div>
  );
}
