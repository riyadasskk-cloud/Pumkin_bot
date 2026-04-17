// api/telegram-webhook.js
const BOT_TOKEN = '8540775880:AAERHIt1yHQV82T4rf7TXnFiEo2hgNsjM6s';
const SUPABASE_URL = 'https://tnsvsjquczljkdxnzrix.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRuc3ZzanF1Y3psamtkeG56cml4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTI5MjIxNCwiZXhwIjoyMDkwODY4MjE0fQ.otceXiZdhxZ8x3Js66tEJGzl11Mxc6NCoDS-OeXYygg';

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    // GET request - Webhook setup info
    if (req.method === 'GET') {
        const webhookUrl = `https://pumkin-bot-pi.vercel.app/api/telegram-webhook`;
        return res.status(200).json({ 
            message: 'Telegram Webhook Endpoint',
            webhook_url: webhookUrl,
            setup_curl: `curl -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" -H "Content-Type: application/json" -d '{"url": "${webhookUrl}"}'`
        });
    }
    
    // POST request - Handle Telegram updates
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        const update = req.body;
        console.log('📨 Webhook received:', JSON.stringify(update).substring(0, 200));
        
        // Handle /start command
        if (update.message?.text?.startsWith('/start')) {
            const chatId = update.message.chat.id;
            const user = update.message.from;
            const userId = user.id.toString();
            const firstName = user.first_name || 'ইউজার';
            const username = user.username || null;
            
            // Check for referral parameter
            let startParam = '';
            const text = update.message.text;
            if (text.includes(' ')) {
                startParam = text.split(' ')[1];
            }
            
            console.log(`👤 User ${userId} (${firstName}) started bot, ref: ${startParam}`);
            
            // Save user's chat ID to Supabase
            await saveUserChatId(userId, chatId, firstName, username);
            
            // Build app URL with referral if exists
            let appUrl = 'https://pumkin-bot-pi.vercel.app';
            if (startParam && startParam.startsWith('ref')) {
                appUrl = `https://pumkin-bot-pi.vercel.app?startapp=${startParam}`;
            }
            
            // Welcome message
            const welcomeMessage = `🎃 *স্বাগতম ${firstName}!*\n\n` +
                `আমি *মিষ্টি কুমড়া বট*! 🍬\n\n` +
                `এখন থেকে আপনি টেলিগ্রামেই পাবেন:\n` +
                `✅ নতুন এড নোটিফিকেশন\n` +
                `✅ বোনাস ক্লেইম রিমাইন্ডার\n` +
                `✅ রেফারেল জয়েন আপডেট\n` +
                `✅ পেমেন্ট কনফার্মেশন\n\n` +
                `👇 নিচের বাটনে ক্লিক করে অ্যাপ ওপেন করুন এবং আয় শুরু করুন!`;
            
            const inlineKeyboard = {
                inline_keyboard: [
                    [{ text: '🎮 অ্যাপ ওপেন করুন', web_app: { url: appUrl } }],
                    [{ text: '⚙️ নোটিফিকেশন সেটিংস', callback_data: 'settings' }],
                    [{ text: '📢 পেমেন্ট চ্যানেল', url: 'https://t.me/mishti_kumra_official' }],
                    [{ text: '👥 রেফারেল লিঙ্ক', callback_data: 'referral' }]
                ]
            };
            
            await sendTelegramMessage(chatId, welcomeMessage, inlineKeyboard);
        }
        
        // Handle /notify or /settings command
        if (update.message?.text === '/notify' || update.message?.text === '/settings') {
            const chatId = update.message.chat.id;
            const userId = update.message.from.id.toString();
            
            const settingsKeyboard = await getSettingsKeyboard(userId);
            await sendTelegramMessage(chatId, '⚙️ *নোটিফিকেশন সেটিংস*\n\nআপনার পছন্দমতো নোটিফিকেশন অন/অফ করুন:', settingsKeyboard);
        }
        
        // Handle /referral command
        if (update.message?.text === '/referral' || update.message?.text === '/ref') {
            const chatId = update.message.chat.id;
            const userId = update.message.from.id.toString();
            
            const referralLink = `https://t.me/mishti_kumra_bot?startapp=ref${userId}`;
            const message = `👥 *আপনার রেফারেল লিঙ্ক*\n\n` +
                `এই লিঙ্ক শেয়ার করে বন্ধুদের invite করুন!\n` +
                `প্রতি রেফারেলে আপনি পাবেন *১০০ টাকা* এবং আপনার বন্ধু পাবে *৫০ টাকা*!\n\n` +
                `📋 আপনার লিঙ্ক:\n\`${referralLink}\`\n\n` +
                `লিঙ্ক কপি করতে উপরের মেসেজে ট্যাপ করুন!`;
            
            const keyboard = {
                inline_keyboard: [
                    [{ text: '📋 লিঙ্ক কপি করুন', callback_data: `copy_ref_${userId}` }],
                    [{ text: '📊 রেফারেল স্ট্যাটাস', web_app: { url: 'https://pumkin-bot-pi.vercel.app' } }]
                ]
            };
            
            await sendTelegramMessage(chatId, message, keyboard);
        }
        
        // Handle /balance command
        if (update.message?.text === '/balance' || update.message?.text === '/bal') {
            const chatId = update.message.chat.id;
            const userId = update.message.from.id.toString();
            
            const balanceInfo = await getUserBalanceInfo(userId);
            await sendTelegramMessage(chatId, balanceInfo);
        }
        
        // Handle /help command
        if (update.message?.text === '/help' || update.message?.text === '/start') {
            // Already handled /start above
            if (update.message?.text === '/help') {
                const chatId = update.message.chat.id;
                const helpMessage = `📚 *সাহায্য ও কমান্ড*\n\n` +
                    `/start - বট শুরু করুন\n` +
                    `/balance - আপনার ব্যালেন্স দেখুন\n` +
                    `/referral - রেফারেল লিঙ্ক পান\n` +
                    `/settings - নোটিফিকেশন সেটিংস\n` +
                    `/help - এই মেসেজ দেখুন\n\n` +
                    `আরও সাহায্যের জন্য: @mishti_kumra_official`;
                await sendTelegramMessage(chatId, helpMessage);
            }
        }
        
        // Handle callback queries (button clicks)
        if (update.callback_query) {
            const query = update.callback_query;
            const chatId = query.message.chat.id;
            const userId = query.from.id.toString();
            const data = query.data;
            
            console.log(`🔘 Callback: ${data} from ${userId}`);
            
            // Settings button
            if (data === 'settings') {
                const settingsKeyboard = await getSettingsKeyboard(userId);
                await editMessageText(chatId, query.message.message_id, 
                    '⚙️ *নোটিফিকেশন সেটিংস*\n\nআপনার পছন্দমতো নোটিফিকেশন অন/অফ করুন:', 
                    settingsKeyboard);
                await answerCallbackQuery(query.id, 'সেটিংস ওপেন হয়েছে');
            }
            
            // Referral button
            if (data === 'referral') {
                const referralLink = `https://t.me/mishti_kumra_bot?startapp=ref${userId}`;
                const message = `👥 *আপনার রেফারেল লিঙ্ক*\n\n\`${referralLink}\`\n\nপ্রতি রেফারেলে ১০০ টাকা!`;
                await sendTelegramMessage(chatId, message);
                await answerCallbackQuery(query.id, 'রেফারেল লিঙ্ক পাঠানো হয়েছে');
            }
            
            // Copy referral link
            if (data.startsWith('copy_ref_')) {
                const refUserId = data.replace('copy_ref_', '');
                const referralLink = `https://t.me/mishti_kumra_bot?startapp=ref${refUserId}`;
                await answerCallbackQuery(query.id, `লিঙ্ক: ${referralLink}`, true);
            }
            
            // Toggle notification settings
            if (data.startsWith('toggle_')) {
                const setting = data.replace('toggle_', '');
                await toggleNotificationSetting(userId, setting);
                
                const newKeyboard = await getSettingsKeyboard(userId);
                await editMessageReplyMarkup(chatId, query.message.message_id, newKeyboard);
                await answerCallbackQuery(query.id, `${getSettingName(setting)} আপডেট হয়েছে`);
            }
            
            // Open App
            if (data === 'open_app') {
                await answerCallbackQuery(query.id, 'অ্যাপ ওপেন হচ্ছে...', 'https://pumkin-bot-pi.vercel.app');
            }
        }
        
        return res.status(200).json({ success: true });
        
    } catch (error) {
        console.error('❌ Webhook Error:', error);
        return res.status(500).json({ error: error.message });
    }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

