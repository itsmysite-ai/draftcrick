import React, { Component, ErrorInfo, ReactNode } from 'react';
import { HashRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { TamaguiProvider, Theme, Text, View, XStack, YStack, H1, H2, Spinner } from 'tamagui';
import { tamaguiConfig } from './tamagui.config.ts';
import { fetchLiveWorldCupData } from './services/geminiService.ts';
import { MatchCard } from './components/MatchCard.tsx';
import { TeamBuilder } from './components/TeamBuilder.tsx';
import { GuruBot } from './components/GuruBot.tsx';
import { LiveGuru } from './components/LiveGuru.tsx';
import { MatchCenter } from './pages/MatchCenter.tsx';
import { Match, Player } from './types.ts';
import { useStore } from './store.ts';
import { Sun, Moon, Trophy, Zap, Shield, BarChart2, ExternalLink } from '@tamagui/lucide-icons';

console.log('🏗️ DraftCrick: App component loading...');

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("App Crash Details:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <YStack flex={1} alignItems="center" justifyContent="center" backgroundColor="#050B14" padding={20}>
          <Text color="#FF4D4F" fontSize={20} fontWeight="900" textAlign="center">CRITICAL BOOT ERROR</Text>
          <Text color="white" fontSize={14} marginTop={10} opacity={0.7} textAlign="center">
            {this.state.error?.message || "Unknown Application Error"}
          </Text>
          <View 
            marginTop={20} 
            backgroundColor="#1e293b" 
            paddingHorizontal={20}
            paddingVertical={10} 
            borderRadius={8} 
            cursor="pointer"
            onPress={() => window.location.reload()}
          >
            <Text fontWeight="800" color="white">RESTART APP</Text>
          </View>
        </YStack>
      );
    }
    return this.props.children;
  }
}

const Button = ({ icon: Icon, color, children, onPress, circular, size, ...props }: any) => (
  <View 
    cursor="pointer" 
    alignItems="center" 
    justifyContent="center" 
    borderRadius={circular ? 100 : 8} 
    padding={8}
    animation="quick"
    hoverStyle={{ scale: 1.05, opacity: 0.9 }}
    pressStyle={{ scale: 0.95 }}
    {...props} 
    onPress={onPress}
  >
    {Icon && <Icon size={20} color={color || 'white'} />}
    {children}
  </View>
);

const ScrollView = (props: any) => (
  <View 
    overflow="scroll" 
    style={{ 
      scrollBehavior: 'smooth',
      WebkitOverflowScrolling: 'touch'
    }} 
    {...props} 
  />
);

const queryClient = new QueryClient();

const NavItem = ({ to, icon: Icon, label, active }: { to: string, icon: any, label: string, active: boolean }) => (
  <Link to={to} style={{ textDecoration: 'none' }}>
    <YStack 
      alignItems="center" 
      gap={4} 
      opacity={active ? 1 : 0.5}
      animation="quick"
      hoverStyle={{ opacity: 1, scale: 1.05 }}
      pressStyle={{ scale: 0.95 }}
    >
      <Icon size={20} color={active ? '$brand' : '$color'} />
      <Text fontSize={10} fontWeight="700" color={active ? '$brand' : '$color'}>{label}</Text>
    </YStack>
  </Link>
);

