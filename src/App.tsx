import React, { useState, useEffect, useRef } from 'react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameDay, 
  addMonths, 
  subMonths,
  isToday,
  startOfToday
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { SanteDeclicLogo } from './components/SanteDeclicLogo';

// ... existing imports ...
import { 
  Calendar as CalendarIcon, 
  Plus, 
  Camera, 
  CheckCircle2, 
  XCircle, 
  BarChart3, 
  ChevronLeft, 
  ChevronRight,
  AlertCircle,
  Loader2,
  TrendingUp,
  Users,
  Trash2,
  User,
  Info,
  Activity,
  LogOut,
  Settings,
  KeyRound,
  RefreshCw
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { analyzeDeclarationImage } from './services/geminiService';
import { googleSheetsService } from './services/googleSheetsService';
import { Declaration, CaseData, PATHOLOGIES, AGE_GROUPS, SEXES } from './types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [currentDate, setCurrentDate] = useState(startOfToday());
  const [viewDate, setViewDate] = useState(startOfToday());
  const [declarations, setDeclarations] = useState<Declaration[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [userId, setUserId] = useState<string>("");
  const [userEtablissement, setUserEtablissement] = useState<string>("");
  const [userEtablissementId, setUserEtablissementId] = useState<string>("");
  const [loginError, setLoginError] = useState<string>("");
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });

  useEffect(() => {
    const savedUser = localStorage.getItem("sante_declic_user");
    if (savedUser) {
      const user = JSON.parse(savedUser);
      setUserId(user.email);
      setUserEtablissement((user.etablissement || "Établissement").trim());
      setUserEtablissementId(user.etablissementId || "");
      setIsLoggedIn(true);
    }
  }, []);

  useEffect(() => {
    if (isLoggedIn && userEtablissementId) {
      fetchDeclarations();
    }
  }, [isLoggedIn, userEtablissementId]);

  const handleLogin = async () => {
    const { email, password } = loginForm;
    if (!email || !password) {
      setLoginError("Veuillez remplir tous les champs.");
      return;
    }

    setIsSyncing(true);
    setLoginError("");

    try {
      const googleScriptUrl = (import.meta as any).env.VITE_GOOGLE_SCRIPT_URL?.trim();
      
      if (!googleScriptUrl) {
        if (email === "test@test.com" && password === "1234") {
          const user = { email, etablissement: "CHU MUSTAPHA (DÉMO)" };
          setUserId(email);
          setUserEtablissement(user.etablissement);
          setIsLoggedIn(true);
          setActiveTab('calendar');
          setIsProfileMenuOpen(false);
          localStorage.setItem("sante_declic_user", JSON.stringify(user));
        } else {
          setLoginError("Configuration manquante.");
        }
        return;
      }

      const response = await fetch(`${googleScriptUrl}?action=login&email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`);
      const result = await response.json();

      if (result.status === "success") {
        const etab = result.etablissement?.trim() || "Établissement";
        const etabId = result.etablissementId || "";
        const user = { email, name: result.name, etablissement: etab, etablissementId: etabId };
        setUserId(email);
        setUserEtablissement(etab);
        setUserEtablissementId(etabId);
        setIsLoggedIn(true);
        setActiveTab('calendar');
        setIsProfileMenuOpen(false);
        localStorage.setItem("sante_declic_user", JSON.stringify(user));
      } else {
        setLoginError(result.message || "Identifiants incorrects.");
      }
    } catch (error) {
      setLoginError("Erreur de communication.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUserId("");
    setUserEtablissement("");
    setActiveTab('calendar');
    setDeclarations([]); // Vider les déclarations à la déconnexion
    localStorage.removeItem("sante_declic_user");
  };
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisMessage, setAnalysisMessage] = useState<string | null>(null);
  const [currentCases, setCurrentCases] = useState<CaseData[]>([]);
  const [activeTab, setActiveTab] = useState<'calendar' | 'stats' | 'settings'>('calendar');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingDeclaration, setViewingDeclaration] = useState<Declaration | null>(null);
  const [statsFilter, setStatsFilter] = useState<string | 'all'>('all');
  
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualCase, setManualCase] = useState<CaseData>({
    pathology: PATHOLOGIES[0],
    ageGroup: AGE_GROUPS[0],
    sex: 'M',
    symptoms: []
  });
  const [selectedFileCount, setSelectedFileCount] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, CaseData[]>>({});
  const [isSaving, setIsSaving] = useState(false);
  
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncLog, setSyncLog] = useState<string[]>([]);

  const addLog = (msg: string) => {
    setSyncLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 20));
  };
  
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isLoggedIn) {
      fetchDeclarations();
    }
    const savedDrafts = localStorage.getItem('sante_declic_drafts');
    if (savedDrafts) setDrafts(JSON.parse(savedDrafts));
  }, [isLoggedIn, userEtablissementId]);

  const saveDraft = async () => {
    await saveDeclaration('draft', currentCases);
  };

  const clearDraft = () => {
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    const { [dateStr]: _, ...rest } = drafts;
    setDrafts(rest);
    localStorage.setItem('sante_declic_drafts', JSON.stringify(rest));
  };

  const fetchDeclarations = async () => {
    if (!isLoggedIn || !userEtablissementId) {
      addLog("⚠️ Sync annulée : ID établissement manquant. Essayez de vous reconnecter.");
      return;
    }
    
    setIsSyncing(true);
    const searchEtabId = userEtablissementId.trim();
    addLog(`🔄 Début sync pour ID: ${searchEtabId}`);

    try {
      // 1. Lire les données locales
      addLog("📡 Lecture du cache local (SQLite)...");
      const res = await fetch(`/api/declarations?etablissement_id=${encodeURIComponent(searchEtabId)}`);
      const localData = await res.json();
      addLog(`🏠 Cache local : ${localData.length} entrées trouvées.`);
      
      // 2. Lire les données Google
      const googleScriptUrl = (import.meta as any).env.VITE_GOOGLE_SCRIPT_URL?.trim();
      let finalData = Array.isArray(localData) ? [...localData] : [];

      if (googleScriptUrl) {
        try {
          addLog("☁️ Appel Google Sheets...");
          const syncRes = await fetch(`${googleScriptUrl}?action=read&etablissementId=${encodeURIComponent(searchEtabId)}`);
          
          if (syncRes.ok) {
            const text = await syncRes.text();
            addLog(`📥 Réponse brute reçue (${text.length} chars)`);
            
            try {
              const remoteData = JSON.parse(text);
              const count = Array.isArray(remoteData) ? remoteData.length : 0;
              addLog(`✅ Google Sheets : ${count} entrées trouvées.`);
              
              if (Array.isArray(remoteData)) {
                addLog(`📊 Analyse de ${remoteData.length} dates reçues.`);
                const normalizedRemote = remoteData.map((d, idx) => {
                  let rawDate = String(d.date || "").split(' ')[0].split('T')[0];
                  let normalizedDate = rawDate;
                  
                  // Support DD/MM/YYYY et YYYY-MM-DD
                  if (rawDate.includes('/')) {
                    const parts = rawDate.split('/');
                    if (parts[0].length === 4) normalizedDate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
                    else normalizedDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                  }
                  
                  if (idx === 0) addLog(`Exemple: ${rawDate} -> ${normalizedDate}`);
                  return { ...d, date: normalizedDate };
                });

                const remoteDates = new Set(normalizedRemote.map(d => d.date));
                const filteredLocal = finalData.filter(ld => !remoteDates.has(ld.date) || ld.status === 'draft');
                finalData = [...filteredLocal, ...normalizedRemote];
                
                // Mise à jour SQLite
                for (const rd of normalizedRemote) {
                  fetch('/api/declarations', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      date: rd.date,
                      status: rd.status,
                      cases: rd.cases || [],
                      etablissement: userEtablissement,
                      etablissement_id: userEtablissementId
                    })
                  }).catch(() => {});
                }
                addLog("✨ Synchronisation terminée.");
              }
            } catch (parseError) {
              addLog(`❌ Erreur lecture JSON: ${text.substring(0, 50)}...`);
            }
          } else {
            addLog(`❌ Erreur HTTP Google: ${syncRes.status}`);
          }
        } catch (e: any) {
          addLog(`❌ Erreur réseau Google : ${e.message}`);
        }
      } else {
        addLog("⚠️ URL Google Script non configurée dans .env");
      }

      setDeclarations(finalData);
    } catch (error: any) {
      addLog(`❌ Erreur globale : ${error.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const saveDeclaration = async (status: 'validated' | 'zero_cases' | 'draft', cases: CaseData[] = []) => {
    if (isSaving) return; // Empêche le double clic
    
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    const declarationData = { 
      date: dateStr, 
      status, 
      cases, 
      etablissement: userEtablissement,
      etablissement_id: userEtablissementId
    };

    setIsSaving(true);
    try {
      // Sauvegarde locale avec établissement
      await fetch('/api/declarations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(declarationData)
      });

      // Synchronisation Google Sheets/Drive (Uniquement si validé ou zéro cas)
      if (status === 'validated' || status === 'zero_cases') {
        const googleScriptUrl = (import.meta as any).env.VITE_GOOGLE_SCRIPT_URL?.trim();
        const googleApiKey = (import.meta as any).env.VITE_GOOGLE_SCRIPT_API_KEY?.trim();

        if (googleScriptUrl) {
          try {
            addLog(`☁️ Envoi vers Google Sheets pour le ${format(currentDate, 'dd/MM/yyyy')}...`);
            const payload = {
              date: format(currentDate, 'dd/MM/yyyy'),
              status: status === 'validated' ? 'Validé' : 'Zéro cas à déclarer',
              cases: cases,
              etablissement: userEtablissement,
              etablissementId: userEtablissementId,
              apiKey: googleApiKey
            };

            console.log("Payload envoyé:", payload);

            await fetch(googleScriptUrl, {
              method: 'POST',
              mode: 'no-cors',
              headers: { 'Content-Type': 'text/plain' },
              body: JSON.stringify(payload)
            });
            console.log("✅ Données envoyées à Google Script (mode no-cors)");
          } catch (e) {
            console.error("❌ Synchronisation Google Script échouée", e);
          }
        } else {
          console.warn("⚠️ URL Google Script manquante dans les variables d'environnement");
        }
      }

      clearDraft();
      // On attend 2.5 secondes avant de rafraîchir pour laisser le temps au script Google de finir l'écriture
      setTimeout(async () => {
        await fetchDeclarations();
      }, 2500);
      
      setIsModalOpen(false);
      setShowConfirmation(false);
      setCurrentCases([]);
    } catch (error) {
      console.error("Failed to save declaration", error);
      alert("Erreur lors de la sauvegarde locale.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setSelectedFileCount(files.length);
    setIsAnalyzing(true);

    const compressImage = (file: File, maxWidth: number = 1600): Promise<string> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
          const img = new Image();
          img.src = event.target?.result as string;
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
              if (height > maxWidth) {
                width *= maxWidth / height;
                height = maxWidth;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);
            // Qualité 0.8 pour un bon compromis poids/lisibilité
            resolve(canvas.toDataURL('image/jpeg', 0.8));
          };
          img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
      });
    };

    const processFile = async (file: File): Promise<CaseData[]> => {
      try {
        const compressedBase64 = await compressImage(file);
        const extractedCases = await analyzeDeclarationImage(compressedBase64);
        return extractedCases;
      } catch (error) {
        console.error("Error processing file", error);
        return [];
      }
    };

    try {
      const allExtractedCases: CaseData[] = [];
      // Traitement séquentiel pour éviter de surcharger l'API et assurer l'ordre
      for (let i = 0; i < files.length; i++) {
        const cases = await processFile(files[i]);
        if (cases.length === 0) {
          const msg = files.length > 1 
            ? `L'image ${i + 1} ne signale aucun cas de maladie.` 
            : "L'analyse est terminée : cette fiche ne signale aucun cas de maladie.";
          
          setAnalysisMessage(msg);
          // On laisse le message s'afficher un peu avant de continuer
          await new Promise(r => setTimeout(r, 1500));
        }
        allExtractedCases.push(...cases);
      }

      // Toujours ajouter aux cas actuels pour permettre le cumul
      setCurrentCases(prev => [...prev, ...allExtractedCases]);
      setShowConfirmation(true);
      setIsModalOpen(false);
    } catch (error) {
      console.error("Upload error:", error);
      alert("Erreur lors de l'analyse des images.");
    } finally {
      setIsAnalyzing(false);
      setAnalysisMessage(null);
      setSelectedFileCount(0);
      if (e.target) e.target.value = '';
    }
  };

  const getDayStatus = (date: Date): 'validated' | 'zero_cases' | 'pending' | 'draft' => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const decl = declarations.find(d => d.date === dateStr);
    
    if (!decl) {
      const draft = drafts[dateStr];
      if (draft) return 'draft';
      return 'pending';
    }
    
    // Traduction des statuts provenant de Google ou de la base locale
    const s = String(decl.status || "").toLowerCase();
    if (s === 'validated' || s === 'validé' || s === 'valide') return 'validated';
    if (s === 'zero_cases' || s.includes('zéro cas') || s.includes('zero cas')) return 'zero_cases';
    if (s === 'draft' || s === 'brouillon') return 'draft';
    
    return 'pending';
  };

  const renderCalendar = () => {
    const monthStart = startOfMonth(viewDate);
    const monthEnd = endOfMonth(monthStart);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 pb-2 flex justify-center"
      >
        <div className="bg-white rounded-[3rem] p-5 pb-4 border border-slate-100 shadow-[0_20px_50px_rgba(0,0,0,0.04)] w-full max-w-3xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex flex-col">
              <h2 className="text-xl font-black text-slate-900 capitalize font-display tracking-tight">
                {format(viewDate, 'MMMM yyyy', { locale: fr })}
              </h2>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => setViewDate(subMonths(viewDate, 1))} 
               /// disabled={startOfMonth(viewDate) <= startOfMonth(startOfToday())}
                className={cn(
                  "p-3 bg-slate-50 border border-slate-100 rounded-2xl transition-all active:scale-90",
                  startOfMonth(viewDate) <= startOfMonth(startOfToday()) ? "hover:bg-slate-100" : "hover:bg-slate-100"
                )}
              >
                <ChevronLeft className="w-5 h-5 text-slate-600" />
              </button>
              <button onClick={() => setViewDate(addMonths(viewDate, 1))} className="p-3 bg-slate-50 border border-slate-100 hover:bg-slate-100 rounded-2xl transition-all active:scale-90">
                <ChevronRight className="w-5 h-5 text-slate-600" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2 mb-4">
            {['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'].map(day => (
              <div key={day} className="text-center text-[10px] font-black text-slate-300 uppercase tracking-widest">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {days.map((day, i) => {
              const status = getDayStatus(day);
              const isTodayDate = isToday(day);
              const isSelected = isSameDay(day, currentDate);
              const isFuture = day > startOfToday();
              const isPast = day < startOfToday();
              const decl = declarations.find(d => d.date === format(day, 'yyyy-MM-dd'));

              // Determine state
              let state: 'declared' | 'zero_cases' | 'not_declared' | 'open' | 'inactive' | 'draft' = 'inactive';
              
              if (isFuture) {
                state = 'inactive';
              } else if (status === 'validated') {
                state = 'declared';
              } else if (status === 'zero_cases') {
                state = 'zero_cases';
              } else if (status === 'draft') {
                state = 'draft';
              } else if (isTodayDate) {
                state = 'open';
              } else if (isPast && status === 'pending') {
                state = 'not_declared';
              }

              return (
                <motion.button
                  whileTap={state !== 'inactive' ? { scale: 0.9 } : {}}
                  key={day.toString()}
                  disabled={state === 'inactive'}
                  onClick={() => {
                    const clickedDate = format(day, 'yyyy-MM-dd');
                    console.log("--- Vérification de la date cliquée ---");
                    console.log("Date cliquée (formatée):", clickedDate);
                    console.log("Nombre de déclarations en mémoire:", declarations.length);
                    
                    declarations.forEach(d => {
                      const match = d.date === clickedDate;
                      console.log(`Comparaison: [${d.date}] vs [${clickedDate}] -> ${match ? "MATCH ✅" : "NO MATCH ❌"}`);
                    });

                    setCurrentDate(day);
                    const existingDecl = declarations.find(d => d.date === clickedDate);
                    
                    if (existingDecl && (existingDecl.status === 'validated' || existingDecl.status === 'zero_cases')) {
                      setViewingDeclaration(existingDecl);
                      setShowViewModal(true);
                    } else if (existingDecl && existingDecl.cases && existingDecl.cases.length > 0) {
                      setCurrentCases(existingDecl.cases);
                      setShowConfirmation(true);
                    } else {
                      setCurrentCases([]);
                      setIsModalOpen(true);
                    }
                  }}
                  className={cn(
                    "aspect-square rounded-[1.5rem] flex flex-col items-center justify-center relative transition-all border-2",
                    // DÉCLARÉ (Green)
                    (state === 'declared' || state === 'zero_cases') && "bg-[#F0FDF4] border-[#4ADE80] text-[#166534]",
                    // BROUILLON (Amber Filled)
                    state === 'draft' && "bg-[#FEF3C7] border-[#F59E0B] text-[#92400E]",
                    // NON DÉCLARÉ (Light Red Border)
                    state === 'not_declared' && "bg-white border-[#F87171] text-[#F87171]",
                    // OUVERT (Blue Border)
                    state === 'open' && "bg-white border-[#3B82F6] text-[#3B82F6]",
                    // INACTIF/PASSÉ (Gris clair)
                    state === 'inactive' && "bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed",
                    // Selection highlight
                    isSelected && "ring-4 ring-offset-2 ring-slate-900/10 z-10 scale-105"
                  )}
                >
                  <span className="text-lg font-black">
                    {format(day, 'd')}
                  </span>

                  {/* Badges */}
                  {(state === 'declared' || state === 'zero_cases' || state === 'draft') && (
                    <div className={cn(
                      "absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center border-2 border-white shadow-sm",
                      (state === 'declared' || state === 'zero_cases') ? "bg-[#4ADE80]" : "bg-[#F59E0B]"
                    )}>
                      <span className="text-[10px] font-black text-white">
                        {state === 'zero_cases' ? '0' : (decl?.cases.length || 0)}
                      </span>
                    </div>
                  )}
                  {state === 'not_declared' && (
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-white rounded-full flex items-center justify-center border-2 border-[#F87171] shadow-sm">
                      <span className="text-xs font-black text-[#F87171]">?</span>
                    </div>
                  )}
                </motion.button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-8 space-y-4">
            <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-[2rem] border border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-lg bg-[#F0FDF4] border-2 border-[#4ADE80]" />
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-tight">Déclaré</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-lg bg-white border-2 border-[#F87171]" />
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-tight">Non déclaré</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-lg bg-[#FEF3C7] border-2 border-[#F59E0B]" />
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-tight">Brouillon</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-lg bg-white border-2 border-[#3B82F6]" />
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-tight">Aujourd’hui</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  const renderSettings = () => {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-4 space-y-6">
        <div className="bg-white rounded-[2.5rem] p-6 border border-slate-100 shadow-sm">
          <h2 className="text-xl font-black text-slate-900 mb-4 font-display">Mon Compte</h2>
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Utilisateur</p>
              <p className="text-sm font-bold text-slate-700">{userId}</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Établissement</p>
              <p className="text-sm font-bold text-slate-700">{userEtablissement} ({userEtablissementId})</p>
            </div>
            <button 
              onClick={handleLogout}
              className="w-full p-4 bg-red-50 text-red-600 font-black rounded-2xl border border-red-100 hover:bg-red-100 transition-all active:scale-95"
            >
              Se déconnecter
            </button>
            <button 
              onClick={async () => {
                if (confirm("Voulez-vous vraiment effacer le cache local ? Cela ne supprimera pas vos données sur Google Sheets.")) {
                  localStorage.removeItem('sante_declic_drafts');
                  setDeclarations([]);
                  addLog("🧹 Cache local vidé.");
                  await fetchDeclarations();
                }
              }}
              className="w-full p-4 bg-slate-100 text-slate-600 font-black rounded-2xl border border-slate-200 hover:bg-slate-200 transition-all active:scale-95 text-xs"
            >
              Réinitialiser et Synchroniser
            </button>
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] p-6 border border-slate-100 shadow-sm">
          <h2 className="text-xl font-black text-slate-900 mb-4 font-display">Inspecteur de Données</h2>
          <p className="text-[10px] text-slate-400 font-bold mb-4 uppercase">Dates enregistrées pour cet établissement :</p>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {declarations.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Aucune donnée trouvée.</p>
            ) : (
              declarations.sort((a, b) => b.date.localeCompare(a.date)).map((d, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-xs font-bold text-slate-700">{format(new Date(d.date), 'dd/MM/yyyy')}</span>
                  <span className={cn(
                    "text-[8px] font-black uppercase px-2 py-1 rounded-full",
                    d.status === 'validated' ? "bg-emerald-100 text-emerald-700" : 
                    d.status === 'zero_cases' ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"
                  )}>
                    {d.status === 'validated' ? `${d.cases.length} cas` : d.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] p-6 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-black text-slate-900 font-display">Journal de Synchronisation</h2>
            <button 
              onClick={() => setSyncLog([])}
              className="text-[10px] font-black text-slate-400 uppercase hover:text-slate-600"
            >
              Effacer
            </button>
          </div>
          <div className="bg-slate-900 rounded-2xl p-4 font-mono text-[10px] text-emerald-400 h-48 overflow-y-auto space-y-1">
            {syncLog.length === 0 ? (
              <p className="text-slate-500 italic">Aucun log disponible. Cliquez sur synchroniser.</p>
            ) : (
              syncLog.map((log, i) => <p key={i}>{log}</p>)
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  const renderStats = () => {
    const validatedDeclarations = declarations.filter(d => 
      d.status === 'validated' || d.status === 'Validé' || 
      d.status === 'zero_cases' || d.status === 'Zéro cas à déclarer' || d.status === 'Zéro cas'
    );
    
    const filteredDeclarations = statsFilter === 'all' 
      ? validatedDeclarations 
      : validatedDeclarations.map(d => ({
          ...d,
          cases: d.cases.filter(c => c.pathology === statsFilter)
        })).filter(d => d.cases.length > 0 || d.status === 'zero_cases');

    const allCases = validatedDeclarations.flatMap(d => d.cases);
    const filteredCases = statsFilter === 'all' ? allCases : allCases.filter(c => c.pathology === statsFilter);
    
    const totalCases = filteredCases.length;
    const validatedDays = validatedDeclarations.length;
    
    const pathologyData = PATHOLOGIES.map(p => ({
      name: p,
      count: allCases.filter(c => c.pathology === p).length
    })).sort((a, b) => b.count - a.count);

    const ageData = AGE_GROUPS.map(a => ({
      name: a,
      count: filteredCases.filter(c => c.ageGroup === a).length
    }));

    const genderData = [
      { name: 'Masculin', count: filteredCases.filter(c => c.sex === 'M').length },
      { name: 'Féminin', count: filteredCases.filter(c => c.sex === 'F').length }
    ];

    // Trend data
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const dateStr = format(d, 'yyyy-MM-dd');
      const decl = validatedDeclarations.find(dec => dec.date === dateStr);
      const cases = decl?.cases || [];
      return {
        date: format(d, 'dd/MM'),
        count: statsFilter === 'all' ? cases.length : cases.filter(c => c.pathology === statsFilter).length
      };
    });

    const COLORS = ['#0056b3', '#28a745', '#ffc107', '#dc3545', '#6610f2', '#fd7e14'];

    return (
      <div className="p-4 space-y-6 pb-24 max-w-5xl mx-auto">
        {/* Stats Filter */}
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar justify-center">
          <button 
            onClick={() => setStatsFilter('all')}
            className={cn(
              "px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border",
              statsFilter === 'all' ? "bg-medical-primary text-white border-medical-primary shadow-md" : "bg-white text-gray-500 border-gray-200"
            )}
          >
            Toutes les pathologies
          </button>
          {PATHOLOGIES.map(p => (
            <button 
              key={p}
              onClick={() => setStatsFilter(p)}
              className={cn(
                "px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border",
                statsFilter === p ? "bg-medical-primary text-white border-medical-primary shadow-md" : "bg-white text-gray-500 border-gray-200"
              )}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-3 gap-4 px-2 max-w-2xl mx-auto">
          <div className="flex flex-col items-center text-center">
            <div className="text-4xl font-black tracking-tighter text-slate-900 font-display">{totalCases}</div>
            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Total Cas</div>
          </div>
          <div className="flex flex-col items-center text-center">
            <div className="text-4xl font-black tracking-tighter text-slate-900 font-display">{validatedDays}</div>
            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Jours</div>
          </div>
          <div className="flex flex-col items-center text-center">
            <div className="text-4xl font-black tracking-tighter text-medical-accent font-display">
              {totalCases > 0 ? (filteredCases.filter(c => c.sex === 'F').length / totalCases * 100).toFixed(0) : 0}%
            </div>
            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Femmes</div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Trend Chart */}
          <div className="medical-card p-10">
            <div className="flex items-center justify-between mb-10">
              <div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Évolution temporelle</h3>
                <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">Derniers 7 jours</p>
              </div>
              <div className="w-10 h-10 bg-medical-primary/10 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-medical-primary" />
              </div>
            </div>
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={last7Days}>
                  <CartesianGrid strokeDasharray="0" vertical={false} stroke="#F1F5F9" />
                  <XAxis 
                    dataKey="date" 
                    fontSize={10} 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94A3B8', fontWeight: 700 }} 
                    dy={15} 
                  />
                  <YAxis 
                    fontSize={10} 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94A3B8', fontWeight: 700 }} 
                  />
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '24px', 
                      border: 'none', 
                      boxShadow: '0 20px 40px rgba(0,0,0,0.08)', 
                      fontSize: '11px',
                      fontWeight: '900',
                      padding: '16px'
                    }}
                    cursor={{ stroke: '#059669', strokeWidth: 2, strokeDasharray: '6 6' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="count" 
                    stroke="#059669" 
                    strokeWidth={5} 
                    dot={{ r: 0 }}
                    activeDot={{ r: 8, fill: '#059669', stroke: '#fff', strokeWidth: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Pathology Distribution (Only if 'all' is selected) */}
          {statsFilter === 'all' && (
            <div className="medical-card p-6">
              <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-medical-primary" />
                Répartition par Pathologie
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pathologyData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" fontSize={10} width={100} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: 'rgba(0,86,179,0.05)' }} />
                    <Bar dataKey="count" fill="#0056b3" radius={[0, 4, 4, 0]} barSize={20}>
                      {pathologyData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Demographics Split */}
          <div className="medical-card p-6">
            <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
              <User className="w-4 h-4 text-medical-primary" />
              Profil Démographique
            </h3>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="h-48 w-full sm:w-1/2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={ageData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={5}
                      dataKey="count"
                    >
                      {ageData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-full sm:w-1/2 space-y-2">
                {ageData.map((entry, index) => (
                  <div key={entry.name} className="flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                      <span className="text-gray-500 font-medium">{entry.name}</span>
                    </div>
                    <span className="font-bold text-gray-700">{entry.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Gender Split */}
          <div className="medical-card p-6">
            <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-medical-primary" />
              Répartition par Sexe
            </h3>
            <div className="flex items-center justify-around py-2">
              {genderData.map((g, i) => (
                <div key={g.name} className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center",
                    i === 0 ? "bg-emerald-50 text-emerald-600" : "bg-orange-50 text-orange-500"
                  )}>
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-lg font-bold leading-none">{g.count}</div>
                    <div className="text-[8px] font-bold text-gray-400 uppercase">{g.name}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex h-2.5 rounded-full overflow-hidden bg-gray-100">
              <div 
                className="bg-emerald-500 h-full transition-all duration-700" 
                style={{ width: `${(genderData[0].count / (totalCases || 1)) * 100}%` }}
              />
              <div 
                className="bg-orange-500 h-full transition-all duration-700" 
                style={{ width: `${(genderData[1].count / (totalCases || 1)) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Completion Rate */}
        <div className="medical-card p-6 bg-gradient-to-br from-white to-medical-secondary/20">
          <div className="flex justify-between items-end mb-3">
            <div>
              <h3 className="text-sm font-bold text-gray-700">Taux de Complétion</h3>
              <p className="text-[10px] text-gray-400">Objectif mensuel de déclaration</p>
            </div>
            <span className="text-sm font-black text-medical-primary">
              {((declarations.length / 30) * 100).toFixed(0)}%
            </span>
          </div>
          <div className="bg-gray-200/50 h-3 rounded-full overflow-hidden p-0.5">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${(declarations.length / 30) * 100}%` }}
              className="bg-medical-primary h-full rounded-full shadow-[0_0_10px_rgba(5,150,105,0.3)]"
            />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="bg-white/60 p-2 rounded-lg border border-gray-100">
              <div className="text-xs font-bold text-gray-700">{declarations.filter(d => d.status === 'zero_cases').length}</div>
              <div className="text-[8px] text-gray-400 uppercase font-bold">Zéro cas à déclarer</div>
            </div>
            <div className="bg-white/60 p-2 rounded-lg border border-gray-100">
              <div className="text-xs font-bold text-medical-primary">{validatedDays}</div>
              <div className="text-[8px] text-gray-400 uppercase font-bold">Validés</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (!isLoggedIn) {
    return (
      <div className="h-screen h-[100dvh] bg-slate-50 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        {/* Decorative Background Elements */}
        <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-medical-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-[-10%] left-[-10%] w-64 h-64 bg-medical-accent/5 rounded-full blur-3xl" />
        
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="w-full max-w-md space-y-4 relative z-10"
        >
          {/* Logos Section */}
          <div className="flex justify-between items-center px-2">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-col items-center text-center space-y-2"
            >
              <div className="w-16 h-16 bg-white rounded-[1.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex items-center justify-center p-2">
                <img src="https://res.cloudinary.com/dt70aqnll/image/upload/v1772012947/logo_uboegy.png" alt="ANS" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
              </div>
              <span className="text-[8px] font-extrabold text-slate-400 uppercase leading-tight tracking-wider">Agence nationale de<br/>sécurité sanitaire</span>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-col items-center text-center space-y-2"
            >
              <div className="w-16 h-16 bg-white rounded-[1.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex items-center justify-center p-2">
                <img src="https://res.cloudinary.com/dt70aqnll/image/upload/v1772012947/sante-2_uesgk6.jpg" alt="Ministère" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
              </div>
              <span className="text-[8px] font-extrabold text-slate-400 uppercase leading-tight tracking-wider">Ministère de<br/>la Santé</span>
            </motion.div>
          </div>

          <div className="text-center space-y-2">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.5, type: "spring" }}
              className="w-24 h-24 bg-gradient-to-tr from-emerald-500 to-teal-600 rounded-[2.5rem] flex items-center justify-center mx-auto shadow-[0_20px_40px_rgba(16,185,129,0.3)] mb-6 relative group overflow-hidden"
            >
              <SanteDeclicLogo className="w-14 h-14 relative z-10" />
            </motion.div>

            <h1 className="text-3xl font-black text-medical-text tracking-tighter font-display">SantéDéclic</h1>
            <p className="text-slate-500 text-xs font-medium px-8">Portail de déclaration sécurisé pour les professionnels de santé</p>
          </div>

          <div className="medical-card p-6 space-y-6 border-none">
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Email professionnel</label>
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-medical-primary transition-colors" />
                  <input 
                    type="email" 
                    placeholder="docteur@ms-gov.dz"
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border-2 border-transparent focus:border-medical-primary/20 focus:bg-white rounded-xl outline-none transition-all font-semibold text-slate-700 placeholder:text-slate-300 text-sm"
                    value={loginForm.email}
                    onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Mot de passe</label>
                <div className="relative group">
                  <AlertCircle className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-medical-primary transition-colors" />
                  <input 
                    type="password" 
                    placeholder="••••••••"
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border-2 border-transparent focus:border-medical-primary/20 focus:bg-white rounded-xl outline-none transition-all font-semibold text-slate-700 placeholder:text-slate-300 text-sm"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  />
                </div>
              </div>
            </div>

            {loginError && (
              <p className="text-red-500 text-[10px] text-center font-bold bg-red-50 p-3 rounded-xl border border-red-100">
                {loginError}
              </p>
            )}

            <button 
              onClick={handleLogin}
              disabled={isSyncing}
              className="w-full py-4 bg-medical-primary text-white font-bold rounded-full shadow-xl shadow-medical-primary/20 active:scale-[0.97] transition-all hover:bg-slate-800 text-sm flex items-center justify-center gap-2"
            >
              {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {isSyncing ? "Vérification..." : "Accéder au portail"}
            </button>

            <div className="text-center">
              <button className="text-[10px] font-bold text-medical-primary hover:text-medical-text transition-colors underline underline-offset-4 decoration-2 decoration-medical-primary/20">
                Problème d'accès ?
              </button>
            </div>
          </div>

          <p className="text-center text-[9px] text-slate-400 font-bold leading-relaxed">
            © 2026 Agence nationale de sécurité sanitaire.<br/>
            Accès strictement réservé au personnel médical autorisé.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-screen h-[100dvh] bg-medical-bg flex flex-col font-sans overflow-hidden">
      {/* Header */}
      <header className="bg-white p-4 sticky top-0 z-40 border-b border-slate-50">
        <div className="max-w-screen-xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Square logos */}
            <div className="flex items-center -space-x-3">
              <div className="w-10 h-10 bg-white rounded-xl p-1.5 shadow-sm border border-slate-100 flex items-center justify-center">
                <img 
                  src="https://res.cloudinary.com/dt70aqnll/image/upload/v1772012947/logo_uboegy.png" 
                  alt="Logo 1" 
                  className="w-full h-full object-contain" 
                  referrerPolicy="no-referrer" 
                />
              </div>
              <div className="w-10 h-10 bg-white rounded-xl p-1.5 shadow-sm border border-slate-100 flex items-center justify-center">
                <img 
                  src="https://res.cloudinary.com/dt70aqnll/image/upload/v1772012947/sante-2_uesgk6.jpg" 
                  alt="Logo 2" 
                  className="w-full h-full object-contain" 
                  referrerPolicy="no-referrer" 
                />
              </div>
            </div>
            
            {/* App Name and Status */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-tr from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20 overflow-hidden">
                <SanteDeclicLogo className="w-7 h-7" />
              </div>
              <div className="flex flex-col">
                <h1 className="text-lg font-black text-medical-text tracking-tight leading-none font-display">SantéDéclic</h1>
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-2 h-2 rounded-full bg-[#4ADE80] shadow-[0_0_8px_rgba(74,222,128,0.5)]" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.1em]">{userEtablissement}</span>
                  {isSyncing && (
                    <div className="flex items-center gap-1 ml-2">
                      <RefreshCw className="w-2 h-2 text-medical-primary animate-spin" />
                      <span className="text-[8px] font-bold text-medical-primary uppercase tracking-tighter">Sync...</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Profile Button */}
          <div className="relative">
            <button 
              onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              className="w-14 h-14 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-all border border-slate-100 active:scale-95"
            >
              <User className="w-7 h-7" />
            </button>

            <AnimatePresence>
              {isProfileMenuOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setIsProfileMenuOpen(false)} 
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-3 w-56 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden"
                  >
                    <div className="p-4 border-b border-slate-50 bg-slate-50/50">
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Connecté en tant que</p>
                      <p className="text-sm font-bold text-slate-900 mt-1">{userId}</p>
                      <p className="text-[10px] font-bold text-medical-primary uppercase tracking-tight mt-1">{userEtablissement}</p>
                    </div>
                    <div className="p-2">
                      <button 
                        onClick={async () => {
                          setIsProfileMenuOpen(false);
                          await fetchDeclarations();
                        }}
                        className="w-full flex items-center gap-3 p-3 text-sm font-bold text-medical-primary hover:bg-emerald-50 rounded-xl transition-colors"
                      >
                        <RefreshCw className={cn("w-4 h-4", isSyncing && "animate-spin")} />
                        Synchroniser
                      </button>
                      <button className="w-full flex items-center gap-3 p-3 text-sm font-bold text-slate-600 hover:bg-slate-50 rounded-xl transition-colors">
                        <Settings className="w-4 h-4" />
                        Paramètres
                      </button>
                      <button className="w-full flex items-center gap-3 p-3 text-sm font-bold text-slate-600 hover:bg-slate-50 rounded-xl transition-colors">
                        <KeyRound className="w-4 h-4" />
                        Modifier mot de passe
                      </button>
                      <button 
                        onClick={() => {
                          fetchDeclarations();
                          setIsProfileMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-3 p-3 text-sm font-bold text-medical-primary hover:bg-medical-secondary rounded-xl transition-colors"
                      >
                        <RefreshCw className={cn("w-4 h-4", isSyncing && "animate-spin")} />
                        Synchroniser les données
                      </button>
                      <div className="h-px bg-slate-50 my-2" />
                      <button 
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 p-3 text-sm font-bold text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        Déconnexion
                      </button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-screen-xl mx-auto w-full">
          {activeTab === 'calendar' ? renderCalendar() : activeTab === 'stats' ? renderStats() : renderSettings()}
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="bg-white p-2 flex justify-around items-center sticky bottom-0 z-10">
        <div className="max-w-screen-xl mx-auto w-full flex justify-around items-center">
        <button 
          onClick={() => {
            console.log("--- DEBUG: Matching Etablissement & Déclarations ---");
            console.log("Établissement de l'utilisateur:", userEtablissement);
            console.log("ID Établissement:", userEtablissementId);
            console.log("Nombre total de déclarations chargées:", declarations.length);
            
            if (declarations.length > 0) {
              console.log("Détails des déclarations en mémoire:");
              declarations.forEach((d, i) => {
                console.log(`${i+1}. Date: ${d.date} | Status: ${d.status} | Cas: ${d.cases?.length || 0}`);
              });
            } else {
              console.log("⚠️ Aucune déclaration n'est actuellement en mémoire pour cet établissement.");
            }
            
            setActiveTab('calendar');
          }}
          className={cn(
            "flex flex-col items-center p-2 rounded-xl transition-colors",
            activeTab === 'calendar' ? "text-medical-primary bg-medical-secondary" : "text-gray-400"
          )}
        >
          <CalendarIcon className="w-6 h-6" />
          <span className="text-[10px] font-bold mt-1">Calendrier</span>
        </button>
        <button 
          onClick={() => setActiveTab('stats')}
          className={cn(
            "flex flex-col items-center p-2 rounded-xl transition-colors",
            activeTab === 'stats' ? "text-medical-primary bg-medical-secondary" : "text-gray-400"
          )}
        >
          <BarChart3 className="w-6 h-6" />
          <span className="text-[10px] font-bold mt-1">Analyses</span>
        </button>
        <button 
          onClick={() => setActiveTab('settings')}
          className={cn(
            "flex flex-col items-center p-2 rounded-xl transition-colors",
            activeTab === 'settings' ? "text-medical-primary bg-medical-secondary" : "text-gray-400"
          )}
        >
          <Settings className="w-6 h-6" />
          <span className="text-[10px] font-bold mt-1">Paramètres</span>
        </button>
        </div>
      </nav>

      {/* Declaration Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="relative w-full max-w-sm bg-white rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl"
            >
              <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6 sm:hidden" />
              <h2 className="text-xl font-bold text-medical-blue mb-2">
                Déclaration du {format(currentDate, 'dd/MM/yyyy')}
              </h2>
              <p className="text-gray-500 text-sm mb-6">
                Veuillez choisir le type de déclaration pour cette journée.
              </p>

              <div className="grid gap-3">
                <button 
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex items-center gap-4 p-4 border-2 border-medical-primary rounded-2xl hover:bg-medical-secondary transition-colors text-left"
                >
                  <div className="w-12 h-12 bg-medical-primary rounded-xl flex items-center justify-center text-white">
                    <Camera className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="font-bold text-medical-primary">Prendre une photo</div>
                    <div className="text-xs text-gray-500">Utiliser l'appareil photo en direct</div>
                  </div>
                </button>

                <button 
                  onClick={() => galleryInputRef.current?.click()}
                  className="flex items-center gap-4 p-4 border-2 border-gray-100 rounded-2xl hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="w-12 h-12 bg-medical-secondary rounded-xl flex items-center justify-center text-medical-primary">
                    <Plus className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="font-bold text-gray-700">Choisir de la galerie</div>
                    <div className="text-xs text-gray-500">Sélectionner plusieurs images</div>
                  </div>
                </button>

                <button 
                  onClick={() => {
                    setIsModalOpen(false);
                    setShowManualEntry(true);
                  }}
                  className="flex items-center gap-4 p-4 border-2 border-gray-100 rounded-2xl hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
                    <Plus className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="font-bold text-gray-700">Saisie manuelle</div>
                    <div className="text-xs text-gray-500">Écrire les détails manuellement</div>
                  </div>
                </button>

                <button 
                  onClick={() => saveDeclaration('zero_cases')}
                  className="flex items-center gap-4 p-4 border-2 border-gray-100 rounded-2xl hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center text-gray-400">
                    <XCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="font-bold text-gray-500">Zéro cas à déclarer</div>
                    <div className="text-xs text-gray-500">Rien à signaler pour ce jour</div>
                  </div>
                </button>
              </div>

              <input 
                type="file" 
                ref={cameraInputRef} 
                className="hidden" 
                accept="image/*" 
                capture="environment"
                onChange={handleImageUpload}
              />
              <input 
                type="file" 
                ref={galleryInputRef} 
                className="hidden" 
                accept="image/*" 
                multiple
                onChange={handleImageUpload}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Analysis Overlay */}
      <AnimatePresence>
        {isAnalyzing && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-medical-primary/90 backdrop-blur-md text-white p-8">
            <div className="text-center">
              {analysisMessage ? (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-white/20 p-6 rounded-3xl backdrop-blur-lg border border-white/30"
                >
                  <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-white" />
                  <h2 className="text-xl font-bold mb-2">{analysisMessage}</h2>
                </motion.div>
              ) : (
                <>
                  <Loader2 className="w-16 h-16 animate-spin mx-auto mb-4" />
                  <h2 className="text-2xl font-bold mb-2">Analyse en cours...</h2>
                  <p className="opacity-80">
                    L'IA SantéDéclic extrait les données de vos {selectedFileCount > 1 ? `${selectedFileCount} fiches` : 'fiche'}.
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Manual Entry Modal */}
      <AnimatePresence>
        {showManualEntry && (
          <div className="fixed inset-0 z-[75] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl"
            >
              <h2 className="text-xl font-bold text-medical-primary mb-6">Saisie manuelle d'un cas</h2>
              
              <div className="space-y-4 mb-8">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Pathologie</label>
                  <select 
                    value={manualCase.pathology}
                    onChange={(e) => setManualCase({ ...manualCase, pathology: e.target.value as any })}
                    className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:border-medical-primary transition-all font-semibold"
                  >
                    {PATHOLOGIES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Âge</label>
                    <select 
                      value={manualCase.ageGroup}
                      onChange={(e) => setManualCase({ ...manualCase, ageGroup: e.target.value as any })}
                      className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:border-medical-primary transition-all font-semibold"
                    >
                      {AGE_GROUPS.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Sexe</label>
                    <select 
                      value={manualCase.sex}
                      onChange={(e) => setManualCase({ ...manualCase, sex: e.target.value as any })}
                      className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:border-medical-primary transition-all font-semibold"
                    >
                      {SEXES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setShowManualEntry(false)}
                  className="flex-1 py-4 bg-gray-100 text-gray-600 font-bold rounded-2xl"
                >
                  Annuler
                </button>
                <button 
                  onClick={() => {
                    setCurrentCases([...currentCases, manualCase]);
                    setShowManualEntry(false);
                    setShowConfirmation(true);
                  }}
                  className="flex-1 py-4 bg-medical-primary text-white font-bold rounded-2xl"
                >
                  Ajouter
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirmation && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl max-h-[80vh] flex flex-col"
            >
              <h2 className="text-xl font-bold text-medical-primary mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Info className="w-5 h-5" />
                  Vérification ({format(currentDate, 'dd/MM/yyyy')})
                </div>
                {currentCases.length > 0 && (
                  <span className="text-xs bg-medical-secondary text-medical-primary px-3 py-1 rounded-full">
                    {currentCases.length} cas
                  </span>
                )}
              </h2>
              
              <div className="flex-1 overflow-y-auto space-y-4 mb-6 pr-2">
                {currentCases.length === 0 ? (
                  <div className="text-center py-8 px-4">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 className="w-8 h-8 text-medical-blue" />
                    </div>
                    <p className="text-gray-600 font-medium">
                      L'analyse est terminée : cette fiche ne signale aucun cas de maladie.
                    </p>
                    <p className="text-gray-400 text-sm mt-2">
                      Vous pouvez valider cette journée comme "Zéro Cas" ou ajouter des cas manuellement.
                    </p>
                  </div>
                ) : (
                  currentCases.map((c, idx) => (
                    <div key={idx} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 relative group">
                      <button 
                        onClick={() => setCurrentCases(prev => prev.filter((_, i) => i !== idx))}
                        className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase">Pathologie</label>
                          <select 
                            value={c.pathology}
                            onChange={(e) => {
                              const newCases = [...currentCases];
                              newCases[idx].pathology = e.target.value as any;
                              setCurrentCases(newCases);
                            }}
                            className="w-full bg-transparent font-semibold text-medical-primary outline-none"
                          >
                            {PATHOLOGIES.map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase">Âge / Sexe</label>
                          <div className="flex gap-2">
                            <select 
                              value={c.ageGroup}
                              onChange={(e) => {
                                const newCases = [...currentCases];
                                newCases[idx].ageGroup = e.target.value as any;
                                setCurrentCases(newCases);
                              }}
                              className="bg-transparent font-semibold text-gray-700 outline-none"
                            >
                              {AGE_GROUPS.map(a => <option key={a} value={a}>{a}</option>)}
                            </select>
                            <select 
                              value={c.sex}
                              onChange={(e) => {
                                const newCases = [...currentCases];
                                newCases[idx].sex = e.target.value as any;
                                setCurrentCases(newCases);
                              }}
                              className="bg-transparent font-semibold text-gray-700 outline-none"
                            >
                              {SEXES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
                
                <button 
                  onClick={() => {
                    setShowConfirmation(false);
                    setIsModalOpen(true);
                  }}
                  className="w-full py-3 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 font-bold hover:border-medical-primary hover:text-medical-primary transition-all flex items-center justify-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Ajouter d'autres cas
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => {
                    setShowConfirmation(false);
                    setCurrentCases([]);
                  }}
                  className="py-4 bg-gray-100 text-gray-600 font-bold rounded-2xl"
                >
                  Annuler
                </button>
                <button 
                  onClick={saveDraft}
                  className="py-4 bg-amber-50 text-amber-600 font-bold rounded-2xl border border-amber-200"
                >
                  Sauvegarder
                </button>
                <button 
                  onClick={() => saveDeclaration(currentCases.length === 0 ? 'zero_cases' : 'validated', currentCases)}
                  className={cn(
                    "col-span-2 py-5 text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg",
                    currentCases.length === 0 
                      ? "bg-medical-blue shadow-medical-blue/20" 
                      : "bg-medical-primary shadow-medical-primary/20"
                  )}
                >
                  <CheckCircle2 className="w-6 h-6" />
                  {currentCases.length === 0 ? "Valider comme Zéro Cas" : "Valider la journée"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* View Declaration Modal */}
      <AnimatePresence>
        {showViewModal && viewingDeclaration && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowViewModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl max-h-[80vh] flex flex-col"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-medical-primary">
                  Déclaration du {format(new Date(viewingDeclaration.date), 'd MMMM yyyy', { locale: fr })}
                </h2>
                <button 
                  onClick={() => setShowViewModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-full"
                >
                  <XCircle className="w-6 h-6 text-gray-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                <div className={cn(
                  "p-4 rounded-2xl flex items-center gap-3",
                  viewingDeclaration.status === 'validated' ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-50 text-slate-700 border border-slate-200"
                )}>
                  {viewingDeclaration.status === 'validated' ? (
                    <CheckCircle2 className="w-6 h-6" />
                  ) : (
                    <XCircle className="w-6 h-6" />
                  )}
                  <div>
                    <div className="font-bold">
                      {viewingDeclaration.status === 'validated' ? "Cas déclarés" : "Zéro cas déclaré"}
                    </div>
                    <div className="text-xs opacity-80">
                      {viewingDeclaration.status === 'validated' ? `${viewingDeclaration.cases.length} cas enregistrés` : "Aucun incident à signaler"}
                    </div>
                  </div>
                </div>

                {viewingDeclaration.cases.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1">Détails des cas</h3>
                    {viewingDeclaration.cases.map((c, idx) => (
                      <div key={idx} className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-bold text-medical-primary">{c.pathology}</span>
                          <span className="text-[10px] bg-white px-2 py-1 rounded-full border border-gray-200 font-bold text-gray-500">
                            Cas #{idx + 1}
                          </span>
                        </div>
                        <div className="flex gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {c.sex === 'M' ? 'Masculin' : 'Féminin'}
                          </div>
                          <div className="flex items-center gap-1">
                            <CalendarIcon className="w-3 h-3" />
                            {c.ageGroup}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button 
                onClick={() => setShowViewModal(false)}
                className="mt-6 w-full py-4 bg-medical-primary text-white font-bold rounded-2xl shadow-lg shadow-medical-primary/20"
              >
                Fermer
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
