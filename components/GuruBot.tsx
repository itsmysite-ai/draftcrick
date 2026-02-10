import React, { useState, useRef, useEffect } from 'react';
import { YStack, XStack, Text, View, Spinner } from 'tamagui';
import { Bot, Send, X, Sparkles } from '@tamagui/lucide-icons';
import { askGuruWithTools, generateMascot } from '../services/geminiService.ts';
import { ChatMessage, Player } from '../types.ts';
import { useStore } from '../store.ts';

// Enhanced components with animations
const Button = ({ icon: Icon, color, children, onPress, circular, size, ...props }: any) => (
  <View 
    cursor="pointer" 
    alignItems="center" 
    justifyContent="center" 
    borderRadius={circular ? 100 : 4} 
    padding={8}
    animation="quick"
    hoverStyle={{ scale: 1.05, opacity: 0.9 }}
    pressStyle={{ scale: 0.95 }}
    {...props} 
    onPress={onPress}
  >
    {Icon && <Icon size={size === '$5' ? 24 : 20} color={color || '$color'} />}
    {children}
  </View>
);

const Input = ({ onChangeText, ...props }: any) => (
  <View 
    tag="input" 
    padding={12} 
    borderRadius={8} 
    borderWidth={1} 
    borderColor="$border" 
    backgroundColor="$surface" 
    color="$color" 
    animation="quick"
    focusStyle={{ borderColor: '$brand' }}
    {...props} 
    onChange={(e: any) => onChangeText?.(e.target.value)}
  />
);
const ScrollView = (props: any) => <View overflow="scroll" {...props} />;

const Image: any = (props: any) => <View tag="img" {...props} />;

const Sheet = ({ open, children, onOpenChange }: any) => {
  if (!open) return null;
  return (
    <View 
      position="absolute" 
      top={0} 
      left={0} 
      right={0} 
      bottom={0} 
      zIndex={1000} 
      backgroundColor="rgba(0,0,0,0.5)"
      animation="quick"
      enterStyle={{ opacity: 0 }}
      onPress={() => onOpenChange?.(false)}
    >
      <View 
        flex={1} 
        justifyContent="flex-end" 
        onPress={(e: any) => e.stopPropagation()}
      >
        {children}
      </View>
    </View>
  );
};
Sheet.Frame = (props: any) => (
  <View 
    backgroundColor="$bg" 
    borderRadius={20} 
    padding={24} 
    height="85%"
    animation="quick"
    enterStyle={{ y: '100%' }}
    {...props} 
  />
);
Sheet.Overlay = (props: any) => <View position="absolute" top={0} left={0} right={0} bottom={0} backgroundColor="rgba(0,0,0,0.5)" {...props} />;
Sheet.Handle = (props: any) => <View width={40} height={4} backgroundColor="$border" borderRadius={2} alignSelf="center" marginVertical={10} {...props} />;

