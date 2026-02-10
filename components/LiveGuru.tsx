
import React, { useState, useRef, useEffect } from 'react';
import { Text, View } from 'tamagui';
import { Mic, MicOff, Activity } from '@tamagui/lucide-icons';
import { GoogleGenAI, Modality, Blob, LiveServerMessage } from '@google/genai';

// Fallback components
const XStack = (props: any) => <View flexDirection="row" {...props} />;
const YStack = (props: any) => <View flexDirection="column" {...props} />;
const Button = ({ icon: Icon, color, children, onPress, circular, size, ...props }: any) => (
  <View 
    cursor="pointer" 
    alignItems="center" 
    justifyContent="center" 
    borderRadius={circular ? 100 : "$10"} 
    padding="$2"
    animation="quick"
    hoverStyle={{ scale: 1.1 }}
    pressStyle={{ scale: 0.95 }}
    {...props} 
    onPress={onPress}
  >
    {Icon && <Icon size={size === '$5' ? 24 : 20} color={color || '$color'} />}
    {children}
  </View>
);

// Audio Helpers as per Coding Guidelines
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

function createBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

export const LiveGuru: React.FC = () => {
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const sessionRef = useRef<any>(null);
  const audioContextsRef = useRef<{ input: AudioContext; output: AudioContext } | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef(new Set<AudioBufferSourceNode>());

  const startSession = async () => {
    setIsConnecting(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextsRef.current = { input: inputCtx, output: outputCtx };

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            setIsActive(true);
            setIsConnecting(false);
            
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              sessionPromise.then((session) => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio && audioContextsRef.current) {
              const { output } = audioContextsRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, output.currentTime);
              
              const audioBuffer = await decodeAudioData(decode(base64Audio), output, 24000, 1);
              const source = output.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(output.destination);
              source.addEventListener('ended', () => sourcesRef.current.delete(source));
              
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(source);
            }

            if (message.serverContent?.interrupted) {
              for (const source of sourcesRef.current) {
                source.stop();
              }
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onerror: () => stopSession(),
          onclose: () => stopSession()
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          systemInstruction: 'You are the tami·draft Cricket Guru. Help the user build their fantasy cricket squad using your voice. Be energetic and knowledgeable about cricket stats.'
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (err) {
      console.error(err);
      setIsConnecting(false);
    }
  };

  const stopSession = () => {
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    if (audioContextsRef.current) {
      audioContextsRef.current.input.close();
      audioContextsRef.current.output.close();
      audioContextsRef.current = null;
    }
    setIsActive(false);
    setIsConnecting(false);
  };

  return (
    <View position="fixed" bottom={100} left={24} zIndex={1000}>
      <YStack alignItems="center" gap="$3">
        {isActive && (
          <YStack 
            backgroundColor="$surface" 
            paddingHorizontal="$4" 
            paddingVertical="$2" 
            borderRadius="$10" 
            borderWidth={1} 
            borderColor="$brand" 
            alignItems="center" 
            gap="$2"
            animation="quick"
            enterStyle={{ opacity: 0, scale: 0.8 }}
          >
            <XStack alignItems="center" gap="$2">
              <Activity size={12} color="$brand" />
              <Text fontSize={10} fontWeight="900" color="$color" letterSpacing={1}>GURU IS LISTENING</Text>
            </XStack>
          </YStack>
        )}
        
        <Button
          circular
          size="$5"
          backgroundColor={isActive ? '$red' : '$surface'}
          borderWidth={2}
          borderColor={isActive ? '$red' : '$brand'}
          icon={isConnecting ? Activity : (isActive ? MicOff : Mic)}
          onPress={isActive ? stopSession : startSession}
          animation="bouncy"
          enterStyle={{ scale: 0, opacity: 0 }}
          hoverStyle={{ scale: 1.15, rotate: '-5deg' }}
        >
          {isActive && (
            <View 
              position="absolute" 
              inset={-8} 
              borderRadius={100} 
              borderWidth={2} 
              borderColor="$red" 
              opacity={0.3}
              animation="bouncy"
              style={{
                animationDuration: '1.5s',
                animationIterationCount: 'infinite',
              }}
            />
          )}
        </Button>
      </YStack>
    </View>
  );
};