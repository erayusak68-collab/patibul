/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Component, useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'motion/react';
import { 
  Heart, 
  X, 
  Search, 
  Plus, 
  User, 
  Home as HomeIcon, 
  ChevronLeft, 
  ChevronRight, 
  Camera, 
  MapPin, 
  Info, 
  LogOut, 
  Star,
  Zap,
  Check,
  CheckCircle2,
  Filter,
  PawPrint,
  MessageCircle,
  Send,
  Share2,
  Image as ImageIcon,
  Mic,
  RefreshCw,
  Bolt,
  Trash2,
  Cat,
  Dog,
  AlertCircle,
  Bell
} from 'lucide-react';
import { AppScreen, Pet, User as UserType, PetType, Message, Conversation } from './types';
import { TURKEY_CITIES, CAT_BREEDS, DOG_BREEDS } from './constants';
import { auth, db } from './firebase';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  signInAnonymously
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  addDoc,
  deleteDoc,
  limit,
  increment,
  getDocFromServer
} from 'firebase/firestore';

// --- Helpers ---

class ErrorBoundary extends (Component as any) {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Bir şeyler yanlış gitti.";
      try {
        if (this.state.error && this.state.error.message) {
          const parsed = JSON.parse(this.state.error.message);
          if (parsed.error && parsed.error.includes('Missing or insufficient permissions')) {
            errorMessage = "Yetki hatası: Bu işlemi yapmak için izniniz yok.";
          }
        }
      } catch (e) {
        // Not a JSON error
      }

      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-slate-50 text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
          <h1 className="text-2xl font-bold mb-2">Hata Oluştu</h1>
          <p className="text-slate-600 mb-6 max-w-xs">{errorMessage}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-brand-purple text-white rounded-2xl font-bold shadow-lg shadow-brand-purple/20 active:scale-95 transition-all"
          >
            Sayfayı Yenile
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const compressImage = (base64Str: string, maxWidth = 800, maxHeight = 800, quality = 0.7): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(base64Str);
  });
};

// --- Components ---

const RainingIcons = () => {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 opacity-5">
      {[...Array(15)].map((_, i) => {
        const Icon = [Cat, PawPrint, Heart, Star, Zap][i % 5];
        return (
          <motion.div
            key={i}
            initial={{ y: -50, x: Math.random() * 400, opacity: 0, rotate: 0 }}
            animate={{ 
              y: 800, 
              opacity: [0, 1, 1, 0],
              rotate: 360 
            }}
            transition={{ 
              duration: 10 + Math.random() * 10, 
              repeat: Infinity, 
              delay: Math.random() * 5,
              ease: "linear"
            }}
            className="absolute"
          >
            <Icon size={24} strokeWidth={1.5} className="text-brand-purple" />
          </motion.div>
        );
      })}
    </div>
  );
};

