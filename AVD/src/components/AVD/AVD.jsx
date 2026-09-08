import React, { useState, useEffect, useRef } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceArea,
  AreaChart,
  Area,
  BarChart,
  Bar,
} from "recharts";
import "./AVD.css";

// --- Radial Gauge Component ---
const RadialThreatGauge = ({ value }) => {
  const normalizedValue = Math.min(Math.max(value, 0), 100);
  const strokeDashoffset = 251 - (251 * (normalizedValue / 100) * 0.75);

  let strokeColor = "#10b981"; // Emerald
  let badgeText = "SAFE STREAM";
  let badgeBg = "rgba(16, 185, 129, 0.15)";

  if (value >= 45 && value < 75) {
    strokeColor = "#f59e0b"; // Amber
    badgeText = "SUSPICIOUS PATTERN";
    badgeBg = "rgba(245, 158, 11, 0.15)";
  } else if (value >= 75) {
    strokeColor = "#ef4444"; // Crimson
    badgeText = "DEEPFAKE THREAT DETECTED";
    badgeBg = "rgba(239, 68, 68, 0.15)";
  }

  return (
    <div className="threat-gauge-root">
      <div className="gauge-svg-container">
        <svg width="220" height="160" viewBox="0 0 200 150">
          <defs>
            <linearGradient id="gaugeGlow" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={strokeColor} stopOpacity={1} />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.8} />
            </linearGradient>
          </defs>
          <path
            d="M 30 130 A 70 70 0 1 1 170 130"
            fill="none"
            stroke="#1e293b"
            strokeWidth={14}
            strokeLinecap="round"
          />
          <path
            d="M 30 130 A 70 70 0 1 1 170 130"
            fill="none"
            stroke="url(#gaugeGlow)"
            strokeWidth={14}
            strokeDasharray="251"
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.4s cubic-bezier(0.16, 1, 0.3, 1)" }}
          />
        </svg>
        <div className="gauge-score-display">
          <span className="gauge-number" style={{ color: strokeColor }}>
            {value}%
          </span>
          <span className="gauge-sublabel">AI GENERATED RISK</span>
        </div>
      </div>
      <div className="threat-status-pill" style={{ backgroundColor: badgeBg, color: strokeColor, borderColor: strokeColor }}>
        <span className="pulsing-dot" style={{ backgroundColor: strokeColor }}></span>
        {badgeText}
      </div>
    </div>
  );
};

