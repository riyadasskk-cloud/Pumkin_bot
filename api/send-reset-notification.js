// api/send-reset-notification.js
const BOT_TOKEN = process.env.BOT_TOKEN || '8540775880:AAERHIt1yHQV82T4rf7TXnFiEo2hgNsjM6s';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tnsvsjquczljkdxnzrix.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRuc3ZzanF1Y3psamtkeG56cml4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTI5MjIxNCwiZXhwIjoyMDkwODY4MjE0fQ.otceXiZdhxZ8x3Js66tEJGzl11Mxc6NCoDS-OeXYygg';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // সহজ পাসওয়ার্ড প্রোটেকশন
    const { password } = req.query;
    if (password !== 'admin123') {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    try {
        // Get all subscribed users
        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/user_chat_ids?select=chat_id,first_name&notifications_enabled=eq.true&new_ad_notify=eq.true`,
            {
                headers: {
                    'apikey': SUPABASE_SERVICE_KEY,
                    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
                }
            }
        );
        
        const users = await response.json();
        
        const message = `🔄 *এড লিমিট রিসেট হয়েছে!*\n\n` +
            `নতুন ঘন্টা শুরু হয়েছে!\n` +
            `এখনই এড দেখে ৩০ টাকা করে উপার্জন করুন!\n\n` +
            `⏰ এই ঘন্টায় ১০টি এড দেখতে পারবেন।`;
        
        let sentCount = 0;
        
        for (const user of users) {
            try {
                await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: user.chat_id,
                        text: message,
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [[
                                { text: '🎬 এড দেখুন', web_app: { url: 'https://pumkin-bot-pi.vercel.app/watch-ads.html' } }
                            ]]
                        }
                    })
                });
                sentCount++;
                await new Promise(r => setTimeout(r, 50)); // Rate limit
            } catch (e) {
                console.error(`Failed: ${user.chat_id}`, e);
            }
        }
        
        return res.status(200).json({ 
            success: true, 
            sent: sentCount,
            total: users.length 
        });
        
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}