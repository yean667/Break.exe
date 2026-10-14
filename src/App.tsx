/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { BreakReason, BreakRecord, ActiveBreak, TodayStats, CharacterConfig } from './types';
import { REASON_CONFIGS, getBlobSpeech, COMPLETION_CELEBRATIONS } from './utils/quotes';
import {
  loadHistory,
  saveHistory,
  loadActiveBreak,
  saveActiveBreak,
  calculateTodayStats,
  getTodayKey,
} from './utils/storage';
import { loadSavedCharacter, saveCharacter } from './utils/characters';
import { sound } from './utils/audio';
import { DancingBlob } from './components/DancingBlob';
import {
  BlobAvatar,
  PeekingBlob,
  BooksStackDoodle,
  CurvedArrowLeft,
  CurvedArrowRight,
  RadiatingTicks,
} from './components/DoodleIcons';
import { ReasonIcon } from './components/ReasonIcons';
import { TodayDamage } from './components/TodayDamage';
import { BreakHistory } from './components/BreakHistory';
import { CharacterCustomizerModal } from './components/CharacterCustomizerModal';
import { CustomCursor } from './components/CustomCursor';
import { Footer } from './components/Footer';

const TARGET_PRESETS = [
  { mins: 0, label: 'Free Vibe' },
  { mins: 5, label: '5m Quick' },
  { mins: 10, label: '10m Coffee' },
  { mins: 15, label: '15m Stretch' },
  { mins: 25, label: '25m Long' },
];

