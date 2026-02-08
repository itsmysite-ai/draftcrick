
import React from 'react';
import { Link } from 'react-router-dom';
import { XStack, YStack, Text, View } from 'tamagui';

// Enhanced Card component with animations
const Card = ({ bordered, elevate, size, children, ...props }: any) => (
  <View 
    padding="$5" 
    borderRadius={16} 
    borderWidth={bordered ? 1 : 0} 
    borderColor="$border" 
    backgroundColor="$surface" 
    elevation={elevate ? 4 : 0}
    animation="quick"
    hoverStyle={{ 
      scale: 1.02, 
      borderColor: '$brand',
      backgroundColor: '$surfaceHover',
      shadowColor: '$shadowColor',
      shadowRadius: 20,
      shadowOpacity: 0.2,
    }}
    pressStyle={{ scale: 0.98 }}
    {...props}
  >
    {children}
  </View>
);

export const MatchCard: React.FC<{ match: any }> = ({ match }) => {
  const isLive = match.status.toLowerCase().includes('live');

  return (
    <Link to={`/match/${match.id}`} state={{ match }} style={{ textDecoration: 'none' }}>
      <Card 
        bordered 
        elevate 
        size="$4" 
        borderRadius={16} 
        padding="$5" 
        backgroundColor="$surface" 
        borderWidth={1}
        borderColor="$border"
      >
        <YStack gap="$4">
          <XStack justifyContent="space-between" alignItems="center">
            <Text fontSize={10} fontWeight="800" color="$brand" letterSpacing={1} opacity={0.7}>
              {match.tournament.toUpperCase()}
            </Text>
            {isLive && (
              <XStack 
                alignItems="center" 
                gap="$2"
                animation="quick"
                enterStyle={{ opacity: 0, scale: 0.8 }}
              >
                <View 
                  width={6} 
                  height={6} 
                  borderRadius={3} 
                  backgroundColor="$red"
                  animation="bouncy"
                  style={{ 
                    animationDuration: '1s',
                    animationIterationCount: 'infinite',
                  }}
                />
                <Text fontSize={10} fontWeight="900" color="$red">LIVE</Text>
              </XStack>
            )}
          </XStack>

          <XStack alignItems="center" justifyContent="space-between" gap="$4">
            <YStack 
              flex={1} 
              alignItems="center" 
              gap="$2"
              animation="quick"
              enterStyle={{ opacity: 0, x: -20 }}
            >
              <View 
                width={48} 
                height={48} 
                borderRadius={12} 
                backgroundColor="$bgSecondary" 
                alignItems="center" 
                justifyContent="center" 
                borderWidth={1} 
                borderColor="$border"
                animation="quick"
                hoverStyle={{ scale: 1.1, borderColor: '$brand' }}
              >
                <Text fontSize={20} fontWeight="900" color="$brand">{match.homeTeam[0]}</Text>
              </View>
              <Text fontSize={12} fontWeight="800" color="$color" textAlign="center">{match.homeTeam}</Text>
            </YStack>

            <Text 
              fontWeight="900" 
              fontSize={16} 
              color="$brand" 
              fontStyle="italic" 
              opacity={0.3}
              animation="quick"
              enterStyle={{ opacity: 0, scale: 0.5 }}
            >
              VS
            </Text>

            <YStack 
              flex={1} 
              alignItems="center" 
              gap="$2"
              animation="quick"
              enterStyle={{ opacity: 0, x: 20 }}
            >
              <View 
                width={48} 
                height={48} 
                borderRadius={12} 
                backgroundColor="$bgSecondary" 
                alignItems="center" 
                justifyContent="center" 
                borderWidth={1} 
                borderColor="$border"
                animation="quick"
                hoverStyle={{ scale: 1.1, borderColor: '$brand' }}
              >
                <Text fontSize={20} fontWeight="900" color="$brand">{match.awayTeam[0]}</Text>
              </View>
              <Text fontSize={12} fontWeight="800" color="$color" textAlign="center">{match.awayTeam}</Text>
            </YStack>
          </XStack>

          <View 
            backgroundColor="$bgSecondary" 
            borderRadius={8} 
            padding={8} 
            alignItems="center" 
            borderWidth={1} 
            borderColor="$border"
            animation="quick"
            enterStyle={{ opacity: 0, y: 10 }}
          >
            <Text fontSize={10} fontWeight="800" color="$brand" opacity={0.8}>
              {isLive ? 'SCORE UPDATING' : match.startTime}
            </Text>
          </View>
        </YStack>
      </Card>
    </Link>
  );
};