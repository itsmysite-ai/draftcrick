
import { GoogleGenAI, Type, GenerateContentResponse, FunctionDeclaration } from "@google/genai";
import { Player, PlayerRole, MatchStatus } from "../types";

// Keep STUB_MODE toggleable - Set to true for local development without API calls
const STUB_MODE = true;

// Always use a named parameter and process.env.API_KEY
const ai = STUB_MODE ? null : new GoogleGenAI({ apiKey: process.env.API_KEY });

// Mock data for stub mode
const STUB_DATA = {
  matches: [
    { 
      id: '1', 
      homeTeam: 'India', 
      awayTeam: 'Australia', 
      venue: 'Mumbai Stadium', 
      startTime: 'Feb 15, 2026 - 7:30 PM IST', 
      status: MatchStatus.UPCOMING,
      format: 'T20',
      tournament: 'ICC World Cup 2026'
    },
    { 
      id: '2', 
      homeTeam: 'England', 
      awayTeam: 'Pakistan', 
      venue: 'Lords', 
      startTime: 'Feb 16, 2026 - 3:00 PM GMT', 
      status: MatchStatus.UPCOMING,
      format: 'ODI',
      tournament: 'ICC World Cup 2026'
    },
    { 
      id: '3', 
      homeTeam: 'South Africa', 
      awayTeam: 'New Zealand', 
      venue: 'Cape Town', 
      startTime: 'Feb 17, 2026 - 2:00 PM SAST', 
      status: MatchStatus.UPCOMING,
      format: 'T20',
      tournament: 'ICC World Cup 2026'
    },
    { 
      id: '4', 
      homeTeam: 'West Indies', 
      awayTeam: 'Sri Lanka', 
      venue: 'Sabina Park', 
      startTime: 'Feb 18, 2026 - 9:30 AM EST', 
      status: MatchStatus.UPCOMING,
      format: 'ODI',
      tournament: 'ICC World Cup 2026'
    },
    { 
      id: '5', 
      homeTeam: 'Bangladesh', 
      awayTeam: 'Afghanistan', 
      venue: 'Dhaka', 
      startTime: 'Feb 19, 2026 - 1:00 PM BST', 
      status: MatchStatus.UPCOMING,
      format: 'T20',
      tournament: 'ICC World Cup 2026'
    },
    { 
      id: '6', 
      homeTeam: 'Ireland', 
      awayTeam: 'Zimbabwe', 
      venue: 'Dublin', 
      startTime: 'Feb 20, 2026 - 11:00 AM GMT', 
      status: MatchStatus.UPCOMING,
      format: 'ODI',
      tournament: 'ICC World Cup 2026'
    },
  ],
  players: [
    { id: '1', name: 'Virat Kohli', role: PlayerRole.BATSMAN, team: 'India', points: 950, price: 11.5, ownership: 85, form: '🔥', lastPerformance: '89(53)' },
    { id: '2', name: 'Jasprit Bumrah', role: PlayerRole.BOWLER, team: 'India', points: 880, price: 10.0, ownership: 78, form: '🔥', lastPerformance: '3/24(4)' },
    { id: '3', name: 'Steve Smith', role: PlayerRole.BATSMAN, team: 'Australia', points: 920, price: 11.0, ownership: 80, form: '📈', lastPerformance: '76(61)' },
    { id: '4', name: 'Pat Cummins', role: PlayerRole.BOWLER, team: 'Australia', points: 850, price: 9.5, ownership: 72, form: '📈', lastPerformance: '2/31(4)' },
    { id: '5', name: 'Joe Root', role: PlayerRole.BATSMAN, team: 'England', points: 890, price: 10.5, ownership: 75, form: '📈', lastPerformance: '82(70)' },
    { id: '6', name: 'Jofra Archer', role: PlayerRole.BOWLER, team: 'England', points: 820, price: 9.0, ownership: 68, form: '📊', lastPerformance: '2/28(4)' },
    { id: '7', name: 'Babar Azam', role: PlayerRole.BATSMAN, team: 'Pakistan', points: 910, price: 10.8, ownership: 82, form: '🔥', lastPerformance: '91(58)' },
    { id: '8', name: 'Shaheen Afridi', role: PlayerRole.BOWLER, team: 'Pakistan', points: 840, price: 9.3, ownership: 70, form: '📈', lastPerformance: '3/29(4)' },
    { id: '9', name: 'Kane Williamson', role: PlayerRole.BATSMAN, team: 'New Zealand', points: 870, price: 10.2, ownership: 73, form: '📊', lastPerformance: '68(55)' },
    { id: '10', name: 'Trent Boult', role: PlayerRole.BOWLER, team: 'New Zealand', points: 810, price: 8.8, ownership: 65, form: '📊', lastPerformance: '2/32(4)' },
    { id: '11', name: 'Rashid Khan', role: PlayerRole.ALL_ROUNDER, team: 'Afghanistan', points: 860, price: 9.8, ownership: 76, form: '🔥', lastPerformance: '45(28) 2/26' },
    { id: '12', name: 'Andre Russell', role: PlayerRole.ALL_ROUNDER, team: 'West Indies', points: 830, price: 9.5, ownership: 71, form: '📈', lastPerformance: '52(31) 1/28' },
  ]
};

