const { createClient } = require('@supabase/supabase-js');

class ProfileManager {
    constructor() {
        this.supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_KEY
        );
    }

    // Get user profile by mobile number
    async getUserProfile(mobile_number) {
        try {
            const { data, error } = await this.supabase
                .from('user_profiles')
                .select('*')
                .eq('mobile_number', mobile_number)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
                throw error;
            }

            return data;
        } catch (error) {
            console.error('Error fetching user profile:', error);
            return null;
        }
    }

    // Create new user profile
    async createUserProfile(mobile_number) {
        try {
            const { data, error } = await this.supabase
                .from('user_profiles')
                .insert([{
                    mobile_number: mobile_number,
                    language_pref: 'Hinglish',
                    profile_completion_score: 5 // Just mobile number = 5%
                }])
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error creating user profile:', error);
            throw error;
        }
    }

    // Update user profile with extracted information
    async updateProfile(user_id, extractedInfo) {
        try {
            // Prepare update object, merging arrays properly
            const updateData = { ...extractedInfo };
            
            // Handle JSONB arrays (merge instead of replace)
            const arrayFields = ['peak_hours', 'peak_days', 'top_products', 'staff_roles', 
                                'payment_methods', 'ad_channels', 'platforms_used', 
                                'goals', 'challenges'];
            
            for (const field of arrayFields) {
                if (extractedInfo[field] && Array.isArray(extractedInfo[field])) {
                    // Get current profile to merge arrays
                    const { data: currentProfile } = await this.supabase
                        .from('user_profiles')
                        .select(field)
                        .eq('user_id', user_id)
                        .single();
                    
                    if (currentProfile && currentProfile[field]) {
                        // Merge arrays and remove duplicates
                        const merged = [...new Set([
                            ...currentProfile[field], 
                            ...extractedInfo[field]
                        ])];
                        updateData[field] = merged;
                    }
                }
            }

            updateData.updated_at = new Date().toISOString();
            updateData.last_profile_update = new Date().toISOString();

            const { data, error } = await this.supabase
                .from('user_profiles')
                .update(updateData)
                .eq('user_id', user_id)
                .select()
                .single();

            if (error) throw error;

            // Update completion score
            const completionScore = this.calculateProfileCompletion(data);
            await this.supabase
                .from('user_profiles')
                .update({ profile_completion_score: completionScore })
                .eq('user_id', user_id);

            return data;
        } catch (error) {
            console.error('Error updating profile:', error);
            throw error;
        }
    }

    // Calculate profile completion percentage
    calculateProfileCompletion(profile) {
        const fields = {
            // Tier 1 - Basic Identity (30 points)
            mobile_number: 5,
            business_type: 10,
            location_city: 8,
            location_state: 7,
            
            // Tier 2 - Operational (35 points)
            monthly_revenue: 8,
            peak_hours: 5,
            peak_days: 5,
            top_products: 7,
            staff_count: 5,
            inventory_source: 5,
            
            // Tier 3 - Tools & Platforms (20 points)
            payment_methods: 5,
            ad_channels: 5,
            platforms_used: 5,
            past_campaigns: 5,
            
            // Tier 4 - Strategy (15 points)
            goals: 8,
            challenges: 7
        };

        let completedPoints = 0;
        let totalPoints = Object.values(fields).reduce((sum, points) => sum + points, 0);

        for (const [field, points] of Object.entries(fields)) {
            const value = profile[field];
            if (value !== null && value !== undefined && value !== '' && 
                !(Array.isArray(value) && value.length === 0)) {
                completedPoints += points;
            }
        }

        return Math.round((completedPoints / totalPoints) * 100);
    }

    // Log conversation
    async logConversation(logData) {
        try {
            const { error } = await this.supabase
                .from('conversation_logs')
                .insert([logData]);

            if (error) throw error;
        } catch (error) {
            console.error('Error logging conversation:', error);
            // Don't throw - logging shouldn't break the main flow
        }
    }

    // Get conversation analytics
    async getAnalytics(user_id, days = 30) {
        try {
            const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
            
            const { data, error } = await this.supabase
                .from('conversation_logs')
                .select('*')
                .eq('user_id', user_id)
                .gte('created_at', cutoffDate);
            
            if (error) throw error;
            
            const totalConversations = data?.length || 0;
            const avgResponseTime = totalConversations > 0 
                ? data.reduce((sum, log) => sum + (log.response_time_ms || 0), 0) / totalConversations
                : 0;
            
            // Extract topics from conversation data
            const topics = data?.map(log => log.extracted_info).filter(Boolean) || [];
            const topicCounts = {};
            topics.forEach(info => {
                if (info.business_type) topicCounts[info.business_type] = (topicCounts[info.business_type] || 0) + 1;
                if (info.location_city) topicCounts[info.location_city] = (topicCounts[info.location_city] || 0) + 1;
            });
            
            return {
                total_conversations: totalConversations,
                avg_response_time_ms: Math.round(avgResponseTime),
                topics: topicCounts,
                recent_activity: data?.slice(0, 5) || []
            };
        } catch (error) {
            console.error('Error getting analytics:', error);
            return {
                total_conversations: 0,
                avg_response_time_ms: 0,
                topics: {},
                recent_activity: []
            };
        }
    }

    // Get profile completion trends
    async getProfileCompletionTrends(limit = 100) {
        try {
            const { data, error } = await this.supabase
                .from('user_profiles')
                .select('profile_completion_score, created_at, business_type, location_city')
                .order('created_at', { ascending: false })
                .limit(limit);
            
            if (error) throw error;
            
            return data || [];
        } catch (error) {
            console.error('Error getting profile trends:', error);
            return [];
        }
    }

    // Get user activity summary
    async getUserActivitySummary(user_id) {
        try {
            const profile = await this.getUserProfile(await this.getUserByUserId(user_id));
            const analytics = await this.getAnalytics(user_id, 30);
            
            return {
                profile_completion: this.calculateProfileCompletion(profile),
                last_active: profile?.updated_at,
                conversation_count: analytics.total_conversations,
                avg_response_time: analytics.avg_response_time_ms,
                business_info: {
                    type: profile?.business_type,
                    location: profile?.location_city,
                    revenue: profile?.monthly_revenue
                }
            };
        } catch (error) {
            console.error('Error getting user activity summary:', error);
            return null;
        }
    }

    // Helper method to get user by user_id
    async getUserByUserId(user_id) {
        try {
            const { data, error } = await this.supabase
                .from('user_profiles')
                .select('mobile_number')
                .eq('user_id', user_id)
                .single();
            
            if (error) throw error;
            return data?.mobile_number;
        } catch (error) {
            console.error('Error getting user by ID:', error);
            return null;
        }
    }
}

module.exports = ProfileManager;
