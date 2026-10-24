import React, { useState, useRef, useEffect } from 'react';
import { transcribeRemote, detectClips, buildClips } from './lib/transcribe.js';
import { exportClip as runExport } from './lib/exporter.js';
import { predictClips, fmtNum } from './lib/predict.js';
import PredictorTab from './PredictorTab.jsx';
import Timeline from './Timeline.jsx';
import PreviewFX from './PreviewFX.jsx';
import EffectsPanel from './EffectsPanel.jsx';
import { autoEffects, DEFAULT_SETTINGS } from './lib/effects.js';
import { 
  Play, Pause, Volume2, VolumeX, Upload, Link as LinkIcon, Sparkles, 
  Video, Scissors, Type, Layout, Wand2, Download, Share2, Eye, 
  TrendingUp, Clock, FileText, CheckCircle2, ChevronRight, Settings, 
  Layers, Smile, Music, Plus, RefreshCw, Maximize2, Hash, Flame,
  Search, Sliders, Check, Copy, ExternalLink, Zap, BarChart2, MessageSquare,
  Instagram, Youtube, Twitter, Linkedin, Smartphone, Monitor, Square,
  Calendar, Circle, Trash2, Undo2, Menu, X, Captions, LayoutGrid
} from 'lucide-react';

// Sample Videos Mock Data
const SAMPLE_VIDEOS = [
  {
    id: 'sample-1',
    title: 'The Future of AI & Tech Startups in 2026',
    duration: '14:25',
    category: 'Podcast Episode',
    thumbnail: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&w=600&q=80',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
  },
  {
    id: 'sample-2',
    title: 'Mastering Modern UI/UX Design Trends',
    duration: '22:10',
    category: 'Webinar',
    thumbnail: 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=600&q=80',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4'
  },
  {
    id: 'sample-3',
    title: 'Building Scalable SaaS Applications',
    duration: '08:45',
    category: 'Tech Talk',
    thumbnail: 'https://images.unsplash.com/photo-1515187029135-18ee286d815b?auto=format&fit=crop&w=600&q=80',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'
  }
];

// Sample AI Transcript Data with timed words & viral highlights
const INITIAL_TRANSCRIPT = [
  { id: 1, start: 0.5, end: 3.2, speaker: 'Speaker 1', text: 'If you are not using artificial intelligence in your workflow today,', isViral: false },
  { id: 2, start: 3.3, end: 6.8, speaker: 'Speaker 1', text: 'you are literally falling behind 90% of your competitors right now!', isViral: true, viralScore: 98, topic: 'Mindset Hook' },
  { id: 3, start: 7.0, end: 11.4, speaker: 'Speaker 2', text: 'That is so true! The shift happening in content creation is faster than anything we saw with mobile or cloud.', isViral: false },
  { id: 4, start: 11.5, end: 16.2, speaker: 'Speaker 2', text: 'Here is the secret shortcut: repurposing long form videos into 10 viral short videos in under two minutes.', isViral: true, viralScore: 95, topic: 'Growth Hack' },
  { id: 5, start: 16.5, end: 20.1, speaker: 'Speaker 1', text: 'Exactly. People do not have time to watch 60-minute webinars anymore.', isViral: false },
  { id: 6, start: 20.3, end: 25.8, speaker: 'Speaker 1', text: 'Give them the golden nuggets in 30 seconds with animated bold subtitles, dynamic emojis, and instant hooks.', isViral: true, viralScore: 92, topic: 'Engagement Strategy' },
  { id: 7, start: 26.0, end: 30.5, speaker: 'Speaker 2', text: 'And that is precisely how creator channels scale from 0 to 1 million followers on TikTok and Instagram Reels.', isViral: false }
];

// AI Generated Clips Mock Data
const INITIAL_CLIPS = [
  {
    id: 'clip-1',
    title: 'Why AI will ruin your startup if you ignore it! 🚨',
    duration: '00:28',
    viralScore: 98,
    hookScore: 'High Hook',
    transcriptSnippet: 'You are literally falling behind 90% of your competitors right now...',
    aspectRatio: '9:16',
    hookText: 'Stop making this massive mistake in 2026! 🔥',
    hashtags: '#SaaS #AI #StartupTips #Productivity #TechNews',
    thumbnail: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&w=400&q=80',
    startTime: 3.3,
    endTime: 31.3
  },
  {
    id: 'clip-2',
    title: 'The 2-Minute Repurposing Shortcut ⚡',
    duration: '00:45',
    viralScore: 95,
    hookScore: 'Very High',
    transcriptSnippet: 'Repurposing long form videos into 10 viral short videos in under two minutes...',
    aspectRatio: '9:16',
    hookText: 'How top creators generate 10x more content easily 📈',
    hashtags: '#ContentCreation #ViralShorts #ReelsTips #Marketing',
    thumbnail: 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=400&q=80',
    startTime: 11.5,
    endTime: 56.5
  },
  {
    id: 'clip-3',
    title: 'Nobody watches 60-minute webinars anymore! ⌛',
    duration: '00:32',
    viralScore: 91,
    hookScore: 'Moderate',
    transcriptSnippet: 'Give them the golden nuggets in 30 seconds with animated subtitles...',
    aspectRatio: '9:16',
    hookText: 'Short form content is officially king in 2026 👑',
    hashtags: '#Shorts #TikTokStrategy #GrowthHacks #SaaSMarketing',
    thumbnail: 'https://images.unsplash.com/photo-1515187029135-18ee286d815b?auto=format&fit=crop&w=400&q=80',
    startTime: 20.3,
    endTime: 52.3
  }
];

// Caption Styles Preset Definitions
const CAPTION_PRESETS = [
  { id: 'hormozi', name: 'Alex Hormozi Style', description: 'Bold bouncy yellow/green text with heavy shadows', font: 'Impact', color: '#FFFFFF', highlightColor: '#FFE600', badgeBg: 'transparent' },
  { id: 'submagic', name: 'Submagic Glow', description: 'Neon vibrant captions with smooth scale animation', font: 'Inter', color: '#FFFFFF', highlightColor: '#A855F7', badgeBg: 'rgba(168,85,247,0.2)' },
  { id: 'karaoke', name: 'Karaoke Active', description: 'Word by word highlight sync with backlight', font: 'Montserrat', color: '#D1D5DB', highlightColor: '#22C55E', badgeBg: '#111827' },
  { id: 'clean', name: 'Clean Minimalist', description: 'Modern sleek sans-serif subtitle overlay', font: 'System-UI', color: '#FFFFFF', highlightColor: '#3B82F6', badgeBg: 'transparent' },
  { id: 'podcast', name: 'Podcast Bold Badge', description: 'Dark padded box behind high contrast text', font: 'Poppins', color: '#F97316', highlightColor: '#FFFFFF', badgeBg: '#000000' }
];

const NAV_ITEMS = [
  ['upload', Upload, 'Import Video'],
  ['workspace', Scissors, 'Editor Workspace'],
  ['clips', Flame, 'Viral Clips'],
  ['brand', Type, 'Brand & Subtitles'],
  ['templates', Layout, 'Templates'],
  ['record', Video, 'Record'],
  ['schedule', Calendar, 'Schedule'],
  ['projects', FileText, 'Projects'],
  ['predictor', TrendingUp, 'Predictor'],
  ['features', LayoutGrid, 'Features'],
];

