// api/send-to-all.js
const BOT_TOKEN = '8540775880:AAERHIt1yHQV82T4rf7TXnFiEo2hgNsjM6s';
const SUPABASE_URL = 'https://tnsvsjquczljkdxnzrix.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRuc3ZzanF1Y3psamtkeG56cml4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTI5MjIxNCwiZXhwIjoyMDkwODY4MjE0fQ.otceXiZdhxZ8x3Js66tEJGzl11Mxc6NCoDS-OeXYygg';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    const { password, start = 0 } = req.query;
    if (password !== 'admin123') {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const startTime = Date.now();
    
    try {
        // ইউজার গুলো নিন (১০০ করে)
        const offset = parseInt(start);
        
        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/user_chat_ids?select=chat_id,first_name,user_id&notifications_enabled=eq.true&order=created_at.desc&limit=100&offset=${offset}`,
            { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
        );
        
        const users = await response.json();
        
        if (!users || users.length === 0) {
            return res.status(200).json({ 
                success: true, 
                message: 'সব ইউজারকে পাঠানো শেষ! 🎉',
                totalTime: `${(Date.now() - startTime) / 1000} সেকেন্ড`
            });
        }
        
        const message = `🔄 *এড লিমিট রিসেট হয়েছে!*\n\nনতুন ঘন্টা শুরু! এড দেখুন!`;
        
        let success = 0;
        let failed = 0;
        
        // সবাইকে পাঠান
        for (const user of users) {
            try {
                const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: user.chat_id,
                        text: message,
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [[
                                { text: '🎬 এড দেখুন', web_app: { url: 'https://pumkin-bot-pi.vercel.app' } }
                            ]]
                        }
                    })
                });
                if (res.ok) success++;
                else failed++;
            } catch(e) { failed++; }
        }
        
        const nextStart = offset + 100;
        
        // HTML রেসপন্স (ব্রাউজারে সুন্দর দেখাবে)
        return res.status(200).send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>নোটিফিকেশন পাঠানো হচ্ছে...</title>
                <meta charset="UTF-8">
                <style>
                    body { font-family: Arial; padding: 20px; background: #f5f5f5; }
                    .card { background: white; border-radius: 10px; padding: 20px; max-width: 500px; margin: 0 auto; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                    .progress { background: #e0e0e0; height: 20px; border-radius: 10px; margin: 20px 0; }
                    .progress-bar { background: #4CAF50; height: 100%; border-radius: 10px; width: ${Math.min((nextStart / 30000) * 100, 100)}%; }
                    .btn { background: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; }
                    .stats { display: flex; justify-content: space-around; margin: 20px 0; }
                </style>
                <script>
                    setTimeout(function() {
                        window.location.href = '/api/send-to-all?password=admin123&start=${nextStart}';
                    }, 3000);
                </script>
            </head>
            <body>
                <div class="card">
                    <h2>📨 নোটিফিকেশন পাঠানো হচ্ছে...</h2>
                    <div class="progress">
                        <div class="progress-bar"></div>
                    </div>
                    <div class="stats">
                        <div>✅ সফল: ${success}</div>
                        <div>❌ ব্যর্থ: ${failed}</div>
                    </div>
                    <p>📊 ব্যাচ: ${offset/100 + 1} | পাঠানো: ${offset + success}/${nextStart}</p>
                    <p>⏳ ৩ সেকেন্ড পর পরবর্তী ব্যাচ শুরু হবে...</p>
                    <a href="/api/send-to-all?password=admin123&start=${nextStart}" class="btn">⏩ এখনই পরবর্তী ব্যাচ</a>
                </div>
            </body>
            </html>
        `);
        
    } catch (error) {
        return res.status(500).send(`<h2>এরর!</h2><p>${error.message}</p>`);
    }
}