export const GuruBot: React.FC<{ availablePlayers: Player[] }> = ({ availablePlayers }) => {
  const { userTeam, setUserTeam } = useStore();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'guru', text: 'Namaste! I am your AI Guru. Ready to build an unbeatable squad?', timestamp: new Date() }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<any>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTo({ y: 99999, animated: true });
  }, [messages, isTyping]);

  const handleToolCall = (call: any) => {
    if (call.name === 'optimize_squad') {
      const sorted = [...availablePlayers].sort((a, b) => b.points - a.points);
      const newTeam: Player[] = [];
      let budget = 100;
      for (const p of sorted) {
        if (newTeam.length < 11 && budget >= p.price) {
          newTeam.push(p);
          budget -= p.price;
        }
      }
      setUserTeam(newTeam);
      return "Squad optimized! I've selected the highest point-scorers within your budget.";
    }
    if (call.name === 'clear_squad') {
      setUserTeam([]);
      return "Squad cleared. Ready for a fresh start!";
    }
    return "Action completed.";
  };

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;
    const userMsg: ChatMessage = { role: 'user', text: input, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    const currentInput = input;
    setInput('');
    setIsTyping(true);

    try {
      if (currentInput.toLowerCase().includes('mascot')) {
        const img = await generateMascot(currentInput);
        setMessages(prev => [...prev, { role: 'guru', text: 'Your team mascot has arrived!', timestamp: new Date(), image: img || undefined }]);
      } else {
        const result = await askGuruWithTools(currentInput, { players: availablePlayers, team: userTeam });
        if (result.functionCalls?.length) {
          result.functionCalls.forEach(c => {
            const feedback = handleToolCall(c);
            setMessages(prev => [...prev, { role: 'guru', text: feedback, timestamp: new Date() }]);
          });
        } else {
          setMessages(prev => [...prev, { role: 'guru', text: result.text || 'Thinking...', timestamp: new Date() }]);
        }
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'guru', text: 'Stumped for a moment. Try again!', timestamp: new Date() }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      <Button
        position="absolute" 
        bottom={100} 
        right={24} 
        zIndex={1000}
        circular
        size="$5"
        backgroundColor="$brand"
        icon={Bot}
        onPress={() => setIsOpen(true)}
        elevation={5}
        animation="bouncy"
        enterStyle={{ scale: 0, opacity: 0 }}
        hoverStyle={{ scale: 1.15, rotate: '5deg' }}
      />

      <Sheet
        open={isOpen}
        onOpenChange={setIsOpen}
        snapPoints={[85]}
        dismissOnSnapToBottom
        modal
        animation="medium"
      >
        <Sheet.Overlay backgroundColor="rgba(0,0,0,0.5)" />
        <Sheet.Handle backgroundColor="$border" />
        <Sheet.Frame backgroundColor="$bg" borderRadius={20} padding={24}>
          <YStack flex={1} gap={16}>
            <XStack justifyContent="space-between" alignItems="center">
              <XStack alignItems="center" gap={8}>
                <Sparkles size={16} color="$brand" />
                <Text fontWeight="800" fontSize={14} color="$color" letterSpacing={1}>GURU AI AGENT</Text>
              </XStack>
              <Button circular size="$2" icon={X} onPress={() => setIsOpen(false)} backgroundColor="$surface" />
            </XStack>

            <ScrollView flex={1} ref={scrollRef}>
              <YStack gap={16} paddingVertical={16}>
                {messages.map((m, i) => (
                  <YStack 
                    key={i} 
                    alignItems={m.role === 'user' ? 'flex-end' : 'flex-start'}
                    animation="quick"
                    enterStyle={{ opacity: 0, y: 20 }}
                  >
                    <YStack 
                      padding={16} 
                      borderRadius={12} 
                      backgroundColor={m.role === 'user' ? '$brand' : '$surface'} 
                      maxWidth="85%"
                      borderWidth={m.role === 'user' ? 0 : 1}
                      borderColor="$border"
                      animation="quick"
                      hoverStyle={{ scale: 1.02 }}
                    >
                      <Text fontSize={14} color={m.role === 'user' ? '$bg' : '$color'} fontWeight="500">
                        {m.text}
                      </Text>
                      {m.image && <Image src={m.image} width="100%" height={200} borderRadius={8} marginTop={12} style={{ objectFit: 'contain' }} />}
                    </YStack>
                  </YStack>
                ))}
                {isTyping && (
                   <XStack gap={8} alignItems="center" animation="quick" enterStyle={{ opacity: 0 }}>
                      <Spinner color="$brand" size="small" />
                      <Text fontSize={10} color="$brand" fontWeight="900">SYNTHESIZING...</Text>
                   </XStack>
                )}
              </YStack>
            </ScrollView>

            <XStack gap={12} paddingBottom={32}>
              <Input 
                flex={1} 
                height={54} 
                borderRadius={12} 
                backgroundColor="$surface" 
                borderColor="$border" 
                color="$color"
                placeholder="How can I help your squad?" 
                value={input}
                onChangeText={setInput}
                onKeyDown={(e: any) => e.key === 'Enter' && handleSend()}
              />
              <Button 
                size="$5" 
                backgroundColor="$brand" 
                icon={Send} 
                onPress={handleSend} 
                circular 
              />
            </XStack>
          </YStack>
        </Sheet.Frame>
      </Sheet>
    </>
  );
};