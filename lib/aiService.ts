import { Ride } from '../context/AppContext';

export interface AIResponse {
  reply: string;
  recommendedRideIds?: string[];
  prefillOrigin?: string;
  prefillDestination?: string;
}

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';

/**
 * Queries Google Gemini API with active Sarathi rides context,
 * providing natural, helpful, and conversational responses for passengers.
 */
export async function querySarathiAI(
  userPrompt: string,
  rides: Ride[],
  userLocation: string = 'Nepal'
): Promise<AIResponse> {
  // Format active rides context for the AI prompt
  const activeRidesSummary = rides.map(r => ({
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

  const systemContext = `You are Sarathi Smart AI, an intelligent, conversational ride & route assistant for passengers on the Sarathi Ride-Sharing App in Nepal.

CONVERSATIONAL RULES:
1. Be natural, polite, and helpful. Match the tone of the passenger's message.
2. If the passenger greets you ("good morning", "hello", "hi", "hey"), respond warmly and ask how you can help with their travel today.
3. If the passenger asks for rides ("Is there any rider for Kathmandu?", "Any other rides available?", "Show me cheap options"), answer directly based on the active rides dataset below.
4. When recommending rides, include the driver name, vehicle, price in NPR, departure time, seats left, and route corridor.
5. If no rides match the exact request, inform the passenger nicely and mention nearby or alternative routes if available.
6. Do NOT use markdown bold syntax like **text** or ** Driver** in the reply. Cleanly write driver names and text in plain conversational text.

AVAILABLE ACTIVE RIDES ON SARATHI:
${JSON.stringify(activeRidesSummary, null, 2)}

USER LOCATION CONTEXT: ${userLocation}

EXPECTED JSON RESPONSE FORMAT:
Return a valid JSON object with:
{
  "reply": "Conversational response answering the user in plain text without raw asterisks",
  "recommendedRideIds": ["ride_id_1", "ride_id_2"],
  "prefillOrigin": "Optional string",
  "prefillDestination": "Optional string"
}`;

  // Attempt live Gemini API Call if key is present
  if (GEMINI_API_KEY && !GEMINI_API_KEY.includes('YOUR_')) {
    const candidateModels = ['gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-flash-latest'];

    for (const modelName of candidateModels) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  role: 'user',
                  parts: [
                    { text: systemContext },
                    { text: `Passenger Query: "${userPrompt}"` },
                  ],
                },
              ],
              generationConfig: {
                temperature: 0.3,
              },
            }),
          }
        );

        if (response.ok) {
          const json = await response.json();
          let candidateText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (candidateText) {
            candidateText = candidateText.replace(/```json/gi, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(candidateText);
            return {
              reply: parsed.reply || 'Here are the matching ride options:',
              recommendedRideIds: Array.isArray(parsed.recommendedRideIds) ? parsed.recommendedRideIds : [],
              prefillOrigin: parsed.prefillOrigin,
              prefillDestination: parsed.prefillDestination,
            };
          }
        } else {
          console.warn(`[Sarathi AI] Gemini API (${modelName}) status:`, response.status);
        }
      } catch (err) {
        console.warn(`[Sarathi AI] Gemini API (${modelName}) error:`, err);
      }
    }
  }

  // Direct Local Fallback Engine if API call is unavailable
  return parseLocalAiFallback(userPrompt, rides);
}

/**
 * Intelligent local search & conversational fallback engine
 */
function parseLocalAiFallback(userPrompt: string, rides: Ride[]): AIResponse {
  const q = userPrompt.toLowerCase().trim();

  // Handle greetings
  const isGreeting =
    q === 'hi' ||
    q === 'hello' ||
    q === 'hey' ||
    q.includes('good morning') ||
    q.includes('good evening') ||
    q.includes('good afternoon') ||
    q.includes('namaste');

  if (isGreeting) {
    return {
      reply: 'Hello! How can I help you find a ride, check prices, or evaluate routes today?',
      recommendedRideIds: [],
    };
  }

  const isCheap = q.includes('cheap') || q.includes('price') || q.includes('cost') || q.includes('lowest');
  const isTopRated = q.includes('rating') || q.includes('best') || q.includes('top');

  let matched = rides.filter(r => r.seatsLeft > 0);

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
    let replyMsg = `Found ${matched.length} ride(s) matching your request:\n\n`;
    replyMsg += `• ${bestRide.riderName} (${bestRide.vehicleName}) — ${bestRide.pickupPoint} ➔ ${bestRide.route[bestRide.route.length - 1] || 'Destination'} for NPR ${bestRide.price}/seat (Departs: ${bestRide.departureTime}, ★${bestRide.rating.toFixed(1)})`;

    return {
      reply: replyMsg,
      recommendedRideIds: recIds,
    };
  }

  return {
    reply: `There are currently no active ride offers matching "${userPrompt}". You can post a search or check back soon as drivers publish new routes continuously!`,
    recommendedRideIds: [],
  };
}