async function saveUserChatId(userId, chatId, firstName, username) {
    try {
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
                first_name: firstName,
                username: username,
                notifications_enabled: true,
                new_ad_notify: true,
                bonus_reminder: true,
                referral_notify: true,
                payment_notify: true,
                updated_at: new Date().toISOString()
            })
        });
        
        if (!response.ok) {
            // Try update if insert fails
            await fetch(`${SUPABASE_URL}/rest/v1/user_chat_ids?user_id=eq.${userId}`, {
                method: 'PATCH',
                headers: {
                    'apikey': SUPABASE_SERVICE_KEY,
                    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    chat_id: chatId.toString(),
                    first_name: firstName,
                    updated_at: new Date().toISOString()
                })
            });
        }
        
        console.log(`✅ Chat ID saved for user ${userId}`);
    } catch (error) {
        console.error('❌ Save chat ID error:', error);
    }
}

async function getSettingsKeyboard(userId) {
    // Get current settings
    const response = await fetch(`${SUPABASE_URL}/rest/v1/user_chat_ids?user_id=eq.${userId}&select=*`, {
        headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
    });
    
    const data = await response.json();
    const settings = data[0] || {
        new_ad_notify: true,
        bonus_reminder: true,
        referral_notify: true,
        payment_notify: true
    };
    
    return {
        inline_keyboard: [
            [{ text: `${settings.new_ad_notify ? '✅' : '❌'} নতুন এড`, callback_data: 'toggle_new_ad_notify' }],
            [{ text: `${settings.bonus_reminder ? '✅' : '❌'} বোনাস রিমাইন্ডার`, callback_data: 'toggle_bonus_reminder' }],
            [{ text: `${settings.referral_notify ? '✅' : '❌'} রেফারেল আপডেট`, callback_data: 'toggle_referral_notify' }],
            [{ text: `${settings.payment_notify ? '✅' : '❌'} পেমেন্ট আপডেট`, callback_data: 'toggle_payment_notify' }],
            [{ text: '🎮 অ্যাপ ওপেন করুন', web_app: { url: 'https://pumkin-bot-pi.vercel.app' } }],
            [{ text: '🔙 ব্যাক', callback_data: 'settings' }]
        ]
    };
}

