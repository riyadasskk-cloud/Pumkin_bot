// app.js - Complete with your table structure
let currentUser = null;

// Get Telegram User ID
function getTelegramUserId() {
    const tg = window.Telegram?.WebApp;
    if (tg?.initDataUnsafe?.user?.id) {
        return tg.initDataUnsafe.user.id.toString();
    }
    let userId = localStorage.getItem('temp_user_id');
    if (!userId) {
        userId = 'web_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
        localStorage.setItem('temp_user_id', userId);
    }
    return userId;
}

// Get Telegram Username
function getTelegramUsername() {
    const tg = window.Telegram?.WebApp;
    return tg?.initDataUnsafe?.user?.username || null;
}

// ============================================
// COMPLETE REFERRAL SYSTEM
// ============================================
async function processReferral(userId, userName, userFirstName) {
    const tg = window.Telegram?.WebApp;
    let referrerId = null;
    
    // Check Telegram start_param
    if (tg?.initDataUnsafe?.start_param) {
        let param = tg.initDataUnsafe.start_param;
        if (param.startsWith('ref')) {
            referrerId = param.replace('ref', '');
        }
    }
    
    // Check URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const startapp = urlParams.get('startapp');
    if (startapp && startapp.startsWith('ref')) {
        referrerId = startapp.replace('ref', '');
    }
    
    const refParam = urlParams.get('ref');
    if (refParam) {
        referrerId = refParam;
    }
    
    console.log('🔍 Referrer ID:', referrerId);
    console.log('👤 Current User ID:', userId);
    
    // Don't process if no referrer or self referral
    if (!referrerId || referrerId === userId) {
        console.log('❌ No valid referrer');
        return false;
    }
    
    // Check if already referred
    const { data: existingUser } = await supabase
        .from('users')
        .select('referred_by')
        .eq('id', userId)
        .single();
    
    if (existingUser?.referred_by) {
        console.log('⚠️ User already has a referrer');
        return false;
    }
    
    // Check localStorage
    if (localStorage.getItem(`ref_${userId}`)) {
        console.log('⚠️ Referral already processed');
        return false;
    }
    
    console.log('🎯 Processing referral from:', referrerId);
    
    try {
        // STEP 1: Get referrer data
        const { data: referrer, error: referrerError } = await supabase
            .from('users')
            .select('*')
            .eq('id', referrerId)
            .single();
        
        if (referrerError || !referrer) {
            console.error('Referrer not found:', referrerError);
            return false;
        }
        
        // STEP 2: Add bonus to NEW USER (50 tk)
        const { error: newUserError } = await supabase
            .from('users')
            .update({
                balance: supabase.rpc('increment', { x: 50 }),
                total_income: supabase.rpc('increment', { x: 50 }),
                referred_by: referrerId
            })
            .eq('id', userId);
        
        if (newUserError) {
            // Fallback
            const newBalance = (currentUser?.balance || 50) + 50;
            const newIncome = (currentUser?.total_income || 50) + 50;
            await supabase
                .from('users')
                .update({
                    balance: newBalance,
                    total_income: newIncome,
                    referred_by: referrerId
                })
                .eq('id', userId);
        }
        
        // STEP 3: Add bonus to REFERRER (100 tk)
        const newReferralCount = (referrer.total_referrals || 0) + 1;
        const newReferrerBalance = (referrer.balance || 0) + 100;
        const newReferrerIncome = (referrer.total_income || 0) + 100;
        
        await supabase
            .from('users')
            .update({
                balance: newReferrerBalance,
                total_income: newReferrerIncome,
                total_referrals: newReferralCount
            })
            .eq('id', referrerId);
        
        // STEP 4: Save to REFERRALS TABLE
        const timestamp = Date.now();
        await supabase
            .from('referrals')
            .insert({
                user_id: referrerId,
                referred_by: referrerId,
                referrer_user_id: referrerId,
                new_user_name: userFirstName,
                new_user_id: userId,
                join_date: new Date().toISOString(),
                timestamp: timestamp,
                status: 'completed',
                source: 'telegram_startapp'
            });
        
        // STEP 5: Mark as processed
        localStorage.setItem(`ref_${userId}`, 'processed');
        
        // Show success message
        setTimeout(() => {
            alert('🎉 রেফারেল সফল! আপনি ৫০ টাকা বোনাস পেয়েছেন!');
        }, 1000);
        
        console.log('✅ Referral completed successfully');
        return true;
        
    } catch (error) {
        console.error('❌ Referral error:', error);
        return false;
    }
}

