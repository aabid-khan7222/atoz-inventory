# Production Authentication Error Fix

## समस्या क्या थी? (What was the problem?)

जब आप **localhost (development)** पर login करते थे और फिर **production** पर application खोलते थे, तो बहुत सारे errors आ रहे थे:

1. **"Invalid or expired token"** errors
2. **"401 Unauthorized"** errors  
3. **"Token verification failed: invalid signature"** errors

### मुख्य कारण:

1. **JWT_SECRET Mismatch**: 
   - Localhost पर token एक JWT_SECRET से sign होता है
   - Production पर server का अलग JWT_SECRET होता है
   - इसलिए production server token को verify नहीं कर पाता → "invalid signature" error

2. **Token localStorage में persist हो रहा था**:
   - Localhost पर login करने पर token localStorage में save हो जाता था
   - Production खोलने पर वही purana token use होने की कोशिश होती थी
   - लेकिन वह token production के JWT_SECRET से match नहीं करता था

3. **401 errors पर automatic cleanup नहीं हो रहा था**:
   - जब 401 error आता था, token automatically clear नहीं हो रहा था
   - User को manually logout करना पड़ता था

## समाधान क्या किया गया? (What was fixed?)

### 1. **Automatic Token Clearing on 401 Errors** (`client/src/api.js`)
   - जब भी API call से 401 (Unauthorized) error आता है
   - Automatically token clear हो जाता है
   - localStorage से `auth_token` और `auth_user` remove हो जाते हैं
   - Event dispatch होता है जिससे AuthContext को पता चल जाता है

### 2. **Environment Detection** (`client/src/contexts/AuthContext.jsx`)
   - जब user login करता है, current API base URL store होता है (`auth_api_base`)
   - Page load पर check होता है कि token same environment के लिए है या नहीं
   - अगर token different environment (localhost vs production) का है, तो automatically clear हो जाता है
   - इससे cross-environment token usage prevent होता है

### 3. **Event-Based Auth State Management**
   - `azb-auth-invalid` event जब dispatch होता है
   - AuthContext automatically logout कर देता है
   - User automatically login page पर redirect हो जाता है

## आपको क्या करना है? (What you need to do?)

### Production पर Deploy करने से पहले:

1. **Production Server पर JWT_SECRET set करें**:
   ```bash
   # Render/Railway/Vercel dashboard में environment variable add करें:
   JWT_SECRET=your-very-secure-random-secret-key-here
   ```
   ⚠️ **Important**: यह secret बहुत strong होना चाहिए (कम से कम 32 characters)

2. **Frontend Environment Variable set करें**:
   ```bash
   # Production frontend में:
   VITE_API_BASE_URL=https://your-backend-url.com/api
   ```

3. **Backend CORS Configuration check करें**:
   ```bash
   # Production backend में:
   ALLOWED_ORIGINS=https://your-frontend-url.com
   ```

### Production पर Test करने के लिए:

1. **Clear Browser Storage**:
   - Production URL खोलने से पहले browser का localStorage clear करें
   - या Incognito/Private window use करें
   - या Browser DevTools → Application → Local Storage → Clear करें

2. **Fresh Login करें**:
   - Production पर fresh login करें
   - अब token production के JWT_SECRET से sign होगा
   - सभी API calls काम करेंगे

3. **Errors Check करें**:
   - Browser Console में errors check करें
   - अब 401 errors नहीं आने चाहिए
   - अगर token invalid हो जाए, तो automatically clear होकर login page पर redirect हो जाएगा

## Code Changes Summary:

### `client/src/api.js`:
- ✅ `clearInvalidAuth()` function add किया
- ✅ 401 errors पर automatic token clearing
- ✅ Login endpoint को exclude किया (login failure पर token clear नहीं होगा)

### `client/src/contexts/AuthContext.jsx`:
- ✅ Environment detection add किया (`auth_api_base` storage)
- ✅ `azb-auth-invalid` event listener add किया
- ✅ `logout` function को `useCallback` में move किया
- ✅ Cross-environment token usage prevention

## Testing Checklist:

- [ ] Localhost पर login करके test करें - काम करना चाहिए
- [ ] Production पर fresh login करें - काम करना चाहिए  
- [ ] Localhost token के साथ production खोलें - automatically clear होना चाहिए
- [ ] Production पर token expire होने पर - automatically logout होना चाहिए
- [ ] 401 errors आने पर - automatically login page पर redirect होना चाहिए

## Additional Notes:

- अगर आपको अभी भी errors आ रहे हैं, तो:
  1. Browser localStorage clear करें
  2. Hard refresh करें (Ctrl+Shift+R)
  3. Fresh login करें
  4. Browser console में errors check करें

- Production server logs check करें:
  - `[requireAuth] Token verification failed` messages देखें
  - JWT_SECRET properly set है या नहीं verify करें

## Support:

अगर कोई issue हो, तो:
1. Browser console की errors share करें
2. Server logs share करें
3. Environment variables verify करें

