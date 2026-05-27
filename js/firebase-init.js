import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy, onSnapshot, limit, serverTimestamp, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, updateProfile, updateEmail, updatePassword, deleteUser, reauthenticateWithCredential, EmailAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDIDs21G2wWy-Wd72wb-iWNMCTy0_KlADo",
  authDomain: "simando.firebaseapp.com",
  projectId: "simando",
  storageBucket: "simando.firebasestorage.app",
  messagingSenderId: "625959608817",
  appId: "1:625959608817:web:0c571d94f720658e97a450",
  measurementId: "G-FMM7Y60XK0"
};

try {
  const app = initializeApp(firebaseConfig);
  const db  = getFirestore(app);
  const auth = getAuth(app);

  window._db = db;
  window._auth = auth;

  // Firestore helpers
  window._fbCol       = collection;
  window._fbAddDoc    = addDoc;
  window._fbGetDocs   = getDocs;
  window._fbDoc       = doc;
  window._fbUpdate    = updateDoc;
  window._fbDelete    = deleteDoc;
  window._fbQuery     = query;
  window._fbOrderBy   = orderBy;
  window._fbOnSnapshot = onSnapshot;
  window._fbLimit     = limit;
  window._fbServerTs  = serverTimestamp;
  window._fbWhere     = where;

  // Auth helpers
  window._fbOnAuth    = onAuthStateChanged;
  window._fbSignIn    = signInWithPopup;
  window._fbGoogleProvider = new GoogleAuthProvider();
  window._fbSignOut   = signOut;
  
  // Auth Settings Management helpers
  window._fbUpdateProfile  = updateProfile;
  window._fbUpdateEmail    = updateEmail;
  window._fbUpdatePassword = updatePassword;
  window._fbDeleteUser     = deleteUser;
  window._fbReauth         = reauthenticateWithCredential;
  window._fbEmailCred      = EmailAuthProvider.credential;

  window._fbReady = true;

  onAuthStateChanged(auth, user => {
    window._currentUser = user || null;
    if (!window._firebaseReadyFired) {
      window._firebaseReadyFired = true;
      document.dispatchEvent(new Event("firebase-ready"));
    }
  });

} catch (err) {
  console.error("Firebase module init failed:", err);
  window._fbReady = false;
  document.dispatchEvent(new Event("firebase-ready"));
}
