import React from 'react';
import { useLocation, useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Text, View } from 'tamagui';
import { ArrowLeft, Swords, TrendingUp, Info, Target, ExternalLink } from '@tamagui/lucide-icons';
import { fetchMatchAnalysis } from '../services/geminiService.ts';

// Enhanced components with animations
const XStack = (props: any) => <View flexDirection="row" {...props} />;
const YStack = (props: any) => <View flexDirection="column" {...props} />;
const Card = ({ children, ...props }: any) => (
  <View 
    padding={16} 
    borderRadius={16} 
    borderWidth={1} 
    borderColor="$border" 
    backgroundColor="$surface"
    animation="quick"
    hoverStyle={{ 
      backgroundColor: '$surfaceHover',
      borderColor: '$borderHover',
      scale: 1.01
    }}
    {...props}
  >
    {children}
  </View>
);
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
    {Icon && <Icon size={20} color={color || '$color'} />}
    {children}
  </View>
);
const H2 = (props: any) => <Text fontSize={24} fontWeight="900" color="$color" {...props} />;
const H3 = (props: any) => <Text fontSize={18} fontWeight="800" color="$color" {...props} />;
const Progress = ({ value }: any) => (
  <View height={32} borderRadius={4} backgroundColor="$border" overflow="hidden" position="relative">
    <View 
      position="absolute" 
      left={0} 
      top={0} 
      bottom={0} 
      width={`${value}%`} 
      backgroundColor="$brand"
      animation="quick"
      enterStyle={{ width: '0%' }}
    />
  </View>
);
const ScrollView = (props: any) => <View overflow="scroll" {...props} />;
const Separator = (props: any) => <View backgroundColor="$border" height={1} width="100%" {...props} />;
const SizableText = (props: any) => <Text color="$color" {...props} />;

