// app.js - Complete with Hourly Reset and 50 Ads Withdrawal Requirement
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

// Process Referral
async function processReferral(userId, userName, userFirstName) {
    const tg = window.Telegram?.WebApp;
    let referrerId = null;
    
    if (tg?.initDataUnsafe?.start_param) {
        let param = tg.initDataUnsafe.start_param;
        if (param.startsWith('ref')) {
            referrerId = param.replace('ref', '');
        }
    }
    
    const urlParams = new URLSearchParams(window.location.search);
    const startapp = urlParams.get('startapp');
    if (startapp && startapp.startsWith('ref')) {
        referrerId = startapp.replace('ref', '');
    }
    
    const refParam = urlParams.get('ref');
    if (refParam) {
        referrerId = refParam;
    }
    
    if (!referrerId || referrerId === userId) {
        return false;
    }
    
    const { data: existingUser } = await supabase
        .from('users')
        .select('referred_by')
        .eq('id', userId)
        .single();
    
    if (existingUser?.referred_by) {
        return false;
    }
    
    if (localStorage.getItem(`ref_${userId}`)) {
        return false;
    }
    
    try {
        const { data: referrer, error: referrerError } = await supabase
            .from('users')
            .select('*')
            .eq('id', referrerId)
            .single();
        
        if (referrerError || !referrer) {
            return false;
        }
        
        // Add bonus to NEW USER (50 tk)
        const { error: newUserError } = await supabase
            .from('users')
            .update({
                balance: supabase.rpc('increment', { x: 50 }),
                total_income: supabase.rpc('increment', { x: 50 }),
                referred_by: referrerId
            })
            .eq('id', userId);
        
        if (newUserError) {
            const { data: currentUserData } = await supabase
                .from('users')
                .select('balance, total_income')
                .eq('id', userId)
                .single();
            
            await supabase
                .from('users')
                .update({
                    balance: (currentUserData?.balance || 50) + 50,
                    total_income: (currentUserData?.total_income || 50) + 50,
                    referred_by: referrerId
                })
                .eq('id', userId);
        }
        
        // Add bonus to REFERRER (100 tk)
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
        
        // Save to REFERRALS TABLE
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
        
        localStorage.setItem(`ref_${userId}`, 'processed');
        
        setTimeout(() => {
            alert('🎉 রেফারেল সফল! আপনি ৫০ টাকা বোনাস পেয়েছেন!');
        }, 1000);
        
        return true;
        
    } catch (error) {
        console.error('Referral error:', error);
        return false;
    }
}

// Load or Create User (NO DAILY RESET - hourly handled by localStorage)
async function loadUser() {
    const userId = getTelegramUserId();
    const tg = window.Telegram?.WebApp;
    const firstName = tg?.initDataUnsafe?.user?.first_name || 'ইউজার';
    const username = getTelegramUsername();
    
    console.log('Loading user:', userId);
    
    let { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
    
    const now = new Date();
    
    if (user) {
        // Update last_active only - no daily reset
        await supabase
            .from('users')
            .update({ last_active: now.toISOString() })
            .eq('id', userId);
        
        currentUser = user;
        console.log('Existing user loaded:', currentUser);
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
            console.error('Create user error:', createError);
            currentUser = newUser;
        } else {
            currentUser = created;
            console.log('New user created:', currentUser);
        }
        
        // Process referral for new user
        await processReferral(userId, username, firstName);
    }
    
    updateUI();
    return currentUser;
}

// Update UI (balance, total stats, not daily counters)
function updateUI() {
    if (!currentUser) return;
    
    const elements = {
        'mainBalance': currentUser.balance?.toFixed(2) + ' টাকা',
        'userName': currentUser.first_name,
        'totalReferrals': currentUser.total_referrals || 0,
        'totalReferrals2': currentUser.total_referrals || 0,
        'totalAds': currentUser.total_ads || 0,
        'totalIncome': (currentUser.total_income || 0).toFixed(2) + ' টাকা',
        'profileName': currentUser.first_name,
        'joinDate': new Date(currentUser.join_date).toLocaleDateString('bn'),
        'balance': currentUser.balance?.toFixed(2) + ' টাকা',
        'reqReferrals': `${currentUser.total_referrals || 0}/15`,
        'reqAds': `${currentUser.total_ads || 0}/50`
    };
    
    for (const [id, value] of Object.entries(elements)) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }
    
    // Update profile total income and ads
    const profileTotalIncome = document.getElementById('profileTotalIncome');
    if (profileTotalIncome) profileTotalIncome.textContent = (currentUser.total_income || 0).toFixed(2) + ' টাকা';
    
    const profileTotalAds = document.getElementById('profileTotalAds');
    if (profileTotalAds) profileTotalAds.textContent = currentUser.total_ads || 0;
    
    const profileReferrals = document.getElementById('profileReferrals');
    if (profileReferrals) profileReferrals.textContent = currentUser.total_referrals || 0;
    
    // Referral link
    const referralLink = `https://t.me/${window.CONFIG?.BOT_USERNAME || 'mishti_kumra_bot'}?startapp=ref${currentUser.id}`;
    const linkElements = ['referralLink', 'profileReferralLink'];
    linkElements.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = referralLink;
    });
    
    // User ID display
    const userIdEl = document.getElementById('userId');
    if (userIdEl) userIdEl.textContent = `আইডি: ${currentUser.id.substring(0, 10)}...`;
    
    const avatarText = document.getElementById('avatarText');
    if (avatarText) avatarText.textContent = currentUser.first_name ? currentUser.first_name.charAt(0).toUpperCase() : 'U';
    
    // Hide loading
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) loadingOverlay.style.display = 'none';
}

