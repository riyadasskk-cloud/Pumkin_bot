// supabase-client.js
console.log('🔌 Initializing Supabase client...');

const supabaseClient = supabase.createClient(
    window.CONFIG.SUPABASE_URL,
    window.CONFIG.SUPABASE_ANON_KEY,
    {
        auth: {
            persistSession: false,
            autoRefreshToken: false
        }
    }
);

// Test connection
(async function() {
    const { error } = await supabaseClient.from('users').select('id').limit(1);
    if (error) {
        console.error('❌ Supabase connection error:', error.message);
        console.log('💡 Make sure you have run the SQL setup in Supabase');
    } else {
        console.log('✅ Supabase connected successfully!');
    }
})();

window.supabase = supabaseClient;