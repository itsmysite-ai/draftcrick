import React, { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { YStack, XStack, Text, View } from 'tamagui';
import { Player, PlayerRole } from '../types.ts';
import { useStore } from '../store.ts';
import { Trash2, Zap, UserPlus, UserMinus } from '@tamagui/lucide-icons';

// Enhanced components with animations
const Card = ({ children, bordered, elevate, size, ...props }: any) => (
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
const ScrollView = (props: any) => <View overflow="scroll" {...props} />;

const Separator: any = ({ vertical, height, ...props }: any) => (
  <View 
    backgroundColor="$border" 
    height={vertical ? (height || 8) : 1} 
    width={vertical ? 1 : "100%"} 
    {...props} 
  />
);

const Progress = ({ value, children, ...props }: any) => (
  <View 
    height={8} 
    borderRadius={10} 
    backgroundColor="$border" 
    overflow="hidden" 
    position="relative" 
    {...props}
  >
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
    {children}
  </View>
);
Progress.Indicator = (props: any) => <View backgroundColor="$brand" height="100%" {...props} />;

interface TeamBuilderProps {
  players: Player[];
}

export const TeamBuilder: React.FC<TeamBuilderProps> = ({ players }) => {
  const location = useLocation();
  const matchContext = location.state?.match;
  const { userTeam, togglePlayer, setUserTeam } = useStore();
  const [filter, setFilter] = useState<PlayerRole | 'ALL'>('ALL');

  const budget = 100;
  const usedBudget = userTeam.reduce((sum, p) => sum + p.price, 0);
  const remainingBudget = budget - usedBudget;
  const progressValue = (userTeam.length / 11) * 100;

  const availablePlayers = useMemo(() => {
    if (!matchContext) return players;
    const teams = [matchContext.homeTeam.toLowerCase(), matchContext.awayTeam.toLowerCase()];
    return players.filter(p => teams.some(t => p.team.toLowerCase().includes(t) || t.includes(p.team.toLowerCase())));
  }, [players, matchContext]);

  const filteredPlayers = filter === 'ALL' ? availablePlayers : availablePlayers.filter(p => p.role === filter);

  return (
    <YStack gap={24}>
      {matchContext && (
        <XStack 
          backgroundColor="$surface" 
          padding={16} 
          borderRadius={12} 
          alignItems="center" 
          justifyContent="space-between" 
          borderWidth={2} 
          borderColor="$brand" 
          borderStyle="dashed"
          animation="quick"
          enterStyle={{ opacity: 0, scale: 0.95 }}
          hoverStyle={{ scale: 1.01 }}
        >
          <XStack alignItems="center" gap={12}>
            <Zap size={20} color="$brand" />
            <YStack>
              <Text fontSize={10} fontWeight="800" color="$brand" letterSpacing={1}>CONTEXTUAL DRAFT</Text>
              <Text fontWeight="700" fontSize={14} color="$color">{matchContext.homeTeam} vs {matchContext.awayTeam}</Text>
            </YStack>
          </XStack>
          <View 
            backgroundColor="$bg" 
            paddingHorizontal={12} 
            paddingVertical={4} 
            borderRadius={10} 
            borderWidth={1} 
            borderColor="$border"
          >
            <Text fontSize={10} fontWeight="800" color="$color">{availablePlayers.length} POOL</Text>
          </View>
        </XStack>
      )}

      {/* Squad Overview Card */}
      <Card 
        padding={24} 
        borderRadius={16} 
        backgroundColor="$surface" 
        borderWidth={1} 
        borderColor="$border"
        animation="quick"
        enterStyle={{ opacity: 0, y: 20 }}
      >
        <YStack gap={16}>
          <XStack justifyContent="space-between" alignItems="flex-end">
            <YStack>
              <Text fontSize={10} fontWeight="800" color="$color" opacity={0.5} letterSpacing={2}>SQUAD</Text>
              <XStack alignItems="baseline" gap={8}>
                <Text 
                  fontSize={32} 
                  fontWeight="900" 
                  color="$brand"
                  animation="bouncy"
                  key={userTeam.length}
                  enterStyle={{ scale: 1.3 }}
                >
                  {userTeam.length}
                </Text>
                <Text fontSize={16} fontWeight="700" color="$color" opacity={0.3}>/ 11</Text>
              </XStack>
            </YStack>
            <YStack alignItems="flex-end">
              <Text fontSize={10} fontWeight="800" color="$color" opacity={0.5} letterSpacing={2}>BUDGET</Text>
              <Text 
                fontSize={28} 
                fontWeight="900" 
                color="$color"
                animation="quick"
                key={remainingBudget}
                enterStyle={{ scale: 1.1 }}
              >
                ₹{remainingBudget.toFixed(1)}
              </Text>
            </YStack>
          </XStack>
          
          <YStack gap={8}>
            <Progress value={progressValue} height={8} borderRadius={10}>
              <Progress.Indicator backgroundColor="$brand" />
            </Progress>
            <XStack justifyContent="space-between">
              <Text fontSize={10} fontWeight="700" color="$color" opacity={0.5}>{progressValue.toFixed(0)}% COMPLETE</Text>
              {userTeam.length > 0 && (
                <Button 
                  size="$1" 
                  chromeless 
                  icon={Trash2} 
                  onPress={() => setUserTeam([])}
                >
                  <Text fontSize={9} fontWeight="800" color="$red">CLEAR ALL</Text>
                </Button>
              )}
            </XStack>
          </YStack>
        </YStack>
      </Card>

      {/* Role Filter */}
      <ScrollView horizontal>
        <XStack gap={8} paddingVertical={8}>
          {['ALL', ...Object.values(PlayerRole)].map(role => (
            <Button
              key={role}
              size="$3"
              borderRadius={10}
              backgroundColor={filter === role ? '$brand' : '$surface'}
              borderColor={filter === role ? '$brand' : '$border'}
              borderWidth={1}
              onPress={() => setFilter(role as any)}
              animation="quick"
              hoverStyle={{ 
                scale: 1.05,
                backgroundColor: filter === role ? '$brandHover' : '$surfaceHover'
              }}
            >
              <Text 
                fontSize={10} 
                fontWeight="800" 
                color={filter === role ? '$bg' : '$color'}
                letterSpacing={1}
              >
                {role}
              </Text>
            </Button>
          ))}
        </XStack>
      </ScrollView>

      {/* Player List */}
      <YStack gap={12} paddingBottom={80}>
        {filteredPlayers.length > 0 ? filteredPlayers.map((p, index) => {
          const isSelected = userTeam.find(item => item.id === p.id);
          return (
            <Card 
              key={p.id}
              padding={16} 
              borderRadius={12} 
              backgroundColor={isSelected ? '$surface' : '$bg'}
              borderWidth={1} 
              borderColor={isSelected ? '$brand' : '$border'}
              onPress={() => togglePlayer(p)}
              animation="quick"
              enterStyle={{ opacity: 0, x: -20 }}
              hoverStyle={{ 
                scale: 1.01,
                borderColor: '$brand',
                backgroundColor: '$surfaceHover'
              }}
            >
              <XStack alignItems="center" justifyContent="space-between">
                <XStack alignItems="center" gap={16}>
                  <View 
                    width={40} 
                    height={40} 
                    borderRadius={12} 
                    backgroundColor="$bgSecondary" 
                    alignItems="center" 
                    justifyContent="center" 
                    borderWidth={1} 
                    borderColor="$border"
                    animation="quick"
                    hoverStyle={{ scale: 1.1, borderColor: '$brand' }}
                  >
                    <Text fontWeight="900" color="$brand">{p.name[0]}</Text>
                  </View>
                  <YStack>
                    <Text fontWeight="800" fontSize={14} color="$color">{p.name}</Text>
                    <XStack alignItems="center" gap={8}>
                      <Text fontSize={10} fontWeight="700" color="$color" opacity={0.5} letterSpacing={1}>{p.role}</Text>
                      <Separator vertical height={8} />
                      <Text fontSize={10} fontWeight="700" color="$color" opacity={0.5} letterSpacing={1}>{p.team}</Text>
                    </XStack>
                  </YStack>
                </XStack>
                <XStack alignItems="center" gap={16}>
                  <YStack alignItems="flex-end">
                    <Text fontWeight="900" fontSize={14} color="$color">₹{p.price}</Text>
                    <Text fontSize={9} fontWeight="700" color="$brand">{p.points} PTS</Text>
                  </YStack>
                  <Button 
                    circular 
                    size="$3" 
                    backgroundColor={isSelected ? '$red' : '$brand'} 
                    icon={isSelected ? UserMinus : UserPlus}
                    onPress={(e: any) => {
                      e.stopPropagation();
                      togglePlayer(p);
                    }}
                  />
                </XStack>
              </XStack>
            </Card>
          );
        }) : (
          <Text opacity={0.5} color="$color" textAlign="center" paddingVertical={40}>
            No players found matching this filter.
          </Text>
        )}
      </YStack>
    </YStack>
  );
};