// Add earning from main ad (updates both database AND localStorage)
async function addEarning(amount) {
    if (!currentUser) return { success: false };
    
    // Get hourly count from localStorage
    const hourlyCount = parseInt(localStorage.getItem('hourly_ads_watched') || '0');
    if (hourlyCount >= 10) return { success: false, error: 'Hourly limit reached' };
    
    const newHourlyCount = hourlyCount + 1;
    localStorage.setItem('hourly_ads_watched', newHourlyCount.toString());
    
    const newBalance = (currentUser.balance || 0) + amount;
    const newTotalIncome = (currentUser.total_income || 0) + amount;
    const newTotalAds = (currentUser.total_ads || 0) + 1;
    
    const { data, error } = await supabase
        .from('users')
        .update({
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
        return { success: true, count: newHourlyCount };
    }
    return { success: false, error: error?.message };
}

// Add bonus earning
async function addBonusEarning(amount) {
    if (!currentUser) return { success: false };
    
    const hourlyCount = parseInt(localStorage.getItem('hourly_bonus_ads_watched') || '0');
    if (hourlyCount >= 10) return { success: false, error: 'Hourly bonus limit reached' };
    
    const newHourlyCount = hourlyCount + 1;
    localStorage.setItem('hourly_bonus_ads_watched', newHourlyCount.toString());
    
    const newBalance = (currentUser.balance || 0) + amount;
    const newTotalIncome = (currentUser.total_income || 0) + amount;
    
    const { data, error } = await supabase
        .from('users')
        .update({
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
        return { success: true, count: newHourlyCount };
    }
    return { success: false };
}

// Add general bonus (for tasks)
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

// Request withdrawal - UPDATED: 50 ads minimum (was 10)
async function requestWithdraw(amount, account, method) {
    if (!currentUser) return { success: false, error: 'No user' };
    if (amount > currentUser.balance) return { success: false, error: 'Insufficient balance' };
    if ((currentUser.total_referrals || 0) < 15) return { success: false, error: 'Need 15 referrals' };
    // UPDATED: 10 ads to 50 ads requirement
    if ((currentUser.total_ads || 0) < 50) return { success: false, error: 'Need 50 total ads' };
    
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
    const link = `https://t.me/${window.CONFIG?.BOT_USERNAME || 'mishti_kumra_bot'}?startapp=ref${currentUser.id}`;
    try {
        await navigator.clipboard.writeText(link);
        alert('✅ রেফারেল লিঙ্ক কপি হয়েছে!\n\n' + link);
    } catch (error) {
        const textarea = document.createElement('textarea');
        textarea.value = link;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        alert('✅ রেফারেল লিঙ্ক কপি হয়েছে!\n\n' + link);
    }
}

// Get current user
async function getCurrentUser() {
    if (!currentUser) await loadUser();
    return currentUser;
}

// Get user data (alias)
function getUserData() {
    return currentUser;
}

// Update all pages UI
function updateAllPagesUI() {
    updateUI();
}

// Hide loading
function hideLoading() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) loadingOverlay.style.display = 'none';
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
    hideLoading();
});

// Expose functions globally
window.addEarning = addEarning;
window.addBonusEarning = addBonusEarning;
window.addBonus = addBonus;
window.requestWithdraw = requestWithdraw;
window.copyReferralLink = copyReferralLink;
window.getCurrentUser = getCurrentUser;
window.loadUser = loadUser;
window.getUserData = getUserData;
window.updateUI = updateUI;
window.updateAllPagesUI = updateAllPagesUI;
window.hideLoading = hideLoading;