async function toggleNotificationSetting(userId, setting) {
    // Get current value
    const response = await fetch(`${SUPABASE_URL}/rest/v1/user_chat_ids?user_id=eq.${userId}&select=${setting}`, {
        headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
    });
    
    const data = await response.json();
    const currentValue = data[0]?.[setting] ?? true;
    
    // Toggle
    await fetch(`${SUPABASE_URL}/rest/v1/user_chat_ids?user_id=eq.${userId}`, {
        method: 'PATCH',
        headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            [setting]: !currentValue,
            updated_at: new Date().toISOString()
        })
    });
}

function getSettingName(setting) {
    const names = {
        'new_ad_notify': 'নতুন এড নোটিফিকেশন',
        'bonus_reminder': 'বোনাস রিমাইন্ডার',
        'referral_notify': 'রেফারেল নোটিফিকেশন',
        'payment_notify': 'পেমেন্ট নোটিফিকেশন'
    };
    return names[setting] || setting;
}

async function getUserBalanceInfo(userId) {
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${userId}&select=balance,total_ads,total_referrals,total_income`, {
            headers: {
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
            }
        });
        
        const data = await response.json();
        const user = data[0];
        
        if (user) {
            return `💰 *আপনার ব্যালেন্স*\n\n` +
                `💵 বর্তমান ব্যালেন্স: *${user.balance?.toFixed(2) || '0.00'} টাকা*\n` +
                `📺 মোট এড: ${user.total_ads || 0} টি\n` +
                `👥 মোট রেফারেল: ${user.total_referrals || 0} জন\n` +
                `📊 মোট আয়: ${user.total_income?.toFixed(2) || '0.00'} টাকা\n\n` +
                `🎮 অ্যাপ ওপেন করে আরও আয় করুন!`;
        } else {
            return `❌ আপনি এখনো অ্যাপে রেজিস্টার করেননি!\n\nঅ্যাপ ওপেন করে রেজিস্টার করুন: https://pumkin-bot-pi.vercel.app`;
        }
    } catch (error) {
        return `❌ তথ্য লোড করতে সমস্যা হয়েছে। পরে আবার চেষ্টা করুন।`;
    }
}

async function sendTelegramMessage(chatId, text, replyMarkup = null) {
    const payload = {
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown',
        disable_web_page_preview: true
    };
    
    if (replyMarkup) {
        payload.reply_markup = replyMarkup;
    }
    
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    
    return response.json();
}

async function editMessageText(chatId, messageId, text, replyMarkup = null) {
    const payload = {
        chat_id: chatId,
        message_id: messageId,
        text: text,
        parse_mode: 'Markdown',
        disable_web_page_preview: true
    };
    
    if (replyMarkup) {
        payload.reply_markup = replyMarkup;
    }
    
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
}

async function editMessageReplyMarkup(chatId, messageId, replyMarkup) {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageReplyMarkup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            message_id: messageId,
            reply_markup: replyMarkup
        })
    });
}

async function answerCallbackQuery(queryId, text, showAlert = false) {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            callback_query_id: queryId,
            text: text,
            show_alert: showAlert
        })
    });
}

// Export for notification sender
export { BOT_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_KEY };