export default function App() {
  // Break state
  const [activeBreak, setActiveBreak] = useState<ActiveBreak | null>(() => loadActiveBreak());
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [selectedReason, setSelectedReason] = useState<BreakReason>('phone');
  const [targetMinutes, setTargetMinutes] = useState<number>(() => {
    const loaded = loadActiveBreak();
    return loaded?.targetMinutes || 0;
  });
  const [explanationNote, setExplanationNote] = useState<string>('');
  
  // Character companion state
  const [characterConfig, setCharacterConfig] = useState<CharacterConfig>(() => loadSavedCharacter());
  const [isCustomizerOpen, setIsCustomizerOpen] = useState<boolean>(false);

  // History and stats
  const [history, setHistory] = useState<BreakRecord[]>(() => loadHistory());
  const [stats, setStats] = useState<TodayStats>(() => calculateTodayStats(loadHistory()));

  // Sound settings
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => sound.enabled);
  const [celebrationToast, setCelebrationToast] = useState<string | null>(null);
  const [endingSoonNotice, setEndingSoonNotice] = useState<string | null>(null);
  const intervalRef = useRef<number | null>(null);

  // Sync sound controller
  useEffect(() => {
    sound.setEnabled(soundEnabled);
  }, [soundEnabled]);

  // Recalculate stats whenever history changes
  useEffect(() => {
    setStats(calculateTodayStats(history));
    saveHistory(history);
  }, [history]);

  // Handle active break timer ticks & check for subtle ending-soon audio alert
  useEffect(() => {
    if (activeBreak) {
      const updateElapsed = () => {
        const now = Date.now();
        const diff = Math.max(0, Math.floor((now - activeBreak.startTime) / 1000));
        setElapsedSeconds(diff);

        // Check if break is about to end (30s before target)
        if (
          activeBreak.targetMinutes > 0 &&
          !activeBreak.notifiedAboutToEnd
        ) {
          const targetSeconds = activeBreak.targetMinutes * 60;
          const remaining = targetSeconds - diff;

          if (remaining <= 30 && remaining > 0) {
            // Play gentle subtle notification
            sound.playEndingSoonReminder();
            setEndingSoonNotice('break is wrapping up in ~30s... time to recharge your focus ☕');
            
            const updatedActive = { ...activeBreak, notifiedAboutToEnd: true };
            setActiveBreak(updatedActive);
            saveActiveBreak(updatedActive);

            setTimeout(() => {
              setEndingSoonNotice(null);
            }, 6000);
          }
        }
      };

      updateElapsed();
      intervalRef.current = window.setInterval(updateElapsed, 1000);
      setSelectedReason(activeBreak.reason);
      setExplanationNote(activeBreak.note || '');
      setTargetMinutes(activeBreak.targetMinutes || 0);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setElapsedSeconds(0);
      setEndingSoonNotice(null);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [activeBreak]);

  // Format digital timer string MM:SS or HH:MM:SS
  const formatTimerDigits = (totalSec: number): string => {
    const hours = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;

    const pad = (n: number) => String(n).padStart(2, '0');

    if (hours > 0) {
      return `${pad(hours)}:${pad(mins)}:${pad(secs)}`;
    }
    return `${pad(mins)}:${pad(secs)}`;
  };

  // Start Break action
  const handleStartBreak = () => {
    sound.playStartChime();
    const newActive: ActiveBreak = {
      startTime: Date.now(),
      reason: selectedReason,
      note: explanationNote.trim(),
      targetMinutes: targetMinutes,
      notifiedAboutToEnd: false,
    };
    setActiveBreak(newActive);
    saveActiveBreak(newActive);
  };

  // End Break action
  const handleEndBreak = () => {
    if (!activeBreak) return;

    sound.playEndChime();
    const now = Date.now();
    const duration = Math.max(1, Math.floor((now - activeBreak.startTime) / 1000));
    
    // Choose fallback note if none entered
    const defaultNote =
      REASON_CONFIGS.find((r) => r.id === activeBreak.reason)?.humorFallback ||
      'well deserved break';
    
    const finalNote = activeBreak.note || explanationNote.trim() || defaultNote;

    const newRecord: BreakRecord = {
      id: 'break-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      startTime: activeBreak.startTime,
      endTime: now,
      durationSeconds: duration,
      reason: activeBreak.reason,
      note: finalNote,
      dateKey: getTodayKey(),
    };

    const updatedHistory = [newRecord, ...history];
    setHistory(updatedHistory);
    setActiveBreak(null);
    saveActiveBreak(null);
    setExplanationNote('');
    setEndingSoonNotice(null);

    // Trigger cute pastel confetti celebration
    try {
      confetti({
        particleCount: 50,
        spread: 65,
        origin: { y: 0.65 },
        colors: ['#FFA8BA', '#BCE0FD', '#FEF08A', '#F5E4F8', '#BBF7D0'],
      });
    } catch {
      // ignore
    }

    // Show celebration banner
    const randomMsg =
      COMPLETION_CELEBRATIONS[
        Math.floor(Math.random() * COMPLETION_CELEBRATIONS.length)
      ];
    setCelebrationToast(randomMsg);
    setTimeout(() => {
      setCelebrationToast(null);
    }, 4500);
  };

  // Delete a specific record
  const handleDeleteRecord = (id: string) => {
    setHistory((prev) => prev.filter((r) => r.id !== id));
  };

  // Clear all history
  const handleClearAll = () => {
    setHistory([]);
  };

  // Handle character customization save
  const handleSaveCharacter = (newConfig: CharacterConfig) => {
    setCharacterConfig(newConfig);
    saveCharacter(newConfig);
  };

  // Dynamic blob speech and expressions
  const blobInfo = activeBreak
    ? getBlobSpeech(elapsedSeconds, activeBreak.reason)
    : {
        main: 'vibing... (temporarily)',
        subtitle: 'your books can wait (again)',
        expression: 'dancing' as const,
      };

  return (
    <div className="min-h-screen bg-[#FBF8F4] text-[#4A3E3D] selection:bg-[#FFE5EC] selection:text-[#E8556D] p-3 sm:p-5 md:p-8 flex flex-col items-center justify-center relative">
      {/* Adorable Custom Cursor (Desktop Only) */}
      <CustomCursor />

      {/* Toast Notification (Break Completed) */}
      {celebrationToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-white border-2 border-[#FFA8BA] px-5 py-2.5 rounded-full shadow-lg flex items-center gap-2 animate-bounce">
          <BlobAvatar
            size={24}
            mood="happy"
            bodyColor={characterConfig.bodyColor}
            blushColor={characterConfig.blushColor}
          />
          <span className="font-doodle text-sm md:text-base font-bold text-[#E8556D]">
            {celebrationToast}
          </span>
        </div>
      )}

      {/* Gentle Ending Soon Audio/Visual Notice */}
      {endingSoonNotice && (
        <div className="fixed top-18 left-1/2 -translate-x-1/2 z-50 bg-[#FFF7ED] border border-[#FDBA74] px-4 py-2 rounded-full shadow-md flex items-center gap-2 animate-pulse">
          <span className="text-sm">🔔</span>
          <span className="font-doodle text-xs md:text-sm font-bold text-[#C2410C]">
            {endingSoonNotice}
          </span>
        </div>
      )}

      {/* Main Container */}
      <div className="w-full max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-5 md:gap-6 items-start">
        {/* ============================================================== */}
        {/* LEFT COLUMN: Main Break Card (Matching the Reference UI Mockup) */}
        {/* ============================================================== */}
        <div className="lg:col-span-7 bg-[#FFFDFB] border border-[#ECE4DB] rounded-[32px] p-5 md:p-7 shadow-xs flex flex-col justify-between">
          <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              {/* App Title & Subtitle */}
              <div className="flex items-center gap-2.5">
                <BlobAvatar
                  size={36}
                  mood={activeBreak ? 'happy' : 'cheeky'}
                  bodyColor={characterConfig.bodyColor}
                  blushColor={characterConfig.blushColor}
                />
                <div>
                  <h1 className="text-2xl md:text-3xl font-black tracking-tight text-[#3A2C29] flex items-center gap-1.5 leading-none font-display">
                    break.exe
                  </h1>
                  <p className="text-xs text-[#9E8E8A] font-medium mt-1">
                    because even robots need breaks
                  </p>
                </div>
              </div>

              {/* Right Pill Badges & Action Buttons */}
              <div className="flex items-center gap-2">
                {/* Customize Companion Button */}
                <button
                  onClick={() => {
                    sound.playPop();
                    setIsCustomizerOpen(true);
                  }}
                  className="bg-[#FAF4ED] border border-[#EFE5DB] hover:border-[#FFA8BA] hover:bg-[#FFF5F7] rounded-full px-3 py-1 flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer text-xs font-semibold text-[#6B5A56]"
                  title="Customize your companion character and sounds"
                >
                  <span>✨</span>
                  <span className="font-doodle hidden sm:inline">{characterConfig.name}</span>
                  <span className="font-doodle sm:hidden">edit</span>
                </button>

                {/* Sound mute/unmute button */}
                <button
                  onClick={() => {
                    const newVal = !soundEnabled;
                    setSoundEnabled(newVal);
                    sound.setEnabled(newVal);
                    if (newVal) sound.playStartChime();
                  }}
                  className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors cursor-pointer text-xs ${
                    soundEnabled
                      ? 'bg-[#FAF4ED] border-[#EFE5DB] text-[#7E6E6A] hover:text-[#3A2C29]'
                      : 'bg-[#F2ECE6] border-[#DFD5CB] text-[#A89894]'
                  }`}
                  title={soundEnabled ? 'Mute sounds' : 'Enable sounds'}
                >
                  {soundEnabled ? '🔔' : '🔕'}
                </button>
              </div>
            </div>

            {/* Inner Pastel Pink Card (The Dancing Blob & Digital Timer Centerpiece) */}
            <div className="bg-[#FFF0F2] border border-[#FFE1E6] rounded-[26px] p-5 md:p-6 my-4 relative overflow-hidden select-none">
              {/* Top Digital Timer with Radiating Ticks */}
              <div className="flex items-center justify-center gap-3 md:gap-4 mb-2">
                <RadiatingTicks side="left" />
                <div className="text-5xl md:text-6xl font-black text-[#EB5E6F] tracking-tight font-display drop-shadow-2xs">
                  {formatTimerDigits(elapsedSeconds)}
                </div>
                <RadiatingTicks side="right" />
              </div>

              {/* Center Row: Left Quote + Dancing Blob + Right Books Doodle */}
              <div className="relative flex items-center justify-between py-1">
                {/* Left humorous note with hand-drawn arrow */}
                <div className="w-24 md:w-32 flex flex-col items-center text-center">
                  <p className="font-doodle text-xs md:text-sm text-[#7D6B66] leading-tight">
                    {blobInfo.main}
                  </p>
                  <CurvedArrowLeft className="mt-1" />
                </div>

                {/* The Adorable Dancing Character with Customizer Support */}
                <div className="flex-1 flex justify-center">
                  <DancingBlob
                    isDancing={Boolean(activeBreak)}
                    expression={blobInfo.expression}
                    config={characterConfig}
                  />
                </div>

                {/* Right stacked books doodle with hand-drawn arrow */}
                <div className="w-24 md:w-32 flex flex-col items-center text-center">
                  <p className="font-doodle text-xs md:text-sm text-[#7D6B66] leading-tight">
                    {blobInfo.subtitle}
                  </p>
                  <div className="flex items-center justify-center mt-1">
                    <CurvedArrowRight className="mr-0.5" />
                    <BooksStackDoodle />
                  </div>
                </div>
              </div>

              {/* Target break indicator if configured */}
              {activeBreak && activeBreak.targetMinutes > 0 && (
                <div className="mt-2 text-center">
                  <span className="font-doodle text-xs text-[#C85567] bg-white/70 px-3 py-1 rounded-full border border-[#FFD5DC]">
                    target limit: {activeBreak.targetMinutes}m (
                    {Math.max(
                      0,
                      Math.ceil((activeBreak.targetMinutes * 60 - elapsedSeconds) / 60)
                    )}
                    m left)
                  </span>
                </div>
              )}
            </div>

            {/* Target Duration Selector (when break is inactive) */}
            {!activeBreak && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-[#6D5D59] uppercase tracking-wider">
                    break length target:
                  </label>
                  <span className="font-doodle text-xs text-[#8A7975]">
                    {targetMinutes === 0
                      ? 'free-form stopwatch'
                      : `gentle chime at ${targetMinutes}m`}
                  </span>
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {TARGET_PRESETS.map((t) => (
                    <button
                      key={t.mins}
                      type="button"
                      onClick={() => {
                        sound.playPop();
                        setTargetMinutes(t.mins);
                      }}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer shrink-0 ${
                        targetMinutes === t.mins
                          ? 'bg-[#FFE6EC] border-[#FFA8BA] text-[#E8556D] shadow-2xs'
                          : 'bg-white border-[#EAE2D8] text-[#6E5E5A] hover:bg-[#FAF4EE]'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Break Reason Selection */}
            <div>
              <label className="block text-sm md:text-base font-bold text-[#3A2C29] mb-2.5 font-display">
                why are you taking a break?
              </label>

              {/* Reasons Pills Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                {REASON_CONFIGS.map((r) => {
                  const isSelected = selectedReason === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      disabled={Boolean(activeBreak)}
                      onClick={() => {
                        sound.playPop();
                        setSelectedReason(r.id);
                      }}
                      className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-2xl border text-xs md:text-sm font-semibold transition-all cursor-pointer ${
                        activeBreak ? 'cursor-not-allowed opacity-90' : ''
                      } ${
                        isSelected
                          ? 'bg-[#FFF0F3] border-[#FFA8BA] text-[#E8556D] shadow-2xs'
                          : 'bg-white border-[#EAE2D8] text-[#554643] hover:bg-[#FDF9F6]'
                      }`}
                    >
                      <ReasonIcon reason={r.id} size={17} />
                      <span className="truncate">{r.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Optional Explanation Input with Peeking Blob */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mt-3">
                <input
                  type="text"
                  value={explanationNote}
                  disabled={Boolean(activeBreak)}
                  onChange={(e) => setExplanationNote(e.target.value)}
                  placeholder="any explanation? (optional)"
                  maxLength={60}
                  className="flex-1 bg-white border border-[#EAE2D8] rounded-2xl px-4 py-2.5 text-xs md:text-sm text-[#4A3E3D] placeholder-[#A69793] focus:outline-none focus:border-[#FFA8BA] transition-colors disabled:bg-[#FAF6F2]"
                />

                <div className="shrink-0 flex justify-end">
                  <PeekingBlob text="no judgment... ~ maybe" />
                </div>
              </div>
            </div>
          </div>

          {/* Action Button: Start or End Break */}
          <div className="mt-6">
            {!activeBreak ? (
              <button
                type="button"
                onClick={handleStartBreak}
                className="w-full bg-[#FF6E85] hover:bg-[#FA5B74] active:scale-[0.99] text-white font-bold text-base md:text-lg py-3.5 px-6 rounded-2xl shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2 font-display"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                <span>Start Break</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleEndBreak}
                className="w-full bg-[#FF6E85] hover:bg-[#FA5B74] active:scale-[0.99] text-white font-bold text-base md:text-lg py-3.5 px-6 rounded-2xl shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2 font-display animate-pulse-glow"
              >
                {/* White stop square */}
                <rect width="16" height="16" rx="3" className="fill-white" />
                <span>End Break</span>
              </button>
            )}

            {/* Bottom Sarcastic Caption */}
            <p className="font-doodle text-xs md:text-sm text-[#8F7F7B] mt-2.5 text-center select-none">
              come back soon... your future self is watching 👀
            </p>
          </div>
        </div>

        {/* ============================================================== */}
        {/* RIGHT COLUMN: Today's Damage + Break History                   */}
        {/* ============================================================== */}
        <div className="lg:col-span-5 flex flex-col gap-5 md:gap-6">
          {/* Top Card: today's damage */}
          <TodayDamage stats={stats} />

          {/* Bottom Card: break history */}
          <BreakHistory
            records={history}
            onDeleteRecord={handleDeleteRecord}
            onClearAll={handleClearAll}
          />
        </div>
      </div>

      {/* Creator Credits and Socials Footer */}
      <Footer />

      {/* Character Customizer & Sound Setup Modal */}
      <CharacterCustomizerModal
        isOpen={isCustomizerOpen}
        onClose={() => setIsCustomizerOpen(false)}
        currentConfig={characterConfig}
        onSave={handleSaveCharacter}
        soundEnabled={soundEnabled}
        onToggleSound={setSoundEnabled}
      />
    </div>
  );
}