// Load or Create User
async function loadUser() {
    const userId = getTelegramUserId();
    const tg = window.Telegram?.WebApp;
    const firstName = tg?.initDataUnsafe?.user?.first_name || 'ইউজার';
    const username = getTelegramUsername();
    
    console.log('📱 Loading user:', userId);
    
    // Try to get from Supabase
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
    
    const now = new Date();
    const todayStr = now.toDateString();
    
    if (data && !error) {
        // Check daily reset for ads
        const lastAdReset = new Date(data.last_ad_reset);
        if (lastAdReset.toDateString() !== todayStr) {
            await supabase
                .from('users')
                .update({
                    today_ads: 0,
                    last_ad_reset: now.toISOString()
                })
                .eq('id', userId);
            data.today_ads = 0;
        }
        
        // Check daily reset for bonus ads
        const lastBonusReset = new Date(data.last_bonus_ad_reset);
        if (lastBonusReset.toDateString() !== todayStr) {
            await supabase
                .from('users')
                .update({
                    today_bonus_ads: 0,
                    last_bonus_ad_reset: now.toISOString()
                })
                .eq('id', userId);
            data.today_bonus_ads = 0;
        }
        
        // Check daily reset for bonus ads 2
        const lastBonusReset2 = new Date(data.last_bonus_ad_reset_2);
        if (lastBonusReset2.toDateString() !== todayStr) {
            await supabase
                .from('users')
                .update({
                    today_bonus_ads_2: 0,
                    last_bonus_ad_reset_2: now.toISOString()
                })
                .eq('id', userId);
            data.today_bonus_ads_2 = 0;
        }
        
        // Update last_active
        await supabase
            .from('users')
            .update({ last_active: now.toISOString() })
            .eq('id', userId);
        
        currentUser = data;
        console.log('✅ Existing user loaded:', currentUser);
    } else {
        // Create new user
        const newUser = {
            id: userId,
            first_name: firstName,
            username: username,
            balance: 50.00,
            today_ads: 0,
            total_ads: 0,
            today_bonus_ads: 0,
            today_bonus_ads_2: 0,
            total_referrals: 0,
            total_income: 50.00,
            join_date: now.toISOString(),
            last_active: now.toISOString(),
            referred_by: null,
            last_ad_reset: now.toISOString(),
            last_bonus_ad_reset: now.toISOString(),
            last_bonus_ad_reset_2: now.toISOString()
        };
        
        const { data: created, error: createError } = await supabase
            .from('users')
            .insert(newUser)
            .select()
            .single();
        
        if (createError) {
            console.error('❌ Create user error:', createError);
            currentUser = newUser;
        } else {
            currentUser = created;
            console.log('✅ New user created:', currentUser);
        }
        
        // Process referral for new user
        await processReferral(userId, username, firstName);
    }
    
    updateUI();
    return currentUser;
}

// Update UI
function updateUI() {
    if (!currentUser) return;
    
    const elements = {
        'mainBalance': currentUser.balance?.toFixed(2) + ' টাকা',
        'userName': currentUser.first_name,
        'todayAds': `${currentUser.today_ads || 0}/10`,
        'totalReferrals': currentUser.total_referrals || 0,
        'totalReferrals2': currentUser.total_referrals || 0,
        'totalAds': currentUser.total_ads || 0,
        'totalIncome': (currentUser.total_income || 0).toFixed(2) + ' টাকা',
        'bonusAdsCount': `${currentUser.today_bonus_ads || 0}/10`,
        'todayAdsCount': currentUser.today_ads || 0,
        'bonusCounter': `${currentUser.today_bonus_ads || 0}/10`,
        'profileName': currentUser.first_name,
        'joinDate': new Date(currentUser.join_date).toLocaleDateString('bn'),
        'balance': currentUser.balance?.toFixed(2) + ' টাকা',
        'reqReferrals': `${currentUser.total_referrals || 0}/15`,
        'reqAds': `${currentUser.total_ads || 0}/10`,
        'remainingAds': 10 - (currentUser.today_ads || 0)
    };
    
    for (const [id, value] of Object.entries(elements)) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }
    
    // Progress bars
    const adProgress = ((currentUser.today_ads || 0) / 10) * 100;
    const bonusProgress = ((currentUser.today_bonus_ads || 0) / 10) * 100;
    
    const progressFills = document.querySelectorAll('.progress-fill');
    progressFills.forEach(el => {
        if (el.id === 'progressFill') el.style.width = `${adProgress}%`;
        else if (el.id === 'bonusProgressFill') el.style.width = `${bonusProgress}%`;
    });
    
    // Referral link
    const referralLink = `https://t.me/${window.CONFIG.BOT_USERNAME}?startapp=ref${currentUser.id}`;
    const linkElements = ['referralLink', 'profileReferralLink'];
    linkElements.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = referralLink;
    });
    
    // User ID display
    const userIdEl = document.getElementById('userId');
    if (userIdEl) userIdEl.textContent = `আইডি: ${currentUser.id.substring(0, 10)}...`;
    
    // Reset timer
    const resetTimer = document.getElementById('resetTimer');
    if (resetTimer) {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        const diffMs = tomorrow - now;
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        resetTimer.textContent = `রিসেট: ${hours}ঘ ${minutes}মি`;
    }
    
    // Hide loading
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) loadingOverlay.style.display = 'none';
}

