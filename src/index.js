const express = require('express');
const cors = require('cors');
require('dotenv').config();

const ProfileManager = require('./profileManager');
const AIService = require('./aiService');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize services
const profileManager = new ProfileManager();
const aiService = new AIService();

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'Partnur Backend is running!', timestamp: new Date() });
});

// Main chat endpoint - This is where the magic happens!
app.post('/chat', async (req, res) => {
    try {
        const { mobile_number, message, session_id } = req.body;
        
        if (!mobile_number || !message) {
            return res.status(400).json({ 
                error: 'mobile_number and message are required' 
            });
        }

        console.log(`💬 New message from ${mobile_number}: ${message}`);
        
        // Step 1: Get or create user profile
        let userProfile = await profileManager.getUserProfile(mobile_number);
        if (!userProfile) {
            userProfile = await profileManager.createUserProfile(mobile_number);
            console.log(`👤 Created new user profile for ${mobile_number}`);
        }

        // Step 2: Extract any new information from the message
        const extractedInfo = await aiService.extractProfileInfo(message, userProfile);
        console.log('🔍 Extracted info:', extractedInfo);

        // Step 3: Update profile with new information
        if (Object.keys(extractedInfo).length > 0) {
            userProfile = await profileManager.updateProfile(userProfile.user_id, extractedInfo);
            console.log('📝 Profile updated with new info');
        }

        // Step 4: Generate AI response using full context
        const aiResponse = await aiService.generateResponse(message, userProfile);
        
        // Step 5: Log the conversation
        await profileManager.logConversation({
            user_id: userProfile.user_id,
            user_message: message,
            ai_response: aiResponse.content,
            extracted_info: extractedInfo,
            profile_updates: Object.keys(extractedInfo),
            context_used: aiResponse.contextUsed,
            response_time_ms: Date.now() - req.startTime,
            session_id: session_id || null
        });

        // Step 6: Calculate profile completion
        const completionScore = profileManager.calculateProfileCompletion(userProfile);
        
        res.json({
            response: aiResponse.content,
            profile_completion: completionScore,
            extracted_info: extractedInfo,
            suggestions: aiResponse.suggestions || []
        });

    } catch (error) {
        console.error('❌ Chat endpoint error:', error);
        res.status(500).json({ 
            error: 'Something went wrong. Please try again.',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Get user profile endpoint
app.get('/profile/:mobile_number', async (req, res) => {
    try {
        const { mobile_number } = req.params;
        const profile = await profileManager.getUserProfile(mobile_number);
        
        if (!profile) {
            return res.status(404).json({ error: 'Profile not found' });
        }

        const completionScore = profileManager.calculateProfileCompletion(profile);
        
        res.json({
            profile: profile,
            completion_score: completionScore
        });
    } catch (error) {
        console.error('❌ Profile fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// Add timestamp middleware
app.use((req, res, next) => {
    req.startTime = Date.now();
    next();
});

app.listen(PORT, () => {
    console.log(`🚀 Partnur Backend running on port ${PORT}`);
    console.log(`📱 Chat endpoint: http://localhost:${PORT}/chat`);
    console.log(`👤 Profile endpoint: http://localhost:${PORT}/profile/:mobile_number`);
})