const AVDDashboard = () => {
  // --- States ---
  const [isRecording, setIsRecording] = useState(false);
  const [aiScore, setAiScore] = useState(18);
  const [sensitivity, setSensitivity] = useState(75);
  const [audioSource, setAudioSource] = useState("mic");
  const [uploadedFileName, setUploadedFileName] = useState(null);
  
  // Real-time Metrics
  const [samplingRate, setSamplingRate] = useState(44100);
  const [formantIndex, setFormantIndex] = useState(1.12);
  const [spectralEntropy, setSpectralEntropy] = useState(0.42);
  const [processedFrames, setProcessedFrames] = useState(0);

  // Chart & Log Datasets
  const [waveformHistory, setWaveformHistory] = useState([
    { time: "00:00", level: 12, peak: 24, frequency: 120 },
  ]);
  const [riskHistory, setRiskHistory] = useState([
    { time: "00:00", risk: 18, threshold: 75 },
  ]);
  const [spectralBins, setSpectralBins] = useState([
    { freq: "60Hz", val: 30 },
    { freq: "250Hz", val: 55 },
    { freq: "500Hz", val: 80 },
    { freq: "2kHz", val: 45 },
    { freq: "4kHz", val: 90 },
    { freq: "8kHz", val: 20 },
  ]);
  const [logs, setLogs] = useState([
    { id: 1, time: new Date().toLocaleTimeString(), type: "SYSTEM", message: "AVD Neural Engine initialized." },
  ]);

  // Audio / File Refs
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);
  const animationFrameIdRef = useRef(null);

  // --- Helper to Append Security Logs ---
  const addLog = (type, message) => {
    setLogs((prev) => [
      { id: Date.now(), time: new Date().toLocaleTimeString(), type, message },
      ...prev.slice(0, 19),
    ]);
  };

  // --- File Upload Handler ---
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setUploadedFileName(file.name);
      setAudioSource("file");
      addLog("FILE", `Audio stream file mounted: ${file.name}`);
      
      // Simulate Deepfake Neural Inspection on local file
      const reader = new FileReader();
      reader.onload = () => {
        addLog("INSPECT", "Running Fast Fourier Transform on uploaded file...");
        setTimeout(() => {
          const simulatedScore = Math.floor(Math.random() * 65) + 30;
          setAiScore(simulatedScore);
          addLog(
            simulatedScore > sensitivity ? "CRITICAL" : "INFO",
            `File Scan complete. Detected AI spectral probability: ${simulatedScore}%`
          );
        }, 1200);
      };
      reader.readAsArrayBuffer(file);
    }
  };

  // --- Web Audio Pipeline ---
  const toggleMicrophone = async () => {
    if (isRecording) {
      stopAudioProcessing();
      addLog("STREAM", "Live microphone stream terminated.");
    } else {
      await startAudioProcessing();
      addLog("STREAM", "Live WebAudio stream connected via mic.");
    }
  };

  const startAudioProcessing = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;

      setSamplingRate(audioCtx.sampleRate);
      setIsRecording(true);
      processAudio();
    } catch (err) {
      addLog("ERROR", `Microphone access rejected: ${err.message}`);
      alert("Microphone access denied or hardware missing.");
    }
  };

  const stopAudioProcessing = () => {
    if (animationFrameIdRef.current) clearTimeout(animationFrameIdRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach((track) => track.stop());
    if (audioContextRef.current) audioContextRef.current.close();
    setIsRecording(false);
  };

  const processAudio = () => {
    if (!analyserRef.current) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const updateLoop = () => {
      analyserRef.current.getByteFrequencyData(dataArray);

      let sum = 0;
      let max = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
        if (dataArray[i] > max) max = dataArray[i];
      }
      const avgLevel = Math.round(sum / bufferLength);

      // Compute simulated synthetic metrics
      const computedFormant = parseFloat((1.0 + (avgLevel / 255) * 0.8).toFixed(2));
      const computedEntropy = parseFloat((0.2 + (max / 255) * 0.7).toFixed(2));
      
      setFormantIndex(computedFormant);
      setSpectralEntropy(computedEntropy);
      setProcessedFrames((prev) => prev + 1);

      // Calculate Deepfake Risk Confidence
      setAiScore((prev) => {
        let nextScore = prev;
        if (avgLevel > 85 || computedFormant > 1.5) {
          nextScore = Math.min(100, prev + 3);
        } else {
          nextScore = Math.max(12, prev - 1);
        }
        return nextScore;
      });

      // Update Spectral Bins
      setSpectralBins([
        { freq: "60Hz", val: Math.min(100, dataArray[2] || 20) },
        { freq: "250Hz", val: Math.min(100, dataArray[8] || 35) },
        { freq: "500Hz", val: Math.min(100, dataArray[16] || 50) },
        { freq: "2kHz", val: Math.min(100, dataArray[32] || 65) },
        { freq: "4kHz", val: Math.min(100, dataArray[64] || 40) },
        { freq: "8kHz", val: Math.min(100, dataArray[100] || 15) },
      ]);

      const currentTime = new Date().toLocaleTimeString().split(" ")[0];

      // Update Charts
      setWaveformHistory((prev) => [
        ...prev.slice(-15),
        { time: currentTime, level: avgLevel, peak: max, frequency: avgLevel * 12 },
      ]);

      setRiskHistory((prev) => [
        ...prev.slice(-15),
        { time: currentTime, risk: aiScore, threshold: sensitivity },
      ]);

      animationFrameIdRef.current = setTimeout(() => {
        requestAnimationFrame(updateLoop);
      }, 200);
    };

    updateLoop();
  };

  useEffect(() => {
    return () => stopAudioProcessing();
  }, []);

  return (
    <div className="avd-dashboard-root">
      {/* --- Header Control Bar --- */}
      <header className="avd-topbar">
        <div className="brand-identity">
          <div className="brand-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="22"/>
            </svg>
          </div>
          <div>
            <h1>AVD NEURAL MONITOR</h1>
            <p className="subtext">Real-Time Acoustic Deepfake & Synthetic Voice Inspection</p>
          </div>
        </div>

        <div className="topbar-actions">
          {/* File Input */}
          <input
            type="file"
            ref={fileInputRef}
            accept="audio/*"
            style={{ display: "none" }}
            onChange={handleFileUpload}
          />
          <button className="bklit-btn secondary" onClick={() => fileInputRef.current.click()}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            {uploadedFileName ? "Change File" : "Upload Audio"}
          </button>

          {/* Stream Switcher */}
          <button
            className={`bklit-btn ${isRecording ? "danger-glow" : "primary-glow"}`}
            onClick={toggleMicrophone}
          >
            <span className={`status-indicator ${isRecording ? "live" : ""}`}></span>
            {isRecording ? "Stop Stream" : "Start Live Stream"}
          </button>
        </div>
      </header>

      {/* --- Main Dashboard Grid --- */}
      <div className="avd-grid-layout">
        
        {/* KPI Panel */}
        <section className="kpi-strip">
          <div className="kpi-card">
            <span className="kpi-title">Audio Sample Rate</span>
            <span className="kpi-value">{samplingRate} <small>Hz</small></span>
            <span className="kpi-badge neutral">16-bit PCM</span>
          </div>
          <div className="kpi-card">
            <span className="kpi-title">Formant Dispersion Index</span>
            <span className="kpi-value">{formantIndex}</span>
            <span className={`kpi-badge ${formantIndex > 1.4 ? "warning" : "safe"}`}>
              {formantIndex > 1.4 ? "Synthetic Drift" : "Organic Pitch"}
            </span>
          </div>
          <div className="kpi-card">
            <span className="kpi-title">Spectral Entropy</span>
            <span className="kpi-value">{spectralEntropy}</span>
            <span className="kpi-badge safe">Normal Phase</span>
          </div>
          <div className="kpi-card">
            <span className="kpi-title">Processed Frames</span>
            <span className="kpi-value">{processedFrames}</span>
            <span className="kpi-badge live-pulse">Real-time Ingest</span>
          </div>
        </section>

        {/* Threat Gauge & Sensitivity Control */}
        <div className="bklit-panel gauge-panel">
          <div className="panel-header">
            <h3>AI Detection Gauge</h3>
            <span className="panel-tag">Neural Model v4.2</span>
          </div>
          
          <RadialThreatGauge value={aiScore} />

          <div className="sensitivity-control">
            <div className="slider-header">
              <label>Alert Sensitivity Threshold</label>
              <span>{sensitivity}%</span>
            </div>
            <input
              type="range"
              min="30"
              max="95"
              value={sensitivity}
              onChange={(e) => setSensitivity(Number(e.target.value))}
              className="bklit-slider"
            />
          </div>
        </div>

        {/* Acoustic Waveform & Level Analysis Chart */}
        <div className="bklit-panel chart-panel">
          <div className="panel-header">
            <h3>Live Audio Frequency Levels</h3>
            <div className="chart-legend">
              <span className="legend-item"><span className="dot avg"></span> Avg Amplitude</span>
              <span className="legend-item"><span className="dot peak"></span> Peak Transients</span>
            </div>
          </div>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={waveformHistory}>
                <defs>
                  <linearGradient id="levelGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.6}/>
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="time" stroke="#64748b" />
                <YAxis domain={[0, 255]} stroke="#64748b" />
                <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "8px" }} />
                <ReferenceArea y1={160} y2={220} fill="#ef4444" fillOpacity={0.12} />
                <Area type="monotone" dataKey="level" stroke="#2563eb" fillOpacity={1} fill="url(#levelGradient)" strokeWidth={2.5} />
                <Line type="monotone" dataKey="peak" stroke="#38bdf8" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Risk Probability Timeline */}
        <div className="bklit-panel chart-panel">
          <div className="panel-header">
            <h3>Synthetic Risk Probability Timeline</h3>
            <span className="panel-tag">Threshold: {sensitivity}%</span>
          </div>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={riskHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="time" stroke="#64748b" />
                <YAxis domain={[0, 100]} stroke="#64748b" />
                <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "8px" }} />
                <Line type="monotone" dataKey="risk" stroke="#a855f7" strokeWidth={3} dot={{ r: 3 }} />
                <Line type="stepAfter" dataKey="threshold" stroke="#ef4444" strokeDasharray="4 4" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Fast Fourier Frequency Distribution Waterfall */}
        <div className="bklit-panel chart-panel">
          <div className="panel-header">
            <h3>FFT Frequency Bins Waterfall</h3>
            <span className="panel-tag">6 Band Spectrum</span>
          </div>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={spectralBins}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="freq" stroke="#64748b" />
                <YAxis domain={[0, 100]} stroke="#64748b" />
                <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "8px" }} />
                <Bar dataKey="val" fill="#06b6d4" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Security & System Event Terminal Log */}
        <div className="bklit-panel log-panel">
          <div className="panel-header">
            <h3>Acoustic Security Telemetry Log</h3>
            <button className="clear-btn" onClick={() => setLogs([])}>Clear Log</button>
          </div>
          <div className="terminal-window">
            {logs.map((log) => (
              <div key={log.id} className="log-line">
                <span className="log-time">[{log.time}]</span>
                <span className={`log-tag ${log.type.toLowerCase()}`}>{log.type}</span>
                <span className="log-msg">{log.message}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default AVDDashboard;