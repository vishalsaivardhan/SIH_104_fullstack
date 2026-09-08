import os
import subprocess
import tempfile
import torch
import torch.nn as nn
import torchaudio.transforms as T
import soundfile as sf
import numpy as np
import imageio_ffmpeg


class VoiceGuardCNN(nn.Module):
    def __init__(self):
        super(VoiceGuardCNN, self).__init__()
        self.conv = nn.Sequential(
            nn.Conv2d(1, 16, kernel_size=3, stride=1, padding=1),
            nn.BatchNorm2d(16),
            nn.ReLU(),
            nn.MaxPool2d(2, 2),
            nn.Conv2d(16, 32, kernel_size=3, stride=1, padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(),
            nn.MaxPool2d(2, 2)
        )
        self.adaptive_pool = nn.AdaptiveAvgPool2d((16, 32))
        self.fc = nn.Sequential(
            nn.Linear(32 * 16 * 32, 128),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(128, 2)
        )

    def forward(self, x):
        x = self.conv(x)
        x = self.adaptive_pool(x)
        x = x.view(x.size(0), -1)
        return self.fc(x)


class VoiceGuardPredictor:
    def __init__(self, weights_path=None, max_len=64000):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.max_len = max_len

        if weights_path is None:
            base_dir = os.path.dirname(os.path.abspath(__file__))
            weights_path = os.path.join(base_dir, "weights", "voiceguard_model.pth")

        self.model = VoiceGuardCNN().to(self.device)
        
        if os.path.exists(weights_path):
            self.model.load_state_dict(torch.load(weights_path, map_location=self.device))
            self.model.eval()
            print(f"[VoiceGuard] Loaded weights successfully from {weights_path}")
        else:
            raise FileNotFoundError(f"[VoiceGuard Error] Weights file missing at: {weights_path}")

        self.spectrogram_transform = T.MelSpectrogram(
            sample_rate=16000, n_fft=1024, hop_length=512, n_mels=64
        )

    def convert_to_wav(self, input_path):
        """Converts any audio file (WhatsApp OPUS, MP3, AAC) to 16kHz Mono WAV using imageio-ffmpeg."""
        ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
        temp_wav = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
        temp_wav.close()

        cmd = [
            ffmpeg_exe,
            "-y",
            "-i", input_path,
            "-ar", "16000",
            "-ac", "1",
            "-f", "wav",
            temp_wav.name
        ]

        process = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if process.returncode != 0:
            if os.path.exists(temp_wav.name):
                os.remove(temp_wav.name)
            raise RuntimeError(f"FFmpeg conversion failed: {process.stderr.decode('utf-8', errors='ignore')}")

        return temp_wav.name

    def preprocess_audio(self, audio_path):
        wav_path = None
        try:
            # 1. Try reading as pure WAV via soundfile
            try:
                data, sr = sf.read(audio_path, dtype='float32')
                if data.ndim > 1:
                    data = data.mean(axis=1)
                if sr != 16000:
                    import librosa
                    data = librosa.resample(data, orig_sr=sr, target_sr=16000)
            except Exception:
                # 2. Convert to 16kHz WAV using imageio-ffmpeg executable
                wav_path = self.convert_to_wav(audio_path)
                data, sr = sf.read(wav_path, dtype='float32')

            waveform = torch.from_numpy(data).unsqueeze(0).float()

            # Pad or truncate to max_len (4 seconds at 16kHz)
            if waveform.shape[1] < self.max_len:
                pad = self.max_len - waveform.shape[1]
                waveform = torch.nn.functional.pad(waveform, (0, pad))
            else:
                waveform = waveform[:, :self.max_len]

            mel_spec = self.spectrogram_transform(waveform)
            return mel_spec.unsqueeze(0)

        finally:
            if wav_path and os.path.exists(wav_path):
                os.remove(wav_path)

    def predict(self, audio_path):
        tensor_input = self.preprocess_audio(audio_path).to(self.device)

        with torch.no_grad():
            logits = self.model(tensor_input)
            probabilities = torch.softmax(logits, dim=1).squeeze().tolist()

        real_score = float(probabilities[0])
        fake_score = float(probabilities[1])

        is_spoof = fake_score > real_score
        confidence = fake_score if is_spoof else real_score

        return {
            "is_spoof": is_spoof,
            "label": "spoof" if is_spoof else "bonafide",
            "confidence": round(confidence * 100, 2),
            "scores": {
                "bonafide": round(real_score, 4),
                "spoof": round(fake_score, 4)
            }
        }