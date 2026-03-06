/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { 
  Trophy, 
  Settings, 
  Play, 
  RotateCcw, 
  X,
  Sparkles,
  Volume2,
  ChevronLeft,
  Loader2
} from 'lucide-react';
import { preloadAllImages } from './services/imageService';

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

// --- Audio Service (Web Audio API) ---
class AudioService {
  private ctx: AudioContext | null = null;

  private init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  playDrumRoll(duration: number) {
    this.init();
    if (!this.ctx) return;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(100, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + duration);
    
    gain.gain.setValueAtTime(0.8, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  playFanfare() {
    this.init();
    if (!this.ctx) return;

    const playChord = (freqs: number[], start: number, dur: number, type: OscillatorType = 'square') => {
      freqs.forEach(freq => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        
        gain.gain.setValueAtTime(0, this.ctx.currentTime + start);
        gain.gain.linearRampToValueAtTime(0.15, this.ctx.currentTime + start + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + start + dur);
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(this.ctx.currentTime + start);
        osc.stop(this.ctx.currentTime + start + dur);
      });
    };

    // Grand Fanfare (C Major)
    playChord([261.63, 329.63, 392.00, 523.25], 0, 0.3, 'sawtooth'); // C
    playChord([261.63, 329.63, 392.00, 523.25], 0.3, 0.3, 'sawtooth'); // C
    playChord([261.63, 329.63, 392.00, 523.25], 0.6, 0.3, 'sawtooth'); // C
    playChord([349.23, 440.00, 523.25, 698.46], 0.9, 0.4, 'sawtooth'); // F
    playChord([392.00, 493.88, 587.33, 783.99], 1.3, 0.4, 'sawtooth'); // G
    playChord([523.25, 659.25, 783.99, 1046.50], 1.7, 2.0, 'sawtooth'); // C high
  }
}

const audio = new AudioService();

// --- Types ---
interface Card {
  id: number;
  isFlipped: boolean;
  isWinning: boolean;
  isShaking: boolean;
}

type Screen = 'apikey' | 'loading' | 'setup' | 'game';
const LOGO_IMAGE = '/logo.png';
const VOUCHER_IMAGE = '/voucher.png';

export default function App() {
  const [screen, setScreen] = useState<Screen>('loading');
  const [count, setCount] = useState<number>(8);
  const [cards, setCards] = useState<Card[]>([]);
  const [winnerIndex, setWinnerIndex] = useState<number | null>(null);
  const [isGameOver, setIsGameOver] = useState(false);
  const [showWinnerPopup, setShowWinnerPopup] = useState(false);
  
  // Image Loading State
  const [images, setImages] = useState<Record<string, string>>({});
  const [loadingProgress, setLoadingProgress] = useState({ loaded: 0, total: 0 });
  const [apiError, setApiError] = useState<string | null>(null);

  const loadImages = useCallback(async () => {
    setScreen('loading');
    setApiError(null);
    try {
      const loadedImages = await preloadAllImages((loaded, total) => {
        setLoadingProgress({ loaded, total });
      });
      setImages(loadedImages);
      setScreen('setup');
    } catch (e: any) {
      console.error("Failed to load images", e);
      if (e?.message?.includes('Requested entity was not found') || e?.message?.includes('403') || e?.message?.includes('PERMISSION_DENIED')) {
        setApiError("API 키 권한이 부족하거나 유효하지 않습니다. 결제가 등록된 Google Cloud 프로젝트의 API 키를 다시 선택해주세요.");
        setScreen('apikey');
      } else {
        setScreen('setup'); // Fallback to setup even if images fail
      }
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const checkApiKey = async () => {
      try {
        if (window.aistudio && window.aistudio.hasSelectedApiKey) {
          const hasKey = await window.aistudio.hasSelectedApiKey();
          if (!hasKey) {
            if (mounted) setScreen('apikey');
            return;
          }
        }
      } catch (e) {
        console.error("Error checking API key", e);
      }
      if (mounted) loadImages();
    };
    checkApiKey();
    return () => { mounted = false; };
  }, [loadImages]);

  const handleSelectApiKey = async () => {
    try {
      if (window.aistudio && window.aistudio.openSelectKey) {
        await window.aistudio.openSelectKey();
        // Assume success and proceed
        loadImages();
      } else {
        setApiError("API 키 선택 기능을 사용할 수 없습니다.");
      }
    } catch (e) {
      console.error("Error selecting API key", e);
    }
  };

  const getRandomWinner = (max: number) => {
    const array = new Uint32Array(1);
    window.crypto.getRandomValues(array);
    return array[0] % max;
  };

  const startGame = () => {
    const winIdx = getRandomWinner(count);
    const initialCards = Array.from({ length: count }, (_, i) => ({
      id: i,
      isFlipped: false,
      isWinning: i === winIdx,
      isShaking: false,
    }));
    setCards(initialCards);
    setWinnerIndex(winIdx);
    setScreen('game');
    setIsGameOver(false);
    setShowWinnerPopup(false);
  };

  const handleCardClick = (id: number, e: React.MouseEvent) => {
    if (isGameOver || cards[id].isFlipped) return;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = (rect.left + rect.width / 2) / window.innerWidth;
    const y = (rect.top + rect.height / 2) / window.innerHeight;

    setCards(prev => prev.map(c => c.id === id ? { ...c, isShaking: true } : c));
    audio.playDrumRoll(1);

    setTimeout(() => {
      setCards(prev => prev.map(c => c.id === id ? { ...c, isShaking: false, isFlipped: true } : c));
      
      const isWin = id === winnerIndex;
      confetti({
        particleCount: isWin ? 60 : 30,
        spread: isWin ? 70 : 50,
        origin: { x, y },
        colors: isWin ? ['#ffcc00', '#ff66aa', '#ffffff'] : ['#253585', '#a0aec0', '#ffffff'],
        zIndex: 100,
        ticks: 100
      });

      if (isWin) {
        handleWin();
      }
    }, 1000);
  };

  const handleWin = () => {
    setIsGameOver(true);
    setTimeout(() => {
      setShowWinnerPopup(true);
      audio.playFanfare();
      
      const duration = 3000;
      const end = Date.now() + duration;

      const frame = () => {
        confetti({
          particleCount: 8,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#253585', '#ffcc00', '#ffffff', '#ff66aa', '#00ccff']
        });
        confetti({
          particleCount: 8,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ['#253585', '#ffcc00', '#ffffff', '#ff66aa', '#00ccff']
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };
      frame();
    }, 600);
  };

  const resetGame = () => {
    setScreen('setup');
    setCards([]);
    setWinnerIndex(null);
    setIsGameOver(false);
    setShowWinnerPopup(false);
  };

  const bgElements = useMemo(() => {
    const icons = ['icon_bulb_v3', 'icon_megaphone_v3', 'icon_target_v3', 'icon_chat_v3', 'icon_smile_v3', 'icon_star_v3', 'icon_coffee_v3', 'icon_fish_v3'];
    return Array.from({ length: 24 }).map((_, i) => ({
      id: i,
      icon: icons[i % icons.length],
      top: `${Math.floor(Math.random() * 90)}%`,
      left: `${Math.floor(Math.random() * 90)}%`,
      rotate: Math.floor(Math.random() * 60) - 30,
      delay: Math.random() * 5,
      width: Math.floor(Math.random() * 40) + 40,
    }));
  }, []);

  const getGridCols = () => {
    if (count <= 4) return 'grid-cols-2 sm:grid-cols-4 max-w-3xl';
    if (count <= 8) return 'grid-cols-3 sm:grid-cols-4 max-w-4xl';
    if (count <= 10) return 'grid-cols-3 sm:grid-cols-5 max-w-5xl';
    if (count <= 14) return 'grid-cols-4 sm:grid-cols-7 max-w-6xl';
    return 'grid-cols-4 sm:grid-cols-7 max-w-6xl';
  };

  return (
    <div className="min-h-screen w-full diary-bg flex flex-col items-center p-4 sm:p-8 relative overflow-x-hidden overflow-y-auto text-[#253585]">
      {/* Background Vector Icons (Generated) */}
      {bgElements.map((el) => (
        images[el.icon] && (
          <motion.img 
            key={el.id}
            src={images[el.icon]} 
            animate={{ y: [0, -10, 0], rotate: [el.rotate, el.rotate + 5, el.rotate] }} 
            transition={{ repeat: Infinity, duration: 4 + el.delay, ease: "easeInOut" }} 
            className="absolute opacity-20 pointer-events-none mix-blend-multiply grayscale" 
            style={{ top: el.top, left: el.left, width: el.width, height: el.width }}
            alt="" 
          />
        )
      ))}

      <AnimatePresence mode="wait">
        {screen === 'apikey' ? (
          <motion.div 
            key="apikey"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="bg-white p-10 rounded-2xl shadow-[8px_8px_0px_#151d4d] border-4 border-[#253585] max-w-md w-full text-center relative z-10 my-auto"
          >
            <div className="mb-8">
              <div className="bg-white border-4 border-[#253585] w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-[4px_4px_0px_#151d4d]">
                <Settings className="text-[#253585] w-10 h-10" />
              </div>
              <h1 className="text-4xl font-bold text-[#253585] mb-2 tracking-tighter">API 키 설정 필요</h1>
              <p className="text-[#3d4fad] font-medium text-lg">고품질 3D 에셋 생성을 위해<br/>결제가 등록된 Google Cloud 프로젝트의<br/>API 키가 필요합니다.</p>
            </div>

            {apiError && (
              <div className="mb-6 p-4 bg-white text-[#253585] rounded-xl text-base font-bold border-4 border-[#253585] shadow-[4px_4px_0px_#151d4d]">
                {apiError}
              </div>
            )}

            <button 
              onClick={handleSelectApiKey}
              className="w-full bg-white hover:bg-blue-50 text-[#253585] text-2xl font-bold py-5 rounded-xl shadow-[6px_6px_0px_#151d4d] active:shadow-none active:translate-y-[6px] active:translate-x-[6px] transition-all flex items-center justify-center gap-3 border-4 border-[#253585]"
            >
              API 키 선택하기
            </button>
            <p className="mt-4 text-sm text-blue-900/60">
              자세한 내용은 <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="underline text-[#253585] font-bold">결제 문서</a>를 참조하세요.
            </p>
          </motion.div>
        ) : screen === 'loading' ? (
          <motion.div 
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center bg-white p-10 rounded-2xl shadow-[8px_8px_0px_#151d4d] border-4 border-[#253585] z-50 my-auto"
          >
            <Loader2 className="w-16 h-16 text-[#253585] animate-spin mb-4" />
            <h2 className="text-3xl font-bold text-[#253585] mb-2">스케치 그리는 중...</h2>
            <p className="text-[#3d4fad] font-medium text-lg">나노바나나2가 귀여운 그림을 그리고 있습니다.</p>
            <p className="text-base text-blue-900/60 mt-2 font-bold">({loadingProgress.loaded} / {loadingProgress.total} 완료)</p>
          </motion.div>
        ) : screen === 'setup' ? (
          <motion.div 
            key="setup"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="bg-white p-10 rounded-2xl shadow-[8px_8px_0px_#151d4d] border-4 border-[#253585] max-w-md w-full text-center relative z-10 my-auto"
          >
            <div className="mb-8">
              <div className="bg-white border-4 border-[#253585] w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4 shadow-[4px_4px_0px_#151d4d]">
                <img src={LOGO_IMAGE} className="w-14 h-14 object-contain" alt="logo" referrerPolicy="no-referrer" />
              </div>
              <h1 className="text-5xl font-bold text-[#253585] mb-2 tracking-tighter">럭키 카드 뒤집기</h1>
              <p className="text-[#3d4fad] font-medium text-xl">유브레인 사내 이벤트</p>
            </div>

            <div className="space-y-8">
              <div className="text-left bg-white p-6 rounded-xl border-4 border-[#253585] shadow-[4px_4px_0px_#151d4d]">
                <label className="block text-xl font-bold text-[#253585] mb-4 uppercase tracking-widest flex items-center gap-2">
                  <Settings className="w-6 h-6" /> 참가 인원 조정 (2-20명)
                </label>
                <div className="flex items-center justify-between gap-4">
                  <button 
                    onClick={() => setCount(Math.max(2, count - 1))}
                    className="w-14 h-14 rounded-xl bg-white text-[#253585] font-bold text-3xl shadow-[4px_4px_0px_#151d4d] hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-[2px_2px_0px_#151d4d] active:shadow-none active:translate-y-[4px] active:translate-x-[4px] transition-all flex items-center justify-center border-4 border-[#253585]"
                  >
                    -
                  </button>
                  <div className="relative flex-1">
                    <input 
                      type="number" 
                      min="2" 
                      max="20"
                      value={count}
                      onChange={(e) => setCount(Math.min(20, Math.max(2, parseInt(e.target.value) || 2)))}
                      className="w-full bg-white border-4 border-[#253585] rounded-xl p-4 text-4xl text-center font-bold focus:outline-none text-[#253585] shadow-[inset_4px_4px_0px_#e0e7ff]"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[#3d4fad] font-bold text-2xl">
                      명
                    </div>
                  </div>
                  <button 
                    onClick={() => setCount(Math.min(20, count + 1))}
                    className="w-14 h-14 rounded-xl bg-white text-[#253585] font-bold text-3xl shadow-[4px_4px_0px_#151d4d] hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-[2px_2px_0px_#151d4d] active:shadow-none active:translate-y-[4px] active:translate-x-[4px] transition-all flex items-center justify-center border-4 border-[#253585]"
                  >
                    +
                  </button>
                </div>
              </div>

              <button 
                onClick={startGame}
                className="w-full bg-white hover:bg-blue-50 text-[#253585] text-4xl font-bold py-6 rounded-xl shadow-[8px_8px_0px_#151d4d] active:shadow-none active:translate-y-[8px] active:translate-x-[8px] transition-all flex items-center justify-center gap-3 border-4 border-[#253585]"
              >
                <Play className="w-8 h-8 fill-current" /> 게임 시작
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="game"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full flex flex-col items-center max-w-7xl mx-auto z-10 my-auto py-8"
          >
            <div className="mb-12 flex items-center justify-between w-full px-4 relative">
              <button 
                onClick={resetGame}
                className="flex items-center gap-1 bg-white px-4 sm:px-6 py-3 rounded-xl shadow-[4px_4px_0px_#151d4d] hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-[2px_2px_0px_#151d4d] active:shadow-none active:translate-y-[4px] active:translate-x-[4px] transition-all border-4 border-[#253585] text-[#253585] font-bold text-sm sm:text-base z-10"
              >
                <ChevronLeft className="w-5 h-5" /> 뒤로 가기
              </button>
              
              <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3 sm:gap-6 w-max">
                <img src={LOGO_IMAGE} className="h-10 sm:h-16" alt="Ubrain" referrerPolicy="no-referrer" />
                <div className="h-8 sm:h-12 w-[3px] sm:w-[5px] bg-[#253585]"></div>
                <h2 className="text-2xl sm:text-5xl font-bold text-[#253585] tracking-tighter whitespace-nowrap">럭키 드로우</h2>
              </div>

              <button 
                onClick={startGame}
                className="bg-white p-3 sm:p-4 rounded-xl shadow-[4px_4px_0px_#151d4d] hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-[2px_2px_0px_#151d4d] active:shadow-none active:translate-y-[4px] active:translate-x-[4px] transition-all border-4 border-[#253585] z-10"
                title="다시 섞기"
              >
                <RotateCcw className="w-5 h-5 sm:w-6 sm:h-6 text-[#253585]" />
              </button>
            </div>

            <div className={`grid ${getGridCols()} gap-4 sm:gap-6 w-full px-4 mx-auto`}>
              {cards.map((card) => (
                <div key={card.id} className="aspect-[3/4] perspective-1000">
                  <div className="w-full h-full card-slot p-2">
                    <div 
                      onClick={(e) => handleCardClick(card.id, e)}
                      className={`
                        relative w-full h-full preserve-3d transition-transform duration-700 cursor-pointer
                        ${card.isFlipped ? 'rotate-y-180' : ''}
                        ${card.isShaking ? 'animate-shake' : ''}
                      `}
                    >
                      {/* Card Front */}
                      <div className="absolute inset-0 backface-hidden bg-white rounded-xl card-3d flex flex-col items-center justify-center border-4 border-[#253585] shadow-[4px_4px_0px_#151d4d]">
                        <img src={LOGO_IMAGE} className="w-14 h-14 object-contain mb-2" alt="logo" referrerPolicy="no-referrer" />
                        <span className="text-[#253585] font-bold text-sm tracking-widest">UBRAIN</span>
                      </div>

                      {/* Card Back */}
                      <div className="absolute inset-0 backface-hidden rotate-y-180 bg-white rounded-xl card-3d flex flex-col items-center justify-between border-4 border-[#253585] shadow-[4px_4px_0px_#151d4d] overflow-hidden p-2">
                        {card.isWinning ? (
                          <>
                            <div className="flex-1 w-full relative flex items-center justify-center overflow-hidden">
                              <img
                                src={images['win_image_v3'] || LOGO_IMAGE}
                                className="w-full h-full object-contain opacity-90 mix-blend-multiply grayscale"
                                alt="Win"
                              />
                            </div>
                            <div className="w-full relative z-10 flex flex-col items-center bg-white p-1 sm:p-2 rounded-xl border-4 border-[#253585] shadow-[4px_4px_0px_#151d4d] mt-1">
                              <span className="text-[#253585] font-bold text-xl sm:text-2xl tracking-tighter">당첨!</span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="h-1/2 w-full relative flex items-center justify-center overflow-hidden bg-[radial-gradient(#d1d5db_1px,transparent_1px)] bg-[size:14px_14px]">
                              <img
                                src={images['lose_image_v3'] || LOGO_IMAGE}
                                className="w-full h-full object-contain opacity-70 mix-blend-multiply grayscale"
                                alt="Lose"
                              />
                            </div>
                            <div className="h-1/2 w-full relative z-10 flex flex-col items-center justify-center bg-white p-2 rounded-xl border-4 border-[#253585] shadow-[4px_4px_0px_#151d4d] mt-1">
                              <span className="text-[#253585] font-black text-lg sm:text-2xl leading-tight break-keep text-center">옆 사람에게<br/>행운을<br/>양보했습니다</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-12 text-center">
              <p className="text-gray-400 font-bold uppercase tracking-[0.2em] text-sm flex items-center gap-3 justify-center">
                <Volume2 className="w-4 h-4" /> 카드를 클릭하여 행운을 확인하세요
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Winner Popup Overlay */}
      <AnimatePresence>
        {showWinnerPopup && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#253585]/90 backdrop-blur-md z-50 flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.5, y: 100, rotate: -5 }}
              animate={{ scale: 1, y: 0, rotate: 0 }}
              className="bg-white rounded-2xl p-2 shadow-[12px_12px_0px_#151d4d] border-4 border-[#253585] max-w-3xl w-full relative overflow-hidden"
            >
              <div className="border-4 border-[#253585] rounded-xl p-8 flex flex-col items-center text-center">
                <motion.div 
                  animate={{ rotate: [0, 5, -5, 0] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="mb-6 relative"
                >
                  <Trophy className="w-24 h-24 text-[#253585]" />
                  <Sparkles className="absolute -top-2 -right-2 w-8 h-8 text-[#253585] animate-pulse" />
                </motion.div>

                <h2 className="text-7xl font-bold text-[#253585] mb-4 tracking-tighter">축하합니다!</h2>
                <p className="text-3xl font-bold text-[#3d4fad] mb-10">유브레인 럭키 이벤트 당첨을 축하드립니다</p>

                <div className="w-full bg-white rounded-xl p-6 border-4 border-[#253585] shadow-[8px_8px_0px_#151d4d] mb-10 relative group mt-8">
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#ffcc00] text-[#253585] px-10 py-4 rounded-xl font-black text-4xl shadow-[6px_6px_0px_#151d4d] border-4 border-[#253585] whitespace-nowrap z-20 transform -rotate-2">
                    외식상품권 20만원
                  </div>
                  <img 
                    src={VOUCHER_IMAGE}
                    className="w-full h-auto max-h-[400px] object-contain rounded-lg shadow-md transform group-hover:scale-105 transition-transform duration-500 mt-4" 
                    alt="Voucher" 
                    referrerPolicy="no-referrer"
                  />
                </div>

                <div className="flex gap-4 w-full">
                  <button 
                    onClick={resetGame}
                    className="flex-1 bg-white hover:bg-blue-50 text-[#253585] font-bold text-2xl py-6 rounded-xl transition-all border-4 border-[#253585] shadow-[4px_4px_0px_#151d4d] active:shadow-none active:translate-y-[4px] active:translate-x-[4px]"
                  >
                    닫기
                  </button>
                  <button 
                    onClick={resetGame}
                    className="flex-1 bg-[#253585] hover:bg-[#1a2666] text-white font-bold text-2xl py-6 rounded-xl transition-all border-4 border-[#253585] shadow-[4px_4px_0px_#151d4d] active:shadow-none active:translate-y-[4px] active:translate-x-[4px]"
                  >
                    다시 하기
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