const FEATURES = [
  { icon: Sparkles, title: 'Auto Viral Effects', desc: 'One click adds punch zooms, shake, flash, emoji pops and a hook title, timed to your transcript. Pick Subtle, Balanced or Wild.', tab: 'workspace', cta: 'Add effects', color: 'text-fuchsia-400' },
  { icon: Layers, title: 'Multi-Track Timeline', desc: 'Scrub, trim the clip, and drag or resize every effect on its own track. Preview is live; export burns it all in.', tab: 'workspace', cta: 'Open timeline', color: 'text-violet-400' },
  { icon: Captions, title: 'Animated Word Captions', desc: 'Word-by-word highlight with pop animation, plus a progress bar and punchy color grade.', tab: 'workspace', cta: 'Style captions', color: 'text-yellow-400' },
  { icon: TrendingUp, title: 'View Predictor (ML)', desc: 'Trains on your own posted clips (ridge + gradient boosting, cross-validated) to estimate a view range and your percentile. Says so when it finds no pattern.', tab: 'predictor', cta: 'Open predictor', color: 'text-emerald-400' },
  { icon: Zap, title: 'Hook Score & Fix Tips', desc: 'Instant 0-100 hook style score per clip, with concrete tips to strengthen the opening.', tab: 'clips', cta: 'See scores', color: 'text-amber-400' },
  { icon: Clock, title: 'Best Posting Hours', desc: 'Once the model has 60+ posts it suggests the hours that worked best for you.', tab: 'predictor', cta: 'Find hours', color: 'text-cyan-400' },
  { icon: Upload, title: 'CSV Import / Export', desc: 'Bootstrap the model by importing your past posts, and export your data any time.', tab: 'predictor', cta: 'Import posts', color: 'text-pink-400' },
  { icon: Wand2, title: 'AI Auto Clipping', desc: 'Whisper transcribes your video and an ML model scores every moment to pull out the most viral clips.', tab: 'upload', cta: 'Import a video', color: 'text-purple-400' },
  { icon: Maximize2, title: 'Fit / Fill Framing', desc: 'Show the complete video inside 9:16, 1:1 or 16:9 frames (Fit), or crop to fill the frame (Fill). Applies to preview and export.', tab: 'workspace', cta: 'Open editor', color: 'text-sky-400' },
  { icon: FileText, title: 'Text-Based Editing', desc: 'Click any transcript line to jump to it, edit the words, or delete a line to cut it from the video.', tab: 'workspace', cta: 'Open editor', color: 'text-emerald-400' },
  { icon: Scissors, title: 'Precise Trim Controls', desc: 'Drag start/end sliders to fine-tune each clip, with optional loop-clip-only preview.', tab: 'workspace', cta: 'Trim a clip', color: 'text-pink-400' },
  { icon: Captions, title: 'Captions & SRT Export', desc: 'Caption style presets, remove filler words in one click, download .srt subtitles, and burn captions into exported MP4s.', tab: 'brand', cta: 'Brand & subtitles', color: 'text-yellow-400' },
  { icon: Flame, title: 'Viral Score & Hooks', desc: 'Every clip gets a viral score, a suggested hook and hashtags you can copy in one tap.', tab: 'clips', cta: 'View clips', color: 'text-orange-400' },
  { icon: Layout, title: 'Layout Templates', desc: 'Single speaker, split screen or screen + webcam layouts for podcasts, interviews and demos.', tab: 'templates', cta: 'Browse templates', color: 'text-indigo-400' },
  { icon: Video, title: 'Screen Recorder', desc: 'Record your screen with audio and send it straight into AI clipping.', tab: 'record', cta: 'Start recording', color: 'text-red-400' },
  { icon: LinkIcon, title: 'Link Import', desc: 'Paste a YouTube, Vimeo, Twitch or X link and the backend downloads it for you (needs yt-dlp).', tab: 'upload', cta: 'Import from link', color: 'text-cyan-400' },
  { icon: Calendar, title: 'Scheduler & AI Captions', desc: 'Generate platform-specific captions for TikTok, Reels, Shorts, LinkedIn and X, then queue posts on a calendar.', tab: 'schedule', cta: 'Open scheduler', color: 'text-teal-400' },
  { icon: Download, title: 'In-Browser MP4 Export', desc: 'Cut, reframe and caption clips locally with ffmpeg.wasm. Nothing leaves your machine.', tab: 'clips', cta: 'Export a clip', color: 'text-lime-400' },
  { icon: FileText, title: 'Projects', desc: 'Save projects locally and come back to them later.', tab: 'projects', cta: 'View projects', color: 'text-slate-300' },
];

