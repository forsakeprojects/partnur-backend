const OpenAI = require('openai');

class AIService {
    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
    }

    // Extract profile information from user message
    async extractProfileInfo(message, currentProfile) {
        try {
            const extractionPrompt = `
You are an information extraction expert for Indian small business profiles.

Current user profile: ${JSON.stringify(currentProfile, null, 2)}

User message: "${message}"

Extract ONLY NEW information that can update the user profile. Return a JSON object with only the fields that have new information.

Available fields to extract:
- business_type (e.g., "salon", "restaurant", "grocery store")
- location_city, location_state
- monthly_revenue (number in rupees)
- peak_hours (array like ["09:00-12:00", "18:00-21:00"])
- peak_days (array like ["Saturday", "Sunday"])
- top_products (array of product/service names)
- staff_count (number)
- staff_roles (array like ["Manager", "Helper"])
- supplier_name, inventory_source (text)
- payment_methods (array like ["Cash", "UPI", "Card"])
- ad_channels (array like ["WhatsApp", "Facebook", "Flyers"])
- platforms_used (array like ["Zomato", "Swiggy", "Meesho"])
- past_campaigns (array of campaign descriptions)
- goals (array like ["increase sales", "hire staff"])
- challenges (array like ["low footfall", "competition"])
- pricing_model ("fixed", "seasonal", "discount-based")

Examples:
- "I run a salon in Kanpur" → {"business_type": "salon", "location_city": "Kanpur"}
- "I earn around 80k per month" → {"monthly_revenue": 80000}
- "I get my stock from Meesho" → {"platforms_used": ["Meesho"], "inventory_source": "Meesho"}
- "Business is good on weekends" → {"peak_days": ["Saturday", "Sunday"]}

Return only valid JSON, no explanations:
`;

            const response = await this.openai.chat.completions.create({
                model: "gpt-4",
                messages: [{ role: "user", content: extractionPrompt }],
                temperature: 0.1,
                max_tokens: 300
            });

            const extracted = JSON.parse(response.choices[0].message.content);
            return extracted || {};
        } catch (error) {
            console.error('Error extracting profile info:', error);
            return {};
        }
    }

    // Generate AI response using user profile context
    async generateResponse(message, userProfile) {
        try {
            const systemPrompt = this.buildSystemPrompt(userProfile);
            
            const response = await this.openai.chat.completions.create({
                model: "gpt-4",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: message }
                ],
                temperature: 0.7,
                max_tokens: 500
            });

            return {
                content: response.choices[0].message.content,
                contextUsed: this.getRelevantContext(userProfile),
                suggestions: this.generateFollowUpSuggestions(message, userProfile)
            };
        } catch (error) {
            console.error('Error generating AI response:', error);
            return {
                content: "I'm having trouble processing your request right now. Please try again in a moment.",
                contextUsed: {},
                suggestions: []
            };
        }
    }

    // Build system prompt with user context
    buildSystemPrompt(profile) {
        const contextParts = [];

        // Basic business context
        if (profile.business_type) {
            contextParts.push(`The user runs a ${profile.business_type}`);
        }
        if (profile.location_city) {
            contextParts.push(`located in ${profile.location_city}${profile.location_state ? ', ' + profile.location_state : ''}`);
        }
        if (profile.monthly_revenue) {
            contextParts.push(`with monthly revenue of ₹${profile.monthly_revenue.toLocaleString()}`);
        }

        // Operational context
        if (profile.peak_hours && profile.peak_hours.length > 0) {
            contextParts.push(`Peak hours: ${profile.peak_hours.join(', ')}`);
        }
        if (profile.peak_days && profile.peak_days.length > 0) {
            contextParts.push(`Busy days: ${profile.peak_days.join(', ')}`);
        }
        if (profile.staff_count) {
            contextParts.push(`Staff: ${profile.staff_count} people`);
        }

        // Platform usage
        if (profile.platforms_used && profile.platforms_used.length > 0) {
            contextParts.push(`Uses: ${profile.platforms_used.join(', ')}`);
        }
        if (profile.ad_channels && profile.ad_channels.length > 0) {
            contextParts.push(`Advertises on: ${profile.ad_channels.join(', ')}`);
        }

        // Goals and challenges
        if (profile.goals && profile.goals.length > 0) {
            contextParts.push(`Goals: ${profile.goals.join(', ')}`);
        }
        if (profile.challenges && profile.challenges.length > 0) {
            contextParts.push(`Challenges: ${profile.challenges.join(', ')}`);
        }

        const context = contextParts.length > 0 ? 
            `\n\nBUSINESS CONTEXT:\n${contextParts.join('. ')}.` : '';

        return `You are Partnur, a friendly AI business advisor for Indian small business owners (MSMEs). You're like a knowledgeable "business chacha" who gives practical, actionable advice.

PERSONALITY:
- Warm, supportive, and encouraging
- Use simple language with occasional Hindi/business terms
- Give specific, actionable advice, not generic tips
- Ask follow-up questions to understand their situation better
- Be empathetic to the challenges of running a small business in India

ADVICE STYLE:
- Focus on low-cost, practical solutions
- Consider Indian market conditions, festivals, local customs
- Suggest specific tools, platforms, and strategies popular in India
- Always consider their current resources and constraints
- Give step-by-step guidance when possible${context}

Respond in a conversational, helpful manner. If you need more information to give better advice, ask specific questions.`;
    }

    // Get relevant context used in response (for logging)
    getRelevantContext(profile) {
        const relevant = {};
        const importantFields = ['business_type', 'location_city', 'monthly_revenue', 
                               'peak_hours', 'challenges', 'goals', 'platforms_used'];
        
        importantFields.forEach(field => {
            if (profile[field]) {
                relevant[field] = profile[field];
            }
        });
        
        return relevant;
    }

    // Generate follow-up suggestions
    generateFollowUpSuggestions(message, profile) {
        const suggestions = [];
        
        // Suggest based on missing profile info
        if (!profile.business_type) {
            suggestions.push("Tell me about your business type");
        }
        if (!profile.monthly_revenue) {
            suggestions.push("Share your monthly revenue range");
        }
        if (!profile.challenges || profile.challenges.length === 0) {
            suggestions.push("What's your biggest business challenge?");
        }
        
        return suggestions.slice(0, 2); // Limit to 2 suggestions
    }
}

module.exports = AIService;