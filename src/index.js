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

// Add timestamp middleware (MOVED TO CORRECT POSITION)
app.use((req, res, next) => {
    req.startTime = Date.now();
    next();
});

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
        // Accept parameters from either body OR query string
        const mobile_number = req.body.mobile_number || req.query.mobile_number;
        const message = req.body.message || req.query.message;
        const session_id = req.body.session_id || req.query.session_id;
        
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

// Analytics endpoint - Get user conversation analytics
app.get('/analytics/:mobile_number', async (req, res) => {
    try {
        const { mobile_number } = req.params;
        const { days } = req.query; // Optional: ?days=30
        
        console.log(`📊 Getting analytics for ${mobile_number}`);
        
        const userProfile = await profileManager.getUserProfile(mobile_number);
        if (!userProfile) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const analytics = await profileManager.getAnalytics(userProfile.user_id, days ? parseInt(days) : 30);
        const activitySummary = await profileManager.getUserActivitySummary(userProfile.user_id);
        
        res.json({
            success: true,
            mobile_number: mobile_number,
            analytics: analytics,
            activity_summary: activitySummary,
            profile_completion: profileManager.calculateProfileCompletion(userProfile),
            generated_at: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Analytics endpoint error:', error);
        res.status(500).json({ 
            error: 'Failed to get analytics',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Profile trends endpoint - Get platform-wide trends
app.get('/trends', async (req, res) => {
    try {
        const { limit } = req.query; // Optional: ?limit=50
        
        console.log(`📈 Getting profile completion trends`);
        
        const trends = await profileManager.getProfileCompletionTrends(limit ? parseInt(limit) : 100);
        
        // Calculate summary statistics
        const totalProfiles = trends.length;
        const averageCompletion = totalProfiles > 0 
            ? Math.round(trends.reduce((sum, t) => sum + t.profile_completion_score, 0) / totalProfiles)
            : 0;
        
        // Group by business type
        const businessTypes = {};
        trends.forEach(trend => {
            if (trend.business_type) {
                businessTypes[trend.business_type] = (businessTypes[trend.business_type] || 0) + 1;
            }
        });
        
        res.json({
            success: true,
            summary: {
                total_profiles: totalProfiles,
                average_completion: averageCompletion,
                business_types: businessTypes
            },
            trends: trends,
            generated_at: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Trends endpoint error:', error);
        res.status(500).json({ 
            error: 'Failed to get trends',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Enhanced chat endpoint with smart features
app.post('/chat/enhanced', async (req, res) => {
    const startTime = Date.now();
    
    try {
        const mobile_number = req.body.mobile_number || req.query.mobile_number;
        const message = req.body.message || req.query.message;
        const session_id = req.body.session_id || req.query.session_id;
        
        if (!mobile_number || !message) {
            return res.status(400).json({ 
                error: 'mobile_number and message are required',
                example: {
                    mobile_number: '+919876543210',
                    message: 'How can I increase my restaurant sales?',
                    session_id: 'optional-session-id'
                }
            });
        }

        console.log(`💬 Enhanced chat from ${mobile_number}: ${message}`);
        
        // Get or create user profile
        let userProfile = await profileManager.getUserProfile(mobile_number);
        if (!userProfile) {
            console.log(`👤 Creating new user profile for ${mobile_number}`);
            userProfile = await profileManager.createUserProfile(mobile_number);
        }

        // Extract information from the message
        const extractedInfo = await aiService.extractProfileInfo(message, userProfile);
        console.log(`📝 Extracted info:`, extractedInfo);
        
        // Update profile if new information was extracted
        if (Object.keys(extractedInfo).length > 0) {
            userProfile = await profileManager.updateProfile(userProfile.user_id, extractedInfo);
            console.log(`🔄 Profile updated with ${Object.keys(extractedInfo).length} new fields`);
        }

        // Generate enhanced AI response with smart features
        const aiResponse = await aiService.generateEnhancedResponse(message, userProfile);
        console.log(`🤖 AI response generated with smart features`);
        
        // Log the conversation
        await profileManager.logConversation({
            user_id: userProfile.user_id,
            user_message: message,
            ai_response: aiResponse.content,
            extracted_info: extractedInfo,
            profile_updates: Object.keys(extractedInfo),
            context_used: aiResponse.contextUsed,
            response_time_ms: Date.now() - startTime,
            session_id: session_id || null
        });

        const completionScore = profileManager.calculateProfileCompletion(userProfile);
        
        // Get quick analytics preview
        const recentAnalytics = await profileManager.getAnalytics(userProfile.user_id, 7);
        
        // Generate business insights
        const businessInsights = aiService.getBusinessInsights(userProfile);
        const contextualTips = aiService.generateContextualTips(userProfile);
        
        res.json({
            success: true,
            response: aiResponse.content,
            profile_completion: completionScore,
            extracted_info: extractedInfo,
            smart_features: {
                smart_questions: aiResponse.suggestions || [],
                seasonal_tip: aiResponse.seasonalTip,
                business_insights: businessInsights,
                contextual_tips: contextualTips
            },
            analytics_preview: {
                total_conversations: recentAnalytics.total_conversations,
                avg_response_time: recentAnalytics.avg_response_time_ms
            },
            context_used: aiResponse.contextUsed,
            response_time_ms: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Enhanced chat endpoint error:', error);
        res.status(500).json({ 
            error: 'Something went wrong. Please try again.',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined,
            response_time_ms: Date.now() - startTime
        });
    }
});

// Start server (KEEP THIS AT THE VERY END)
app.listen(PORT, () => {
    console.log(`🚀 Partnur Backend running on port ${PORT}`);
    console.log(`📱 Chat endpoint: http://localhost:${PORT}/chat`);
    console.log(`🧠 Enhanced chat: http://localhost:${PORT}/chat/enhanced`);
    console.log(`👤 Profile endpoint: http://localhost:${PORT}/profile/:mobile_number`);
    console.log(`📊 Analytics endpoint: http://localhost:${PORT}/analytics/:mobile_number`);
    console.log(`📈 Trends endpoint: http://localhost:${PORT}/trends`);
});