export default function App() {
  // Navigation State
  const [activeTab, setActiveTab] = useState('upload'); // 'upload', 'processing', 'workspace', 'clips', 'brand', 'templates'
  
  // Upload & Video Processing Config
  const [inputMethod, setInputMethod] = useState('upload'); // 'upload', 'url', 'sample'
  const [videoUrlInput, setVideoUrlInput] = useState('');
  const [selectedSample, setSelectedSample] = useState(SAMPLE_VIDEOS[0]);
  const [targetLanguage, setTargetLanguage] = useState('English');
  const [clippingMode, setClippingMode] = useState('auto'); // 'auto', 'topic', 'keyword', 'custom'
  const [targetAspectRatio, setTargetAspectRatio] = useState('original'); // 'original', '9:16', '1:1', '16:9'
  const [fitMode, setFitMode] = useState('fit'); // 'fit' = whole video visible (default), 'fill' = crop to fill frame
  const [clipLength, setClipLength] = useState('30-60'); // '<30', '30-60', '60-180', 'custom'
  
  // Processing Simulator State
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingStep, setProcessingStep] = useState('Transcribing audio with Whisper AI...');
  
  // Video Editor Workspace State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(120);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [transcript, setTranscript] = useState(INITIAL_TRANSCRIPT);
  const [transcriptSearch, setTranscriptSearch] = useState('');
  
  // Customization State
  const [selectedPreset, setSelectedPreset] = useState(CAPTION_PRESETS[0]);
  const [captionFont, setCaptionFont] = useState('Impact');
  const [captionColor, setCaptionColor] = useState('#FFFFFF');
  const [highlightColor, setHighlightColor] = useState('#FFE600');
  const [fontSize, setFontSize] = useState(28);
  const [textPosition, setTextPosition] = useState('bottom'); // 'top', 'center', 'bottom'
  const [autoEmojis, setAutoEmojis] = useState(true);
  const [autoBRoll, setAutoBRoll] = useState(true);
  const [layoutMode, setLayoutMode] = useState('single'); // 'single', 'split', 'screen_cam'
  // Timeline + viral effects
  const [effects, setEffects] = useState([]);
  const [selectedFx, setSelectedFx] = useState(null);
  const [fxSettings, setFxSettings] = useState(DEFAULT_SETTINGS);
  const [fxLevel, setFxLevel] = useState('balanced');
  
  // Clips Management State
  const [generatedClips, setGeneratedClips] = useState(INITIAL_CLIPS);
  const [activeClip, setActiveClip] = useState(INITIAL_CLIPS[0]);
  const [publishingModal, setPublishingModal] = useState(false);
  const [publishedPlatform, setPublishedPlatform] = useState(null);
  
  // Video Element Reference
  const videoRef = useRef(null);
  const [videoAR, setVideoAR] = useState(16 / 9); // native width/height of the loaded video
  const fileInputRef = useRef(null);
  const [uploadedUrl, setUploadedUrl] = useState(null);
  const [uploadedName, setUploadedName] = useState('');
  const [clipOnly, setClipOnly] = useState(true);
  const [copied, setCopied] = useState('');
  const [deleted, setDeleted] = useState([]); // transcript lines removed = video trimmed
  const toggleDeleted = (id) => setDeleted((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]));

  // Screen recorder
  const [recState, setRecState] = useState('idle');
  const [recUrl, setRecUrl] = useState(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => chunksRef.current.push(e.data);
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecUrl(URL.createObjectURL(new Blob(chunksRef.current, { type: 'video/webm' })));
        setRecState('done');
      };
      stream.getVideoTracks()[0].onended = () => { if (mr.state !== 'inactive') mr.stop(); };
      mr.start();
      recorderRef.current = mr;
      setRecState('recording');
    } catch (e) { alert('Screen recording was blocked or is not supported in this browser.'); }
  };
  const stopRec = () => recorderRef.current?.stop();
  const editRecording = () => { setUploadedUrl(recUrl); setUploadedName('screen-recording.webm'); setActiveTab('processing'); runTranscribe(recUrl); };

  // AI social captions + scheduler
  const PLATFORMS = ['TikTok', 'Instagram Reels', 'YouTube Shorts', 'LinkedIn', 'X (Twitter)'];
  const makeCaption = (clip, plat) => {
    const tags = clip.hashtags.split(' ');
    if (plat === 'TikTok') return `${clip.hookText}\n\n${tags.slice(0, 4).join(' ')} #fyp`;
    if (plat === 'Instagram Reels') return `${clip.title}\n.\n${clip.transcriptSnippet}\n.\n${clip.hashtags}`;
    if (plat === 'YouTube Shorts') return `${clip.title} #Shorts ${tags.slice(0, 3).join(' ')}`;
    if (plat === 'LinkedIn') return `${clip.hookText}\n\nKey takeaway: ${clip.transcriptSnippet}\n\nWhat is your take?\n\n${tags.slice(0, 3).join(' ')}`;
    return `${clip.title} ${tags.slice(0, 2).join(' ')}`.slice(0, 280);
  };
  const [schedClipId, setSchedClipId] = useState('clip-1');
  const [schedPlats, setSchedPlats] = useState(['TikTok']);
  const [schedDate, setSchedDate] = useState('');
  const [schedCaption, setSchedCaption] = useState('');
  const [queue, setQueue] = useState([]);

  const [mobileNav, setMobileNav] = useState(false);
  const [busy, setBusy] = useState('');
  const [clipTarget, setClipTarget] = useState(60);

  // ---- View predictor ----
  const [predSettings, setPredSettings] = useState(() => {
    try { const v = JSON.parse(localStorage.getItem('vz_pred') || 'null'); if (v) return v; } catch {}
    return { platform: 'TikTok', followers: '', hour: 18, weekday: 2 };
  });
  useEffect(() => { try { localStorage.setItem('vz_pred', JSON.stringify(predSettings)); } catch {} }, [predSettings]);
  const [predictions, setPredictions] = useState({});
  const [predModel, setPredModel] = useState(null);
  const [predErr, setPredErr] = useState('');
  const [predTick, setPredTick] = useState(0);
  const [sortByPred, setSortByPred] = useState(false);
  const [logClipId, setLogClipId] = useState(null);
  const [openTips, setOpenTips] = useState(null);
  const clipText = (c) => {
    const lines = transcript.filter((t) => t.end > c.startTime && t.start < c.endTime && !deleted.includes(t.id));
    return lines.map((t) => t.text).join(' ').trim() || c.transcriptSnippet || c.title;
  };
  const predItems = generatedClips.map((c) => ({ id: c.id, text: clipText(c), duration: Math.max(1, c.endTime - c.startTime), platform: predSettings.platform, followers: Number(predSettings.followers) || null, hour: predSettings.hour, weekday: predSettings.weekday }));
  const predKey = JSON.stringify(predItems) + predTick;
  useEffect(() => {
    if (!predItems.length) return;
    let live = true;
    const h = setTimeout(async () => {
      try {
        const r = await predictClips(predItems);
        if (!live) return;
        setPredictions(Object.fromEntries(r.results.map((x) => [x.id, x])));
        setPredModel(r.model); setPredErr('');
      } catch (e) { if (live) setPredErr(e.message); }
    }, 700);
    return () => { live = false; clearTimeout(h); };
  }, [predKey]);
  const displayClips = sortByPred
    ? [...generatedClips].sort((a, b) => (predictions[b.id]?.pred?.median ?? predictions[b.id]?.hookScore ?? 0) - (predictions[a.id]?.pred?.median ?? predictions[a.id]?.hookScore ?? 0))
    : generatedClips;

  
  useEffect(() => {
    const v = videoRef.current;
    if (v && activeTab === 'workspace' && activeClip) v.currentTime = activeClip.startTime;
  }, [activeClip.id, activeTab]);

  const regenClips = (sec) => {
    setClipTarget(sec);
    const clips = buildClips(transcript, SAMPLE_VIDEOS[0].thumbnail, sec);
    if (clips.length) { setGeneratedClips(clips); setActiveClip(clips[0]); }
  };

  const runTranscribe = async (src) => {
    try {
      const j = await transcribeRemote(src || uploadedUrl || selectedSample.videoUrl, (m) => { console.log('[vizard]', m); setBusy(m); });
      const { segs, clips } = await detectClips(j.segments, SAMPLE_VIDEOS[0].thumbnail, setBusy, j.ml, clipTarget);
      setTranscript(segs);
      setDeleted([]);
      setEffects([]);
      setSelectedFx(null);
      if (clips.length) { setGeneratedClips(clips); setActiveClip(clips[0]); }
      setBusy('');
      setActiveTab('workspace');
    } catch (e) {
      setBusy('');
      setActiveTab('workspace');
      alert('Transcription failed: ' + e.message);
    }
  };

  const downloadClip = async (clip) => {
    if (!uploadedUrl) { alert('Upload or record your own video first, then export.'); return; }
    try {
      const out = await runExport({ url: uploadedUrl, start: clip.startTime, end: clip.endTime, ratio: targetAspectRatio, fit: fitMode, segs: transcript.filter((x) => !deleted.includes(x.id)), fx: { effects, settings: fxAll, caption: captionCfg }, onStatus: setBusy });
      const a = document.createElement('a'); a.href = out; a.download = `${clip.id}.mp4`; a.click();
      setBusy('');
    } catch (e) { setBusy(''); alert('Export failed: ' + e.message); }
  };

  const importFromUrl = async () => {
    const link = videoUrlInput.trim();
    if (!/^https?:\/\//i.test(link)) { alert('Paste a full link starting with http:// or https://'); return; }
    try {
      setBusy('Downloading video from link (can take a minute)...');
      const r = await fetch('/api/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: link }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Backend not reachable');
      setUploadedUrl(j.file);
      setUploadedName(j.title);
      setActiveTab('processing');
      runTranscribe(j.file);
    } catch (e) {
      setBusy('');
      alert('Import failed: ' + e.message);
    }
  };

  const [projects, setProjects] = useState(() => {
    try { return JSON.parse(localStorage.getItem('vz_projects') || '[]'); } catch { return []; }
  });
  
  const saveProject = () => {
    const next = [{ id: Date.now(), name: uploadedName || selectedSample.title, clips: generatedClips.length, lang: targetLanguage, date: new Date().toLocaleString() }, ...projects];
    setProjects(next);
    try { localStorage.setItem('vz_projects', JSON.stringify(next)); } catch {}
  };

  const deleteProject = (id) => {
    const next = projects.filter((p) => p.id !== id);
    setProjects(next);
    try { localStorage.setItem('vz_projects', JSON.stringify(next)); } catch {}
  };

  const schedClip = generatedClips.find((c) => c.id === schedClipId) || generatedClips[0];
  const togglePlat = (pl) => setSchedPlats((a) => (a.includes(pl) ? a.filter((x) => x !== pl) : [...a, pl]));
  const addToQueue = () => {
    if (!schedDate || !schedPlats.length) { alert('Pick a date/time and at least one platform.'); return; }
    setQueue((q) => [...q, { id: Date.now(), clip: schedClip.title, plats: schedPlats, when: schedDate, caption: schedCaption || makeCaption(schedClip, schedPlats[0]) }]
      .sort((a, b) => a.when.localeCompare(b.when)));
  };

  const simTimer = useRef(null);
  useEffect(() => () => clearInterval(simTimer.current), []);

  // Real transcription when a video is loaded, otherwise the demo simulation for the selected sample
  const handleGenerate = () => {
    const secs = { '<30': 30, '30-60': 60, '60-180': 180 }[clipLength];
    if (secs) setClipTarget(secs);
    if (uploadedUrl) { setActiveTab('processing'); runTranscribe(); } else startAIProcessing();
  };

  const startAIProcessing = () => {
    clearInterval(simTimer.current);
    setActiveTab('processing');
    setProcessingProgress(0);
    
    const steps = [
      { p: 15, text: 'Analyzing video keyframes & audio track...' },
      { p: 35, text: 'Generating multi-speaker transcript & timestamps...' },
      { p: 60, text: 'Calculating virality score & detecting hooks...' },
      { p: 85, text: 'Applying AI reframing & layout auto-crop...' },
      { p: 100, text: 'Clips ready! Redirecting to workspace...' }
    ];

    let currentStep = 0;
    const interval = simTimer.current = setInterval(() => {
      if (currentStep < steps.length) {
        setProcessingProgress(steps[currentStep].p);
        setProcessingStep(steps[currentStep].text);
        currentStep++;
      } else {
        clearInterval(interval);
        setTimeout(() => {
          setActiveTab((t) => (t === 'processing' ? 'workspace' : t));
        }, 800);
      }
    }, 900);
  };

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    if (clipOnly && activeClip && v.currentTime >= activeClip.endTime) v.currentTime = activeClip.startTime;
    const gap = transcript.find((t) => deleted.includes(t.id) && v.currentTime >= t.start && v.currentTime < t.end);
    if (gap) v.currentTime = gap.end;
    setCurrentTime(v.currentTime);
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {}); else v.pause(); // onPlay/onPause keep isPlaying in sync
  };

  const jumpToTime = (time) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
      if (videoRef.current.paused) videoRef.current.play().catch(() => {});
    }
  };

  const handleFile = (file) => {
    if (!file || !file.type.startsWith('video/')) { alert('Please choose a video file (MP4, MOV, WebM).'); return; }
    if (uploadedUrl) URL.revokeObjectURL(uploadedUrl);
    const u = URL.createObjectURL(file);
    setUploadedUrl(u);
    setUploadedName(file.name);
    setActiveTab('processing');
    runTranscribe(u);
  };

  const fmt = (t) => `${Math.floor(t / 60).toString().padStart(2, '0')}:${Math.floor(t % 60).toString().padStart(2, '0')}`;

  const updateClip = (field, val) => {
    const n = { ...activeClip, [field]: val };
    n.duration = fmt(Math.max(0, n.endTime - n.startTime));
    setActiveClip(n);
    setGeneratedClips((c) => c.map((x) => (x.id === n.id ? n : x)));
  };

  const removeFillers = () => {
    const re = /\b(um+|uh+|erm|you know|like,|basically|actually)\b,?\s*/gi;
    setTranscript((t) => t.map((x) => ({ ...x, text: x.text.replace(re, '').replace(/\s{2,}/g, ' ').trim() })));
  };
  const editLine = (id, text) => setTranscript((t) => t.map((x) => (x.id === id ? { ...x, text } : x)));

  const srtTime = (t) => {
    const ms = Math.round((t % 1) * 1000);
    const sec = Math.floor(t) % 60, min = Math.floor(t / 60) % 60, h = Math.floor(t / 3600);
    const z = (n, l = 2) => n.toString().padStart(l, '0');
    return `${z(h)}:${z(min)}:${z(sec)},${z(ms, 3)}`;
  };
  
  const exportSRT = () => {
    const lines = transcript.filter((x) => !deleted.includes(x.id) && x.end > activeClip.startTime && x.start < activeClip.endTime);
    const body = (lines.length ? lines : transcript)
      .map((x, i) => `${i + 1}\n${srtTime(x.start)} --> ${srtTime(x.end)}\n${x.text}\n`).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([body], { type: 'text/plain' }));
    a.download = 'captions.srt';
    a.click();
  };
  
  const copyText = (key, text) => {
    navigator.clipboard?.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 1500);
  };

  // Caption look shared by the live preview and the exported MP4
  const captionCfg = {
    font: captionFont, fontSize, color: captionColor, highlight: highlightColor, position: textPosition,
    uppercase: ['hormozi', 'submagic', 'karaoke'].includes(selectedPreset.id),
    badge: selectedPreset.id === 'podcast', glow: selectedPreset.id === 'submagic',
  };
  const fxAll = { ...fxSettings, emojis: autoEmojis };
  const runAutoFx = () => {
    const mine = autoEffects({ segs: transcript, deleted, clip: activeClip, level: fxLevel, hookText: activeClip.hookText });
    setEffects((old) => [...old.filter((e) => !(e.end > activeClip.startTime && e.start < activeClip.endTime)), ...mine]);
    setSelectedFx(null);
    setAutoEmojis(true);
    jumpToTime(activeClip.startTime);
  };
  const clearClipFx = () => {
    setEffects((old) => old.filter((e) => !(e.end > activeClip.startTime && e.start < activeClip.endTime)));
    setSelectedFx(null);
  };

  return (
    <div className="h-[100dvh] overflow-hidden bg-slate-950 text-slate-100 flex flex-col font-sans antialiased selection:bg-purple-500 selection:text-white">
      {/* Top Header Navigation */}
      <header className="h-16 shrink-0 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('upload')}>
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-white via-slate-200 to-purple-400 bg-clip-text text-transparent">
              Vizard<span className="text-purple-500">.ai</span>
            </span>
            <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
              Pro v3.5
            </span>
          </div>
        </div>

        {/* Tab Selector Nav */}
        <nav className="hidden xl:flex items-center gap-1 bg-slate-900/90 p-1.5 rounded-xl border border-slate-800">
          {NAV_ITEMS.map(([id, Icon, label]) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === id ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}>
              <Icon className={`h-4 w-4 ${id === 'clips' && activeTab !== id ? 'text-orange-400' : ''}`} /> {label}{id === 'clips' ? ` (${generatedClips.length})` : ''}
            </button>
          ))}
        </nav>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <button onClick={() => setMobileNav((m) => !m)} className="xl:hidden p-2 rounded-lg bg-slate-800 text-slate-200" aria-label="Menu">
            {mobileNav ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <button 
            onClick={handleGenerate}
            className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium text-sm px-4 py-2 rounded-xl shadow-lg shadow-purple-600/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Wand2 className="h-4 w-4 animate-pulse" /> Auto Clip
          </button>
        </div>
      </header>

      {mobileNav && (
        <div className="xl:hidden shrink-0 bg-slate-900 border-b border-slate-800 p-3 grid grid-cols-2 sm:grid-cols-3 gap-2 z-30">
          {NAV_ITEMS.map(([id, Icon, label]) => (
            <button key={id} onClick={() => { setActiveTab(id); setMobileNav(false); }}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${activeTab === id ? 'bg-purple-600 text-white' : 'bg-slate-950 text-slate-300 border border-slate-800'}`}>
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>
      )}

      {/* MAIN CONTAINER CONTENT */}
      <main className="flex-1 min-h-0 flex flex-col overflow-hidden">
        
        {/* TAB 1: VIDEO UPLOAD & INPUT OPTIONS */}
        {activeTab === 'upload' && (
          <div className="flex-1 overflow-y-auto p-6 md:p-10 max-w-7xl mx-auto w-full space-y-8">
            <div className="text-center max-w-3xl mx-auto space-y-3">
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20">
                AI Powered Video Repurposing
              </span>
              <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-purple-300 bg-clip-text text-transparent">
                Turn long videos into viral shorts in 1-click
              </h1>
              <p className="text-slate-400 text-base md:text-lg">
                Automatically extract high-impact viral moments, generate animated captions, split speaker layouts, and publish straight to social channels.
              </p>
            </div>

            {/* Input Switcher Tabs */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl max-w-4xl mx-auto space-y-6">
              <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800/80">
                <button
                  onClick={() => setInputMethod('upload')}
                  className={`flex-1 py-3 text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
                    inputMethod === 'upload' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Upload className="h-4 w-4" /> Upload Local Video
                </button>
                <button
                  onClick={() => setInputMethod('url')}
                  className={`flex-1 py-3 text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
                    inputMethod === 'url' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <LinkIcon className="h-4 w-4" /> Import via Link / URL
                </button>
                <button
                  onClick={() => setInputMethod('sample')}
                  className={`flex-1 py-3 text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
                    inputMethod === 'sample' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Video className="h-4 w-4" /> Sample Library
                </button>
              </div>

              <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
              
              {inputMethod === 'upload' && (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files?.[0]); }}
                  className="border-2 border-dashed border-purple-500/40 hover:border-purple-500 bg-purple-950/10 hover:bg-purple-950/20 rounded-2xl p-10 text-center cursor-pointer transition-all duration-300 group flex flex-col items-center justify-center space-y-4"
                >
                  <div className="h-16 w-16 rounded-full bg-purple-600/20 text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Upload className="h-8 w-8" />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-white">Drag & drop your video here, or <span className="text-purple-400 underline">browse</span></p>
                    <p className="text-slate-400 text-sm mt-1">Supports MP4, MOV, WebM. Transcription is English-only; the first 15 minutes are analysed.</p>
                  </div>
                </div>
              )}

              {inputMethod === 'url' && (
                <div className="space-y-4 py-4">
                  <label className="text-sm font-medium text-slate-300 block">Paste YouTube, Zoom, Twitch, or Google Drive link</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="https://www.youtube.com/watch?v=..."
                      value={videoUrlInput}
                      onChange={(e) => setVideoUrlInput(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500"
                    />
                    <button
                      onClick={importFromUrl}
                      className="bg-purple-600 hover:bg-purple-500 px-6 py-3 rounded-xl font-semibold text-sm text-white transition-all shadow-lg shadow-purple-600/20"
                    >
                      Import Video
                    </button>
                  </div>
                </div>
              )}

              {inputMethod === 'sample' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-2">
                  {SAMPLE_VIDEOS.map((sample) => (
                    <div
                      key={sample.id}
                      onClick={() => { if (uploadedUrl?.startsWith('blob:')) URL.revokeObjectURL(uploadedUrl); setUploadedUrl(null); setUploadedName(''); setSelectedSample(sample); startAIProcessing(); }}
                      className={`relative rounded-xl overflow-hidden border cursor-pointer transition-all hover:scale-[1.02] ${
                        selectedSample.id === sample.id ? 'border-purple-500 ring-2 ring-purple-500/50' : 'border-slate-800 bg-slate-950'
                      }`}
                    >
                      <img src={sample.thumbnail} alt={sample.title} className="h-32 w-full object-cover" />
                      <div className="p-3">
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">
                          {sample.category}
                        </span>
                        <h4 className="font-semibold text-sm line-clamp-1 mt-1 text-slate-200">{sample.title}</h4>
                        <span className="text-xs text-slate-400 mt-1 block">Duration: {sample.duration}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t border-slate-800 pt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Video Language</label>
                  <select 
                    value={targetLanguage} 
                    onChange={(e) => setTargetLanguage(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-slate-200 focus:outline-none focus:border-purple-500"
                  >
                    <option>English</option>
                    <option>Spanish</option>
                    <option>French</option>
                    <option>German</option>
                    <option>Hindi</option>
                    <option>Portuguese</option><option>Italian</option><option>Dutch</option><option>Arabic</option>
                    <option>Japanese</option><option>Korean</option><option>Chinese</option><option>Russian</option>
                    <option>Turkish</option><option>Indonesian</option><option>Polish</option><option>Marathi</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">AI Clipping Mode</label>
                  <select 
                    value={clippingMode} 
                    onChange={(e) => setClippingMode(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-slate-200 focus:outline-none focus:border-purple-500"
                  >
                    <option value="auto">🔥 Auto Viral Moments</option>
                    <option value="topic">📌 Topic Extraction</option>
                    <option value="keyword">🔍 Keyword Search</option>
                    <option value="custom">⏱️ Custom Timestamp</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Output Aspect Ratio</label>
                  <div className="flex gap-1.5">
                    {[
                      { label: 'original', icon: Maximize2 },
                      { label: '9:16', icon: Smartphone },
                      { label: '1:1', icon: Square },
                      { label: '16:9', icon: Monitor }
                    ].map(({ label, icon: Icon }) => (
                      <button
                        key={label}
                        onClick={() => setTargetAspectRatio(label)}
                        className={`flex-1 py-2 rounded-xl text-xs font-medium border flex items-center justify-center gap-1 transition-all ${
                          targetAspectRatio === label 
                            ? 'bg-purple-600/20 border-purple-500 text-purple-300' 
                            : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" /> {label === 'original' ? 'Original' : label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Target Clip Length</label>
                  <select 
                    value={clipLength} 
                    onChange={(e) => setClipLength(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-slate-200 focus:outline-none focus:border-purple-500"
                  >
                    <option value="<30">Short (&lt; 30s)</option>
                    <option value="30-60">Medium (30s - 60s)</option>
                    <option value="60-180">Long (1m - 3m)</option>
                  </select>
                </div>
              </div>

              <button
                onClick={handleGenerate}
                className="w-full bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:opacity-95 text-white font-bold py-4 rounded-xl shadow-xl shadow-purple-600/30 text-base flex items-center justify-center gap-2 transition-all"
              >
                <Sparkles className="h-5 w-5 animate-spin" /> Generate AI Clips Now
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: PROCESSING SIMULATION SCREEN */}
        {activeTab === 'processing' && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-xl mx-auto space-y-8">
            <div className="relative">
              <div className="h-28 w-28 rounded-full border-4 border-purple-500/20 border-t-purple-500 animate-spin flex items-center justify-center"></div>
              <Sparkles className="h-10 w-10 text-purple-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>

            <div className="space-y-3 w-full">
              <h2 className="text-2xl font-bold text-white">AI Processing in Progress...</h2>
              <p className="text-purple-400 text-sm font-mono">{busy || processingStep}</p>
              <button onClick={() => setActiveTab('workspace')} className="text-xs text-slate-400 hover:text-white underline">Skip to editor</button>
              
              <div className="w-full bg-slate-900 h-3 rounded-full overflow-hidden border border-slate-800">
                <div 
                  className="bg-gradient-to-r from-purple-600 to-pink-500 h-full transition-all duration-500"
                  style={{ width: `${busy ? 100 : processingProgress}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-xs text-slate-500 font-mono">
                <span>0%</span>
                <span>{processingProgress}%</span>
                <span>100%</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-left w-full bg-slate-900 p-4 rounded-xl border border-slate-800 text-xs text-slate-400">
              <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Audio Clean-up</div>
              <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Whisper AI Transcript</div>
              <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Hook Analysis</div>
              <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-purple-400 animate-pulse" /> Auto B-Roll Matching</div>
            </div>
          </div>
        )}

        {/* TAB 3: WORKSPACE & VIDEO EDITOR */}
        {activeTab === 'workspace' && (
          <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
            
            {/* Left Panel: Transcript & Timeline Editor */}
            <div className="w-full lg:w-1/2 min-h-[22rem] lg:min-h-0 max-h-[60vh] lg:max-h-none border-r border-slate-800 flex flex-col bg-slate-950 overflow-hidden shrink-0 lg:shrink">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between gap-4 bg-slate-900/50">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-purple-400" />
                  <span className="font-bold text-sm text-slate-200">Interactive Transcript</span>
                </div>
                <div className="relative flex-1 max-w-xs">
                  <Search className="h-3.5 w-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search transcript text..."
                    value={transcriptSearch}
                    onChange={(e) => setTranscriptSearch(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
                {transcript
                  .filter(item => item.text.toLowerCase().includes(transcriptSearch.toLowerCase()))
                  .map((item) => {
                    const isActive = currentTime >= item.start && currentTime <= item.end;
                    return (
                      <div
                        key={item.id}
                        onClick={() => jumpToTime(item.start)}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer group ${
                          isActive 
                            ? 'bg-purple-950/30 border-purple-500/50 ring-1 ring-purple-500/30' 
                            : 'bg-slate-900/40 border-slate-800/80 hover:bg-slate-900 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                              {item.speaker}
                            </span>
                            <button onClick={(e) => { e.stopPropagation(); toggleDeleted(item.id); }}
                              title={deleted.includes(item.id) ? 'Restore line' : 'Delete line (cuts it from the video)'}
                              className="text-slate-500 hover:text-red-400">
                              {deleted.includes(item.id) ? <Undo2 className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
                            </button>
                            <span className="text-[11px] font-mono text-slate-500">
                              00:{Math.floor(item.start).toString().padStart(2, '0')} - 00:{Math.floor(item.end).toString().padStart(2, '0')}
                            </span>
                          </div>
                          {item.isViral && (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-full border border-orange-500/20">
                              <Flame className="h-3 w-3 fill-orange-400" /> {item.viralScore}% Viral Hook
                            </span>
                          )}
                        </div>

                        <p
                          contentEditable
                          suppressContentEditableWarning
                          onClick={(e) => e.stopPropagation()}
                          onBlur={(e) => editLine(item.id, e.currentTarget.textContent)}
                          className={`text-sm leading-relaxed outline-none focus:ring-1 focus:ring-purple-500/50 rounded ${deleted.includes(item.id) ? 'line-through opacity-40 ' : ''}${isActive ? 'text-white font-medium' : 'text-slate-300'}`}
                        >
                          {item.text}
                        </p>
                      </div>
                    );
                  })}
              </div>

              <div className="p-3 border-t border-slate-800 bg-slate-900/80 flex flex-wrap gap-2 items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <button onClick={() => runTranscribe()} className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold">Transcribe (Whisper)</button>
                  <button onClick={removeFillers} className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold">Remove filler words</button>
                  <button onClick={exportSRT} className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold flex items-center gap-1"><Download className="h-3 w-3" /> SRT</button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                  <span>AI Auto-Synced</span>
                </div>
              </div>
            </div>

            {/* Right Panel: Video Preview Player & Caption Editor */}
            <div className="w-full lg:w-1/2 flex flex-col bg-slate-900 lg:overflow-y-auto shrink-0 lg:shrink">
              <div className="p-6 flex flex-col items-center justify-center bg-slate-950 border-b border-slate-800 relative">
                
                {/* Aspect-ratio frame: sized from the ratio + available height so the whole frame is always visible */}
                <div
                  className="relative rounded-2xl overflow-hidden shadow-2xl border border-slate-800 bg-black flex items-center justify-center transition-all"
                  style={(() => {
                    const [rw, rh] = targetAspectRatio.split(':').map(Number);
                    const ar = targetAspectRatio === 'original' ? videoAR : rw / rh;
                    // landscape frames are limited by width, portrait/square by height; both stay inside the screen
                    return ar > 1.05
                      ? { aspectRatio: String(ar), width: 'min(100%, 36rem)', maxHeight: 'calc(100dvh - 17rem)' }
                      : { aspectRatio: String(ar), height: 'clamp(220px, calc(100dvh - 17rem), 640px)', maxWidth: '100%' };
                  })()}
                >
                  <video
                    ref={videoRef}
                    src={uploadedUrl || selectedSample.videoUrl}
                    onTimeUpdate={handleTimeUpdate}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onLoadedMetadata={() => {
                      const v = videoRef.current;
                      if (!v) return;
                      setDuration(v.duration || 120);
                      if (v.videoWidth && v.videoHeight) setVideoAR(v.videoWidth / v.videoHeight);
                      if (activeClip) v.currentTime = activeClip.startTime;
                    }}
                    onError={() => setBusy('Could not load this video. Try another file or format (MP4/H.264 works best).')}
                    className={`absolute inset-0 w-full h-full ${fitMode === 'fit' ? 'object-contain' : 'object-cover'}`}
                    playsInline
                    muted={isMuted}
                    loop
                  />

                  <PreviewFX
                    videoRef={videoRef} effects={effects} settings={fxAll} caption={captionCfg}
                    clip={activeClip} transcript={transcript} deleted={deleted}
                  />
                </div>

                {/* Aspect ratio + Fit / Fill toggle buttons */}
                <div className="flex flex-wrap justify-center gap-1.5 mt-4">
                  {['original', '9:16', '1:1', '16:9'].map((r) => (
                    <button key={r} onClick={() => setTargetAspectRatio(r)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        targetAspectRatio === r ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300' : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                      }`}>{r === 'original' ? 'Original' : r}</button>
                  ))}
                  <span className="w-px bg-slate-800 mx-1" />
                  {[['fit', 'Fit (full video)'], ['fill', 'Fill (crop)']].map(([id, label]) => (
                    <button
                      key={id}
                      onClick={() => setFitMode(id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        fitMode === id ? 'bg-purple-600/20 border-purple-500 text-purple-300' : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Video Controls Bar */}
                <div className="w-full max-w-lg mt-4 space-y-2">
                  <div className="flex items-center gap-3">
                    <button onClick={togglePlay} className="p-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-white">
                      {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-white" />}
                    </button>
                    <input
                      type="range"
                      min="0"
                      max={duration || 100}
                      value={currentTime}
                      onChange={(e) => jumpToTime(parseFloat(e.target.value))}
                      className="flex-1 accent-purple-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                    <button onClick={() => setIsMuted((m) => !m)} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-200" title={isMuted ? 'Unmute' : 'Mute'}>
                      {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                    </button>
                    <span className="font-mono text-xs text-slate-400">
                      {fmt(currentTime)} / {fmt(duration)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Clip trim controls */}
              <div className="px-6 pt-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Scissors className="h-4 w-4 text-purple-400" /> Trim Clip {uploadedName && <span className="text-[10px] text-slate-500 normal-case truncate max-w-[140px]">· {uploadedName}</span>}
                  </h3>
                  <label className="text-xs text-slate-300 flex items-center gap-2">
                    <input type="checkbox" checked={clipOnly} onChange={(e) => setClipOnly(e.target.checked)} className="accent-purple-600" /> Loop clip only
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-4 bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <div>
                    <label className="text-xs text-slate-400 font-semibold block mb-1">Start ({fmt(activeClip.startTime)})</label>
                    <input type="range" min="0" max={Math.max(0, activeClip.endTime - 1)} step="0.1" value={activeClip.startTime}
                      onChange={(e) => { const v = parseFloat(e.target.value); updateClip('startTime', v); jumpToTime(v); }}
                      className="w-full accent-purple-500" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 font-semibold block mb-1">End ({fmt(activeClip.endTime)})</label>
                    <input type="range" min={activeClip.startTime + 1} max={Math.max(duration, activeClip.endTime)} step="0.1" value={activeClip.endTime}
                      onChange={(e) => updateClip('endTime', parseFloat(e.target.value))}
                      className="w-full accent-purple-500" />
                  </div>
                  <p className="col-span-2 text-[11px] text-slate-500">Clip length: {activeClip.duration} · Layout: {layoutMode.replace('_', ' ')}</p>
                </div>
              </div>

              <div className="p-6 space-y-6 flex-1">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Type className="h-4 w-4 text-purple-400" /> Caption Styles & Animation
                  </h3>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {CAPTION_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => {
                          setSelectedPreset(preset);
                          setCaptionFont(preset.font);
                          setCaptionColor(preset.color);
                          setHighlightColor(preset.highlightColor);
                        }}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          selectedPreset.id === preset.id 
                            ? 'bg-purple-600/20 border-purple-500 ring-1 ring-purple-500' 
                            : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <p className="text-xs font-bold text-white">{preset.name}</p>
                        <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">{preset.description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <div>
                    <label className="text-xs text-slate-400 font-semibold block mb-1">Text Position</label>
                    <div className="flex gap-1">
                      {['top', 'center', 'bottom'].map((pos) => (
                        <button
                          key={pos}
                          onClick={() => setTextPosition(pos)}
                          className={`flex-1 py-1.5 text-xs rounded-lg capitalize border ${
                            textPosition === pos ? 'bg-purple-600 text-white border-purple-500' : 'border-slate-800 text-slate-400'
                          }`}
                        >
                          {pos}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 font-semibold block mb-1">Font Size ({fontSize}px)</label>
                    <input 
                      type="range" 
                      min="16" 
                      max="42" 
                      value={fontSize} 
                      onChange={(e) => setFontSize(Number(e.target.value))}
                      className="w-full accent-purple-500 h-1.5 bg-slate-800 rounded-lg mt-2"
                    />
                  </div>

                  <div className="flex items-center justify-between col-span-2 pt-2 border-t border-slate-800">
                    <span className="text-xs text-slate-300 font-medium flex items-center gap-2">
                      <Smile className="h-4 w-4 text-yellow-400" /> Auto Emojis & Stickers
                    </span>
                    <input 
                      type="checkbox" 
                      checked={autoEmojis} 
                      onChange={(e) => setAutoEmojis(e.target.checked)}
                      className="accent-purple-600 h-4 w-4 rounded"
                    />
                  </div>
                </div>

                <EffectsPanel
                  settings={fxSettings} setSettings={setFxSettings} level={fxLevel} setLevel={setFxLevel}
                  onAuto={runAutoFx} onClear={clearClipFx} onExport={() => downloadClip(activeClip)}
                  effects={effects} clip={activeClip} busy={busy}
                />
              </div>
            </div>
          </div>
          <Timeline
            duration={duration} clip={activeClip} onClipChange={updateClip}
            transcript={transcript} deleted={deleted}
            effects={effects} setEffects={setEffects} selected={selectedFx} setSelected={setSelectedFx}
            videoRef={videoRef}
          />
          </div>
        )}

        {/* TAB 4: VIRAL CLIPS GENERATION LIBRARY */}
        {activeTab === 'clips' && (
          <div className="flex-1 overflow-y-auto p-6 md:p-10 max-w-7xl mx-auto w-full space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
              <div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Flame className="h-6 w-6 text-orange-500" /> AI Generated Short Clips
                </h1>
                <p className="text-slate-400 text-sm mt-1">Showing {generatedClips.length} clips · target {clipTarget / 60} min · model: {predModel ? ({ cold: 'not trained (hook score only)', weak: 'no reliable pattern yet', learning: 'learning', ready: 'ready' }[predModel.status]) : 'offline'}</p>
                {predErr && <p className="text-[11px] text-amber-400 mt-1">Predictor offline: {predErr}</p>}
                <label className="text-xs text-slate-300 flex items-center gap-2 mt-2"><input type="checkbox" checked={sortByPred} onChange={(e) => setSortByPred(e.target.checked)} className="accent-purple-600" /> Rank clips by prediction</label>
              </div>
              <button 
                onClick={() => setActiveTab('workspace')}
                className="bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-xl text-sm font-semibold text-white shadow-md shadow-purple-600/20"
              >
                + Extract More Clips
              </button>
              <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1">
                {[60, 120, 180].map((sec) => (
                  <button key={sec} onClick={() => regenClips(sec)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold ${clipTarget === sec ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                    {sec / 60} min
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayClips.map((clip) => {
                const pr = predictions[clip.id];
                return (
                <div key={clip.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl hover:border-slate-700 transition-all group flex flex-col">
                  <div className="relative h-56 bg-slate-950 overflow-hidden flex items-center justify-center">
                    <img src={clip.thumbnail} alt={clip.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80" />
                    
                    <div className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur-md border border-slate-800 px-3 py-1 rounded-full flex items-center gap-1.5 shadow">
                      <Flame className="h-4 w-4 text-orange-500 fill-orange-500" />
                      <span className="text-xs font-extrabold text-white">{clip.viralScore}/100</span>
                    </div>

                    <span className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg text-xs font-mono text-slate-300">
                      {clip.duration}
                    </span>

                    <button 
                      onClick={() => { setActiveClip(clip); setActiveTab('workspace'); }}
                      className="h-12 w-12 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                    >
                      <Play className="h-5 w-5 fill-white ml-0.5" />
                    </button>
                  </div>

                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <div>
                      <h3 className="font-bold text-slate-100 text-base line-clamp-1">{clip.title}</h3>
                      <p className="text-slate-400 text-xs mt-1.5 italic line-clamp-2">"{clip.transcriptSnippet}"</p>
                    </div>

                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 space-y-1">
                      <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider block">Suggested Social Hook</span>
                      <p className="text-xs font-semibold text-slate-200">{clip.hookText}</p>
                    </div>

                    {pr && (
                      <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 space-y-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-slate-300 uppercase tracking-wider" title="Style heuristic: not a view forecast">Hook score</span>
                          <span className="font-extrabold text-white">{pr.hookScore}/100</span>
                        </div>
                        <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden"><div className={`h-full ${pr.hookScore >= 70 ? 'bg-emerald-500' : pr.hookScore >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${pr.hookScore}%` }} /></div>
                        {pr.pred ? (
                          <p className="text-xs text-slate-200">
                            <span className="text-emerald-300 font-bold">Est. {fmtNum(pr.pred.low)} – {fmtNum(pr.pred.high)} views</span>
                            <span className="text-slate-500"> (typical {fmtNum(pr.pred.median)}) · better than {pr.pred.percentile}% of your posts{pr.pred.confidence === 'low' ? ' · low confidence' : ''}</span>
                          </p>
                        ) : (
                          <p className="text-[11px] text-slate-500">{predModel?.status === 'weak' ? 'No reliable view estimate: the model found no pattern in your posts yet.' : `View estimate unlocks after ${predModel?.minTrain ?? 10} logged posts (${predModel?.n ?? 0} so far).`}</p>
                        )}
                        {pr.tips?.length > 0 && (
                          <div>
                            <button onClick={() => setOpenTips(openTips === clip.id ? null : clip.id)} className="text-[11px] text-purple-300 hover:text-white">{openTips === clip.id ? 'Hide' : 'How to improve this hook'} ({pr.tips.length})</button>
                            {openTips === clip.id && <ul className="mt-1.5 space-y-1 list-disc pl-4 text-[11px] text-slate-400">{pr.tips.map((t) => <li key={t}>{t}</li>)}</ul>}
                          </div>
                        )}
                        <button onClick={() => { setLogClipId(clip.id); setActiveTab('predictor'); }} className="text-[11px] text-slate-400 hover:text-white underline">Posted it? Log real views</button>
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                      <button 
                        onClick={() => { setActiveClip(clip); setPublishingModal(true); }}
                        className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold py-2.5 rounded-xl shadow flex items-center justify-center gap-1.5"
                      >
                        <Share2 className="h-3.5 w-3.5" /> Direct Publish
                      </button>
                      <button 
                        onClick={() => downloadClip(clip)}
                        className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold"
                        title="Download MP4 (720p)"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => copyText(clip.id, `${clip.title}\n\n${clip.hookText}\n\n${clip.hashtags}`)}
                        className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold"
                        title="Copy title, hook & hashtags"
                      >
                        {copied === clip.id ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              );})}
            </div>
          </div>
        )}

        {/* TAB 5: BRAND KIT */}
        {activeTab === 'brand' && (
          <div className="flex-1 overflow-y-auto p-6 md:p-10 max-w-5xl mx-auto w-full space-y-8">
            <div>
              <h1 className="text-2xl font-bold text-white">Brand Kit & Preset Manager</h1>
              <p className="text-slate-400 text-sm mt-1">Save custom typography, colors, and watermark logos across all team videos.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                <h3 className="font-bold text-slate-200 text-sm uppercase tracking-wider">Brand Palette</h3>
                <div className="grid grid-cols-4 gap-3">
                  {['#A855F7', '#3B82F6', '#22C55E', '#FFE600'].map((hex) => (
                    <div key={hex} onClick={() => setHighlightColor(hex)} className="space-y-1 text-center cursor-pointer" title="Use as caption highlight color">
                      <div className="h-12 w-full rounded-xl shadow" style={{ backgroundColor: hex }}></div>
                      <span className="text-[10px] font-mono text-slate-400">{hex}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                <h3 className="font-bold text-slate-200 text-sm uppercase tracking-wider">Logo Watermark</h3>
                <div className="border-2 border-dashed border-slate-800 rounded-xl p-4 text-center">
                  <p className="text-xs text-slate-400">Drag PNG logo overlay here</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: TEMPLATES */}
        {activeTab === 'templates' && (
          <div className="flex-1 overflow-y-auto p-6 md:p-10 max-w-5xl mx-auto w-full space-y-8">
            <div>
              <h1 className="text-2xl font-bold text-white">Dynamic AI Video Layouts</h1>
              <p className="text-slate-400 text-sm mt-1">Automatically frame active speakers, dual podcast guests, or screen recordings.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { title: 'Single Speaker Face-Track', desc: 'AI auto-crops and keeps speaker centered in 9:16 frame.' },
                { title: 'Split Screen (Speaker + Guest)', desc: 'Stacked view ideal for podcasts, interviews & debates.' },
                { title: 'Screen + WebCam Overlay', desc: 'SaaS product demo layout with speaker bubble.' }
              ].map((template, idx) => (
                <div key={idx} onClick={() => setLayoutMode(['single', 'split', 'screen_cam'][idx])}
                  className={`bg-slate-900 border rounded-2xl p-5 hover:border-purple-500 transition-all cursor-pointer ${layoutMode === ['single', 'split', 'screen_cam'][idx] ? 'border-purple-500 ring-1 ring-purple-500' : 'border-slate-800'}`}>
                  <div className="h-36 bg-slate-950 rounded-xl mb-4 border border-slate-800 flex items-center justify-center text-slate-600 font-mono text-xs">
                    Layout Preview #{idx + 1}
                  </div>
                  <h3 className="font-bold text-white text-base">{template.title}</h3>
                  <p className="text-xs text-slate-400 mt-1">{template.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 7: PROJECTS */}
        {activeTab === 'projects' && (
          <div className="flex-1 overflow-y-auto p-6 md:p-10 max-w-4xl mx-auto w-full space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-white">Projects</h1>
              <button onClick={saveProject} className="bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold px-4 py-2 rounded-xl">Save current project</button>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <div className="flex justify-between text-xs text-slate-400 mb-2"><span>Credits (demo)</span><span>{Math.max(0, 120 - projects.length * 10)} / 120 min</span></div>
              <div className="h-2 bg-slate-950 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-purple-600 to-pink-500" style={{ width: `${Math.max(0, 100 - projects.length * 8.3)}%` }} /></div>
            </div>
            {projects.length === 0 && <p className="text-sm text-slate-500">No saved projects yet.</p>}
            {projects.map((pr) => (
              <div key={pr.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
                <div><p className="font-semibold text-slate-100 text-sm">{pr.name}</p><p className="text-xs text-slate-500">{pr.clips} clips · {pr.lang} · {pr.date}</p></div>
                <div className="flex gap-2">
                  <button onClick={() => setActiveTab('clips')} className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200">Open</button>
                  <button onClick={() => deleteProject(pr.id)} className="text-slate-500 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 8: SCREEN RECORDER */}
        {activeTab === 'record' && (
          <div className="flex-1 overflow-y-auto p-6 md:p-10 max-w-3xl mx-auto w-full space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-white">Screen & Webinar Recorder</h1>
              <p className="text-slate-400 text-sm mt-1">Record your screen with audio, then send it straight to AI clipping.</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 text-center">
              {recState === 'idle' && (
                <button onClick={startRec} className="bg-red-600 hover:bg-red-500 text-white font-semibold px-6 py-3 rounded-xl flex items-center gap-2 mx-auto">
                  <Circle className="h-4 w-4 fill-white" /> Start recording
                </button>
              )}
              {recState === 'recording' && (
                <div className="space-y-3">
                  <p className="text-red-400 font-mono text-sm animate-pulse">● Recording...</p>
                  <button onClick={stopRec} className="bg-slate-800 hover:bg-slate-700 text-white font-semibold px-6 py-3 rounded-xl flex items-center gap-2 mx-auto">
                    <Square className="h-4 w-4" /> Stop
                  </button>
                </div>
              )}
              {recState === 'done' && recUrl && (
                <div className="space-y-4">
                  <video src={recUrl} controls className="w-full rounded-xl border border-slate-800 bg-black" />
                  <div className="flex gap-2 justify-center">
                    <button onClick={editRecording} className="bg-purple-600 hover:bg-purple-500 text-white font-semibold px-5 py-2.5 rounded-xl flex items-center gap-2"><Wand2 className="h-4 w-4" /> Auto clip this</button>
                    <a href={recUrl} download="recording.webm" className="bg-slate-800 hover:bg-slate-700 text-white font-semibold px-5 py-2.5 rounded-xl flex items-center gap-2"><Download className="h-4 w-4" /> Download</a>
                    <button onClick={() => setRecState('idle')} className="text-slate-400 hover:text-white px-3">New</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 11: VIEW PREDICTOR */}
        {activeTab === 'predictor' && (
          <PredictorTab clips={generatedClips} clipText={clipText} settings={predSettings} setSettings={setPredSettings}
            logClipId={logClipId} setLogClipId={setLogClipId} onChanged={() => setPredTick((t) => t + 1)} predictions={predictions} />
        )}

        {/* TAB 10: FEATURES */}
        {activeTab === 'features' && (
          <div className="flex-1 overflow-y-auto p-6 md:p-10 max-w-7xl mx-auto w-full space-y-8">
            <div className="text-center max-w-2xl mx-auto space-y-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20">Everything in one place</span>
              <h1 className="text-3xl md:text-4xl font-extrabold text-white">Features</h1>
              <p className="text-slate-400 text-sm md:text-base">Everything this app can do, with a shortcut to each tool.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {FEATURES.map(({ icon: Icon, title, desc, tab, cta, color }) => (
                <div key={title} className="bg-slate-900 border border-slate-800 hover:border-purple-500/60 rounded-2xl p-5 flex flex-col gap-3 transition-all">
                  <div className="h-11 w-11 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center">
                    <Icon className={`h-5 w-5 ${color}`} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-white text-base">{title}</h3>
                    <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{desc}</p>
                  </div>
                  <button onClick={() => setActiveTab(tab)} className="self-start text-xs font-semibold text-purple-300 hover:text-white flex items-center gap-1">
                    {cta} <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 9: SCHEDULE */}
        {activeTab === 'schedule' && (
          <div className="flex-1 overflow-y-auto p-6 md:p-10 max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-6 content-start">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h2 className="font-bold text-white">Schedule a post</h2>
              <select value={schedClipId} onChange={(e) => { setSchedClipId(e.target.value); setSchedCaption(''); }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-slate-200">
                {generatedClips.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map((pl) => (
                  <button key={pl} onClick={() => togglePlat(pl)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${schedPlats.includes(pl) ? 'bg-purple-600/20 border-purple-500 text-purple-300' : 'border-slate-800 text-slate-400'}`}>
                    {pl}
                  </button>
                ))}
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase">AI social caption</label>
                  <button onClick={() => setSchedCaption(makeCaption(schedClip, schedPlats[0] || 'TikTok'))} className="text-xs text-purple-400 flex items-center gap-1"><Sparkles className="h-3 w-3" /> Generate for {schedPlats[0] || 'TikTok'}</button>
                </div>
                <textarea rows={5} value={schedCaption} onChange={(e) => setSchedCaption(e.target.value)} placeholder="Click Generate or write your own..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:border-purple-500" />
              </div>
              <input type="datetime-local" value={schedDate} onChange={(e) => setSchedDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-slate-200" />
              <button onClick={addToQueue} className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2">
                <Calendar className="h-4 w-4" /> Add to queue
              </button>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
              <h2 className="font-bold text-white">Content calendar ({queue.length})</h2>
              {queue.length === 0 && <p className="text-sm text-slate-500">Nothing scheduled yet.</p>}
              {queue.map((q) => (
                <div key={q.id} className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-purple-400">{q.when.replace('T', ' ')}</span>
                    <button onClick={() => setQueue((x) => x.filter((i) => i.id !== q.id))} className="text-slate-500 hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                  <p className="text-sm font-semibold text-slate-200 line-clamp-1">{q.clip}</p>
                  <p className="text-[11px] text-slate-500">{q.plats.join(' · ')}</p>
                  <p className="text-xs text-slate-400 whitespace-pre-line line-clamp-3">{q.caption}</p>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>

      {busy && (
        <div className="fixed bottom-4 right-4 z-50 bg-slate-900 border border-purple-500/50 text-sm text-slate-100 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3">
          <div className="h-4 w-4 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin" /> {busy}
          <button onClick={() => setBusy('')} className="text-slate-500 hover:text-white ml-2" title="Hide">✕</button>
        </div>
      )}

      {/* SOCIAL MEDIA PUBLISHING MODAL */}
      {publishingModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 space-y-6 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-lg font-bold text-white">Publish Clip to Social Media</h3>
              <button onClick={() => setPublishingModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            {publishedPlatform ? (
              <div className="text-center py-6 space-y-4">
                <div className="h-16 w-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <h4 className="text-xl font-bold text-white">Successfully Published!</h4>
                <p className="text-xs text-slate-400">Your video clip is now live on {publishedPlatform}.</p>
                <button 
                  onClick={() => { setPublishedPlatform(null); setPublishingModal(false); }}
                  className="w-full bg-slate-800 hover:bg-slate-700 py-2.5 rounded-xl text-sm font-semibold text-white"
                >
                  Done
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-slate-400">Select target platform for immediate automated posting:</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { name: 'TikTok', icon: Smartphone, color: 'hover:border-pink-500' },
                    { name: 'Instagram Reels', icon: Instagram, color: 'hover:border-purple-500' },
                    { name: 'YouTube Shorts', icon: Youtube, color: 'hover:border-red-500' },
                    { name: 'LinkedIn', icon: Linkedin, color: 'hover:border-blue-500' }
                  ].map((platform) => (
                    <button
                      key={platform.name}
                      onClick={() => setPublishedPlatform(platform.name)}
                      className={`p-4 bg-slate-950 border border-slate-800 rounded-xl flex flex-col items-center justify-center gap-2 text-slate-200 transition-all ${platform.color}`}
                    >
                      <platform.icon className="h-6 w-6" />
                      <span className="text-xs font-bold">{platform.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}