// Tool Declarations for the AI Guru (MCP Simulation)
const squadTools: FunctionDeclaration[] = [
  {
    name: 'optimize_squad',
    parameters: {
      type: Type.OBJECT,
      description: 'Automatically select the best 11 players for the user based on credits and points.',
      properties: {
        strategy: { 
          type: Type.STRING, 
          description: 'The drafting strategy (e.g., "aggressive", "balanced", "bowler-heavy")' 
        }
      },
      required: ['strategy']
    }
  },
  {
    name: 'clear_squad',
    parameters: { 
      type: Type.OBJECT,
      description: 'Remove all selected players from the current team.',
      properties: {} 
    }
  },
  {
    name: 'analyze_current_squad',
    parameters: { 
      type: Type.OBJECT,
      description: 'Provide a detailed statistical breakdown and "Guru Rating" for the users current 11-man team.',
      properties: {} 
    }
  }
];

// Fix: Handle search grounding correctly. 
// Note: When using googleSearch tool, responseMimeType and responseSchema might interfere with grounding metadata.
// Instructions say response.text may not be JSON, so we extract it manually.
export async function fetchLiveWorldCupData() {
  // Return stub data in local development mode
  if (STUB_MODE) {
    return {
      matches: STUB_DATA.matches,
      players: STUB_DATA.players,
      sources: []
    };
  }

  const response: GenerateContentResponse = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: 'List 6 top cricket matches and 12 top fantasy players. Provide the result as a raw JSON object.',
    config: {
      tools: [{ googleSearch: {} }],
    }
  });

  try {
    const text = response.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const data = jsonMatch ? JSON.parse(jsonMatch[0]) : { matches: [], players: [] };
    
    return {
      matches: data.matches || [],
      players: data.players || [],
      sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
    };
  } catch (e) {
    console.error("Failed to parse search-grounded response", e);
    return { matches: [], players: [], sources: [] };
  }
}

// Fix: Use gemini-3-pro-preview for complex analysis with search grounding.
export async function fetchMatchAnalysis(homeTeam: string, awayTeam: string, venue: string) {
  // Return stub data in local development mode
  if (STUB_MODE) {
    return {
      pitchReport: `The ${venue} pitch typically favors batsmen with good bounce and carry. Recent matches show average first innings scores around 280-300.`,
      winProbability: { [homeTeam]: 55, [awayTeam]: 45 },
      keyBattles: [
        `${homeTeam}'s top order vs ${awayTeam}'s pace attack`,
        `${awayTeam}'s middle order vs ${homeTeam}'s spinners`
      ],
      topFantasyPicks: [
        `Star batsman from ${homeTeam} - excellent record at ${venue}`,
        `Leading pace bowler from ${awayTeam} - taking wickets consistently`,
        `All-rounder from ${homeTeam} - contributes with both bat and ball`
      ],
      sources: []
    };
  }

  const response: GenerateContentResponse = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Analyze ${homeTeam} vs ${awayTeam} at ${venue}. Provide pitch report, win probability, key battles, and top fantasy picks in a JSON format.`,
    config: {
      tools: [{ googleSearch: {} }],
    }
  });

  try {
    const text = response.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const data = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    
    return {
      ...data,
      sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
    };
  } catch (e) {
    console.error("Failed to parse match analysis response", e);
    return { sources: [] };
  }
}

export async function askGuruWithTools(message: string, context: { players: Player[], team: Player[] }) {
  // Return stub responses in local development mode
  if (STUB_MODE) {
    const lowerMessage = message.toLowerCase();
    
    // Simple pattern matching for common queries
    if (lowerMessage.includes('pick') || lowerMessage.includes('select') || lowerMessage.includes('build') || lowerMessage.includes('create')) {
      return {
        text: "I can help you build a strong team! Based on your available players and credits, I recommend selecting a balanced mix of batsmen, bowlers, and all-rounders. Would you like me to optimize your squad?",
        functionCalls: undefined
      };
    } else if (lowerMessage.includes('clear') || lowerMessage.includes('remove') || lowerMessage.includes('reset')) {
      return {
        text: "I can clear your current squad if you'd like to start fresh.",
        functionCalls: undefined
      };
    } else if (lowerMessage.includes('analyze') || lowerMessage.includes('rate') || lowerMessage.includes('review')) {
      return {
        text: `Your current team has ${context.team.length} players selected. The team composition looks good with a mix of different roles. Consider the balance between credits spent and potential points.`,
        functionCalls: undefined
      };
    } else {
      return {
        text: "I'm the DraftCrick Guru! I can help you pick players, analyze your team, or clear your squad. What would you like to do?",
        functionCalls: undefined
      };
    }
  }

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `User asks: "${message}". Current Team: ${JSON.stringify(context.team)}. Available: ${JSON.stringify(context.players)}`,
    config: {
      systemInstruction: "You are the DraftCrick Guru. You can chat but also perform actions like optimizing or clearing the squad using tools. If the user asks to 'pick a team' or 'fill my squad', use optimize_squad.",
      tools: [{ functionDeclarations: squadTools }]
    }
  });
  
  return {
    text: response.text,
    functionCalls: response.functionCalls
  };
}

// Fix: Correct iteration through candidates and parts to find the image.
export async function generateMascot(prompt: string) {
  // Return stub placeholder image in local development mode
  if (STUB_MODE) {
    // Return a simple SVG as a data URL for stub mode
    const svgPlaceholder = `<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
      <rect width="200" height="200" fill="#5DB882"/>
      <text x="50%" y="50%" font-family="DM Sans, Arial" font-size="16" fill="#111210" text-anchor="middle" dy=".3em">
        Mascot: ${prompt.substring(0, 20)}
      </text>
    </svg>`;
    const base64 = btoa(svgPlaceholder);
    return `data:image/svg+xml;base64,${base64}`;
  }

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        {
          text: `Generate a vibrant, modern cricket team mascot based on the following theme: ${prompt}. The mascot should be professional, energetic, and suitable for a fantasy sports application logo.`,
        },
      ],
    }
  });

  if (response.candidates?.[0]?.content?.parts) {
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
  }
  return null;
}
