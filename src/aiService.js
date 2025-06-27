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

    // Generate smart follow-up questions
    generateSmartQuestions(profile) {
        const questions = [];
        
        // Basic business info questions
        if (!profile.business_type) {
            questions.push("What type of business do you run?");
        }
        if (!profile.location_city) {
            questions.push("Which city is your business located in?");
        }
        if (!profile.monthly_revenue) {
            questions.push("What's your approximate monthly revenue range?");
        }
        
        // Operational questions
        if (!profile.peak_hours || profile.peak_hours.length === 0) {
            questions.push("What are your busiest hours of the day?");
        }
        if (!profile.staff_count) {
            questions.push("How many people work in your business?");
        }
        if (!profile.inventory_source) {
            questions.push("Where do you source your products/inventory from?");
        }
        
        // Challenges and goals
        if (!profile.challenges || profile.challenges.length === 0) {
            questions.push("What's your biggest business challenge right now?");
        }
        if (!profile.goals || profile.goals.length === 0) {
            questions.push("What are your main business goals for this year?");
        }
        
        // Business-specific questions
        if (profile.business_type === 'restaurant' && !profile.platforms_used?.includes('Zomato')) {
            questions.push("Are you listed on food delivery platforms like Zomato or Swiggy?");
        }
        if (profile.business_type === 'salon' && !profile.platforms_used?.includes('Instagram')) {
            questions.push("Do you use social media like Instagram to showcase your work?");
        }
        if (profile.business_type === 'retail' && !profile.payment_methods?.includes('UPI')) {
            questions.push("Do you accept digital payments like UPI or cards?");
        }
        
        // Return only 1-2 questions to avoid overwhelming
        return questions.slice(0, 2);
    }

    // Get seasonal context for advice
    getSeasonalContext() {
        const now = new Date();
        const month = now.getMonth() + 1; // JavaScript months are 0-indexed
        
        if (month === 10 || month === 11) {
            return "With Diwali and festive season approaching, this is a great time to boost sales. ";
        } else if (month === 8) {
            return "Raksha Bandhan season is here - consider special offers for siblings. ";
        } else if (month === 3 || month === 4) {
            return "With Holi and spring season, it's time to refresh your business approach. ";
        } else if (month === 12 || month === 1) {
            return "New Year is a perfect time for new beginnings and planning ahead. ";
        } else if (month === 6 || month === 7) {
            return "Monsoon season can affect business - plan accordingly. ";
        } else if (month === 5) {
            return "Summer season - consider how weather affects your business. ";
        }
        
        return "";
    }

    // Get relevant context based on user profile
    getRelevantContext(profile) {
        const context = [];
        
        if (profile.business_type) context.push(`Business: ${profile.business_type}`);
        if (profile.location_city) context.push(`Location: ${profile.location_city}`);
        if (profile.monthly_revenue) context.push(`Revenue: ${profile.monthly_revenue}`);
        if (profile.challenges?.length > 0) context.push(`Challenges: ${profile.challenges.join(', ')}`);
        
        return context.join(' | ');
    }

    // Enhanced response generation with smart questions and seasonal context
    async generateEnhancedResponse(message, userProfile) {
        try {
            const seasonalContext = this.getSeasonalContext();
            const smartQuestions = this.generateSmartQuestions(userProfile);
            const systemPrompt = this.buildEnhancedSystemPrompt(userProfile, seasonalContext);
            
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
                suggestions: smartQuestions,
                seasonalTip: seasonalContext ? seasonalContext.trim() : null
            };
        } catch (error) {
            console.error('Error generating enhanced response:', error);
            return this.generateResponse(message, userProfile); // Fallback to basic response
        }
    }

    // Enhanced system prompt with seasonal awareness
    buildEnhancedSystemPrompt(profile, seasonalContext) {
        const basePrompt = this.buildSystemPrompt(profile);
        
        const enhancement = `

SEASONAL AWARENESS:
${seasonalContext}Consider seasonal factors, festivals, and timing in your advice.

SMART QUESTIONING:
Always end responses with thoughtful follow-up questions to gather missing business information.

BUSINESS INTELLIGENCE:
Provide specific, actionable advice based on the user's business type, location, and current challenges.

RESPONSE STYLE:
- Keep responses conversational and encouraging
- Use "Hinglish" phrases naturally where appropriate
- Focus on practical, implementable advice
- Ask only 1-2 follow-up questions at a time`;

        return basePrompt + enhancement;
    }

    // Get business insights based on profile completeness
    getBusinessInsights(profile) {
        const insights = [];
        const completionScore = this.calculateProfileCompletion ? this.calculateProfileCompletion(profile) : 50;
        
        if (completionScore < 30) {
            insights.push("Complete your profile to get personalized business advice");
        }
        
        if (profile.business_type === 'restaurant' && !profile.platforms_used?.includes('Zomato')) {
            insights.push("Consider joining food delivery platforms to increase reach");
        }
        
        if (profile.monthly_revenue && profile.monthly_revenue.includes('Below') && !profile.goals?.includes('increase revenue')) {
            insights.push("Setting revenue growth goals could help focus your efforts");
        }
        
        return insights;
    }

    // Generate contextual business tips
    generateContextualTips(profile) {
        const tips = [];
        const businessType = profile.business_type?.toLowerCase();
        const location = profile.location_city?.toLowerCase();
        
        // Business-specific tips
        if (businessType === 'restaurant') {
            tips.push("Focus on food quality and customer service for repeat customers");
            if (!profile.platforms_used?.includes('Instagram')) {
                tips.push("Share food photos on Instagram to attract customers");
            }
        } else if (businessType === 'salon') {
            tips.push("Before/after photos showcase your skills effectively");
            tips.push("Building client relationships leads to regular appointments");
        } else if (businessType === 'retail') {
            tips.push("Display products attractively to increase impulse purchases");
            tips.push("Track inventory to avoid stockouts during peak times");
        }
        
        // Location-specific tips
        if (location?.includes('delhi') || location?.includes('mumbai')) {
            tips.push("Consider digital marketing for metro city competition");
        }
        
        return tips.slice(0, 2); // Return max 2 tips
    }
}

module.exports = AIService;