// Add earning from main ad
async function addEarning(amount) {
    if (!currentUser) return { success: false };
    if (currentUser.today_ads >= 10) return { success: false, error: 'Limit reached' };
    
    const newTodayAds = (currentUser.today_ads || 0) + 1;
    const newBalance = (currentUser.balance || 0) + amount;
    const newTotalIncome = (currentUser.total_income || 0) + amount;
    const newTotalAds = (currentUser.total_ads || 0) + 1;
    
    const { data, error } = await supabase
        .from('users')
        .update({
            today_ads: newTodayAds,
            balance: newBalance,
            total_income: newTotalIncome,
            total_ads: newTotalAds,
            last_active: new Date().toISOString()
        })
        .eq('id', currentUser.id)
        .select()
        .single();
    
    if (!error && data) {
        currentUser = data;
        updateUI();
        return { success: true };
    }
    return { success: false, error: error?.message };
}

// Add bonus earning
async function addBonusEarning(amount) {
    if (!currentUser) return { success: false };
    if (currentUser.today_bonus_ads >= 10) return { success: false, error: 'Bonus limit reached' };
    
    const newBonusAds = (currentUser.today_bonus_ads || 0) + 1;
    const newBalance = (currentUser.balance || 0) + amount;
    const newTotalIncome = (currentUser.total_income || 0) + amount;
    
    const { data, error } = await supabase
        .from('users')
        .update({
            today_bonus_ads: newBonusAds,
            balance: newBalance,
            total_income: newTotalIncome,
            last_active: new Date().toISOString()
        })
        .eq('id', currentUser.id)
        .select()
        .single();
    
    if (!error && data) {
        currentUser = data;
        updateUI();
        return { success: true };
    }
    return { success: false };
}

// Add general bonus
async function addBonus(amount) {
    if (!currentUser) return;
    const newBalance = (currentUser.balance || 0) + amount;
    const newTotalIncome = (currentUser.total_income || 0) + amount;
    
    await supabase
        .from('users')
        .update({ 
            balance: newBalance, 
            total_income: newTotalIncome,
            last_active: new Date().toISOString()
        })
        .eq('id', currentUser.id);
    
    currentUser = await loadUser();
    updateUI();
}

// Request withdrawal
async function requestWithdraw(amount, account, method) {
    if (!currentUser) return { success: false, error: 'No user' };
    if (amount > currentUser.balance) return { success: false, error: 'Insufficient balance' };
    if ((currentUser.total_referrals || 0) < 15) return { success: false, error: 'Need 15 referrals' };
    if ((currentUser.total_ads || 0) < 10) return { success: false, error: 'Need 10 total ads' };
    
    // Deduct balance
    const newBalance = currentUser.balance - amount;
    await supabase
        .from('users')
        .update({ balance: newBalance })
        .eq('id', currentUser.id);
    
    // Create withdrawal request
    const timestamp = Date.now();
    const { error } = await supabase
        .from('withdrawals')
        .insert({
            user_id: currentUser.id,
            user_name: currentUser.first_name,
            amount: amount,
            account_number: account,
            method: method,
            status: 'pending',
            request_date: new Date().toISOString(),
            timestamp: timestamp,
            user_ads: currentUser.total_ads,
            user_referrals: currentUser.total_referrals
        });
    
    if (!error) {
        currentUser = await loadUser();
        updateUI();
        return { success: true };
    }
    return { success: false, error: error.message };
}

// Copy referral link
async function copyReferralLink() {
    if (!currentUser) return;
    const link = `https://t.me/${window.CONFIG.BOT_USERNAME}?startapp=ref${currentUser.id}`;
    await navigator.clipboard.writeText(link);
    alert('✅ রেফারেল লিঙ্ক কপি হয়েছে!\n\n' + link);
}

// Get current user
async function getCurrentUser() {
    if (!currentUser) await loadUser();
    return currentUser;
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
        tg.expand();
        tg.ready();
    }
    await loadUser();
    updateUI();
    
    // Update timer every minute
    setInterval(() => {
        const resetTimer = document.getElementById('resetTimer');
        if (resetTimer && currentUser) {
            const now = new Date();
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(0, 0, 0, 0);
            const diffMs = tomorrow - now;
            const hours = Math.floor(diffMs / (1000 * 60 * 60));
            const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
            resetTimer.textContent = `রিসেট: ${hours}ঘ ${minutes}মি`;
        }
    }, 60000);
});

// Expose functions globally
window.addEarning = addEarning;
window.addBonusEarning = addBonusEarning;
window.addBonus = addBonus;
window.requestWithdraw = requestWithdraw;
window.copyReferralLink = copyReferralLink;
window.getCurrentUser = getCurrentUser;
window.loadUser = loadUser;