const Toast = ({ message, type = 'info', onClose }: { message: string, type?: 'info' | 'error' | 'success', onClose: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const icons = {
    info: <Bell className="w-5 h-5 text-brand-purple" />,
    error: <AlertCircle className="w-5 h-5 text-red-500" />,
    success: <CheckCircle2 className="w-5 h-5 text-green-500" />
  };

  const bgColors = {
    info: 'bg-brand-purple/10 border-brand-purple/20',
    error: 'bg-red-50 border-red-100',
    success: 'bg-green-50 border-green-100'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, x: '-50%' }}
      animate={{ opacity: 1, y: 0, x: '-50%' }}
      exit={{ opacity: 0, y: 50, x: '-50%' }}
      className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-6 py-4 rounded-2xl border shadow-xl ${bgColors[type]} min-w-[300px]`}
    >
      {icons[type]}
      <p className="text-sm font-medium text-slate-700">{message}</p>
      <button onClick={onClose} className="ml-auto text-slate-400 hover:text-slate-600">
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
};

const PetBackground = () => {
  const icons = useMemo(() => {
    const petIcons = [Cat, Dog, PawPrint];
    const colors = [
      'text-brand-purple/20', 
      'text-brand-blue/20', 
      'text-brand-pink/20', 
      'text-orange-300/20', 
      'text-amber-300/20', 
      'text-yellow-300/20'
    ];
    
    return [...Array(20)].map((_, i) => ({
      id: i,
      Icon: petIcons[Math.floor(Math.random() * petIcons.length)],
      color: colors[Math.floor(Math.random() * colors.length)],
      top: `${Math.random() * 100}%`,
      left: `${Math.random() * 100}%`,
      rotate: Math.random() * 360,
      scale: 0.5 + Math.random() * 1,
      opacity: 0.15 + Math.random() * 0.2
    }));
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
      {icons.map((item) => (
        <div
          key={item.id}
          className={`absolute ${item.color}`}
          style={{
            top: item.top,
            left: item.left,
            transform: `rotate(${item.rotate}deg) scale(${item.scale})`,
            opacity: item.opacity
          }}
        >
          <item.Icon className="w-12 h-12" />
        </div>
      ))}
    </div>
  );
};

const Button = ({ children, onClick, variant = 'primary', className = '', disabled = false, loading = false }: any) => {
  const variants = {
    primary: 'bg-brand-purple text-white shadow-lg shadow-brand-purple/30',
    secondary: 'bg-brand-purple/10 text-brand-purple shadow-lg shadow-brand-purple/10',
    outline: 'border-2 border-brand-purple text-brand-purple bg-transparent',
    ghost: 'bg-transparent text-brand-text'
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`px-6 py-3 rounded-2xl font-medium transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 ${variants[variant as keyof typeof variants]} ${className}`}
    >
      {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
};

const Input = ({ label, type = 'text', value, onChange, error, placeholder, options }: any) => {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && <label className="text-sm font-medium text-slate-500 ml-1">{label}</label>}
      {options ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full px-4 py-3 rounded-2xl bg-white border transition-all outline-none focus:border-brand-purple ${error ? 'border-red-400' : 'border-brand-purple/40'}`}
        >
          <option value="">Seçiniz</option>
          {options.map((opt: any) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full px-4 py-3 rounded-2xl bg-white border transition-all outline-none focus:border-brand-purple ${error ? 'border-red-400' : 'border-brand-purple/40'}`}
        />
      )}
      {error && <span className="text-xs text-red-500 ml-1">{error}</span>}
    </div>
  );
};

const DefaultAvatar = ({ name, size = "w-full h-full", className = "" }: any) => {
  const colors = [
    'bg-brand-purple/10 text-brand-purple',
    'bg-brand-purple/20 text-brand-purple',
    'bg-brand-pink/10 text-brand-pink'
  ];
  
  const colorIndex = (name || 'User').split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0) % colors.length;
  const colorClass = colors[colorIndex];

  return (
    <div className={`${size} rounded-full flex items-center justify-center ${colorClass} ${className}`}>
      <Cat className="w-1/2 h-1/2" strokeWidth={2.5} />
    </div>
  );
};

const CameraCapture = ({ onCapture, onClose }: any) => {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isFlashOn, setIsFlashOn] = useState(false);
  const [hasFlash, setHasFlash] = useState(false);

  useEffect(() => {
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [facingMode]);

  const startCamera = async () => {
    // Stop existing stream if any
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: facingMode }, 
        audio: false 
      });
      setStream(mediaStream);
      
      const track = mediaStream.getVideoTracks()[0];
      const capabilities = track.getCapabilities() as any;
      setHasFlash(!!capabilities.torch);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error("Camera error:", err);
      setError("Kameraya erişilemedi. Lütfen izinleri kontrol edin.");
    }
  };

  const toggleFlash = async () => {
    if (stream && hasFlash) {
      const track = stream.getVideoTracks()[0];
      try {
        await track.applyConstraints({
          advanced: [{ torch: !isFlashOn }]
        } as any);
        setIsFlashOn(!isFlashOn);
      } catch (err) {
        console.error("Flash error:", err);
      }
    }
  };

  const flipCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
    setIsFlashOn(false);
  };

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        onCapture(dataUrl);
        onClose();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center">
      <div className="absolute top-6 inset-x-6 z-10 flex justify-between items-center">
        <button onClick={onClose} className="p-3 bg-white/20 backdrop-blur-md rounded-full text-white">
          <X className="w-6 h-6" />
        </button>
        
        <div className="flex gap-4">
          {hasFlash && (
            <button 
              onClick={toggleFlash} 
              className={`p-3 backdrop-blur-md rounded-full transition-all ${isFlashOn ? 'bg-yellow-400 text-black' : 'bg-white/20 text-white'}`}
            >
              <Bolt className={`w-6 h-6 ${isFlashOn ? 'fill-current' : ''}`} />
            </button>
          )}
          <button onClick={flipCamera} className="p-3 bg-white/20 backdrop-blur-md rounded-full text-white active:rotate-180 transition-all duration-500">
            <RefreshCw className="w-6 h-6" />
          </button>
        </div>
      </div>
      
      {error ? (
        <div className="text-white text-center p-8">
          <p className="mb-4">{error}</p>
          <Button onClick={onClose}>Geri Dön</Button>
        </div>
      ) : (
        <>
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            className="w-full h-full object-cover"
          />
          <canvas ref={canvasRef} className="hidden" />
          
          <div className="absolute bottom-12 inset-x-0 flex flex-col items-center gap-6">
            <button 
              onClick={takePhoto}
              className="w-20 h-20 bg-white rounded-full border-8 border-white/30 flex items-center justify-center active:scale-90 transition-all"
            >
              <div className="w-14 h-14 bg-brand-purple rounded-full" />
            </button>
            <p className="text-white text-sm font-medium bg-black/40 px-4 py-2 rounded-full backdrop-blur-md">
              Fotoğraf çekmek için butona basın
            </p>
          </div>
        </>
      )}
    </div>
  );
};

const PhotoActionModal = ({ isOpen, onClose, onSelectGallery, onSelectCamera, onDelete, hasPhoto }: any) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[150] flex items-end justify-center p-6">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            className="bg-white w-full max-w-sm rounded-[32px] p-6 relative z-10 flex flex-col gap-3"
          >
            <div className="w-12 h-1.5 bg-slate-100 rounded-full mx-auto mb-4" />
            <h3 className="text-lg font-bold text-center mb-2">Profil Fotoğrafı</h3>
            
            <button 
              onClick={() => { onSelectGallery(); onClose(); }}
              className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-all active:scale-95"
            >
              <div className="w-12 h-12 bg-brand-purple/10 text-brand-purple rounded-xl flex items-center justify-center">
                <ImageIcon className="w-6 h-6" />
              </div>
              <div className="text-left">
                <p className="font-bold text-sm">Galeriden Seç</p>
                <p className="text-[10px] text-slate-400">Cihazınızdaki fotoğrafları kullanın</p>
              </div>
            </button>

            <button 
              onClick={() => { onSelectCamera(); onClose(); }}
              className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-all active:scale-95"
            >
              <div className="w-12 h-12 bg-brand-purple/20 text-brand-purple rounded-xl flex items-center justify-center">
                <Camera className="w-6 h-6" />
              </div>
              <div className="text-left">
                <p className="font-bold text-sm">Fotoğraf Çek</p>
                <p className="text-[10px] text-slate-400">Kameranızı kullanarak yeni bir kare yakalayın</p>
              </div>
            </button>

            {hasPhoto && (
              <button 
                onClick={() => { onDelete(); onClose(); }}
                className="flex items-center gap-4 p-4 bg-red-50 rounded-2xl hover:bg-red-100 transition-all active:scale-95 text-red-500"
              >
                <div className="w-12 h-12 bg-red-100 text-red-500 rounded-xl flex items-center justify-center">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-sm">Fotoğrafı Sil</p>
                  <p className="text-[10px] text-red-400">Mevcut profil fotoğrafınızı kaldırın</p>
                </div>
              </button>
            )}

            <Button variant="ghost" onClick={onClose} className="mt-2">İptal</Button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

// --- Screens ---

const LoadingScreen = () => (
  <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-gradient-to-br from-brand-purple/5 via-white to-brand-pink/5">
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
      className="w-16 h-16 border-4 border-brand-purple border-t-transparent rounded-full mb-4"
    />
    <p className="text-brand-text font-medium animate-pulse">Yükleniyor...</p>
  </div>
);

const LoginScreen = ({ onNavigate, onLogin, onGoogleLogin }: any) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.includes('@')) {
      setError('Geçerli bir email adresi giriniz');
      return;
    }
    if (!password) {
      setError('Şifre girmelisiniz');
      return;
    }
    setLoading(true);
    await onLogin(email, password, (msg: string) => {
      setError(msg);
      setLoading(false);
    });
  };

  const handleGoogle = async () => {
    setLoading(true);
    try {
      await onGoogleLogin();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-gradient-to-br from-brand-purple/5 via-white to-brand-pink/5 relative">
      <RainingIcons />
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm glass-card p-8 rounded-3xl soft-shadow z-10"
      >
        <div className="flex flex-col items-center gap-2 mb-8">
          <div className="w-32 h-32 flex items-center justify-center overflow-hidden">
            <img 
              src="https://i.hizliresim.com/p7sryaz.png" 
              alt="Logo" 
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <h1 className="text-3xl font-bold text-brand-text">Hoş Geldin</h1>
          <p className="text-slate-400 text-sm">Patibul ile yeni dostunu bul!</p>
        </div>

        <div className="flex flex-col gap-4">
          <Input 
            label="Email" 
            placeholder="ornek@email.com" 
            value={email} 
            onChange={setEmail} 
            error={error.includes('email') ? error : ''}
          />
          <Input 
            label="Şifre" 
            type="password" 
            placeholder="••••••" 
            value={password} 
            onChange={setPassword} 
          />

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-xs font-medium animate-in fade-in slide-in-from-top-2">
              {error}
              {error.includes('etkinleştirilmemiş') && (
                <div className="mt-2 pt-2 border-t border-red-100 text-[10px] opacity-80">
                  İpucu: Firebase Console {'>'} Authentication {'>'} Sign-in method kısmından Email/Password'u etkinleştirin.
                </div>
              )}
            </div>
          )}
          
          <Button onClick={handleLogin} loading={loading} className="mt-4">Giriş Yap</Button>
          <Button 
            variant="secondary" 
            onClick={() => onNavigate('register')} 
            className="w-full"
          >
            <PawPrint className="w-4 h-4" />
            Hesap Oluştur
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

const RegisterScreen = ({ onNavigate, onRegister, onGoogleLogin, referralCode }: any) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    city: '',
    district: '',
    gender: '',
    inviteCode: referralCode || '',
    petType: '' as PetType | '',
    breed: ''
  });
  const [errors, setErrors] = useState<any>({});
  const [generalError, setGeneralError] = useState('');
  const [loading, setLoading] = useState(false);

  const cities = TURKEY_CITIES.map(c => c.name);
  const districts = TURKEY_CITIES.find(c => c.name === formData.city)?.districts || [];
  const breeds = formData.petType === 'Kedi' ? CAT_BREEDS : DOG_BREEDS;

  const handleRegister = async () => {
    const newErrors: any = {};
    if (!formData.fullName.trim()) newErrors.fullName = 'Ad Soyad gereklidir';
    
    if (!formData.email.includes('@')) newErrors.email = 'Geçerli bir email adresi giriniz';
    if (formData.password.length < 6) newErrors.password = 'Şifre en az 6 karakter olmalıdır';
    if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = 'Şifreler eşleşmiyor';

    if (!formData.city) newErrors.city = 'Şehir seçiniz';
    if (!formData.district) newErrors.district = 'İlçe seçiniz';
    if (!formData.gender) newErrors.gender = 'Cinsiyet seçiniz';
    if (!formData.petType) newErrors.petType = 'Tercih edilen hayvan türünü seçiniz';
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      if (newErrors.fullName || newErrors.email || newErrors.password || newErrors.confirmPassword) {
        setStep(1);
      }
      return;
    }
    setGeneralError('');
    setLoading(true);
    await onRegister({ ...formData, isAnonymous: false }, (msg: string) => {
      setGeneralError(msg);
      setLoading(false);
    });
  };

  const handleGoogle = async () => {
    setLoading(true);
    try {
      await onGoogleLogin();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-gradient-to-br from-brand-purple/5 via-white to-brand-pink/5 relative">
      <RainingIcons />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md glass-card p-8 rounded-3xl soft-shadow z-10 overflow-y-auto max-h-[90vh]"
      >
        <div className="flex flex-col items-center gap-2 mb-6">
          <div className="w-28 h-28 flex items-center justify-center overflow-hidden">
            <img 
              src="https://i.hizliresim.com/p7sryaz.png" 
              alt="Logo" 
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <h1 className="text-2xl font-bold text-center">Hesap Oluştur</h1>
        </div>

        <div className="flex flex-col gap-4">
          {generalError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-xs font-medium animate-in fade-in slide-in-from-top-2">
              {generalError}
            </div>
          )}
          {step === 1 ? (
            <>
              <Input label="Ad Soyad" value={formData.fullName} onChange={(v: any) => setFormData({...formData, fullName: v})} error={errors.fullName} />
              <Input label="Email" value={formData.email} onChange={(v: any) => setFormData({...formData, email: v})} error={errors.email} />
              <Input label="Şifre" type="password" value={formData.password} onChange={(v: any) => setFormData({...formData, password: v})} error={errors.password} />
              <Input label="Şifre Tekrar" type="password" value={formData.confirmPassword} onChange={(v: any) => setFormData({...formData, confirmPassword: v})} error={errors.confirmPassword} />
              <Button onClick={() => setStep(2)} className="mt-4">Devam Et</Button>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Şehir" options={cities} value={formData.city} onChange={(v: any) => setFormData({...formData, city: v, district: ''})} error={errors.city} disabled={loading} />
                <Input label="İlçe" options={districts} value={formData.district} onChange={(v: any) => setFormData({...formData, district: v})} error={errors.district} disabled={loading} />
              </div>
              <Input label="Cinsiyet" options={['Kadın', 'Erkek', 'Belirtilmedi']} value={formData.gender} onChange={(v: any) => setFormData({...formData, gender: v})} error={errors.gender} disabled={loading} />
              
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-500 ml-1">Tercih Edilen Evcil Hayvan</label>
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => setFormData({...formData, petType: 'Kedi'})}
                    disabled={loading}
                    className={`p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 ${formData.petType === 'Kedi' ? 'border-brand-purple bg-brand-purple/10' : 'border-brand-purple/40 bg-white'} ${errors.petType ? 'border-red-500' : ''} disabled:opacity-50`}
                  >
                    <span className="text-3xl">🐱</span>
                    <span className="font-medium">Kedi</span>
                  </button>
                  <button 
                    onClick={() => setFormData({...formData, petType: 'Köpek'})}
                    disabled={loading}
                    className={`p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 ${formData.petType === 'Köpek' ? 'border-brand-purple bg-brand-purple/10' : 'border-brand-purple/40 bg-white'} ${errors.petType ? 'border-red-500' : ''} disabled:opacity-50`}
                  >
                    <span className="text-3xl">🐶</span>
                    <span className="font-medium">Köpek</span>
                  </button>
                </div>
                {errors.petType && <p className="text-[10px] text-red-500 ml-1 mt-1">{errors.petType}</p>}
              </div>

              {formData.petType && (
                <Input label="Cins" options={breeds} value={formData.breed} onChange={(v: any) => setFormData({...formData, breed: v})} disabled={loading} />
              )}

              <Input label="Davet Kodu (Opsiyonel)" value={formData.inviteCode} onChange={(v: any) => setFormData({...formData, inviteCode: v})} disabled={loading} />

              <div className="flex gap-2 mt-4">
                <Button variant="secondary" onClick={() => setStep(1)} disabled={loading} className="flex-1">Geri</Button>
                <Button onClick={handleRegister} loading={loading} className="flex-[2]">Kayıt Ol</Button>
              </div>
            </>
          )}
          <Button variant="ghost" onClick={() => onNavigate('login')}>Zaten hesabın var mı? Giriş Yap</Button>
        </div>
      </motion.div>
    </div>
  );
};

const SwipeCard = ({ pet, onSwipe, onDetail, forceSwipe }: any) => {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-25, 25]);
  const opacity = useTransform(x, [-200, -150, 0, 150, 200], [0, 1, 1, 1, 0]);
  const likeOpacity = useTransform(x, [50, 150], [0, 1]);
  const nopeOpacity = useTransform(x, [-150, -50], [1, 0]);

  useEffect(() => {
    if (forceSwipe === 'right') {
      animate(x, 500, { duration: 0.4 });
    } else if (forceSwipe === 'left') {
      animate(x, -500, { duration: 0.4 });
    }
  }, [forceSwipe, x]);

  const handleDragEnd = (_: any, info: any) => {
    if (info.offset.x > 100) {
      onSwipe('right');
    } else if (info.offset.x < -100) {
      onSwipe('left');
    }
  };

  return (
    <motion.div
      style={{ x, rotate, opacity }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={handleDragEnd}
      className="absolute inset-0 cursor-grab active:cursor-grabbing"
    >
      <div className="relative w-full h-full rounded-3xl overflow-hidden shadow-xl bg-white">
        <img 
          src={pet.photos[0]} 
          alt={pet.name} 
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
        
        {/* Overlays */}
        <motion.div style={{ opacity: likeOpacity }} className="absolute top-10 left-10 border-4 border-brand-purple rounded-xl px-4 py-2 rotate-[-20deg] z-20">
          <span className="text-brand-purple text-4xl font-black uppercase">EVET!</span>
        </motion.div>
        <motion.div style={{ opacity: nopeOpacity }} className="absolute top-10 right-10 border-4 border-red-500 rounded-xl px-4 py-2 rotate-[20deg] z-20">
          <span className="text-red-500 text-4xl font-black uppercase">HAYIR</span>
        </motion.div>

        <div className="absolute bottom-0 inset-x-0 p-6 bg-gradient-to-t from-black/80 via-black/40 to-transparent text-white">
          <div className="flex justify-between items-end">
            <div>
              <h2 className="text-3xl font-bold flex items-center gap-2">
                {pet.name}, {pet.age}
                {pet.isBoosted && <Zap className="w-6 h-6 text-brand-pink fill-brand-pink" />}
              </h2>
              <p className="text-white/80 flex items-center gap-1 mt-1">
                <MapPin className="w-4 h-4" /> {pet.city}, {pet.district}
              </p>
              <div className="flex gap-2 mt-3">
                <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-medium">
                  {pet.breed}
                </span>
                <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-medium">
                  {pet.type}
                </span>
              </div>
            </div>
            <button 
              onClick={() => onDetail(pet)}
              className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center hover:bg-white/30 transition-all"
            >
              <Info className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const HomeScreen = ({ pets, user, onDetail, onChat, onLogin }: any) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState<string | null>(null);
  const [showMatchModal, setShowMatchModal] = useState<Pet | null>(null);

  const handleSwipe = async (dir: string) => {
    if (!user || user.id === 'guest') {
      onLogin?.();
      return;
    }
    setDirection(dir);
    
    // Logic for match
    if (dir === 'right') {
      const currentPet = pets[currentIndex];
      // Simulate a match (50% chance for mock)
      if (Math.random() > 0.5) {
        const currentMatches = user?.matches || [];
        if (!currentMatches.includes(currentPet.id)) {
          const updatedMatches = [...currentMatches, currentPet.id];
          await updateDoc(doc(db, 'users', user.id), { matches: updatedMatches });
          setShowMatchModal(currentPet);
        }
      }
    }

    setTimeout(() => {
      setCurrentIndex(prev => prev + 1);
      setDirection(null);
    }, 400);
  };

  return (
    <div className="h-full flex flex-col p-4 pb-24">
      <div className="flex justify-between items-center mb-6 px-2">
        <h1 className="text-2xl font-bold text-brand-purple flex items-center gap-2">
          Patibul <span className="text-xl">🐾</span>
        </h1>
        <div className="flex gap-2">
          <button className="p-2 bg-white rounded-xl shadow-sm"><Filter className="w-5 h-5 text-slate-400" /></button>
        </div>
      </div>

      <div className="flex-1 relative">
        <AnimatePresence>
          {currentIndex < pets.length ? (
            <div className="absolute inset-0">
              {pets.slice(currentIndex, currentIndex + 2).reverse().map((pet: any, i: number) => (
                <SwipeCard 
                  key={pet.id} 
                  pet={pet} 
                  onSwipe={handleSwipe} 
                  onDetail={onDetail}
                  forceSwipe={pet.id === pets[currentIndex]?.id ? direction : null}
                />
              ))}
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 bg-white rounded-3xl shadow-sm">
              <div className="text-6xl mb-4">😴</div>
              <h2 className="text-xl font-bold mb-2">Başka ilan kalmadı!</h2>
              <p className="text-slate-400">Daha sonra tekrar kontrol et veya filtrelerini genişlet.</p>
              <Button variant="secondary" className="mt-6" onClick={() => setCurrentIndex(0)}>Baştan Başla</Button>
            </div>
          )}
        </AnimatePresence>
      </div>

      {currentIndex < pets.length && (
        <div className="flex justify-center gap-6 mt-8">
          <button 
            onClick={() => handleSwipe('left')}
            className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-lg text-red-400 hover:scale-110 transition-all"
          >
            <X className="w-8 h-8" />
          </button>
          <button 
            onClick={() => handleSwipe('right')}
            className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-lg text-brand-purple hover:scale-110 transition-all"
          >
            <Heart className="w-8 h-8 fill-current" />
          </button>
        </div>
      )}

      {/* Match Modal */}
      <AnimatePresence>
        {showMatchModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-brand-purple/90 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.5, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              className="bg-white rounded-[40px] p-8 w-full max-w-sm text-center shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-brand-pink via-brand-purple to-brand-pink" />
              <div className="text-6xl mb-4">⚡</div>
              <h2 className="text-3xl font-black text-brand-purple mb-2">EŞLEŞME!</h2>
              <p className="text-slate-500 mb-8 font-medium">
                Tebrikler! {showMatchModal.name} ile birbirinizi beğendiniz.
              </p>
              
              <div className="flex justify-center gap-4 mb-8">
                <div className="w-20 h-20 rounded-full border-4 border-brand-purple p-1 overflow-hidden">
                  <img src={user?.profilePhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.fullName}`} className="w-full h-full rounded-full object-cover" referrerPolicy="no-referrer" />
                </div>
                <div className="w-20 h-20 rounded-full border-4 border-brand-pink p-1 overflow-hidden">
                  <img src={showMatchModal.photos[0]} className="w-full h-full rounded-full object-cover" referrerPolicy="no-referrer" />
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <Button onClick={() => setShowMatchModal(null)}>Kaydırmaya Devam Et</Button>
                <Button variant="ghost" onClick={() => {
                  setShowMatchModal(null);
                  onChat(showMatchModal);
                }}>Mesaj Gönder</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const DetailScreen = ({ pet, user, onBack, onChat, onLogin }: any) => {
  const [activePhoto, setActivePhoto] = useState(0);
  const [[page, direction], setPage] = useState([0, 0]);
  const isFavorite = user?.favorites?.includes(pet.id) || false;

  const paginate = (newDirection: number) => {
    const newPage = activePhoto + newDirection;
    if (newPage >= 0 && newPage < pet.photos.length) {
      setPage([newPage, newDirection]);
      setActivePhoto(newPage);
    }
  };

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 1000 : -1000,
      opacity: 0
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 1000 : -1000,
      opacity: 0
    })
  };

  const swipeConfidenceThreshold = 10000;
  const swipePower = (offset: number, velocity: number) => {
    return Math.abs(offset) * velocity;
  };

  const toggleFavorite = async () => {
    if (!user || user.id === 'guest') {
      onLogin?.();
      return;
    }
    const currentFavorites = user.favorites || [];
    let updatedFavorites;
    if (isFavorite) {
      updatedFavorites = currentFavorites.filter((id: string) => id !== pet.id);
    } else {
      updatedFavorites = [...currentFavorites, pet.id];
    }
    try {
      await updateDoc(doc(db, 'users', user.id), { favorites: updatedFavorites });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.id}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-white z-50 overflow-y-auto pb-10">
      <div className="relative h-[60vh] overflow-hidden bg-black">
        <AnimatePresence initial={false} custom={direction}>
          <motion.img
            key={activePhoto}
            src={pet.photos[activePhoto]}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: "spring", stiffness: 300, damping: 30 },
              opacity: { duration: 0.2 }
            }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={1}
            onDragEnd={(e, { offset, velocity }) => {
              const swipe = swipePower(offset.x, velocity.x);

              if (swipe < -swipeConfidenceThreshold) {
                paginate(1);
              } else if (swipe > swipeConfidenceThreshold) {
                paginate(-1);
              }
            }}
            className="absolute w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </AnimatePresence>
        
        {/* Photo Navigation Overlay (Optional, but kept for click support) */}
        <div className="absolute inset-y-0 inset-x-0 flex z-10">
          <div className="flex-1" onClick={() => paginate(-1)} />
          <div className="flex-1" onClick={() => paginate(1)} />
        </div>

        {/* Header with Back Button - Elevated Z-Index */}
        <div className="absolute top-10 inset-x-0 px-4 flex justify-between items-center z-20">
          <button onClick={(e) => { e.stopPropagation(); onBack(); }} className="w-10 h-10 bg-black/20 backdrop-blur-md rounded-full flex items-center justify-center text-white active:scale-90 transition-all">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex gap-1">
            {pet.photos.map((_: any, i: number) => (
              <div key={i} className={`h-1.5 rounded-full transition-all ${i === activePhoto ? 'w-6 bg-white' : 'w-2 bg-white/40'}`} />
            ))}
          </div>
          <div className="w-10" />
        </div>

        <button 
          onClick={toggleFavorite}
          className={`absolute -bottom-8 right-8 w-16 h-16 rounded-full flex items-center justify-center shadow-xl transition-all z-20 ${isFavorite ? 'bg-brand-pink text-white' : 'bg-white text-slate-300'}`}
        >
          <Star className={`w-8 h-8 ${isFavorite ? 'fill-current' : ''}`} />
        </button>
        
        <button 
          onClick={(e) => { 
            e.stopPropagation(); 
            e.preventDefault();
            onChat(pet); 
          }}
          className="absolute -bottom-8 left-8 w-16 h-16 bg-white text-brand-purple rounded-full flex items-center justify-center shadow-xl hover:scale-110 transition-all active:scale-90 z-20"
        >
          <MessageCircle className="w-8 h-8" />
        </button>
      </div>

      <div className="p-8">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              {pet.name}, {pet.age}
              {((pet.isBoosted && !pet.boostedUntil) || (pet.boostedUntil && new Date(pet.boostedUntil) > new Date())) && (
                <Zap className="w-6 h-6 text-brand-pink fill-brand-pink" />
              )}
            </h1>
            <p className="text-slate-400 flex items-center gap-1 mt-1">
              <MapPin className="w-4 h-4" /> {pet.city}, {pet.district}
            </p>
          </div>
          <div className="px-4 py-2 bg-brand-purple/10 text-brand-purple font-bold rounded-2xl">
            {pet.type}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="p-4 bg-slate-50 rounded-2xl">
            <p className="text-xs text-slate-400 uppercase font-bold mb-1">Cins</p>
            <p className="font-medium">{pet.breed}</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-2xl">
            <p className="text-xs text-slate-400 uppercase font-bold mb-1">Aşı Durumu</p>
            <p className="font-medium">{pet.vaccinationStatus}</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-2xl">
            <p className="text-xs text-slate-400 uppercase font-bold mb-1">Kısırlaştırma</p>
            <p className="font-medium">{pet.neuteredStatus}</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-2xl">
            <p className="text-xs text-slate-400 uppercase font-bold mb-1">Tuvalet Eğitimi</p>
            <p className="font-medium">{pet.toiletTraining ? 'Var' : 'Yok'}</p>
          </div>
        </div>

        <div className="mb-8">
          <h3 className="text-lg font-bold mb-3">Hakkında</h3>
          <p className="text-slate-600 leading-relaxed">{pet.description}</p>
        </div>

        <div className="mb-8">
          <h3 className="text-lg font-bold mb-3">Enerji Seviyesi</h3>
          <div className="flex gap-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className={`h-2 flex-1 rounded-full ${i < pet.energyLevel ? 'bg-brand-purple' : 'bg-slate-100'}`} />
            ))}
          </div>
        </div>

        <div className="mb-8 p-4 bg-slate-50 rounded-3xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl overflow-hidden bg-white">
            {pet.ownerPhoto ? (
              <img src={pet.ownerPhoto} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <DefaultAvatar name={pet.ownerName} />
            )}
          </div>
          <div>
            <p className="text-[10px] text-slate-400 uppercase font-bold">İlan Sahibi</p>
            <p className="font-bold text-slate-700">{pet.ownerName || 'Bilinmeyen Kullanıcı'}</p>
          </div>
        </div>

        <Button 
          onClick={() => onChat(pet, 'Sahiplenmek istiyorum')}
          className="w-full py-4 text-lg"
        >
          Sahiplenmek İstiyorum
        </Button>
      </div>
    </div>
  );
};

