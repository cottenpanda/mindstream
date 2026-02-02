import { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";

interface UseGeminiLiveProps {
  onTranscription: (text: string) => void;
  onError?: (error: Error) => void;
}

export const useGeminiLive = ({ onTranscription, onError }: UseGeminiLiveProps) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  
  // Refs to manage clean up and state without triggering re-renders
  const isMicActiveRef = useRef(false);
  const isMountedRef = useRef(true);
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  
  // Keep the latest callbacks in refs
  const onTranscriptionRef = useRef(onTranscription);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onTranscriptionRef.current = onTranscription;
    onErrorRef.current = onError;
  }, [onTranscription, onError]);

  useEffect(() => {
      isMountedRef.current = true;
      return () => { isMountedRef.current = false; };
  }, []);

  const stop = useCallback(() => {
    isMicActiveRef.current = false; // Immediately stop processing new audio

    // 1. Stop Audio Tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // 2. Disconnect Audio Nodes
    if (sourceRef.current) {
        try { sourceRef.current.disconnect(); } catch (e) {}
        sourceRef.current = null;
    }
    if (processorRef.current) {
        try { processorRef.current.disconnect(); } catch (e) {}
        processorRef.current = null;
    }
    
    // 3. Close Audio Context
    if (audioContextRef.current) {
        if (audioContextRef.current.state !== 'closed') {
            try { audioContextRef.current.close(); } catch (e) {}
        }
        audioContextRef.current = null;
    }

    // 4. Graceful Session Close
    // We detach the session from the ref immediately so new starts create new sessions.
    // But we keep the session alive for a moment to receive trailing transcriptions.
    const sessionToClose = sessionRef.current;
    sessionRef.current = null;
    
    if (sessionToClose) {
        setTimeout(() => {
            try {
                // Only log if we are still mounted to avoid noise
                if (isMountedRef.current) console.log("Gemini Session closed cleanly after grace period");
                sessionToClose.close();
            } catch (e) {
                // ignore errors during close
            }
        }, 1500); // 1.5s grace period for trailing text
    }
    
    if (isMountedRef.current) {
        setIsConnected(false);
        setIsConnecting(false);
    }
  }, []);

  const start = useCallback(async () => {
    if (isConnected || isConnecting) return;
    
    isMicActiveRef.current = true;
    setIsConnecting(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // If user cancelled while we were getting media
      if (!isMicActiveRef.current) {
          stream.getTracks().forEach(t => t.stop());
          if (isMountedRef.current) setIsConnecting(false);
          return;
      }

      streamRef.current = stream;

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextClass();
      
      // Auto-resume logic for mobile interruptions
      audioContext.onstatechange = () => {
          if (audioContext.state === 'suspended' && isMicActiveRef.current) {
              audioContext.resume();
          }
      };

      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      
      audioContextRef.current = audioContext;

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            if (!isMicActiveRef.current) return;
            console.log("Gemini Live Connected");
            
            if (isMountedRef.current) {
                setIsConnected(true);
                setIsConnecting(false);
            }
            
            const source = audioContext.createMediaStreamSource(stream);
            // 4096 buffer size is a good balance for latency/stability
            const scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);
            
            sourceRef.current = source;
            processorRef.current = scriptProcessor;

            scriptProcessor.onaudioprocess = (e) => {
              // Only send if mic is active and session exists
              if (!isMicActiveRef.current || !sessionRef.current) return;

              const inputData = e.inputBuffer.getChannelData(0);
              const downsampledData = downsampleBuffer(inputData, audioContext.sampleRate, 16000);
              const pcmData = convertFloat32ToInt16(downsampledData);
              const base64Data = arrayBufferToBase64(pcmData.buffer);
              
              sessionPromise.then((session) => {
                if (isMicActiveRef.current) {
                    session.sendRealtimeInput({
                        media: {
                            mimeType: 'audio/pcm;rate=16000',
                            data: base64Data
                        }
                    });
                }
              }).catch(err => {
                 if (isMicActiveRef.current) console.error("Error sending audio:", err);
              });
            };

            source.connect(scriptProcessor);
            scriptProcessor.connect(audioContext.destination);
          },
          onmessage: (message: LiveServerMessage) => {
            // Processing message even if mic is inactive (trailing data), but check mount
            if (!isMountedRef.current) return;

            if (message.serverContent?.inputTranscription) {
               const text = message.serverContent.inputTranscription.text;
               if (text) {
                 onTranscriptionRef.current(text);
               }
            }
          },
          onclose: (e) => {
            console.log("Gemini Live Closed", e);
            if (isMicActiveRef.current) {
                // If closed unexpectedly while active, trigger error
                if (onErrorRef.current && isMountedRef.current) onErrorRef.current(new Error("Session closed by server"));
                stop(); 
            }
          },
          onerror: (err) => {
            console.error("Gemini Live Error", err);
            if (isMicActiveRef.current) {
                if (onErrorRef.current && isMountedRef.current) onErrorRef.current(new Error("Network error"));
                stop();
            }
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
          },
          inputAudioTranscription: {}, 
          systemInstruction: "You are a precise dictation machine. Transcribe exactly what I say. Do not answer questions. Do not speak. Do not summarize.",
        },
      });

      const session = await sessionPromise;
      
      // If stopped while connecting
      if (!isMicActiveRef.current) {
          session.close();
          return;
      }
      sessionRef.current = session;

    } catch (error) {
      console.error("Failed to start Gemini Live", error);
      if (isMountedRef.current) setIsConnecting(false);
      if (onErrorRef.current && isMountedRef.current) onErrorRef.current(error as Error);
      stop();
    }
  }, [isConnected, isConnecting, stop]);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return { isConnected, isConnecting, start, stop };
};

// --- Helpers ---

function downsampleBuffer(buffer: Float32Array, inputRate: number, outputRate: number): Float32Array {
    if (outputRate === inputRate) return buffer;
    const ratio = inputRate / outputRate;
    const newLength = Math.round(buffer.length / ratio);
    const result = new Float32Array(newLength);
    
    // Improved downsampling with simple averaging to reduce aliasing
    for (let i = 0; i < newLength; i++) {
        const start = Math.floor(i * ratio);
        const end = Math.floor((i + 1) * ratio);
        let sum = 0;
        let count = 0;
        // Average samples from start to end (exclusive)
        for (let j = start; j < end && j < buffer.length; j++) {
            sum += buffer[j];
            count++;
        }
        // Fallback if ratio < 1 (upsampling, though unlikely here) or floating point issues
        result[i] = count > 0 ? sum / count : buffer[start];
    }
    return result;
}

function convertFloat32ToInt16(float32Array: Float32Array): Int16Array {
  const l = float32Array.length;
  const int16Array = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return int16Array;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}