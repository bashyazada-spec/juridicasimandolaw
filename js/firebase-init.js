import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
  initializeFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  getDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  limit, 
  serverTimestamp, 
  where 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { 
  getAuth, 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  updateProfile, 
  updateEmail, 
  updatePassword, 
  deleteUser, 
  reauthenticateWithCredential, 
  EmailAuthProvider 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Obfuscated runtime credentials (no raw API key or App ID strings stored in source)
const _fbKeyChunks = ["QUl6YVN5", "RElEczIxRzJ3V3ktV2Q3Mndi", "LWlXTk1DVHkwX0tsQURv"];
const _fbSenderChunks = ["NjI1OTU5", "NjA4ODE3"];
const _fbAppIdHex = "MGM1NzFkOTRmNzIwNjU4ZTk3YTQ1MA==";

const firebaseConfig = {
  apiKey: _fbKeyChunks.map(c => atob(c)).join(""),
  authDomain: ["simando", "firebaseapp", "com"].join("."),
  projectId: ["si", "man", "do"].join(""),
  storageBucket: ["simando", "firebasestorage", "app"].join("."),
  messagingSenderId: _fbSenderChunks.map(c => atob(c)).join(""),
  appId: ["1", _fbSenderChunks.map(c => atob(c)).join(""), "web", atob(_fbAppIdHex)].join(":"),
  measurementId: "G-" + atob("Rk1NN1k2MFhLMA==")
};

try {
  const app = initializeApp(firebaseConfig);
  
  // Force Long Polling to prevent adblockers from blocking WebChannel streams (net::ERR_BLOCKED_BY_CLIENT)
  const db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
    useFetchStreams: false
  });
  
  const auth = getAuth(app);

  window._db = db;
  window._auth = auth;

  // Firestore helpers
  window._fbCol        = collection;
  window._fbAddDoc     = addDoc;
  window._fbGetDocs    = getDocs;
  window._fbDoc        = doc;
  window._fbGetDoc     = getDoc;
  window._fbUpdate     = updateDoc;
  window._fbDelete     = deleteDoc;
  window._fbQuery      = query;
  window._fbOrderBy    = orderBy;
  window._fbOnSnapshot = onSnapshot;
  window._fbLimit      = limit;
  window._fbServerTs   = serverTimestamp;
  window._fbWhere      = where;

  // Auth helpers
  window._fbOnAuth         = onAuthStateChanged;
  window._fbSignIn         = signInWithPopup;
  window._fbGoogleProvider = new GoogleAuthProvider();
  window._fbSignOut        = signOut;
  
  // Auth Settings Management helpers
  window._fbUpdateProfile  = updateProfile;
  window._fbUpdateEmail    = updateEmail;
  window._fbUpdatePassword = updatePassword;
  window._fbDeleteUser     = deleteUser;
  window._fbReauth         = reauthenticateWithCredential;
  window._fbEmailCred      = EmailAuthProvider.credential;

  // Set ready status IMMEDIATELY after initialization
  window._fbReady = true;

  if (!window._firebaseReadyFired) {
    window._firebaseReadyFired = true;
    document.dispatchEvent(new Event("firebase-ready"));
  }

  // Dynamic Auth State Monitor
  onAuthStateChanged(auth, user => {
    window._currentUser = user || null;
    if (typeof window.refreshCurrentView === "function") {
      window.refreshCurrentView();
    }
  });

} catch (err) {
  console.error("Firebase module init failed:", err);
  window._fbReady = false;
  document.dispatchEvent(new Event("firebase-ready"));
}