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
                session