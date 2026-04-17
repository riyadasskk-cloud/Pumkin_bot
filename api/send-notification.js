// api/send-notification.js
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
        const { userId, message, type, buttonText, buttonUrl } = req.body;
        
        if (!userId || !message) {
            return res.status(400).json({ error: 'Missing userId or message' });
        }
        
        // Get user's chat ID and notification preferences
        const userChatData = await getUserChatData(userId);
        
        if (!userChatData) {
            return res.status(404).json({ error: 'User not found or not subscribed' });
        }
        
        // Check if this notification type is enabled
        const typeField = {
            'new_ad': 'new_ad_notify',
            'bonus_reminder': 'bonus_reminder',
            'referral_join': 'referral_notify',
            'payment_complete': 'payment_notify',
            'level_up': null,
            'daily_bonus': 'bonus_reminder'
        }[type];
        
        if (typeField && userChatData[typeField] === false) {
            return res.status(200).json({ 
                success: false, 
                message: 'User disabled this notification type' 
            });
        }
        
        if (!userChatData.notifications_enabled) {
            return res.status(200).json({ 
                success: false, 
                message: 'User disabled all notifications' 
            });
        }
        
        // Format message based on type
        let formattedMessage = '';
        let inlineKeyboard = null;
        
        switch(type) {
            case 'new_ad':
                formattedMessage = `🎬 *নতুন এড এসেছে!*\n\n${message}\n\n💰 ৩০ টাকা পেতে এখনই দেখুন!`;
                inlineKeyboard = {
                    inline_keyboard: [[
                        { text: buttonText || '🎬 এড দেখুন', web_app: { url: buttonUrl || 'https://pumkin-bot-pi.vercel.app' } }
                    ]]
                };
                break;
                
            case 'bonus_reminder':
                formattedMessage = `⏰ *বোনাস ক্লেইম রিমাইন্ডার*\n\n${message}\n\n🎁 আপনার বোনাস এখনই ক্লেইম করুন!`;
                inlineKeyboard = {
                    inline_keyboard: [[
                        { text: buttonText || '🎁 বোনাস ক্লেইম', web_app: { url: buttonUrl || 'https://pumkin-bot-pi.vercel.app' } }
                    ]]
                };
                break;
                
            case 'referral_join':
                formattedMessage = `👥 *নতুন রেফারেল জয়েন করেছেন!*\n\n${message}\n\n🎉 আপনি ১০০ টাকা পেয়েছেন!`;
                inlineKeyboard = {
                    inline_keyboard: [[
                        { text: buttonText || '💰 ব্যালেন্স দেখুন', web_app: { url: buttonUrl || 'https://pumkin-bot-pi.vercel.app' } }
                    ]]
                };
                break;
                
            case 'payment_complete':
                formattedMessage = `✅ *পেমেন্ট সম্পন্ন হয়েছে!*\n\n${message}`;
                break;
                
            case 'level_up':
                formattedMessage = `🏆 *অভিনন্দন! লেভেল আপ!*\n\n${message}`;
                inlineKeyboard = {
                    inline_keyboard: [[
                        { text: buttonText || '🎯 নতুন লেভেল দেখুন', web_app: { url: buttonUrl || 'https://pumkin-bot-pi.vercel.app' } }
                    ]]
                };
                break;
                
            case 'daily_bonus':
                formattedMessage = `🎁 *দৈনিক বোনাস রিমাইন্ডার*\n\n${message}`;
                inlineKeyboard = {
                    inline_keyboard: [[
                        { text: buttonText || '🎁 বোনাস নিন', web_app: { url: buttonUrl || 'https://pumkin-bot-pi.vercel.app' } }
                    ]]
                };
                break;
                
            default:
                formattedMessage = message;
        }
        
        // Send to Telegram
        const telegramUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
        const payload = {
            chat_id: userChatData.chat_id,
            text: formattedMessage,
            parse_mode: 'Markdown',
            disable_web_page_preview: true
        };
        
        if (inlineKeyboard) {
            payload.reply_markup = inlineKeyboard;
        }
        
        const telegramResponse = await fetch(telegramUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const telegramData = await telegramResponse.json();
        
        if (!telegramData.ok) {
            console.error('Telegram API Error:', telegramData);
            return res.status(400).json({ 
                success: false, 
                error: telegramData.description 
            });
        }
        
        return res.status(200).json({ 
            success: true, 
            message: 'Notification sent successfully',
            telegram_message_id: telegramData.result.message_id
        });
        
    } catch (error) {
        console.error('Notification Error:', error);
        return res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
}

async function getUserChatData(userId) {
    try {
        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/user_chat_ids?user_id=eq.${userId}&select=*`,
            {
                headers: {
                    'apikey': SUPABASE_SERVICE_KEY,
                    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
                }
            }
        );
        
        const data = await response.json();
        return data[0] || null;
    } catch (error) {
        console.error('Get user chat data error:', error);
        return null;
    }
}