const AppContent: React.FC = () => {
  const { theme, setTheme, selectedTournament, setSelectedTournament } = useStore();
  const location = useLocation();

  // Apply theme class to body for smooth transitions
  React.useEffect(() => {
    const body = document.body;
    if (theme === 'light') {
      body.classList.add('light-theme');
    } else {
      body.classList.remove('light-theme');
    }
  }, [theme]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['world-cup-data'],
    queryFn: fetchLiveWorldCupData,
    retry: 2
  });

  const matches = (data?.matches || []) as Match[];
  const players = (data?.players || []) as Player[];
  const sources = data?.sources || [];

  const tournaments = Array.from(new Set(matches.map(m => m.tournament || 'Unknown Tournament'))).map(name => ({
    name: name as string,
    count: matches.filter(m => m.tournament === name).length,
    isLive: matches.some(m => m.tournament === name && m.status && m.status.toLowerCase().includes('live'))
  }));

  if (isLoading) {
    return (
      <YStack flex={1} alignItems="center" justifyContent="center" backgroundColor="$bg" gap={16}>
        <Spinner size="large" color="$brand" />
        <Text fontWeight="800" color="$brand" letterSpacing={2} animation="quick" enterStyle={{ opacity: 0, scale: 0.8 }}>
          DRAFTCRICK AI
        </Text>
      </YStack>
    );
  }

  if (error) {
    return (
      <YStack flex={1} alignItems="center" justifyContent="center" backgroundColor="$bg" padding={32} gap={16}>
        <Text color="$red" textAlign="center" fontSize={16} fontWeight="600">
          Unable to sync cricket arena.{'\n'}Please check your connectivity.
        </Text>
        <Button 
          marginTop={16} 
          backgroundColor="$surface" 
          padding={16} 
          borderRadius={8} 
          borderWidth={1}
          borderColor="$border"
          onPress={() => queryClient.invalidateQueries({ queryKey: ['world-cup-data'] })}
        >
          <Text fontWeight="800" color="$brand">RECONNECT</Text>
        </Button>
      </YStack>
    );
  }

  return (
    <Theme name={theme === 'system' ? 'dark' : theme}>
      <YStack flex={1} backgroundColor="$bg" position="relative">
        {/* Header */}
        <XStack 
          paddingHorizontal={24} 
          height={64} 
          alignItems="center" 
          justifyContent="space-between" 
          borderColor="$border" 
          borderBottomWidth={1} 
          backgroundColor="$bg" 
          position="sticky" 
          top={0} 
          zIndex={100}
          animation="quick"
          enterStyle={{ opacity: 0, y: -20 }}
        >
          <XStack alignItems="center" gap={12}>
            <View 
              backgroundColor="$brand" 
              width={32} 
              height={32} 
              borderRadius={8} 
              alignItems="center" 
              justifyContent="center"
              animation="quick"
              hoverStyle={{ scale: 1.1, rotate: '5deg' }}
            >
              <Text fontWeight="900" color="$brandDark">D</Text>
            </View>
            <H1 fontSize={20} letterSpacing={-1} fontWeight="800" color="$color">DraftCrick</H1>
          </XStack>
          
          <Button 
            circular 
            size="$3" 
            onPress={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            icon={theme === 'dark' ? Moon : Sun}
            backgroundColor="$surface"
            borderColor="$border"
            borderWidth={1}
          />
        </XStack>

        <ScrollView flex={1}>
          <YStack 
            paddingHorizontal={20} 
            paddingVertical={24} 
            gap={32} 
            paddingBottom={120}
            className="page-container"
          >
            <Routes>
              <Route path="/" element={
                <YStack gap={32}>
                  {/* Tournaments */}
                  <YStack gap={16} animation="quick" enterStyle={{ opacity: 0, y: 20 }}>
                    <YStack>
                      <Text color="$brand" fontWeight="800" fontSize={11} letterSpacing={2}>ACTIVE EVENTS</Text>
                      <H2 fontSize={24} fontWeight="800" color="$color">Select Tournament</H2>
                    </YStack>
                    
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <XStack gap={16} paddingVertical={8} className="stagger-children">
                        {tournaments.length > 0 ? tournaments.map(t => (
                          <YStack 
                            key={t.name}
                            width={220} 
                            height={130} 
                            borderRadius={16} 
                            padding={20} 
                            justifyContent="space-between" 
                            borderWidth={2}
                            borderColor={selectedTournament === t.name ? '$brand' : '$border'}
                            backgroundColor="$surface"
                            onPress={() => setSelectedTournament(selectedTournament === t.name ? null : t.name)}
                            animation="quick"
                            pressStyle={{ scale: 0.98 }}
                            hoverStyle={{ 
                              borderColor: '$brand', 
                              scale: 1.02,
                              backgroundColor: '$surfaceHover'
                            }}
                          >
                            <XStack justifyContent="space-between">
                              <Trophy size={18} color="$brand" />
                              {t.isLive && (
                                <View 
                                  backgroundColor="$red" 
                                  paddingHorizontal={8} 
                                  paddingVertical={4} 
                                  borderRadius={10}
                                  animation="quick"
                                  hoverStyle={{ scale: 1.1 }}
                                >
                                  <Text fontSize={8} fontWeight="900" color="white">LIVE</Text>
                                </View>
                              )}
                            </XStack>
                            <YStack>
                              <Text fontWeight="800" fontSize={16} color="$color">{t.name}</Text>
                              <Text fontSize={10} color="$brand" fontWeight="600">{t.count} MATCHES</Text>
                            </YStack>
                          </YStack>
                        )) : (
                          <Text opacity={0.5} color="$color">No active tournaments found.</Text>
                        )}
                      </XStack>
                    </ScrollView>
                  </YStack>

                  {/* Matches Grid */}
                  <YStack gap={16} animation="quick" enterStyle={{ opacity: 0, y: 20 }}>
                    <H2 fontSize={20} fontWeight="800" color="$color">Match Arena</H2>
                    <YStack gap={16} className="stagger-children">
                      {matches.length > 0 ? matches
                        .filter(m => !selectedTournament || m.tournament === selectedTournament)
                        .map((m, index) => (
                          <View 
                            key={m.id}
                            animation="quick"
                            enterStyle={{ opacity: 0, y: 20 }}
                            animateOnly={['opacity', 'transform']}
                          >
                            <MatchCard match={m} />
                          </View>
                        )) : (
                          <Text opacity={0.5} color="$color" textAlign="center" paddingVertical={16}>
                            Fetching upcoming matches...
                          </Text>
                        )}
                    </YStack>
                  </YStack>

                  {/* Grounding Info */}
                  {sources.length > 0 && (
                    <YStack 
                      padding={16} 
                      borderRadius={12} 
                      backgroundColor="$surface" 
                      borderWidth={1} 
                      borderColor="$border" 
                      gap={12}
                      animation="quick"
                      enterStyle={{ opacity: 0, scale: 0.95 }}
                    >
                      <Text fontSize={10} fontWeight="900" color="$brand" letterSpacing={1}>
                        POWERED BY LIVE GOOGLE SEARCH
                      </Text>
                      <XStack gap={12} flexWrap="wrap">
                        {sources.map((s: any, i: number) => (
                          <XStack 
                            key={i} 
                            alignItems="center" 
                            gap={4} 
                            cursor="pointer" 
                            animation="quick"
                            hoverStyle={{ scale: 1.05 }}
                            pressStyle={{ scale: 0.95 }}
                            onPress={() => s.web?.uri && window.open(s.web.uri, '_blank')}
                          >
                            <ExternalLink size={10} color="$brand" />
                            <Text fontSize={10} color="$color" fontWeight="600">{s.web?.title || 'Source'}</Text>
                          </XStack>
                        ))}
                      </XStack>
                    </YStack>
                  )}
                </YStack>
              } />

              <Route path="/match/:matchId" element={<MatchCenter />} />
              <Route path="/build" element={<TeamBuilder players={players} />} />
            </Routes>
          </YStack>
        </ScrollView>

        {/* Bottom Nav */}
        <XStack 
          height={84} 
          backgroundColor="$bg" 
          borderColor="$border" 
          borderTopWidth={1} 
          alignItems="center" 
          justifyContent="space-around" 
          paddingHorizontal={24} 
          paddingBottom={16} 
          position="absolute" 
          bottom={0} 
          left={0} 
          right={0} 
          zIndex={100}
          animation="quick"
          enterStyle={{ opacity: 0, y: 20 }}
        >
          <NavItem to="/" icon={Trophy} label="ARENA" active={location.pathname === '/'} />
          <NavItem to="/build" icon={Shield} label="SQUAD" active={location.pathname === '/build'} />
          <NavItem to="/stats" icon={BarChart2} label="STATS" active={location.pathname === '/stats'} />
        </XStack>

        <LiveGuru />
        <GuruBot availablePlayers={players} />
      </YStack>
    </Theme>
  );
};

export default function App() {
  console.log('⚛️ DraftCrick: App starting render...');
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
          <Router>
            <AppContent />
          </Router>
        </TamaguiProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}