export const MatchCenter: React.FC = () => {
  const { matchId } = useParams();
  const location = useLocation();
  const match = location.state?.match;

  const { data: analysis, isLoading } = useQuery({
    queryKey: ['match-analysis', matchId],
    queryFn: () => fetchMatchAnalysis(match.homeTeam, match.awayTeam, match.venue),
    enabled: !!match,
  });

  if (!match) return (
    <YStack flex={1} alignItems="center" justifyContent="center" padding={40} gap={16}>
      <Text fontWeight="700" color="$color">Match not found.</Text>
      <Link to="/" style={{ textDecoration: 'none' }}>
        <Button backgroundColor="$brand" borderRadius={10}>
          <Text color="$bg" fontWeight="800">BACK TO ARENA</Text>
        </Button>
      </Link>
    </YStack>
  );

  return (
    <YStack gap={32} paddingBottom={48}>
      <XStack 
        alignItems="center" 
        gap={16}
        animation="quick"
        enterStyle={{ opacity: 0, x: -20 }}
      >
        <Link to="/" style={{ textDecoration: 'none' }}>
          <Button icon={ArrowLeft} circular chromeless size="$4" />
        </Link>
        <H2 size="$7" fontWeight="900" letterSpacing={-1}>MATCH CENTER</H2>
      </XStack>

      {/* Scoreboard Card */}
      <Card 
        padding={32} 
        borderRadius={20} 
        alignItems="center"
        animation="quick"
        enterStyle={{ opacity: 0, scale: 0.95 }}
      >
        <Text fontSize={10} fontWeight="900" color="$brand" letterSpacing={2} marginBottom={16}>{match.tournament.toUpperCase()}</Text>
        <XStack alignItems="center" gap={40}>
          <YStack 
            alignItems="center" 
            gap={12}
            animation="quick"
            enterStyle={{ opacity: 0, x: -30 }}
          >
            <View 
              width={72} 
              height={72} 
              borderRadius={24} 
              backgroundColor="$bgSecondary" 
              alignItems="center" 
              justifyContent="center" 
              borderWidth={2} 
              borderColor="$border"
              animation="quick"
              hoverStyle={{ scale: 1.1, borderColor: '$brand' }}
            >
              <Text fontSize={32} fontWeight="900" color="$brand">{match.homeTeam[0]}</Text>
            </View>
            <Text fontWeight="800" fontSize={16} color="$color">{match.homeTeam}</Text>
          </YStack>
          
          <Text 
            fontSize={24} 
            fontWeight="900" 
            fontStyle="italic" 
            opacity={0.2} 
            color="$color"
            animation="quick"
            enterStyle={{ opacity: 0, scale: 0.5 }}
          >
            VS
          </Text>
          
          <YStack 
            alignItems="center" 
            gap={12}
            animation="quick"
            enterStyle={{ opacity: 0, x: 30 }}
          >
            <View 
              width={72} 
              height={72} 
              borderRadius={24} 
              backgroundColor="$bgSecondary" 
              alignItems="center" 
              justifyContent="center" 
              borderWidth={2} 
              borderColor="$border"
              animation="quick"
              hoverStyle={{ scale: 1.1, borderColor: '$brand' }}
            >
              <Text fontSize={32} fontWeight="900" color="$brand">{match.awayTeam[0]}</Text>
            </View>
            <Text fontWeight="800" fontSize={16} color="$color">{match.awayTeam}</Text>
          </YStack>
        </XStack>
        <Separator width="50%" marginVertical={24} />
        <XStack alignItems="center" gap={12} backgroundColor="$bgSecondary" paddingHorizontal={16} paddingVertical={8} borderRadius={10} borderWidth={1} borderColor="$border">
          <Info size={14} color="$brand" />
          <Text fontSize={10} fontWeight="800" color="$color" letterSpacing={1}>{match.venue} • {match.startTime}</Text>
        </XStack>
      </Card>

      <YStack gap={24}>
        <YStack gap={16} animation="quick" enterStyle={{ opacity: 0, y: 20 }}>
          <XStack alignItems="center" gap={8}>
            <Target size={18} color="$brand" />
            <H3 size="$5" fontWeight="800">AI PITCH INTEL</H3>
          </XStack>
          <Card padding={24} borderRadius={16}>
            {isLoading ? (
              <YStack gap={8}>
                <View height={12} backgroundColor="$border" borderRadius={10} animation="pulse" />
                <View height={12} width="80%" backgroundColor="$border" borderRadius={10} animation="pulse" />
              </YStack>
            ) : (
              <SizableText fontSize={14} lineHeight={22} color="$color" opacity={0.8}>
                {analysis?.pitchReport || "Guru AI is analyzing historical ground data and weather patterns..."}
              </SizableText>
            )}
          </Card>
        </YStack>

        <YStack gap={16} animation="quick" enterStyle={{ opacity: 0, y: 20 }}>
          <XStack alignItems="center" gap={8}>
            <TrendingUp size={18} color="$brand" />
            <H3 size="$5" fontWeight="800">WIN PROBABILITY</H3>
          </XStack>
          <YStack gap={8}>
            <XStack justifyContent="space-between" paddingHorizontal={8}>
              <Text fontSize={11} fontWeight="800" color="$color">{match.homeTeam}</Text>
              <Text fontSize={11} fontWeight="800" color="$color">{match.awayTeam}</Text>
            </XStack>
            <Progress value={analysis?.winProbHome || 50} />
            <XStack justifyContent="space-between" paddingHorizontal={8}>
              <Text fontSize={14} fontWeight="900" color="$accent">{analysis?.winProbHome || 50}%</Text>
              <Text fontSize={14} fontWeight="900" color="$brand">{analysis?.winProbAway || 50}%</Text>
            </XStack>
          </YStack>
        </YStack>

        <YStack gap={16} animation="quick" enterStyle={{ opacity: 0, y: 20 }}>
          <XStack alignItems="center" gap={8}>
            <Swords size={18} color="$brand" />
            <H3 size="$5" fontWeight="800">GURU'S TOP PICKS</H3>
          </XStack>
          <YStack gap={12}>
            {analysis?.aiTopPicks?.map((pick: any, i: number) => (
              <Card 
                key={i} 
                padding={16} 
                borderRadius={12}
                animation="quick"
                enterStyle={{ opacity: 0, x: -20 }}
              >
                <YStack gap={4}>
                  <Text fontWeight="900" color="$brand" fontSize={14}>{pick.name}</Text>
                  <Text fontSize={12} opacity={0.7} color="$color">{pick.reason}</Text>
                </YStack>
              </Card>
            ))}
          </YStack>
        </YStack>

        {/* Grounding Sources */}
        {analysis?.sources?.length > 0 && (
          <YStack gap={16} animation="quick" enterStyle={{ opacity: 0, y: 20 }}>
            <Text fontSize={10} fontWeight="900" opacity={0.6} letterSpacing={1} color="$color">DATA SOURCES</Text>
            <XStack gap={12} flexWrap="wrap">
              {analysis.sources.map((s: any, idx: number) => (
                <XStack 
                  key={idx} 
                  alignItems="center" 
                  gap={4} 
                  cursor="pointer"
                  animation="quick"
                  hoverStyle={{ scale: 1.05 }}
                  pressStyle={{ scale: 0.95 }}
                  onPress={() => s.web?.uri && window.open(s.web.uri, '_blank')}
                >
                  <ExternalLink size={10} color="$brand" />
                  <Text fontSize={10} color="$brand" fontWeight="700">{s.web?.title || 'Source'}</Text>
                </XStack>
              ))}
            </XStack>
          </YStack>
        )}

        <Link to="/build" state={{ match }} style={{ textDecoration: 'none' }}>
          <Button 
            size="$6" 
            backgroundColor="$brand" 
            borderRadius={10} 
            marginTop={16}
            animation="quick"
            hoverStyle={{ scale: 1.02, backgroundColor: '$brandHover' }}
          >
            <Text color="$bg" fontWeight="900" fontSize={14} letterSpacing={1}>DRAFT SQUAD FOR THIS MATCH</Text>
          </Button>
        </Link>
      </YStack>
    </YStack>
  );
};