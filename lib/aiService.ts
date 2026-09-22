import { Ride } from '../context/AppContext';

export interface AIResponse {
  reply: string;
  recommendedRideIds?: string[];
  prefillOrigin?: string;
  prefillDestination?: string;
}

export interface ChatHistoryMessage {
  id?: string;
  sender: 'user' | 'ai';
  text: string;
}

export interface QuerySarathiOptions {
  userPrompt: string;
  rides: Ride[];
  userLocation?: string;
  userProfile?: {
    name?: string;
    role?: 'passenger' | 'driver';
    kycStatus?: string;
  } | null;
  conversationHistory?: ChatHistoryMessage[];
}

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';

/**
 * Queries Google Gemini API with active Sarathi rides context, multi-turn history,
 * user role, and dynamic intent analysis.
 */
export async function querySarathiAI(
  promptOrOptions: string | QuerySarathiOptions,
  legacyRides?: Ride[],
  legacyLocation: string = 'Nepal'
): Promise<AIResponse> {
  let userPrompt = '';
  let rides: Ride[] = [];
  let userLocation = 'Nepal';
  let userProfile: QuerySarathiOptions['userProfile'] = null;
  let conversationHistory: ChatHistoryMessage[] = [];

  if (typeof promptOrOptions === 'object' && promptOrOptions !== null) {
    userPrompt = promptOrOptions.userPrompt || '';
    rides = promptOrOptions.rides || [];
    userLocation = promptOrOptions.userLocation || 'Nepal';
    userProfile = promptOrOptions.userProfile || null;
    conversationHistory = promptOrOptions.conversationHistory || [];
  } else {
    userPrompt = promptOrOptions || '';
    rides = legacyRides || [];
    userLocation = legacyLocation || 'Nepal';
  }

  const cleanPrompt = userPrompt.trim();
  if (!cleanPrompt) {
    return {
      reply: "Please type a question or destination so I can assist you with your Sarathi journey!",
      recommendedRideIds: [],
    };
  }

  // Filter active rides only for the AI prompt
  const activeOnlyRides = rides.filter(r => (r.status === 'active' || !r.status) && r.seatsLeft > 0);

  // Format active rides context for the AI prompt
  const activeRidesSummary = activeOnlyRides.map(r => ({
    id: r.id,
    riderName: r.riderName,
    rating: r.rating,
    vehicle: `${r.vehicleName} (${r.vehicleType}, ${r.vehicleNumber})`,
    priceNPR: r.price,
    seatsLeft: r.seatsLeft,
    departureTime: r.departureTime,
    origin: r.pickupPoint,
    route: r.route,
  }));

  const userName = userProfile?.name || 'Commuter';
  const userRole = userProfile?.role || 'passenger';

  const systemContext = `You are Sarathi Smart AI, the official intelligent assistant on the Sarathi Ride-Sharing App in Nepal.

USER CONTEXT:
- Name: ${userName}
- Role: ${userRole.toUpperCase()} (${userRole === 'driver' ? 'Driver / Route Publisher' : 'Passenger / Commuter'})
- Location: ${userLocation}

CRITICAL RULES & POLICIES:
1. PAYMENT POLICY: Sarathi currently supports CASH PAYMENT ONLY. There is NO online payment, digital wallet (eSewa, Khalti), or card payment functionality for now. If a user asks about payment methods, clearly explain that Sarathi currently supports cash payment directly to the rider upon trip arrival, and digital payments will be added in a future update. Never show, suggest, or simulate online payment methods.
2. DYNAMIC INTENT ANALYSIS: Understand and answer ANY question related to Sarathi dynamically based on the user's specific question, active rides data, user role, and conversation history. Never force a predefined or hardcoded answer.
3. CONVERSATION CONTEXT: Maintain multi-turn conversation context. Use previous messages to understand follow-up questions (e.g. "which one is cheaper?", "what time does he leave?", "can I book it?").
4. OUT-OF-CONTEXT QUESTIONS: If the user asks a question completely unrelated to Sarathi, ride-sharing, or commuting in Nepal (e.g. coding, world capitals, cooking recipes, movies, math problems), politely explain that you are focused on helping with Sarathi ride-sharing and route navigation in Nepal, and gently guide the user back to Sarathi travel topics.
5. SARATHI POLICIES & OFF-FLOW QUESTIONS:
   - Free Rides / Promo: Explain that Sarathi rides are shared fuel-cost rides set by local peer drivers at budget-friendly rates. Rides are not completely free, but seat prices are kept as affordable as possible.
   - Pets & Heavy Luggage: Explain that helmets are provided by riders for safety. Small backpacks fit easily, but for pets or heavy luggage, passengers should check with the rider via Sarathi Chat before booking.
   - Safety & OTP: Explain 4-digit Pickup/Completion OTP verification and the 1-tap Emergency SOS feature.
   - Driver KYC & Posting Routes: Switch profile to Driver Mode, complete KYC verification (license & vehicle plate), then tap (+) Post.
6. RIDE RECOMMENDATIONS: Recommend active rides ONLY when the user is explicitly searching for rides or asking about travel options.
7. FORMATTING: Do NOT use raw markdown bold syntax like **text** or **Driver** in the JSON reply string. Keep all text clean, readable, and friendly.

AVAILABLE ACTIVE LIVE RIDES ON SARATHI:
${JSON.stringify(activeRidesSummary, null, 2)}

EXPECTED JSON RESPONSE FORMAT:
Return a valid JSON object with:
{
  "reply": "Conversational response dynamically answering the user in clean text without raw asterisks",
  "recommendedRideIds": ["ride_id_1"]
}`;

  // Build multi-turn conversation payload for Gemini API
  const recentHistory = (conversationHistory || []).slice(-6).filter(m => m.text);
  const contentsPayload = [
    {
      role: 'user',
      parts: [{ text: systemContext }],
    },
    ...recentHistory.map(h => ({
      role: h.sender === 'user' ? 'user' : 'model',
      parts: [{ text: h.text }],
    })),
    {
      role: 'user',
      parts: [{ text: `User Question (${userName}): "${userPrompt}"` }],
    },
  ];

  // Attempt live Gemini API Call if key is present
  if (GEMINI_API_KEY && !GEMINI_API_KEY.includes('YOUR_')) {
    const candidateModels = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'];

    for (const modelName of candidateModels) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              contents: contentsPayload,
              generationConfig: {
                temperature: 0.4,
              },
            }),
          }
        );

        clearTimeout(timeoutId);

        if (response.ok) {
          const json = await response.json();
          let candidateText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (candidateText) {
            candidateText = candidateText.replace(/```json/gi, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(candidateText);
            return {
              reply: parsed.reply || 'Here is the information you requested:',
              recommendedRideIds: Array.isArray(parsed.recommendedRideIds) ? parsed.recommendedRideIds : [],
              prefillOrigin: parsed.prefillOrigin,
              prefillDestination: parsed.prefillDestination,
            };
          }
        }
      } catch (err) {
        clearTimeout(timeoutId);
      }
    }
  }

  // Fallback Engine if API call is unavailable or timed out
  return parseLocalAiFallback(userPrompt, rides, userProfile, conversationHistory);
}

/**
 * Intelligent dynamic local search & conversational fallback engine
 */
function parseLocalAiFallback(
  userPrompt: string,
  rides: Ride[],
  userProfile?: QuerySarathiOptions['userProfile'],
  conversationHistory?: ChatHistoryMessage[]
): AIResponse {
  const q = userPrompt.toLowerCase().trim();
  const userName = userProfile?.name ? userProfile.name.split(' ')[0] : 'there';
  const isDriver = userProfile?.role === 'driver';

  // 1. Payment Policy Queries — CASH ONLY
  if (q.includes('pay') || q.includes('payment') || q.includes('cash') || q.includes('esewa') || q.includes('khalti') || q.includes('card') || q.includes('wallet') || q.includes('bank')) {
    return {
      reply: `Sarathi currently supports cash payment only. You can pay your rider directly in cash when you reach your destination. Digital payment options (eSewa, Khalti, and cards) will be introduced in a future update!`,
      recommendedRideIds: [],
    };
  }

  // 2. Completely Unrelated / Out-of-Context Detection
  const isOffTopic =
    q.includes('cook') ||
    q.includes('recipe') ||
    q.includes('momo recipe') ||
    q.includes('capital of') ||
    q.includes('president') ||
    q.includes('prime minister') ||
    q.includes('programming') ||
    q.includes('python') ||
    q.includes('javascript') ||
    q.includes('movie') ||
    q.includes('song') ||
    q.includes('math') ||
    q.includes('2+2') ||
    q.includes('tell a joke') ||
    q.includes('tell me a story');

  if (isOffTopic) {
    return {
      reply: `I am Sarathi Smart AI, designed specifically to assist you with Sarathi ride-sharing, route navigation, and commuting in Nepal! I'm unable to answer off-topic questions, but feel free to ask me anything about finding rides, checking prices, safety features, or posting routes!`,
      recommendedRideIds: [],
    };
  }

  // 3. Social & Greetings
  if (q.includes('how are you') || q.includes('how r u') || q.includes('k cha') || q.includes('sanchai') || q.includes('how is it going')) {
    return {
      reply: `I am doing great, ${userName}, thank you for asking! 😊 Ready to help you with rides, route details, or any questions about Sarathi today. How can I assist you?`,
      recommendedRideIds: [],
    };
  }

  if (q.includes('thank') || q.includes('dhanyabad') || q.includes('dhanyabhad') || q.includes('great thanks')) {
    return {
      reply: `You're very welcome, ${userName}! I'm always happy to assist. Have a wonderful and safe journey with Sarathi! 🚗✨`,
      recommendedRideIds: [],
    };
  }

  if (q.includes('good night') || q.includes('bye') || q.includes('see you') || q.includes('take care')) {
    return {
      reply: `Goodbye ${userName}! Have a wonderful time, and feel free to check back whenever you need travel info or a ride next! 👋`,
      recommendedRideIds: [],
    };
  }

  if (q.includes('who created') || q.includes('who made') || q.includes('who built') || q.includes('who developed')) {
    return {
      reply: "I was created as Sarathi Smart AI for the Sarathi Ride-Sharing app in Nepal to give fast, helpful, and transparent answers to all passenger and driver queries!",
      recommendedRideIds: [],
    };
  }

  if (q.includes('free ride') || q.includes('free') || q.includes('discount') || q.includes('promo') || q.includes('coupon')) {
    return {
      reply: "Sarathi rides are shared fuel-cost rides offered directly by local peer drivers at low, budget-friendly rates. While rides are not free, seat prices are kept as low as possible to keep commuting affordable!",
      recommendedRideIds: [],
    };
  }

  if (q.includes('pet') || q.includes('dog') || q.includes('cat') || q.includes('animal')) {
    return {
      reply: "Carrying pets depends on the vehicle type and rider preference. For motorbike rides, small pets in secure carriers may be allowed if agreed upon. We recommend sending a message to your driver via Sarathi Chat before booking!",
      recommendedRideIds: [],
    };
  }

  if (q.includes('safety') || q.includes('otp') || q.includes('code') || q.includes('pin') || q.includes('verify') || q.includes('sos') || q.includes('emergency')) {
    return {
      reply: "Your safety is our priority! Every Sarathi ride uses 4-digit Pickup and Completion OTP codes to verify identity before a trip begins and ends. An Emergency SOS button is also available during live trip tracking.",
      recommendedRideIds: [],
    };
  }

  if (q.includes('become a driver') || q.includes('post ride') || q.includes('offer ride') || q.includes('kyc') || q.includes('driver mode') || q.includes('publish route')) {
    return {
      reply: "To offer rides on Sarathi, switch your profile to Driver Mode and complete KYC verification by uploading your license and vehicle plate details. Once verified, tap the (+) Post button on your bottom navigation bar to publish routes!",
      recommendedRideIds: [],
    };
  }

  if (q.includes('what is sarathi') || q.includes('about sarathi') || q.includes('how does it work')) {
    return {
      reply: "Sarathi is Nepal's premier peer-to-peer ride-sharing platform connecting commuters with drivers traveling along the same route. Passengers can search routes, book seats, track trips live with OTP verification, and pay in cash!",
      recommendedRideIds: [],
    };
  }

  // 4. Explicit Ride Search & Location Queries
  const isSearchQuery =
    q.includes('ride') ||
    q.includes('rider') ||
    q.includes('trip') ||
    q.includes('go to') ||
    q.includes('going') ||
    q.includes('cheap') ||
    q.includes('cost') ||
    q.includes('price') ||
    q.includes('available') ||
    q.includes('kathmandu') ||
    q.includes('pokhara') ||
    q.includes('lalitpur') ||
    q.includes('koteshwor') ||
    q.includes('balkhu') ||
    q.includes('thamel') ||
    q.includes('bhaktapur') ||
    q.includes('chabahil') ||
    q.includes('kalanki') ||
    q.includes('patan') ||
    q.includes('banepa') ||
    q.includes('search');

  if (isSearchQuery) {
    const isCheap = q.includes('cheap') || q.includes('lowest') || q.includes('price');
    const isTopRated = q.includes('rating') || q.includes('best') || q.includes('top');

    let matched = rides.filter(r => (r.status === 'active' || !r.status) && r.seatsLeft > 0);

    const words = q.split(/\s+/);
    const matchedLocationRide = matched.filter(r => {
      const routeStr = (r.route || []).join(' ').toLowerCase();
      const pickupStr = (r.pickupPoint || '').toLowerCase();
      return words.some(w => w.length > 3 && (routeStr.includes(w) || pickupStr.includes(w)));
    });

    if (matchedLocationRide.length > 0) {
      matched = matchedLocationRide;
    }

    if (isCheap) {
      matched.sort((a, b) => a.price - b.price);
    } else if (isTopRated) {
      matched.sort((a, b) => (b.rating || 5) - (a.rating || 5));
    }

    const recIds = matched.slice(0, 3).map(r => r.id);

    if (recIds.length > 0) {
      const bestRide = matched[0];
      const targetLoc = words.find(w => w.length > 3 && !['ride', 'rider', 'cheap', 'best', 'cost', 'show', 'find', 'with', 'from', 'this', 'that', 'have', 'there', 'what', 'when', 'where', 'some', 'is', 'are', 'available', 'going', 'to'].includes(w));
      const locName = targetLoc ? targetLoc.charAt(0).toUpperCase() + targetLoc.slice(1) : (bestRide.route[bestRide.route.length - 1] || 'your destination');

      let replyMsg = "";

      if (isCheap) {
        replyMsg = `Here are the most budget-friendly rides available right now! ${bestRide.riderName} (${bestRide.vehicleName}) offers the lowest fare at NPR ${bestRide.price}/seat along the ${bestRide.pickupPoint} ➔ ${bestRide.route[bestRide.route.length - 1] || 'Destination'} route (Departs: ${bestRide.departureTime}).`;
      } else if (isTopRated) {
        replyMsg = `Here are the highest-rated drivers available! ${bestRide.riderName} is rated ★${(bestRide.rating || 5).toFixed(1)} driving a ${bestRide.vehicleName}, going from ${bestRide.pickupPoint} ➔ ${bestRide.route[bestRide.route.length - 1] || 'Destination'} for NPR ${bestRide.price}/seat.`;
      } else if (q.includes('soon') || q.includes('time') || q.includes('earliest') || q.includes('now') || q.includes('leaving')) {
        replyMsg = `Here are the rides departing soonest! ${bestRide.riderName} (${bestRide.vehicleName}) is leaving at ${bestRide.departureTime} from ${bestRide.pickupPoint} to ${bestRide.route[bestRide.route.length - 1] || 'Destination'} for NPR ${bestRide.price}/seat.`;
      } else if (matchedLocationRide.length > 0) {
        replyMsg = `Yes! I found ${matched.length} driver(s) traveling toward ${locName}. ${bestRide.riderName} is driving a ${bestRide.vehicleName} along ${bestRide.pickupPoint} ➔ ${bestRide.route[bestRide.route.length - 1] || 'Destination'} for NPR ${bestRide.price}/seat (Departs: ${bestRide.departureTime}).`;
      } else {
        replyMsg = `Great news! I found ${matched.length} active ride offer(s) available. ${bestRide.riderName} (${bestRide.vehicleName}) is departing from ${bestRide.pickupPoint} to ${bestRide.route[bestRide.route.length - 1] || 'Destination'} for NPR ${bestRide.price}/seat (Departs: ${bestRide.departureTime}).`;
      }

      return {
        reply: replyMsg,
        recommendedRideIds: recIds,
      };
    }

    return {
      reply: `There are currently no active ride offers matching "${userPrompt}". Drivers publish new routes continuously — check back soon or try searching another location!`,
      recommendedRideIds: [],
    };
  }

  // 5. Default General Conversational Response
  return {
    reply: `I am Sarathi Smart AI, here to assist you with all your travel and ride-sharing needs across Nepal. Ask me about finding rides, route prices, cash payment rules, safety codes, or posting routes!`,
    recommendedRideIds: [],
  };
}

