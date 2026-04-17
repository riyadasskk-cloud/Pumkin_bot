// api/save-chat-id.js
const BOT_TOKEN = '8540775880:AAERHIt1yHQV82T4rf7TXnFiEo2hgNsjM6s';
const SUPABASE_URL = 'https://tnsvsjquczljkdxnzrix.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRuc3ZzanF1Y3psamtkeG56cml4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTI5MjIxNCwiZXhwIjoyMDkwODY4MjE0fQ.otceXiZdhxZ8x3Js66tEJGzl11Mxc6NCoDS-OeXYygg';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        const { userId, telegramUserId, firstName, username } = req.body;
        
        if (!userId || !telegramUserId) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const chatId = telegramUserId;
        
        console.log(`📱 Saving chat ID for user ${userId}: ${chatId}`);
        
        const response = await fetch(`${SUPABASE_URL}/rest/v1/user_chat_ids`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify({
                user_id: userId,
                chat_id: chatId.toString(),
                first_name: firstName || 'ইউজার',
                username: username || null,
                notifications_enabled: true,
                new_ad_notify: true,
                bonus_reminder: true,
                referral_notify: true,
                payment_notify: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
        });
        
        if (!response.ok && response.status !== 409) {
            const errorText = await response.text();
            console.error('Supabase error:', errorText);
            return res.status(400).json({ success: false, error: 'Failed to save' });
        }
        
        // Send welcome notification (optional)
        try {
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: `🔔 *নোটিফিকেশন চালু হয়েছে!*\n\nস্বাগতম ${firstName || 'ইউজার'}!\n\nএখন থেকে আপনি পাবেন:\n✅ নতুন এড আপডেট\n✅ বোনাস রিমাইন্ডার\n✅ রেফারেল নোটিফিকেশন\n\n/settings দিয়ে সেটিংস বদলাতে পারবেন।`,
                    parse_mode: 'Markdown'
                })
            });
        } catch (e) {
            console.log('Welcome notification failed (user may not have started bot)');
        }
        
        return res.status(200).json({ success: true, message: 'Subscription saved' });
        
    } catch (error) {
        console.error('Save chat ID error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}