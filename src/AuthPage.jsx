import { useState } from "react";
import { useAuth } from "./AuthContext";

const C = {
  accent:  "#2563eb",
  primary: "#1a4b8c",
  danger:  "#dc2626",
  success: "#16a34a",
  gray100: "#f1f5f9",
  gray200: "#e2e8f0",
  gray300: "#cbd5e1",
  gray400: "#94a3b8",
  gray500: "#64748b",
  gray600: "#475569",
  gray700: "#334155",
  gray800: "#1e293b",
};

function friendlyError(code) {
  const map = {
    "auth/configuration-not-found": "Google Sign-In is not enabled in Firebase Console. Go to Firebase Console → Authentication → Sign-in method → Enable Google.",
    "auth/user-not-found":          "No account found with this email.",
    "auth/wrong-password":          "Incorrect password. Please try again.",
    "auth/invalid-credential":      "Incorrect email or password.",
    "auth/email-already-in-use":    "This email is already registered. Sign in instead.",
    "auth/weak-password":           "Password must be at least 6 characters.",
    "auth/invalid-email":           "Please enter a valid email address.",
    "auth/too-many-requests":       "Too many failed attempts. Try again later.",
    "auth/popup-closed-by-user":    "Sign-in cancelled. Please try again.",
    "auth/popup-blocked":           "Popup blocked by browser. Please allow popups and retry.",
    "auth/network-request-failed":  "Network error. Check your connection.",
    "auth/cancelled-popup-request": "Sign-in cancelled. Please try again.",
    "auth/operation-not-allowed":   "Google sign-in is not enabled. Please contact support.",
    "auth/unauthorized-domain":     "This domain is not authorised in Firebase. Add 'localhost' to Firebase Console → Auth → Authorized Domains.",
  };
  return map[code] || `Sign-in error (${code || "unknown"}). Please try again.`;
}

function GoogleLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function Spinner({ dark = false }) {
  return (
    <>
      <style>{`@keyframes _spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{
        width: 18, height: 18, flexShrink: 0,
        border: `2.5px solid ${dark ? "rgba(37,99,235,0.25)" : "rgba(255,255,255,0.35)"}`,
        borderTopColor: dark ? C.accent : "#fff",
        borderRadius: "50%",
        animation: "_spin 0.7s linear infinite",
      }} />
    </>
  );
}

const inputStyle = {
  width: "100%", padding: "11px 14px",
  border: `1.5px solid ${C.gray200}`, borderRadius: 9,
  fontSize: 14, color: C.gray800, background: "#fff",
  outline: "none", fontFamily: "inherit",
  transition: "border-color 0.18s", boxSizing: "border-box",
};

export default function AuthPage() {
  const { login, signup, loginWithGoogle } = useAuth();
  const [gLoading,    setGLoading]    = useState(false);
  const [gError,      setGError]      = useState("");   // error from Google sign-in
  const [emailOpen,   setEmailOpen]   = useState(false);
  const [emailMode,   setEmailMode]   = useState("signin");
  const [email,       setEmail]       = useState("");
  const [password,    setPassword]    = useState("");
  const [confirm,     setConfirm]     = useState("");
  const [showPwd,     setShowPwd]     = useState(false);
  const [eLoading,    setELoading]    = useState(false);
  const [eError,      setEError]      = useState("");   // error from email sign-in

  // ── Google OAuth (primary) ────────────────────────────────────────────────
  const handleGoogle = async () => {
    setGError("");
    setGLoading(true);
    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: "940547916068-0r2art3sdr1lajulqr8rmma3vljklr92.apps.googleusercontent.com",
        scope: "email profile",
        callback: async (tokenResponse) => {
          if (tokenResponse && tokenResponse.access_token) {
            try {
              await loginWithGoogle(tokenResponse.access_token);
            } catch (err) {
              setGError(err.message || "Google login failed.");
              setGLoading(false);
            }
          } else {
            setGError("Failed to get Google authorization token.");
            setGLoading(false);
          }
        },
        error_callback: (err) => {
          setGError(err.message || "Google login error.");
          setGLoading(false);
        }
      });
      client.requestAccessToken();
    } catch (err) {
      console.error("Google Init Error:", err);
      setGError("Google Sign-In initialization failed.");
      setGLoading(false);
    }
  };

  // ── Email / Password (secondary) ─────────────────────────────────────────
  const handleEmail = async (e) => {
    e.preventDefault();
    setEError("");
    if (!email.trim() || !password) { setEError("Please fill in all fields."); return; }
    if (emailMode === "signup" && password !== confirm) { setEError("Passwords do not match."); return; }
    setELoading(true);
    try {
      if (emailMode === "signup") await signup(email.trim(), password);
      else                        await login(email.trim(), password);
    } catch (err) {
      setEError(err.message || "Authentication failed.");
    } finally {
      setELoading(false);
    }
  };

  return (
    <>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        .auth-card { animation: fadeUp 0.4s ease both; }
        .g-btn:hover:not(:disabled) {
          background: linear-gradient(135deg,#1d4ed8 0%,#1e3a8a 100%) !important;
          box-shadow: 0 6px 24px rgba(37,99,235,0.55) !important;
          transform: translateY(-1px);
        }
        .g-btn:active:not(:disabled) { transform: translateY(0); }
        .email-toggle:hover { background:#f0f5ff !important; }
      `}</style>

      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "stretch",
        background: "linear-gradient(135deg, #0c1445 0%, #1a3a72 45%, #1b2f68 100%)",
        fontFamily: "'Inter', sans-serif",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Background decoration */}
        <div style={{position:"absolute",width:650,height:650,borderRadius:"50%",background:"rgba(37,99,235,0.07)",top:-220,left:-200,pointerEvents:"none"}} />
        <div style={{position:"absolute",width:500,height:500,borderRadius:"50%",background:"rgba(124,58,237,0.06)",bottom:-150,right:-130,pointerEvents:"none"}} />
        <div style={{position:"absolute",width:200,height:200,borderRadius:"50%",background:"rgba(255,255,255,0.025)",top:"30%",left:"22%",pointerEvents:"none"}} />

        {/* ── Left branding ──────────────────────────────────────────────── */}
        <div style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "60px 56px",
          color: "#fff",
          minWidth: 0, // allow flex shrink
        }}>
          {/* Logo */}
          <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:48}}>
            <div style={{width:52,height:52,borderRadius:14,background:"linear-gradient(135deg,#3b82f6,#2563eb)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 6px 18px rgba(37,99,235,0.4)"}}>
              <i className="ti ti-calendar-stats" style={{fontSize:26,color:"#fff"}} />
            </div>
            <div>
              <div style={{fontSize:21,fontWeight:800,letterSpacing:"-0.4px"}}>TimeTable Pro</div>
              <div style={{fontSize:12,color:"rgba(255,255,255,0.45)",marginTop:1}}>School Schedule Management</div>
            </div>
          </div>

          <div style={{fontSize:38,fontWeight:900,lineHeight:1.22,letterSpacing:"-1.2px",marginBottom:16}}>
            Your institution's<br/>private dashboard,<br/>
            <span style={{background:"linear-gradient(90deg,#60a5fa,#a78bfa,#34d399)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
              fully secured.
            </span>
          </div>

          <div style={{fontSize:15,color:"rgba(255,255,255,0.52)",lineHeight:1.75,maxWidth:380,marginBottom:40}}>
            Every school, college, or institute gets a completely
            private account — your data belongs only to you.
          </div>

          {[
            {icon:"ti-lock-square",   label:"One Google account = one private institution"},
            {icon:"ti-shield-check",  label:"Firestore rules block all cross-institution access"},
            {icon:"ti-wand",          label:"Auto-generate conflict-free timetables"},
            {icon:"ti-file-export",   label:"Export class & teacher schedules instantly"},
          ].map((f,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:12,marginBottom:13}}>
              <div style={{width:34,height:34,borderRadius:8,background:"rgba(255,255,255,0.09)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <i className={`ti ${f.icon}`} style={{fontSize:16,color:"rgba(255,255,255,0.78)"}} />
              </div>
              <span style={{fontSize:13,color:"rgba(255,255,255,0.62)"}}>{f.label}</span>
            </div>
          ))}
        </div>

        {/* ── Right auth card ─────────────────────────────────────────────── */}
        <div style={{
          width: 468,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "28px 24px",
        }}>
          <div className="auth-card" style={{
            background: "#fff",
            borderRadius: 22,
            padding: "36px 34px 32px",
            width: "100%",
            boxShadow: "0 28px 68px rgba(0,0,0,0.32)",
          }}>

            {/* App badge */}
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:22}}>
              <div style={{width:36,height:36,borderRadius:9,background:C.accent,display:"flex",alignItems:"center",justifyContent:"center"}}>
                <i className="ti ti-calendar-stats" style={{fontSize:18,color:"#fff"}} />
              </div>
              <div>
                <div style={{fontSize:13,fontWeight:800,color:C.gray800}}>TimeTable Pro</div>
                <div style={{fontSize:10,color:C.gray400}}>Institution Portal</div>
              </div>
            </div>

            <div style={{fontSize:22,fontWeight:900,color:C.gray800,letterSpacing:"-0.5px",marginBottom:5}}>
              Sign in to your dashboard
            </div>
            <div style={{fontSize:13,color:C.gray500,marginBottom:26,lineHeight:1.5}}>
              Use your institution's Google account for secure, private access.
            </div>

            {/* ── GOOGLE BUTTON (primary) ─────────────────────────────── */}
            <button
              className="g-btn"
              onClick={handleGoogle}
              disabled={gLoading || eLoading}
              style={{
                width:"100%", padding:"13px 18px", borderRadius:12,
                background:"linear-gradient(135deg,#2563eb 0%,#1a4b8c 100%)",
                border:"none", color:"#fff",
                display:"flex", alignItems:"center", justifyContent:"center", gap:12,
                fontSize:15, fontWeight:700,
                cursor: gLoading||eLoading ? "not-allowed" : "pointer",
                fontFamily:"inherit",
                boxShadow:"0 4px 16px rgba(37,99,235,0.42)",
                transition:"all 0.18s",
                opacity: eLoading ? 0.6 : 1,
              }}
            >
              {gLoading ? (
                <><Spinner /><span>Connecting to Google…</span></>
              ) : (
                <>
                  <div style={{width:30,height:30,borderRadius:"50%",background:"#fff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:"0 1px 3px rgba(0,0,0,0.12)"}}>
                    <GoogleLogo />
                  </div>
                  <span style={{flex:1,textAlign:"left"}}>Continue with Google</span>
                  <i className="ti ti-arrow-right" style={{fontSize:16}} />
                </>
              )}
            </button>

            {/* ── Google sign-in error (shown right below Google button) ── */}
            {gError && (
              <div style={{
                marginTop:10,
                padding:"10px 13px",
                background:"#fff8f8",
                border:`1.5px solid #fca5a5`,
                borderRadius:9,
                display:"flex", gap:8, alignItems:"flex-start",
              }}>
                <i className="ti ti-alert-triangle" style={{fontSize:16,color:C.danger,flexShrink:0,marginTop:1}} />
                <div>
                  <div style={{fontSize:12,fontWeight:700,color:C.danger,marginBottom:2}}>Google Sign-In Failed</div>
                  <div style={{fontSize:12,color:"#7f1d1d",lineHeight:1.5}}>{gError}</div>
                </div>
              </div>
            )}

            {/* OAuth trust line */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:5,marginTop:9,marginBottom:20}}>
              <i className="ti ti-shield-check" style={{fontSize:13,color:C.success}} />
              <span style={{fontSize:11,color:C.gray400}}>Secured by Google OAuth 2.0 · Your password is never shared</span>
            </div>

            {/* ── Divider ─────────────────────────────────────────────── */}
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
              <div style={{flex:1,height:1,background:C.gray200}} />
              <span style={{fontSize:11,color:C.gray400,fontWeight:500,whiteSpace:"nowrap"}}>or continue with email</span>
              <div style={{flex:1,height:1,background:C.gray200}} />
            </div>

            {/* ── Email accordion ─────────────────────────────────────── */}
            <button
              className="email-toggle"
              onClick={() => { setEmailOpen(v=>!v); setGError(""); setEError(""); }}
              disabled={gLoading}
              style={{
                width:"100%", padding:"11px 16px", borderRadius:10,
                border:`1.5px solid ${emailOpen ? C.accent : C.gray200}`,
                background: emailOpen ? "#eef3ff" : "#fafafa",
                display:"flex", alignItems:"center", justifyContent:"space-between",
                fontSize:13, fontWeight:600,
                color: emailOpen ? C.accent : C.gray600,
                cursor:"pointer", fontFamily:"inherit",
                transition:"all 0.18s",
              }}
            >
              <span style={{display:"flex",alignItems:"center",gap:8}}>
                <i className="ti ti-mail" style={{fontSize:16}} />
                {emailMode==="signin" ? "Sign in with Email & Password" : "Create Email Account"}
              </span>
              <i className={`ti ${emailOpen?"ti-chevron-up":"ti-chevron-down"}`} style={{fontSize:14}} />
            </button>

            {emailOpen && (
              <div style={{
                border:`1.5px solid ${C.accent}`, borderTop:"none",
                borderRadius:"0 0 10px 10px",
                padding:"16px 14px 14px",
                background:"#f8faff",
                marginBottom:2,
              }}>
                {/* Email error */}
                {eError && (
                  <div style={{
                    padding:"9px 12px", marginBottom:12,
                    background:"#fff8f8", border:"1.5px solid #fca5a5",
                    borderRadius:8,
                    display:"flex", gap:7, alignItems:"flex-start",
                  }}>
                    <i className="ti ti-alert-circle" style={{fontSize:14,color:C.danger,flexShrink:0,marginTop:1}} />
                    <span style={{fontSize:12,color:"#7f1d1d"}}>{eError}</span>
                  </div>
                )}

                <form onSubmit={handleEmail} style={{display:"flex",flexDirection:"column",gap:11}}>
                  <div>
                    <label style={{display:"block",fontSize:11,fontWeight:700,color:C.gray600,marginBottom:4,textTransform:"uppercase",letterSpacing:"0.04em"}}>Email</label>
                    <input type="email" value={email} placeholder="admin@school.edu"
                      onChange={e=>{setEmail(e.target.value);setEError("");}}
                      required style={inputStyle}
                      onFocus={e=>(e.target.style.borderColor=C.accent)}
                      onBlur={e=>(e.target.style.borderColor=C.gray200)} />
                  </div>

                  <div>
                    <label style={{display:"block",fontSize:11,fontWeight:700,color:C.gray600,marginBottom:4,textTransform:"uppercase",letterSpacing:"0.04em"}}>Password</label>
                    <div style={{position:"relative"}}>
                      <input type={showPwd?"text":"password"} value={password}
                        placeholder={emailMode==="signup"?"Min. 6 characters":"Your password"}
                        onChange={e=>{setPassword(e.target.value);setEError("");}}
                        required style={{...inputStyle,paddingRight:40}}
                        onFocus={e=>(e.target.style.borderColor=C.accent)}
                        onBlur={e=>(e.target.style.borderColor=C.gray200)} />
                      <button type="button" onClick={()=>setShowPwd(v=>!v)}
                        style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:C.gray400,padding:0}}>
                        <i className={`ti ${showPwd?"ti-eye-off":"ti-eye"}`} style={{fontSize:15}} />
                      </button>
                    </div>
                  </div>

                  {emailMode==="signup" && (
                    <div>
                      <label style={{display:"block",fontSize:11,fontWeight:700,color:C.gray600,marginBottom:4,textTransform:"uppercase",letterSpacing:"0.04em"}}>Confirm Password</label>
                      <input type={showPwd?"text":"password"} value={confirm}
                        placeholder="Re-enter password"
                        onChange={e=>{setConfirm(e.target.value);setEError("");}}
                        required style={inputStyle}
                        onFocus={e=>(e.target.style.borderColor=C.accent)}
                        onBlur={e=>(e.target.style.borderColor=C.gray200)} />
                    </div>
                  )}

                  <button type="submit" disabled={eLoading||gLoading}
                    style={{
                      width:"100%", padding:"11px", borderRadius:9,
                      background:C.accent, color:"#fff", border:"none",
                      fontSize:13, fontWeight:700,
                      cursor:eLoading?"not-allowed":"pointer",
                      fontFamily:"inherit",
                      display:"flex",alignItems:"center",justifyContent:"center",gap:8,
                      opacity:eLoading||gLoading?0.75:1,
                      boxShadow:"0 2px 10px rgba(37,99,235,0.28)",
                    }}>
                    {eLoading
                      ? <><Spinner/><span>Please wait…</span></>
                      : emailMode==="signin"
                        ? <><i className="ti ti-login" style={{fontSize:15}}/> Sign In</>
                        : <><i className="ti ti-user-plus" style={{fontSize:15}}/> Create Account</>
                    }
                  </button>
                </form>

                <div style={{textAlign:"center",marginTop:11,fontSize:12,color:C.gray500}}>
                  {emailMode==="signin" ? "No account? " : "Already registered? "}
                  <button onClick={()=>{setEmailMode(m=>m==="signin"?"signup":"signin");setEError("");setPassword("");setConfirm("");}}
                    style={{background:"none",border:"none",color:C.accent,fontWeight:700,cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>
                    {emailMode==="signin"?"Create one":"Sign in"}
                  </button>
                </div>
              </div>
            )}

            {/* Privacy note */}
            <div style={{
              marginTop:18, padding:"12px 14px",
              background:"linear-gradient(135deg,#f0fdf4,#f0f9ff)",
              border:"1px solid #bbf7d0", borderRadius:10,
              display:"flex", gap:10, alignItems:"flex-start",
            }}>
              <div style={{width:28,height:28,borderRadius:7,background:"#dcfce7",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <i className="ti ti-shield-lock" style={{fontSize:14,color:"#16a34a"}} />
              </div>
              <div>
                <div style={{fontSize:11,fontWeight:700,color:"#15803d",marginBottom:2}}>100% Private &amp; Secure</div>
                <div style={{fontSize:11,color:"#166534",lineHeight:1.5}}>
                  Your institution data is isolated at the database level. No other user can access your dashboard or timetables.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