const AddListingScreen = ({ user, onComplete, onLogin }: any) => {
  if (user.id === 'guest') {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center gap-6">
        <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center">
          <Plus className="w-12 h-12 text-slate-300" />
        </div>
        <div>
          <h2 className="text-2xl font-bold mb-2">İlan Ver 🐾</h2>
          <p className="text-slate-500 text-sm">Yeni bir dost sahiplendirmek için önce bir hesap oluşturmalısın.</p>
        </div>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button 
            onClick={onLogin}
            className="w-full p-4 bg-brand-purple text-white rounded-2xl font-bold shadow-lg shadow-brand-purple/20 active:scale-95 transition-all"
          >
            Giriş Yap / Kayıt Ol
          </button>
        </div>
      </div>
    );
  }

  const [formData, setFormData] = useState({
    name: '',
    type: 'Kedi' as PetType,
    breed: '',
    age: '',
    vaccinationStatus: '',
    neuteredStatus: '',
    description: '',
    city: '',
    district: '',
    energyLevel: 3,
    toiletTraining: false,
    photos: [] as string[],
    isBoosted: false,
    boostDuration: 30
  });

  const [isBoostModalOpen, setIsBoostModalOpen] = useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const handleBoostToggle = () => {
    if (!formData.isBoosted) {
      if (user.patiPuan >= 50) {
        setFormData(prev => ({ ...prev, isBoosted: true, boostDuration: 30 }));
      } else {
        setIsBoostModalOpen(true);
      }
    } else {
      setFormData(prev => ({ ...prev, isBoosted: false }));
    }
  };

  const handlePurchaseBoost = (duration: number) => {
    setFormData(prev => ({ ...prev, isBoosted: true, boostDuration: duration }));
    setIsBoostModalOpen(false);
  };

  const handlePhotoClick = () => {
    setIsPhotoModalOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        const compressed = await compressImage(base64String, 800, 800, 0.7);
        setFormData(prev => ({ ...prev, photos: [...prev.photos, compressed] }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCapture = async (photo: string) => {
    const compressed = await compressImage(photo, 800, 800, 0.7);
    setFormData(prev => ({ ...prev, photos: [...prev.photos, compressed] }));
  };

  const removePhoto = (index: number) => {
    setFormData(prev => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index)
    }));
  };

  const cities = TURKEY_CITIES.map(c => c.name);
  const districts = TURKEY_CITIES.find(c => c.name === formData.city)?.districts || [];
  const breeds = formData.type === 'Kedi' ? CAT_BREEDS : DOG_BREEDS;

  return (
    <div className="h-full flex flex-col p-6 pb-24 overflow-y-auto">
      <PhotoActionModal 
        isOpen={isPhotoModalOpen}
        onClose={() => setIsPhotoModalOpen(false)}
        onSelectGallery={() => fileInputRef.current?.click()}
        onSelectCamera={() => setIsCameraOpen(true)}
      />

      {isCameraOpen && (
        <CameraCapture 
          onCapture={handleCapture}
          onClose={() => setIsCameraOpen(false)}
        />
      )}

      <h1 className="text-2xl font-bold mb-2">İlan Ver</h1>
      <p className="text-xs text-slate-400 mb-6 flex items-center gap-1">
        <Info className="w-3 h-3" /> İlanınız yayınlandıktan sonra 24 saat boyunca yayında kalacaktır.
      </p>

      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-slate-500 ml-1">Fotoğraflar</label>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*" 
            onChange={handleFileChange} 
          />
          <div className="grid grid-cols-3 gap-4">
            {formData.photos.map((photo, index) => (
              <div key={index} className="relative aspect-square group">
                <img src={photo} className="w-full h-full object-cover rounded-2xl" referrerPolicy="no-referrer" />
                <button 
                  onClick={() => removePhoto(index)}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {formData.photos.length < 3 && (
              <div 
                onClick={handlePhotoClick}
                className="aspect-square bg-slate-100 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 gap-1 cursor-pointer hover:bg-slate-200 transition-all"
              >
                <Camera className="w-6 h-6" />
                <span className="text-[10px] font-bold">EKLE</span>
              </div>
            )}
          </div>
        </div>

        <Input label="Hayvan Adı" value={formData.name} onChange={(v: any) => setFormData({...formData, name: v})} />
        
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-slate-500 ml-1">Tür</label>
          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={() => setFormData({...formData, type: 'Kedi'})}
              className={`p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 ${formData.type === 'Kedi' ? 'border-brand-purple bg-brand-purple/10' : 'border-brand-purple/40 bg-white'}`}
            >
              <span className="text-2xl">🐱</span>
              <span className="font-medium">Kedi</span>
            </button>
            <button 
              onClick={() => setFormData({...formData, type: 'Köpek'})}
              className={`p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 ${formData.type === 'Köpek' ? 'border-brand-purple bg-brand-purple/10' : 'border-brand-purple/40 bg-white'}`}
            >
              <span className="text-2xl">🐶</span>
              <span className="font-medium">Köpek</span>
            </button>
          </div>
        </div>

        <Input label="Cins" options={breeds} value={formData.breed} onChange={(v: any) => setFormData({...formData, breed: v})} />
        <Input label="Yaş" placeholder="Örn: 2 Yaş veya 6 Aylık" value={formData.age} onChange={(v: any) => setFormData({...formData, age: v})} />
        
        <div className="grid grid-cols-2 gap-4">
          <Input label="Şehir" options={cities} value={formData.city} onChange={(v: any) => setFormData({...formData, city: v, district: ''})} />
          <Input label="İlçe" options={districts} value={formData.district} onChange={(v: any) => setFormData({...formData, district: v})} />
        </div>

        <Input label="Aşı Durumu" options={['Tam', 'Eksik', 'Bilinmiyor']} value={formData.vaccinationStatus} onChange={(v: any) => setFormData({...formData, vaccinationStatus: v})} />
        <Input label="Kısırlaştırma" options={['Kısırlaştırılmış', 'Kısırlaştırılmamış']} value={formData.neuteredStatus} onChange={(v: any) => setFormData({...formData, neuteredStatus: v})} />
        
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-slate-500 ml-1">Enerji Seviyesi (1-5)</label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map(level => (
              <button 
                key={level}
                onClick={() => setFormData({...formData, energyLevel: level})}
                className={`flex-1 py-2 rounded-xl transition-all font-bold ${formData.energyLevel === level ? 'bg-brand-purple text-white' : 'bg-slate-100 text-slate-400'}`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl">
          <input 
            type="checkbox" 
            id="toilet" 
            className="w-5 h-5 accent-brand-purple" 
            checked={formData.toiletTraining}
            onChange={(e) => setFormData({...formData, toiletTraining: e.target.checked})}
          />
          <label htmlFor="toilet" className="font-medium">Tuvalet Eğitimi Var</label>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-slate-500 ml-1">Açıklama</label>
          <textarea 
            className="w-full px-4 py-3 rounded-2xl bg-white border border-brand-purple/40 outline-none focus:border-brand-purple h-32 resize-none transition-all"
            placeholder="Dostunuz hakkında biraz bilgi verin..."
            value={formData.description}
            onChange={(e) => setFormData({...formData, description: e.target.value})}
          />
        </div>

        <div className="p-6 bg-gradient-to-br from-brand-pink/5 to-brand-purple/5 rounded-[32px] border-2 border-brand-pink/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Zap className="w-24 h-24 text-brand-pink fill-current" />
          </div>
          
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 bg-brand-pink rounded-full flex items-center justify-center shadow-lg shadow-brand-pink/20">
                <Zap className="w-4 h-4 text-white fill-current" />
              </div>
              <h3 className="font-bold text-slate-800">İlanını Öne Çıkar!</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              İlanın 30 dakika boyunca en üstte görünsün, dostun yuvasına daha hızlı kavuşsun!
            </p>
            
            <button 
              onClick={handleBoostToggle}
              className={`w-full py-3 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 ${formData.isBoosted ? 'bg-brand-purple text-white shadow-lg shadow-brand-purple/20' : 'bg-white text-slate-700 border-2 border-slate-100'}`}
            >
              {formData.isBoosted ? (
                <>
                  <Check className="w-5 h-5" />
                  Öne Çıkarma Aktif ({formData.boostDuration} dk)
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 fill-current" />
                  Şimdi Öne Çıkar (50 PatiPuan)
                </>
              )}
            </button>
            {!formData.isBoosted && user.patiPuan < 50 && (
              <p className="text-[10px] text-center text-brand-purple mt-2 font-medium">
                PatiPuanın yetersiz, paket satın alabilirsin.
              </p>
            )}
          </div>
        </div>

        <BoostModal 
          isOpen={isBoostModalOpen}
          onClose={() => setIsBoostModalOpen(false)}
          onPurchase={handlePurchaseBoost}
          petName={formData.name || 'Dostun'}
        />

        <Button onClick={() => onComplete(formData)} className="mt-4">İlanı Yayınla</Button>
      </div>
    </div>
  );
};

const FavoritesScreen = ({ pets, user, onDetail, onLogin }: any) => {
  if (user.id === 'guest') {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center gap-6">
        <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center">
          <Star className="w-12 h-12 text-slate-300" />
        </div>
        <div>
          <h2 className="text-2xl font-bold mb-2">Favorilerim ⭐</h2>
          <p className="text-slate-500 text-sm">Beğendiğin dostları kaydetmek için önce bir hesap oluşturmalısın.</p>
        </div>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button 
            onClick={onLogin}
            className="w-full p-4 bg-brand-purple text-white rounded-2xl font-bold shadow-lg shadow-brand-purple/20 active:scale-95 transition-all"
          >
            Giriş Yap / Kayıt Ol
          </button>
        </div>
      </div>
    );
  }

  const favorites = pets.filter((p: Pet) => user?.favorites?.includes(p.id));

  return (
    <div className="h-full flex flex-col p-6 pb-24">
      <h1 className="text-2xl font-bold mb-6">Favorilerim ⭐</h1>
      
      {favorites.length > 0 ? (
        <div className="grid grid-cols-3 gap-2">
          {favorites.map((pet: Pet) => (
            <motion.div 
              key={pet.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={() => onDetail(pet)}
              className="glass-card rounded-2xl overflow-hidden soft-shadow cursor-pointer"
            >
              <div className="relative aspect-square">
                <img src={pet.photos[0]} alt={pet.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                <div className="absolute top-1 right-1 p-1 bg-white/80 backdrop-blur-md rounded-full text-brand-pink">
                  <Star className="w-3 h-3 fill-current" />
                </div>
              </div>
              <div className="p-2">
                <h3 className="font-bold text-[10px] truncate">{pet.name}, {pet.age}</h3>
                <p className="text-[8px] text-slate-400 truncate">{pet.breed}</p>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
          <div className="text-6xl mb-4">⭐</div>
          <h2 className="text-xl font-bold mb-2">Henüz favorin yok!</h2>
          <p className="text-slate-400">Beğendiğin dostlarını burada görebilirsin.</p>
        </div>
      )}
    </div>
  );
};

const MatchesScreen = ({ pets, user, onDetail, onLogin }: any) => {
  if (user.id === 'guest') {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center gap-6">
        <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center">
          <Zap className="w-12 h-12 text-slate-300" />
        </div>
        <div>
          <h2 className="text-2xl font-bold mb-2">Eşleşmeler ⚡</h2>
          <p className="text-slate-500 text-sm">Sana uygun dostları görmek için önce bir hesap oluşturmalısın.</p>
        </div>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button 
            onClick={onLogin}
            className="w-full p-4 bg-brand-purple text-white rounded-2xl font-bold shadow-lg shadow-brand-purple/20 active:scale-95 transition-all"
          >
            Giriş Yap / Kayıt Ol
          </button>
        </div>
      </div>
    );
  }

  const matches = pets.filter((p: Pet) => user?.matches?.includes(p.id));

  return (
    <div className="h-full flex flex-col p-6 pb-24">
      <h1 className="text-2xl font-bold mb-6">Eşleşmeler ⚡</h1>
      
      {matches.length > 0 ? (
        <div className="grid grid-cols-3 gap-2">
          {matches.map((pet: Pet) => (
            <motion.div 
              key={pet.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={() => onDetail(pet)}
              className="glass-card rounded-2xl overflow-hidden soft-shadow cursor-pointer"
            >
              <div className="relative aspect-square">
                <img src={pet.photos[0]} alt={pet.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                <div className="absolute top-1 right-1 p-1 bg-brand-purple text-white rounded-full">
                  <Zap className="w-3 h-3 fill-current" />
                </div>
              </div>
              <div className="p-2">
                <h3 className="font-bold text-[10px] truncate">{pet.name}, {pet.age}</h3>
                <p className="text-[8px] text-slate-400 truncate">{pet.breed}</p>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
          <div className="text-6xl mb-4">⚡</div>
          <h2 className="text-xl font-bold mb-2">Henüz eşleşme yok!</h2>
          <p className="text-slate-400">Kaydırmaya devam et, belki birileri seni bekliyordur!</p>
        </div>
      )}
    </div>
  );
};

const UserDetailScreen = ({ user, pets, onBack, onChat }: any) => {
  if (!user) return null;
  const userPets = pets.filter((p: any) => p.ownerId === user.id);

  return (
    <div className="h-full flex flex-col p-6 pb-24 overflow-y-auto bg-slate-50">
      <div className="flex items-center mb-8">
        <button onClick={onBack} className="p-2 -ml-2 hover:bg-white rounded-xl transition-all">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-bold ml-2">Kullanıcı Profili</h1>
      </div>

      <div className="flex flex-col items-center gap-4 mb-8">
        <div className="w-32 h-32 rounded-full border-4 border-brand-purple p-1 overflow-hidden bg-white shadow-xl">
          {user.profilePhoto ? (
            <img 
              src={user.profilePhoto} 
              className="w-full h-full rounded-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <DefaultAvatar name={user.fullName} />
          )}
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold">{user.fullName}</h2>
          <p className="text-slate-400 text-sm flex items-center justify-center gap-1">
            <MapPin className="w-4 h-4" /> {user.city}, {user.district}
          </p>
          <div className="mt-2 inline-block px-4 py-1 bg-brand-pink/10 text-brand-pink text-xs font-bold rounded-full">
            {user.petType === 'Kedi' 
              ? (user.gender === 'Kadın' ? 'Kedi Annesi' : 'Kedi Babası') 
              : (user.gender === 'Kadın' ? 'Köpek Annesi' : 'Köpek Babası')}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="glass-card p-4 rounded-3xl text-center">
          <p className="text-xs text-slate-400 font-bold uppercase mb-1">PatiPuan</p>
          <p className="text-2xl font-black text-brand-purple flex items-center justify-center gap-1">
            {user.patiPuan} <PawPrint className="w-5 h-5" strokeWidth={3} />
          </p>
        </div>
        <div className="glass-card p-4 rounded-3xl text-center flex flex-col justify-center">
          <p className="text-xs text-slate-400 font-bold uppercase mb-1">İlan Sayısı</p>
          <p className="text-2xl font-black text-brand-purple">{userPets.length}</p>
        </div>
      </div>

      <div className="mb-8">
        <h3 className="text-lg font-bold mb-4">İlanları</h3>
        <div className="flex flex-col gap-4">
          {userPets.length > 0 ? (
            userPets.map((pet: any) => (
              <div 
                key={pet.id} 
                onClick={() => onChat(pet)}
                className="glass-card p-4 rounded-3xl flex gap-4 items-center cursor-pointer hover:scale-[1.02] transition-all"
              >
                <img src={pet.photos[0]} className="w-16 h-16 rounded-2xl object-cover" referrerPolicy="no-referrer" />
                <div className="flex-1">
                  <h4 className="font-bold">{pet.name}</h4>
                  <p className="text-xs text-slate-400">{pet.breed}</p>
                </div>
                <div className="w-10 h-10 bg-brand-purple/10 text-brand-purple rounded-full flex items-center justify-center">
                  <MessageCircle className="w-5 h-5" />
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-slate-400 text-sm py-4">Henüz ilanı bulunmuyor.</p>
          )}
        </div>
      </div>
    </div>
  );
};

const BoostModal = ({ isOpen, onClose, onPurchase, petName }: any) => {
  const options = [
    { duration: 15, price: '24.99', advantage: null },
    { duration: 30, price: '49.99', advantage: null, label: 'Popüler' },
    { duration: 60, price: '89.99', advantage: '10', label: 'En Avantajlı' }
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white w-full max-w-sm rounded-[32px] p-8 relative z-10 text-center"
          >
            <div className="w-20 h-20 bg-brand-pink rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-brand-pink/30">
              <Zap className="w-10 h-10 text-white fill-current" />
            </div>
            
            <h2 className="text-2xl font-black mb-2">{petName} Öne Çıkar!</h2>
            <p className="text-slate-500 text-sm mb-8">
              PatiPuanın yetersiz. Hemen bir paket seçerek ilanını zirveye taşı!
            </p>

            <div className="flex flex-col gap-3 mb-8">
              {options.map((opt) => (
                <button
                  key={opt.duration}
                  onClick={() => onPurchase(opt.duration)}
                  className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl hover:bg-brand-purple/10 hover:border-brand-purple border-2 border-transparent transition-all group relative overflow-hidden"
                >
                  <div className="text-left">
                    <p className="font-bold text-slate-700">{opt.duration === 60 ? '1 Saat' : `${opt.duration} Dakika`}</p>
                    <div className="flex gap-2 items-center mt-1">
                      {opt.advantage && (
                        <span className="text-[10px] font-bold text-brand-purple bg-brand-purple/10 px-2 py-0.5 rounded-full">
                          %{opt.advantage} Tasarruf
                        </span>
                      )}
                      {opt.label && (
                        <span className="text-[10px] font-bold text-brand-purple bg-brand-purple/10 px-2 py-0.5 rounded-full">
                          {opt.label}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-brand-purple">{opt.price} TL</p>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-3">
              <Button onClick={onClose} variant="ghost">Daha Sonra</Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

const ProfileScreen = ({ user, pets, onLogout, onUpdateUser, onBoostPet, showToast, onGenerateDemo, onDeleteDemo }: any) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const [isBoostModalOpen, setIsBoostModalOpen] = useState(false);
  const [selectedPetForBoost, setSelectedPetForBoost] = useState<any>(null);

  const isAdmin = user?.email === 'erayusak68@gmail.com';

  const handleBoost = (pet: any) => {
    if (user.patiPuan >= 50) {
      onBoostPet(pet.id, 30);
      showToast('İlanınız 30 dakika boyunca en üstte görünecek! 🚀', 'success');
    } else {
      setSelectedPetForBoost(pet);
      setIsBoostModalOpen(true);
    }
  };

  const handlePurchaseBoost = (duration: number) => {
    if (selectedPetForBoost) {
      onBoostPet(selectedPetForBoost.id, duration, true);
      setIsBoostModalOpen(false);
      showToast(`İlanınız ${duration === 60 ? '1 saat' : duration + ' dakika'} boyunca en üstte görünecek! 🚀`, 'success');
    }
  };

  const handlePhotoClick = () => {
    setIsPhotoModalOpen(true);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        const compressed = await compressImage(base64String, 400, 400, 0.6);
        onUpdateUser({ ...user, profilePhoto: compressed });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCapture = async (photo: string) => {
    const compressed = await compressImage(photo, 400, 400, 0.6);
    onUpdateUser({ ...user, profilePhoto: compressed });
  };

  const handleDeletePhoto = () => {
    onUpdateUser({ ...user, profilePhoto: null });
  };

  const handleShareInvite = () => {
    const appUrl = window.location.origin;
    const shareUrl = `${appUrl}?ref=${user.inviteCode}`;
    const message = `🐾 Patibul'a katıl ve yeni dostunu bul! Benim davet kodum: ${user.inviteCode}\n\nUygulamayı indir: ${shareUrl}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleCopyInvite = () => {
    const appUrl = window.location.origin;
    const shareUrl = `${appUrl}?ref=${user.inviteCode}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      showToast('Davet linki kopyalandı! 🐾', 'success');
    }).catch(() => {
      showToast('Kopyalama başarısız oldu.', 'error');
    });
  };

  if (user.id === 'guest') {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center gap-6">
        <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center">
          <User className="w-12 h-12 text-slate-300" />
        </div>
        <div>
          <h2 className="text-2xl font-bold mb-2">Profilini Oluştur 🐾</h2>
          <p className="text-slate-500 text-sm">İlan vermek, favorilere eklemek ve mesajlaşmak için bir hesap oluşturmalısın.</p>
        </div>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button 
            onClick={() => onLogout()}
            className="w-full p-4 bg-brand-purple text-white rounded-2xl font-bold shadow-lg shadow-brand-purple/20 active:scale-95 transition-all"
          >
            Giriş Yap / Kayıt Ol
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-6 pb-24 overflow-y-auto">
      <PhotoActionModal 
        isOpen={isPhotoModalOpen}
        onClose={() => setIsPhotoModalOpen(false)}
        onSelectGallery={() => fileInputRef.current?.click()}
        onSelectCamera={() => setIsCameraOpen(true)}
        onDelete={handleDeletePhoto}
        hasPhoto={!!user.profilePhoto}
      />

      {isCameraOpen && (
        <CameraCapture 
          onCapture={handleCapture}
          onClose={() => setIsCameraOpen(false)}
        />
      )}

      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Profilim</h1>
        <button onClick={onLogout} className="p-2 text-red-400"><LogOut className="w-6 h-6" /></button>
      </div>

      <div className="flex flex-col items-center gap-4 mb-8">
        <div className="relative">
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*" 
            onChange={handleFileChange} 
          />
          <div className="w-32 h-32 rounded-full border-4 border-brand-purple p-1 overflow-hidden">
            {user.profilePhoto ? (
              <img 
                src={user.profilePhoto} 
                className="w-full h-full rounded-full object-cover bg-brand-purple/10"
                referrerPolicy="no-referrer"
              />
            ) : (
              <DefaultAvatar name={user.fullName} />
            )}
          </div>
          <button 
            onClick={handlePhotoClick}
            className="absolute bottom-0 right-0 w-10 h-10 bg-brand-purple text-white rounded-full flex items-center justify-center border-4 border-white active:scale-90 transition-all"
          >
            <Camera className="w-5 h-5" />
          </button>
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold">{user.fullName}</h2>
          <p className="text-slate-400 text-sm flex items-center justify-center gap-1">
            <MapPin className="w-4 h-4" /> {user.city}, {user.district}
          </p>
          <div className="mt-2 inline-block px-4 py-1 bg-brand-pink/10 text-brand-pink text-xs font-bold rounded-full">
            {user.petType === 'Kedi' 
              ? (user.gender === 'Kadın' ? 'Kedi Annesi' : 'Kedi Babası') 
              : (user.gender === 'Kadın' ? 'Köpek Annesi' : 'Köpek Babası')}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="glass-card p-4 rounded-3xl text-center">
          <p className="text-xs text-slate-400 font-bold uppercase mb-1">PatiPuan</p>
          <p className="text-2xl font-black text-brand-purple flex items-center justify-center gap-1">
            {user.patiPuan} <span className="text-lg">🐾</span>
          </p>
        </div>
        <button 
          onClick={handleShareInvite}
          className="glass-card p-4 rounded-3xl text-center active:scale-95 transition-all border-brand-purple/20"
        >
          <p className="text-xs text-slate-400 font-bold uppercase mb-1">Davet Kodun</p>
          <p className="text-lg font-black text-brand-purple tracking-widest">{user.inviteCode}</p>
          <p className="text-[8px] text-brand-purple/60 mt-1 font-bold">WHATSAPP'TA PAYLAŞ 🐾</p>
        </button>
      </div>

      <Button 
        variant="secondary" 
        onClick={handleCopyInvite}
        className="w-full mb-8 flex items-center justify-center gap-2"
      >
        <Share2 className="w-4 h-4" />
        Davet Linkini Kopyala
      </Button>

      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">İlanlarım</h3>
          <Button variant="ghost" className="text-xs p-0">Tümünü Gör</Button>
        </div>
        <div className="flex flex-col gap-4">
          {pets.filter((p: any) => p.ownerId === user.id).length > 0 ? (
            pets.filter((p: any) => p.ownerId === user.id).map((pet: any) => (
              <div key={pet.id} className="glass-card p-4 rounded-3xl flex gap-4 items-center">
                <img src={pet.photos[0]} className="w-16 h-16 rounded-2xl object-cover" referrerPolicy="no-referrer" />
                <div className="flex-1">
                  <h4 className="font-bold">{pet.name}</h4>
                  <p className="text-xs text-slate-400">{pet.breed}</p>
                </div>
                <button 
                  onClick={() => handleBoost(pet)}
                  className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold shadow-lg transition-all ${
                    ((pet.isBoosted && !pet.boostedUntil) || (pet.boostedUntil && new Date(pet.boostedUntil) > new Date())) 
                      ? 'bg-brand-purple text-white shadow-brand-purple/30' 
                      : 'bg-brand-pink text-white shadow-brand-pink/30'
                  }`}
                >
                  <Zap className={`w-3 h-3 fill-current ${((pet.isBoosted && !pet.boostedUntil) || (pet.boostedUntil && new Date(pet.boostedUntil) > new Date())) ? 'animate-pulse' : ''}`} /> 
                  {((pet.isBoosted && !pet.boostedUntil) || (pet.boostedUntil && new Date(pet.boostedUntil) > new Date())) ? 'ÖNE ÇIKARILDI' : 'ÖNE ÇIKAR'}
                </button>
              </div>
            ))
          ) : (
            <p className="text-center text-slate-400 text-sm py-4">Henüz ilanınız bulunmuyor.</p>
          )}
        </div>
      </div>

      <div className="bg-brand-purple/10 p-6 rounded-3xl border-2 border-dashed border-brand-purple">
        <h4 className="font-bold text-brand-purple mb-2 flex items-center gap-2">
          <Star className="w-5 h-5 fill-current" /> Arkadaşını Davet Et!
        </h4>
        <p className="text-xs text-slate-500 mb-4">
          Patibul'a davet ettiğin her arkadaşın için 100 PatiPuan kazan, ilanlarını öne çıkar!
        </p>
        <Button variant="secondary" className="w-full py-2 text-sm">Davet Linkini Kopyala</Button>
      </div>

      {isAdmin && (
        <div className="mt-8 p-6 bg-slate-900 rounded-3xl border-2 border-slate-700">
          <h4 className="font-bold text-white mb-2 flex items-center gap-2">
            <Bolt className="w-5 h-5 text-yellow-400 fill-current" /> Admin Paneli
          </h4>
          <p className="text-xs text-slate-400 mb-4">
            Test amaçlı 100 adet demo kullanıcı ve 100 adet ilan oluşturur.
          </p>
          <button 
            onClick={onGenerateDemo}
            className="w-full py-3 bg-yellow-500 text-slate-900 rounded-2xl font-bold text-sm hover:bg-yellow-400 transition-all active:scale-95 mb-3"
          >
            100 Demo Veri Oluştur ⚡
          </button>
          <button 
            onClick={onDeleteDemo}
            className="w-full py-3 bg-red-500 text-white rounded-2xl font-bold text-sm hover:bg-red-400 transition-all active:scale-95"
          >
            Tüm Demo Verileri Sil 🗑️
          </button>
        </div>
      )}

      <BoostModal 
        isOpen={isBoostModalOpen} 
        onClose={() => setIsBoostModalOpen(false)} 
        onPurchase={handlePurchaseBoost}
        petName={selectedPetForBoost?.name}
      />
    </div>
  );
};

const ChatListScreen = ({ user, onNavigate, onSelectConversation }: any) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [usersMap, setUsersMap] = useState<Record<string, UserType>>({});

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'conversations'), 
      where('participants', 'array-contains', user.id),
      orderBy('lastTimestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const conversationsData = snapshot.docs.map(doc => doc.data() as Conversation);
      setConversations(conversationsData);

      // Fetch other participants' info
      const otherUserIds = Array.from(new Set(
        conversationsData.flatMap(c => c.participants.filter(id => id !== user.id))
      ));

      const newUsersMap = { ...usersMap };
      for (const id of otherUserIds) {
        if (!newUsersMap[id]) {
          try {
            const userDoc = await getDoc(doc(db, 'users', id));
            if (userDoc.exists()) {
              newUsersMap[id] = userDoc.data() as UserType;
            }
          } catch (error) {
            console.error('Error fetching user info in ChatList:', error);
          }
        }
      }
      setUsersMap(newUsersMap);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'conversations');
    });

    return () => unsubscribe();
  }, [user?.id]);

  const getOtherParticipant = (participants: string[]) => {
    const otherId = participants.find(id => id !== user.id);
    return otherId ? usersMap[otherId] : null;
  };

  return (
    <div className="h-full flex flex-col p-6 pb-24">
      <h1 className="text-2xl font-bold mb-6">Mesajlar 💬</h1>
      
      <div className="flex-1 overflow-y-auto no-scrollbar space-y-4">
        {conversations.length > 0 ? (
          conversations.map((conv) => {
            const otherId = conv.participants.find(id => id !== user.id) || '';
            const otherName = conv.participantNames?.[otherId] || 'Bilinmeyen Kullanıcı';
            const otherPhoto = conv.participantPhotos?.[otherId];

            return (
              <motion.div
                key={conv.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => onSelectConversation(conv)}
                className="glass-card p-4 rounded-3xl flex items-center gap-4 cursor-pointer hover:scale-[1.02] transition-all"
              >
                <div className="w-14 h-14 rounded-2xl overflow-hidden flex-shrink-0">
                  {otherPhoto ? (
                    <img src={otherPhoto} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <DefaultAvatar name={otherName} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <h3 className="font-bold truncate">{otherName}</h3>
                    <div className="flex items-center gap-2">
                      {conv.unreadCount ? (
                        <span className="w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                          {conv.unreadCount}
                        </span>
                      ) : null}
                      <span className="text-[10px] text-slate-400">
                        {conv.lastTimestamp ? new Date(conv.lastTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                  </div>
                  <p className={`text-xs truncate ${conv.unreadCount ? 'text-brand-purple font-bold' : 'text-slate-500'}`}>
                    {conv.lastMessage || 'Henüz mesaj yok'}
                  </p>
                </div>
              </motion.div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="text-6xl mb-4">✉️</div>
            <h2 className="text-lg font-bold mb-2">Henüz mesajın yok</h2>
            <p className="text-sm text-slate-400">Beğendiğin ilanların sahiplerine mesaj atarak iletişime geçebilirsin.</p>
          </div>
        )}
      </div>
    </div>
  );
};

const ChatDetailScreen = ({ user, conversation, onBack, onUserClick, showToast }: any) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [otherUser, setOtherUser] = useState<UserType | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordedAudio, setRecordedAudio] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const timerRef = React.useRef<any>(null);
  const shouldSendImmediatelyRef = React.useRef(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!conversation || !user) return;

    // Real-time messages listener
    const q = query(
      collection(db, 'conversations', conversation.id, 'messages'),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messagesData = snapshot.docs.map(doc => doc.data() as Message);
      setMessages(messagesData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `conversations/${conversation.id}/messages`);
    });

    // Mark as read when entering chat
    if (conversation.unreadCount && conversation.unreadCount > 0) {
      updateDoc(doc(db, 'conversations', conversation.id), { unreadCount: 0 });
    }

    return () => unsubscribe();
  }, [conversation?.id, user?.id]);

  if (!conversation || !user) return null;

  const otherId = conversation.participants.find((id: string) => id !== user.id) || '';
  const otherName = conversation.participantNames?.[otherId] || 'Bilinmeyen Kullanıcı';
  const otherPhoto = conversation.participantPhotos?.[otherId];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const saveMessage = async (msg: Message) => {
    // Play sound
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3');
    audio.volume = 0.3;
    audio.play().catch(() => {});

    try {
      await setDoc(doc(db, 'conversations', conversation.id, 'messages', msg.id), msg);
      
      await updateDoc(doc(db, 'conversations', conversation.id), {
        lastMessage: msg.type === 'text' ? msg.text : (msg.type === 'image' ? '📷 Fotoğraf' : '🎤 Ses Mesajı'),
        lastTimestamp: msg.timestamp,
        unreadCount: increment(1) // This is a bit tricky since we don't want to increment for ourselves
        // In a real app, we'd use a more complex structure for unread counts
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `conversations/${conversation.id}/messages`);
    }
  };

  const handleSendMessage = () => {
    if (isRecording) {
      shouldSendImmediatelyRef.current = true;
      stopRecording();
      return;
    }

    if (recordedAudio) {
      const newMessage: Message = {
        id: 'm' + Date.now(),
        senderId: user.id,
        timestamp: new Date().toISOString(),
        type: 'audio',
        dataUrl: recordedAudio
      };
      saveMessage(newMessage);
      setRecordedAudio(null);
      return;
    }

    if (!inputText.trim()) return;

    const newMessage: Message = {
      id: 'm' + Date.now(),
      senderId: user.id,
      text: inputText,
      timestamp: new Date().toISOString(),
      type: 'text'
    };

    saveMessage(newMessage);
    setInputText('');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Image = reader.result as string;
        const compressed = await compressImage(base64Image, 800, 800, 0.6);
        const newMessage: Message = {
          id: 'm' + Date.now(),
          senderId: user.id,
          timestamp: new Date().toISOString(),
          type: 'image',
          dataUrl: compressed
        };
        saveMessage(newMessage);
      };
      reader.readAsDataURL(file);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          if (shouldSendImmediatelyRef.current) {
            const newMessage: Message = {
              id: 'm' + Date.now(),
              senderId: user.id,
              timestamp: new Date().toISOString(),
              type: 'audio',
              dataUrl: base64Audio
            };
            saveMessage(newMessage);
            shouldSendImmediatelyRef.current = false;
          } else {
            setRecordedAudio(base64Audio);
          }
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordingTime(0);
      shouldSendImmediatelyRef.current = false;
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Mikrofon erişimi reddedildi:", err);
      showToast("Ses kaydı için mikrofon izni gereklidir.", "error");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      setRecordedAudio(null);
      startRecording();
    }
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 flex items-center gap-4 bg-white/80 backdrop-blur-md sticky top-0 z-10">
        <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div 
          className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => onUserClick(otherUser)}
        >
          <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0">
            {otherUser?.profilePhoto ? (
              <img src={otherUser.profilePhoto} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <DefaultAvatar name={otherUser?.fullName} />
            )}
          </div>
          <div>
            <h3 className="font-bold text-sm">{otherUser?.fullName || 'Yükleniyor...'}</h3>
            <span className="text-[10px] text-green-500 font-bold">Çevrimiçi</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div 
              key={msg.id} 
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className={`flex items-end gap-2 ${msg.senderId === user.id ? 'flex-row-reverse' : 'flex-row'}`}
            >
              <div 
                className={`w-7 h-7 rounded-full overflow-hidden flex-shrink-0 mb-1 ${msg.senderId !== user.id ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
                onClick={() => msg.senderId !== user.id && onUserClick(otherUser)}
              >
                {msg.senderId === user.id ? (
                  user.profilePhoto ? (
                    <img src={user.profilePhoto} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <DefaultAvatar name={user.fullName} />
                  )
                ) : (
                  otherUser?.profilePhoto ? (
                    <img src={otherUser.profilePhoto} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <DefaultAvatar name={otherUser?.fullName} />
                  )
                )}
              </div>
              <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm break-words whitespace-pre-wrap ${
                msg.senderId === user.id 
                  ? 'bg-brand-purple text-white rounded-br-none' 
                  : 'bg-slate-100 text-slate-600 rounded-bl-none'
              }`}>
                {(!msg.type || msg.type === 'text') && msg.text}
                {msg.type === 'image' && (
                  <img src={msg.dataUrl} alt="Sent" className="max-w-full rounded-xl" referrerPolicy="no-referrer" />
                )}
                {msg.type === 'audio' && (
                  <audio src={msg.dataUrl} controls className="max-w-full h-8" />
                )}
                <div className={`text-[8px] mt-1 opacity-60 ${msg.senderId === user.id ? 'text-right' : 'text-left'}`}>
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Input */}
      <div className="p-4 border-t border-slate-100 bg-white">
        {recordedAudio && !isRecording && (
          <div className="mb-3 p-3 bg-slate-50 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex-1">
              <audio src={recordedAudio} controls className="w-full h-8" />
            </div>
            <button 
              onClick={() => setRecordedAudio(null)}
              className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-all"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        )}
        <div className="flex gap-2 items-center">
          {!isRecording && (
            <>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleImageUpload} 
                accept="image/*" 
                className="hidden" 
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                onPointerDown={(e) => e.preventDefault()}
                className="p-2 text-slate-400 hover:text-brand-purple transition-colors"
              >
                <ImageIcon className="w-6 h-6" />
              </button>
            </>
          )}
          
          <button 
            onClick={toggleRecording}
            onPointerDown={(e) => e.preventDefault()}
            className={`p-2 transition-colors ${isRecording ? 'text-red-500 scale-125' : 'text-slate-400 hover:text-brand-purple'}`}
          >
            <Mic className={`w-6 h-6 ${isRecording ? 'animate-pulse' : ''}`} />
          </button>

          {isRecording ? (
            <div className="flex-1 flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-red-50 text-red-500 font-bold text-sm">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
              <span>{formatTime(recordingTime)}</span>
              <span className="text-[10px] opacity-60 animate-pulse ml-auto">Kaydı durdurmak için bırakın</span>
            </div>
          ) : (
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder={recordedAudio ? "Ses kaydı hazır" : "Mesajınızı yazın..."}
              disabled={!!recordedAudio}
              className="flex-1 px-4 py-2.5 rounded-2xl bg-slate-50 border-none outline-none text-sm font-medium focus:ring-2 ring-brand-purple/20 transition-all"
            />
          )}

          <button
            onClick={handleSendMessage}
            onPointerDown={(e) => e.preventDefault()}
            disabled={!isRecording && !inputText.trim() && !recordedAudio}
            className="w-10 h-10 bg-brand-purple text-white rounded-2xl flex items-center justify-center shadow-lg shadow-brand-purple/20 active:scale-90 transition-all disabled:opacity-50"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

const AdoptionListingsScreen = ({ pets, onDetail, onChat }: any) => {
  const [filterType, setFilterType] = useState<PetType | ''>('');
  const [filterBreed, setFilterBreed] = useState<string>('');
  const [filterCity, setFilterCity] = useState<string>('');
  const [filterDistrict, setFilterDistrict] = useState<string>('');
  const [filterAge, setFilterAge] = useState<string>('');
  const [filterVaccination, setFilterVaccination] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  const filteredPets = pets.filter((pet: any) => 
    (filterType === '' || pet.type === filterType) &&
    (filterBreed === '' || pet.breed === filterBreed) &&
    (filterCity === '' || pet.city === filterCity) &&
    (filterDistrict === '' || pet.district === filterDistrict) &&
    (filterAge === '' || (
      filterAge === 'Yavru' ? (pet.age.includes('Aylık') || pet.age.includes('0') || pet.age.includes('1 Yaş')) :
      filterAge === 'Yetişkin' ? (!pet.age.includes('Aylık') && !pet.age.includes('1 Yaş')) : true
    )) &&
    (filterVaccination === '' || pet.vaccinationStatus === filterVaccination)
  ).sort((a: any, b: any) => {
    const aBoosted = (a.isBoosted && !a.boostedUntil) || (a.boostedUntil && new Date(a.boostedUntil) > new Date());
    const bBoosted = (b.isBoosted && !b.boostedUntil) || (b.boostedUntil && new Date(b.boostedUntil) > new Date());
    if (aBoosted && !bBoosted) return -1;
    if (!aBoosted && bBoosted) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const cities = TURKEY_CITIES.map(c => c.name);
  const districts = TURKEY_CITIES.find(c => c.name === filterCity)?.districts || [];
  const breeds = filterType === 'Kedi' ? CAT_BREEDS : filterType === 'Köpek' ? DOG_BREEDS : [];

  return (
    <div className="h-full flex flex-col p-6 pb-24 relative">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">İlanlar 🐾</h1>
        <button 
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl transition-all active:scale-95 z-50 ${showFilters ? 'bg-brand-purple text-white shadow-lg shadow-brand-purple/30' : 'bg-white text-slate-600 shadow-sm border border-slate-100'}`}
        >
          <Filter className="w-4 h-4" />
          <span className="text-sm font-bold">Filtrele</span>
        </button>
      </div>

      <AnimatePresence>
        {showFilters && (
          <motion.div 
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="absolute top-20 left-0 right-0 bg-white/95 backdrop-blur-xl z-40 p-6 shadow-2xl rounded-b-[40px] border-b border-slate-100 max-h-[70vh] overflow-y-auto"
          >
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-3">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tür</label>
                <div className="flex gap-2">
                  {['Hepsi', 'Kedi', 'Köpek'].map((type) => (
                    <button
                      key={type}
                      onClick={() => {
                        setFilterType(type === 'Hepsi' ? '' : type as any);
                        setFilterBreed('');
                      }}
                      className={`flex-1 py-3 rounded-2xl text-sm font-bold transition-all ${
                        (type === 'Hepsi' ? filterType === '' : filterType === type)
                          ? 'bg-brand-purple text-white shadow-md'
                          : 'bg-slate-50 text-slate-400'
                      }`}
                    >
                      {type === 'Hepsi' ? 'Hepsi' : type === 'Kedi' ? 'Kedi 🐱' : 'Köpek 🐶'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cins</label>
                <select 
                  value={filterBreed}
                  onChange={(e) => setFilterBreed(e.target.value)}
                  disabled={!filterType}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 border-none outline-none text-sm font-medium disabled:opacity-50"
                >
                  <option value="">{filterType ? 'Tüm Cinsler' : 'Önce tür seçiniz'}</option>
                  {breeds.map(breed => <option key={breed} value={breed}>{breed}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-3">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Şehir</label>
                  <select 
                    value={filterCity}
                    onChange={(e) => {
                      setFilterCity(e.target.value);
                      setFilterDistrict('');
                    }}
                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 border-none outline-none text-sm font-medium"
                  >
                    <option value="">Tüm Şehirler</option>
                    {cities.map(city => <option key={city} value={city}>{city}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-3">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">İlçe</label>
                  <select 
                    value={filterDistrict}
                    onChange={(e) => setFilterDistrict(e.target.value)}
                    disabled={!filterCity}
                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 border-none outline-none text-sm font-medium disabled:opacity-50"
                  >
                    <option value="">Tüm İlçeler</option>
                    {districts.map(district => <option key={district} value={district}>{district}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-3">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Yaş Grubu</label>
                  <select 
                    value={filterAge}
                    onChange={(e) => setFilterAge(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 border-none outline-none text-sm font-medium"
                  >
                    <option value="">Hepsi</option>
                    <option value="Yavru">Yavru (0-1 Yaş)</option>
                    <option value="Yetişkin">Yetişkin (1+ Yaş)</option>
                  </select>
                </div>
                <div className="flex flex-col gap-3">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Aşı Durumu</label>
                  <select 
                    value={filterVaccination}
                    onChange={(e) => setFilterVaccination(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 border-none outline-none text-sm font-medium"
                  >
                    <option value="">Hepsi</option>
                    <option value="Tam">Tam</option>
                    <option value="Eksik">Eksik</option>
                  </select>
                </div>
              </div>

              <Button 
                onClick={() => setShowFilters(false)}
                className="w-full py-4 rounded-2xl shadow-xl shadow-brand-purple/20"
              >
                Sonuçları Gör ({filteredPets.length})
              </Button>
              
              <button 
                onClick={() => {
                  setFilterType('');
                  setFilterBreed('');
                  setFilterCity('');
                  setFilterDistrict('');
                  setFilterAge('');
                  setFilterVaccination('');
                }}
                className="text-xs font-bold text-slate-400 hover:text-brand-purple transition-all"
              >
                Filtreleri Temizle
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        {filteredPets.length > 0 ? (
          <div className="grid grid-cols-3 gap-2">
            {filteredPets.map((pet: any) => (
              <motion.div 
                key={pet.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={() => onDetail(pet)}
                className="glass-card rounded-2xl overflow-hidden soft-shadow cursor-pointer hover:scale-[1.02] transition-all"
              >
                <div className="relative aspect-square">
                  <img src={pet.photos[0]} alt={pet.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/40 backdrop-blur-md rounded-md text-white text-[8px] flex items-center gap-0.5">
                    <MapPin className="w-2 h-2" /> {pet.city}
                  </div>
                  {((pet.isBoosted && !pet.boostedUntil) || (pet.boostedUntil && new Date(pet.boostedUntil) > new Date())) && (
                    <div className="absolute top-1 right-1 w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center shadow-lg shadow-yellow-400/40">
                      <Zap className="w-2.5 h-2.5 text-white fill-current" />
                    </div>
                  )}
                </div>
                <div className="p-2">
                  <div className="flex justify-between items-start mb-0.5">
                    <h3 className="font-bold text-[10px] truncate">{pet.name}</h3>
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="text-[8px] text-slate-400 truncate">{pet.breed}</p>
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        e.preventDefault();
                        onChat(pet); 
                      }}
                      className="p-1 bg-brand-purple/10 text-brand-purple rounded-lg hover:bg-brand-purple hover:text-white transition-all active:scale-90"
                    >
                      <MessageCircle className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <div className="text-5xl mb-4">🔍</div>
            <h3 className="text-lg font-bold mb-2">İlan bulunamadı</h3>
            <p className="text-sm text-slate-400">Şu an aktif ilan bulunmuyor veya filtrelerinize uygun sonuç yok. İlanlar 24 saat sonra otomatik olarak yayından kaldırılır.</p>
          </div>
        )}
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

function AppContent() {
  const [screen, setScreen] = useState<AppScreen>('home');
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null);
  const [previousScreen, setPreviousScreen] = useState<AppScreen>('home');
  const [user, setUser] = useState<UserType | null>(null);
  const [pets, setPets] = useState<Pet[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [toast, setToast] = useState<{ message: string, type: 'info' | 'error' | 'success' } | null>(null);
  const [referralCode, setReferralCode] = useState<string>('');

  const GUEST_USER: UserType = {
    id: 'guest',
    fullName: 'Misafir Kullanıcı',
    email: 'guest@patipati.com',
    city: 'İstanbul',
    district: 'Kadıköy',
    gender: 'Belirtilmedi',
    petType: 'Kedi',
    inviteCode: 'GUEST',
    patiPuan: 0,
    role: 'user',
    favorites: [],
    matches: []
  };

  const showToast = (message: string, type: 'info' | 'error' | 'success' = 'info') => {
    setToast({ message, type });
  };

  // Referral code listener
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) {
      setReferralCode(ref);
      // Clean up URL without refreshing
      const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
      window.history.replaceState({ path: newUrl }, '', newUrl);
    }
  }, []);

  // Auth state listener
  useEffect(() => {
    let userUnsubscribe: (() => void) | null = null;

    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. ");
          showToast("Firebase bağlantı hatası. Lütfen yapılandırmayı kontrol edin.", "error");
        }
      }
    }
    testConnection();

    const authUnsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Set up real-time listener for the user document
        userUnsubscribe = onSnapshot(doc(db, 'users', firebaseUser.uid), (docSnap) => {
          if (docSnap.exists()) {
            setUser(docSnap.data() as UserType);
            setScreen(prev => (prev === 'login' || prev === 'register') ? 'home' : prev);
          } else {
            console.warn('User not found in Firestore yet');
          }
          setIsAuthReady(true);
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
          setIsAuthReady(true);
        });
      } else {
        if (userUnsubscribe) {
          userUnsubscribe();
          userUnsubscribe = null;
        }
        setUser(null);
        // Passive auth: don't force login screen
        setIsAuthReady(true);
      }
    });

    return () => {
      authUnsubscribe();
      if (userUnsubscribe) userUnsubscribe();
    };
  }, []); // Removed screen dependency to prevent unnecessary re-subscriptions

  // Real-time pets listener
  useEffect(() => {
    if (!isAuthReady) return;

    const q = query(collection(db, 'pets'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const now = new Date().getTime();
      const twentyFourHours = 24 * 60 * 60 * 1000;
      
      const petsData = snapshot.docs
        .map(doc => doc.data() as Pet)
        .filter(pet => {
          if (!pet.createdAt) return false;
          const createdAt = new Date(pet.createdAt).getTime();
          return (now - createdAt) < twentyFourHours;
        });
        
      setPets(petsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'pets');
    });

    return () => unsubscribe();
  }, [isAuthReady, user]);

  // Real-time conversations listener
  useEffect(() => {
    if (!isAuthReady || !user || user.id === 'guest') return;

    const q = query(
      collection(db, 'conversations'), 
      where('participants', 'array-contains', user.id),
      orderBy('lastTimestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const conversationsData = snapshot.docs.map(doc => doc.data() as Conversation);
      const unread = conversationsData.reduce((acc, curr) => acc + (curr.unreadCount || 0), 0);
      setTotalUnreadCount(unread);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'conversations');
    });

    return () => unsubscribe();
  }, [isAuthReady, user]);

  const handleLogin = async (email: string, pass: string, setError: (msg: string) => void) => {
    if (!pass) {
      setError('Şifre girmelisiniz');
      return;
    }
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      // onAuthStateChanged will handle the rest
    } catch (error: any) {
      console.error('Login error:', error);
      const errorCode = error.code || '';
      const errorMessage = error.message || '';
      
      if (errorCode === 'auth/user-not-found' || 
          errorCode === 'auth/wrong-password' || 
          errorCode === 'auth/invalid-credential' ||
          errorMessage.includes('invalid-credential')) {
        setError('Hatalı email veya şifre. Lütfen bilgilerinizi kontrol edin.');
      } else if (errorCode === 'auth/operation-not-allowed') {
        setError('Email/Şifre girişi henüz etkinleştirilmemiş. Lütfen Google ile giriş yapın veya Firebase Console\'dan (Authentication > Sign-in method) "Email/Password" seçeneğini etkinleştirin.');
      } else if (errorCode === 'auth/missing-password') {
        setError('Şifre girmelisiniz');
      } else if (errorCode === 'auth/invalid-email') {
        setError('Geçerli bir email adresi giriniz.');
      } else if (errorCode === 'auth/too-many-requests') {
        setError('Çok fazla başarısız giriş denemesi. Lütfen bir süre sonra tekrar deneyin veya şifrenizi sıfırlayın.');
      } else {
        setError('Giriş yapılırken bir hata oluştu: ' + errorMessage);
      }
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const firebaseUser = result.user;

      // Check if user document exists, if not create it
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
      if (!userDoc.exists()) {
        const newUser: UserType = {
          id: firebaseUser.uid,
          fullName: firebaseUser.displayName || 'İsimsiz Kullanıcı',
          email: firebaseUser.email || '',
          city: 'İstanbul', // Default
          district: 'Kadıköy', // Default
          gender: 'Kadın', // Default
          inviteCode: 'PET-' + Math.random().toString(36).substring(2, 7).toUpperCase(),
          patiPuan: 100,
          role: 'user',
          favorites: [],
          matches: [],
          petType: 'Kedi' // Default
        };
        await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
      }
      showToast('Google ile giriş başarılı!', 'success');
    } catch (error: any) {
      console.error('Google Login error:', error);
      showToast('Google ile giriş yapılırken bir hata oluştu.', 'error');
    }
  };

  const handleRegister = async (formData: any, setError?: (msg: string) => void) => {
    try {
      let firebaseUser;
      if (formData.isAnonymous) {
        const userCredential = await signInAnonymously(auth);
        firebaseUser = userCredential.user;
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        firebaseUser = userCredential.user;
      }

      const newUser: UserType = {
        id: firebaseUser.uid,
        fullName: formData.fullName,
        email: formData.email || 'guest@patipati.com',
        city: formData.city,
        district: formData.district,
        gender: formData.gender,
        petType: formData.petType,
        patiPuan: 100,
        role: 'user',
        inviteCode: 'PET-' + Math.random().toString(36).substring(2, 7).toUpperCase(),
        favorites: [],
        matches: []
      };

      await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
      showToast('Kayıt başarılı! Hoş geldin.', 'success');
      // onAuthStateChanged will handle the rest
    } catch (error: any) {
      console.error('Registration error:', error);
      let errorMsg = 'Kayıt olurken bir hata oluştu. Lütfen tekrar deneyin.';
      
      if (error.code === 'auth/operation-not-allowed') {
        errorMsg = 'Bu kayıt yöntemi henüz etkinleştirilmemiş. Lütfen Google ile kayıt olun veya Firebase Console\'dan ilgili yöntemi (Email veya Anonim) etkinleştirin.';
      } else if (error.code === 'auth/email-already-in-use') {
        errorMsg = 'Bu email adresi zaten kullanımda. Lütfen farklı bir email deneyin veya giriş yapın.';
      } else if (error.code === 'auth/missing-password') {
        errorMsg = 'Şifre girmelisiniz!';
      } else if (error.code === 'auth/invalid-email') {
        errorMsg = 'Geçerli bir email adresi giriniz.';
      } else if (error.code === 'auth/weak-password') {
        errorMsg = 'Şifre çok zayıf. Lütfen daha güçlü bir şifre seçin.';
      }

      if (setError) {
        setError(errorMsg);
      } else {
        showToast(errorMsg, 'error');
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setScreen('login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const generateDemoData = async () => {
    const firstNames = ['Ahmet', 'Mehmet', 'Ayşe', 'Fatma', 'Can', 'Ece', 'Burak', 'Selin', 'Deniz', 'Merve', 'Emre', 'Zeynep', 'Ali', 'Elif', 'Kaan', 'Derya', 'Oğuz', 'İrem', 'Mert', 'Gökçe'];
    const lastNames = ['Yılmaz', 'Kaya', 'Demir', 'Çelik', 'Şahin', 'Yıldız', 'Öztürk', 'Aydın', 'Özdemir', 'Arslan', 'Doğan', 'Kılıç', 'Aslan', 'Çetin', 'Kara', 'Koç', 'Kurt', 'Özcan', 'Vural', 'Güler'];
    const petNames = ['Pamuk', 'Duman', 'Zeytin', 'Boncuk', 'Tarçın', 'Limon', 'Mavi', 'Gece', 'Güneş', 'Fıstık', 'Badem', 'Karamel', 'Şeker', 'Bal', 'Gofret', 'Lokum', 'Pati', 'Mırnav', 'Kont', 'Paşa'];
    const petDescriptions = [
      'Çok oyuncu ve cana yakın bir dost.',
      'Sakin, uykuyu seven ve kucak düşkünü.',
      'Aşıları tam, tuvalet eğitimi var.',
      'Yeni yuvasını bekleyen enerjik bir yavru.',
      'Diğer hayvanlarla çok iyi anlaşıyor.',
      'Çocuklu aileler için ideal, sabırlı bir karakter.',
      'Bahçeli ev arayan, koşturmayı seven bir dost.',
      'Sadece sevgi bekleyen, sadık bir arkadaş.',
      'Ev ortamına alışkın, uslu ve temiz.',
      'Sokağa terk edilmiş, sevgiye muhtaç bir can.'
    ];

    showToast('Demo verileri oluşturuluyor, lütfen bekleyin...', 'info');

    try {
      for (let i = 0; i < 100; i++) {
        // 1. Create User
        const userId = 'demo_user_' + Math.random().toString(36).substring(2, 10);
        const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
        const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
        const fullName = `${firstName} ${lastName}`;
        const cityObj = TURKEY_CITIES[Math.floor(Math.random() * TURKEY_CITIES.length)];
        const district = cityObj.districts[Math.floor(Math.random() * cityObj.districts.length)];
        
        const demoUser: UserType = {
          id: userId,
          fullName,
          email: `demo_${userId}@patipati.com`,
          city: cityObj.name,
          district,
          gender: Math.random() > 0.5 ? 'Kadın' : 'Erkek',
          petType: Math.random() > 0.5 ? 'Kedi' : 'Köpek',
          patiPuan: Math.floor(Math.random() * 500) + 100,
          role: 'user',
          inviteCode: 'DEMO-' + Math.random().toString(36).substring(2, 7).toUpperCase(),
          favorites: [],
          matches: [],
          profilePhoto: `https://i.pravatar.cc/150?u=${userId}`
        };

        await setDoc(doc(db, 'users', userId), demoUser);

        // 2. Create Pet
        const petId = 'demo_pet_' + Math.random().toString(36).substring(2, 10);
        const petType: PetType = Math.random() > 0.5 ? 'Kedi' : 'Köpek';
        const breeds = petType === 'Kedi' ? CAT_BREEDS : DOG_BREEDS;
        const breed = breeds[Math.floor(Math.random() * breeds.length)];
        const petName = petNames[Math.floor(Math.random() * petNames.length)];
        
        const demoPet: Pet = {
          id: petId,
          name: petName,
          type: petType,
          breed,
          age: Math.floor(Math.random() * 5) + 1 + ' Yaşında',
          description: petDescriptions[Math.floor(Math.random() * petDescriptions.length)],
          photos: [`https://loremflickr.com/600/800/${petType === 'Kedi' ? 'cat' : 'dog'}?lock=${i}`],
          ownerId: userId,
          ownerName: fullName,
          ownerPhoto: demoUser.profilePhoto || '',
          city: cityObj.name,
          district,
          createdAt: new Date(Date.now() - Math.floor(Math.random() * 1000000000)).toISOString(),
          isBoosted: Math.random() > 0.8,
          vaccinationStatus: Math.random() > 0.3 ? 'Tam' : 'Eksik',
          neuteredStatus: Math.random() > 0.5 ? 'Kısırlaştırılmış' : 'Kısırlaştırılmamış',
          energyLevel: Math.floor(Math.random() * 5) + 1,
          toiletTraining: Math.random() > 0.5
        };

        if (demoPet.isBoosted) {
          demoPet.boostedUntil = new Date(Date.now() + 86400000).toISOString();
        }

        await setDoc(doc(db, 'pets', petId), demoPet);
        
        if ((i + 1) % 10 === 0) {
          showToast(`${i + 1} adet veri oluşturuldu...`, 'info');
        }
      }
      showToast('100 adet demo hesap ve ilan başarıyla oluşturuldu!', 'success');
    } catch (error) {
      console.error('Demo data generation error:', error);
      showToast('Veri oluşturulurken bir hata oluştu.', 'error');
    }
  };

  const deleteDemoData = async () => {
    showToast('Demo verileri siliniyor, lütfen bekleyin...', 'info');
    try {
      // Delete Pets
      const petsSnapshot = await getDocs(collection(db, 'pets'));
      const demoPets = petsSnapshot.docs.filter(doc => doc.id.startsWith('demo_pet_'));
      
      // Delete Users
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const demoUsers = usersSnapshot.docs.filter(doc => doc.id.startsWith('demo_user_'));

      let count = 0;
      for (const petDoc of demoPets) {
        await deleteDoc(doc(db, 'pets', petDoc.id));
        count++;
      }
      for (const userDoc of demoUsers) {
        await deleteDoc(doc(db, 'users', userDoc.id));
        count++;
      }

      showToast(`${count} adet demo verisi başarıyla silindi!`, 'success');
    } catch (error) {
      console.error('Demo data deletion error:', error);
      showToast('Veriler silinirken bir hata oluştu.', 'error');
    }
  };

  const handleUpdateUser = async (updatedUser: UserType) => {
    try {
      await updateDoc(doc(db, 'users', updatedUser.id), updatedUser as any);
      // setUser is handled by onSnapshot
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${updatedUser.id}`);
    }
  };

  const handleBoostPet = async (petId: string, durationMinutes: number, isPaid: boolean = false) => {
    if (!user) return;

    try {
      const boostedUntil = new Date(Date.now() + durationMinutes * 60000).toISOString();
      await updateDoc(doc(db, 'pets', petId), {
        boostedUntil,
        isBoosted: true
      });

      if (!isPaid) {
        const updatedUser = { ...user, patiPuan: Math.max(0, user.patiPuan - 50) };
        await handleUpdateUser(updatedUser);
      }
      showToast(`İlanınız ${durationMinutes === 60 ? '1 saat' : durationMinutes + ' dakika'} boyunca en üstte görünecek! 🚀`, 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `pets/${petId}`);
    }
  };

  const handleAddPet = async (petData: any) => {
    if (!user) return;

    try {
      const { isBoosted, boostDuration, ...rest } = petData;
      const petId = 'p' + Date.now();
      const newPet: Pet = {
        id: petId,
        ...rest,
        photos: petData.photos.length > 0 ? petData.photos : [`https://loremflickr.com/600/800/${petData.type === 'Kedi' ? 'cat' : 'dog'}?lock=${Date.now()}`],
        ownerId: user.id,
        ownerName: user.fullName,
        ownerPhoto: user.profilePhoto || '',
        createdAt: new Date().toISOString()
      };

      if (isBoosted) {
        newPet.isBoosted = true;
        newPet.boostedUntil = new Date(Date.now() + (boostDuration || 30) * 60000).toISOString();
        
        if (user.patiPuan >= 50 && boostDuration === 30) {
          const updatedUser = { ...user, patiPuan: user.patiPuan - 50 };
          await handleUpdateUser(updatedUser);
        }
      }

      await setDoc(doc(db, 'pets', petId), newPet);
      showToast('İlanınız başarıyla eklendi!', 'success');
      setScreen('search');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'pets');
    }
  };

  const handleStartChat = async (pet: Pet, initialMessage?: string) => {
    if (!user || user.id === 'guest') {
      setScreen('login');
      return;
    }

    if (pet.ownerId === user.id) {
      showToast('Kendi ilanınız için kendinizle sohbet edemezsiniz.', 'info');
      return;
    }

    try {
      // Check if conversation already exists
      const q = query(
        collection(db, 'conversations'),
        where('participants', 'array-contains', user.id)
      );
      const querySnapshot = await getDocs(q);
      let conversation = querySnapshot.docs
        .map(doc => doc.data() as Conversation)
        .find(c => c.participants.includes(pet.ownerId) && c.petId === pet.id);

      if (!conversation) {
        const conversationId = 'c' + Date.now();
        conversation = {
          id: conversationId,
          participants: [user.id, pet.ownerId],
          participantNames: {
            [user.id]: user.fullName,
            [pet.ownerId]: pet.ownerName || 'Bilinmeyen Kullanıcı'
          },
          participantPhotos: {
            [user.id]: user.profilePhoto || '',
            [pet.ownerId]: pet.ownerPhoto || ''
          },
          petId: pet.id,
          lastMessage: initialMessage || '',
          lastTimestamp: new Date().toISOString()
        };

        await setDoc(doc(db, 'conversations', conversationId), conversation);

        if (initialMessage) {
          const messageId = 'm' + Date.now();
          const message: Message = {
            id: messageId,
            senderId: user.id,
            text: initialMessage,
            timestamp: conversation.lastTimestamp!,
            type: 'text'
          };
          await setDoc(doc(db, 'conversations', conversationId, 'messages', messageId), message);
        }
      } else if (initialMessage) {
        const messageId = 'm' + Date.now();
        const timestamp = new Date().toISOString();
        const message: Message = {
          id: messageId,
          senderId: user.id,
          text: initialMessage,
          timestamp,
          type: 'text'
        };
        await setDoc(doc(db, 'conversations', conversation.id, 'messages', messageId), message);
        await updateDoc(doc(db, 'conversations', conversation.id), {
          lastMessage: initialMessage,
          lastTimestamp: timestamp
        });
      }

      setSelectedConversation(conversation);
      setScreen('chatDetail');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'conversations');
    }
  };

  const renderScreen = () => {
    if (!isAuthReady) return <LoadingScreen />;
    
    // Use guest user if not logged in
    const currentUser = user || GUEST_USER;

    switch (screen) {
      case 'login': return <LoginScreen onNavigate={setScreen} onLogin={handleLogin} onGoogleLogin={handleGoogleLogin} />;
      case 'register': return <RegisterScreen onNavigate={setScreen} onRegister={handleRegister} onGoogleLogin={handleGoogleLogin} referralCode={referralCode} />;
      case 'home': return <HomeScreen pets={pets} user={currentUser} onChat={handleStartChat} onDetail={(p: any) => { setSelectedPet(p); setPreviousScreen('home'); setScreen('detail'); }} onLogin={() => setScreen('login')} />;
      case 'search': return <AdoptionListingsScreen pets={pets} onChat={handleStartChat} onDetail={(p: any) => { setSelectedPet(p); setPreviousScreen('search'); setScreen('detail'); }} />;
      case 'add': return <AddListingScreen user={currentUser} onComplete={handleAddPet} onLogin={() => setScreen('login')} />;
      case 'favorites': return <FavoritesScreen pets={pets} user={currentUser} onDetail={(p: any) => { setSelectedPet(p); setPreviousScreen('favorites'); setScreen('detail'); }} onLogin={() => setScreen('login')} />;
      case 'matches': return <MatchesScreen pets={pets} user={currentUser} onDetail={(p: any) => { setSelectedPet(p); setPreviousScreen('matches'); setScreen('detail'); }} onLogin={() => setScreen('login')} />;
      case 'profile': 
        if (!user) return <LoginScreen onNavigate={setScreen} onLogin={handleLogin} onGoogleLogin={handleGoogleLogin} />;
        return <ProfileScreen user={user} pets={pets} onLogout={handleLogout} onUpdateUser={handleUpdateUser} onBoostPet={handleBoostPet} showToast={showToast} onGenerateDemo={generateDemoData} onDeleteDemo={deleteDemoData} />;
      case 'userDetail': return <UserDetailScreen user={selectedUser} pets={pets} onBack={() => setScreen(previousScreen)} onChat={handleStartChat} />;
      case 'detail': return <DetailScreen pet={selectedPet} user={currentUser} onChat={handleStartChat} onBack={() => setScreen(previousScreen)} onLogin={() => setScreen('login')} />;
      case 'chat': 
        if (!user) return <LoginScreen onNavigate={setScreen} onLogin={handleLogin} onGoogleLogin={handleGoogleLogin} />;
        return <ChatListScreen user={user} onNavigate={setScreen} onSelectConversation={(c: any) => { setSelectedConversation(c); setScreen('chatDetail'); }} />;
      case 'chatDetail': 
        if (!user) return <LoginScreen onNavigate={setScreen} onLogin={handleLogin} onGoogleLogin={handleGoogleLogin} />;
        return <ChatDetailScreen user={user} conversation={selectedConversation} onBack={() => setScreen('chat')} onUserClick={(u: any) => { setSelectedUser(u); setPreviousScreen('chatDetail'); setScreen('userDetail'); }} showToast={showToast} />;
      default: return null;
    }
  };

  const isLoginOrRegister = ['login', 'register'].includes(screen) || (!user && ['profile', 'chat', 'chatDetail'].includes(screen));
  const showNavbar = !isLoginOrRegister && !['detail', 'chatDetail', 'userDetail'].includes(screen);

  return (
    <div className="max-w-md mx-auto h-screen bg-slate-50 relative overflow-hidden shadow-2xl">
      {!isLoginOrRegister && <PetBackground />}
      <AnimatePresence mode="wait">
        {renderScreen()}
      </AnimatePresence>
      <AnimatePresence>
        {toast && (
          <Toast 
            message={toast.message} 
            type={toast.type} 
            onClose={() => setToast(null)} 
          />
        )}
      </AnimatePresence>
      {showNavbar && (
        <div className="absolute bottom-6 inset-x-6 h-16 bg-gradient-to-r from-brand-purple to-brand-pink backdrop-blur-xl border border-white/20 px-6 rounded-full flex items-center justify-between z-40 shadow-xl shadow-brand-pink/20">
          <button onClick={() => setScreen('home')} className={`flex flex-col items-center gap-1 ${screen === 'home' ? 'text-white' : 'text-white/60'}`}>
            <HomeIcon className="w-7 h-7" strokeWidth={2.5} />
          </button>
          <button onClick={() => setScreen('search')} className={`flex flex-col items-center gap-1 ${screen === 'search' ? 'text-white' : 'text-white/60'}`}>
            <PawPrint className="w-7 h-7" strokeWidth={2.5} />
          </button>
          <button onClick={() => setScreen('matches')} className={`flex flex-col items-center gap-1 ${screen === 'matches' ? 'text-white' : 'text-white/60'}`}>
            <Zap className="w-7 h-7" strokeWidth={2.5} />
          </button>
          
          <div className="relative -top-4">
            <button 
              onClick={() => setScreen('add')}
              className="w-14 h-14 bg-white text-brand-purple rounded-full flex items-center justify-center shadow-lg shadow-black/10 active:scale-90 transition-all border-4 border-brand-purple"
            >
              <Plus className="w-8 h-8" strokeWidth={3} />
            </button>
          </div>

          <button onClick={() => setScreen('favorites')} className={`flex flex-col items-center gap-1 ${screen === 'favorites' ? 'text-white' : 'text-white/60'}`}>
            <Star className="w-7 h-7" strokeWidth={2.5} />
          </button>
          <button onClick={() => setScreen('chat')} className={`flex flex-col items-center gap-1 relative ${screen === 'chat' ? 'text-white' : 'text-white/60'}`}>
            <MessageCircle className="w-7 h-7" strokeWidth={2.5} />
            {totalUnreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-white text-brand-purple text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-brand-purple">
                {totalUnreadCount > 9 ? '9+' : totalUnreadCount}
              </span>
            )}
          </button>
          <button onClick={() => setScreen('profile')} className={`flex flex-col items-center gap-1 ${screen === 'profile' ? 'text-white' : 'text-white/60'}`}>
            <User className="w-7 h-7" strokeWidth={2.5} />
          </button>
        </div>
      )}
    </div>
  );
}
