/* ============ Firebase storage ============
   The whole tracker (ipos + accounts + applications) lives in one
   Firestore document per user: ipoMonitor/{uid}. It's a few KB, so a
   single doc keeps writes atomic and reads trivial.

   Auth: anonymous by default (zero friction, data survives reloads on
   this browser). Signing in with an email links that anonymous account
   — the existing data comes along — so other devices see the same doc.

   If firebase-config.js is not filled in, none of this runs and the app
   stays on localStorage. */

const cfg = window.FIREBASE_CONFIG;
const dot = document.getElementById('cloudDot');
const statusEl = document.getElementById('cloudStatus');
const signInBtn = document.getElementById('cloudAuthBtn');
const signOutBtn = document.getElementById('cloudOutBtn');

function cloudStatus(state, msg){
  dot.className = 'sync-dot' + (state ? ' ' + state : '');
  statusEl.textContent = msg;
}

if(!cfg || !cfg.apiKey){
  cloudStatus('', 'Storage: this browser only — add your project to firebase-config.js to sync.');
} else {
  const SDK = 'https://www.gstatic.com/firebasejs/11.0.2/';
  try{
    const [{ initializeApp }, auth_, fs_] = await Promise.all([
      import(SDK + 'firebase-app.js'),
      import(SDK + 'firebase-auth.js'),
      import(SDK + 'firebase-firestore.js'),
    ]);

    const app = initializeApp(cfg);
    const auth = auth_.getAuth(app);
    // Offline cache: edits made with no connection are queued and flushed later.
    const fs = fs_.initializeFirestore(app, {
      localCache: fs_.persistentLocalCache({ tabManager: fs_.persistentMultipleTabManager() }),
    });

    let docRef = null;
    let unsubscribe = null;
    let writeTimer = null;
    let pending = null;

    /* Debounced write — a burst of edits becomes one document write. */
    window.cloudPush = (data) => {
      if(!docRef) return;
      pending = data;
      clearTimeout(writeTimer);
      writeTimer = setTimeout(async () => {
        const payload = pending; pending = null;
        try{
          await fs_.setDoc(docRef, {
            ipos: payload.ipos || [],
            accounts: payload.accounts || [],
            applications: payload.applications || [],
            updatedAt: fs_.serverTimestamp(),
            updatedBy: navigator.userAgent.slice(0, 120),
          });
        }catch(e){
          cloudStatus('err', 'Cloud write failed: ' + e.message + ' — saved locally.');
        }
      }, 500);
    };

    function watch(user){
      if(unsubscribe) unsubscribe();
      docRef = fs_.doc(fs, 'ipoMonitor', user.uid);
      const who = user.isAnonymous ? 'anonymous (' + user.uid.slice(0, 6) + '…)' : user.email;

      unsubscribe = fs_.onSnapshot(docRef, (snap) => {
        const local = snap.metadata.hasPendingWrites;
        if(!snap.exists()){
          // First run for this account — seed the cloud from this browser.
          cloudStatus('ok', 'Cloud: ' + who + ' · uploading local data…');
          window.cloudPush(db);
          return;
        }
        if(!local) applyRemoteDb(snap.data());
        const src = snap.metadata.fromCache ? 'offline cache' : 'synced';
        cloudStatus('ok', 'Cloud: ' + who + ' · ' + src + ' · ' +
          db.ipos.length + ' IPOs, ' + db.applications.length + ' applications');
      }, (e) => {
        cloudStatus('err', 'Cloud read failed: ' + e.message + ' — using local copy.');
      });

      signInBtn.style.display = user.isAnonymous ? '' : 'none';
      signOutBtn.style.display = user.isAnonymous ? 'none' : '';
    }

    auth_.onAuthStateChanged(auth, (user) => {
      if(user){ watch(user); return; }
      if(unsubscribe){ unsubscribe(); unsubscribe = null; }
      docRef = null;
      cloudStatus('busy', 'Cloud: signing in…');
      auth_.signInAnonymously(auth).catch((e) => {
        // Anonymous sign-in is off in the project — fall back to an explicit sign-in.
        const off = e.code === 'auth/admin-restricted-operation' || e.code === 'auth/operation-not-allowed';
        signInBtn.style.display = '';
        cloudStatus('err', off
          ? 'Cloud: not signed in — click Sign in (Google or email). Data stays local until then.'
          : 'Cloud sign-in failed (' + (e.code || e.message) + ') — data stays local.');
      });
    });

    /* Google is the least-friction option when anonymous auth is disabled:
       no password to manage and the data follows the Google account. */
    window.signInGoogle = async () => {
      const errEl = document.getElementById('authError');
      errEl.style.display = 'none';
      const provider = new auth_.GoogleAuthProvider();
      try{
        const user = auth.currentUser;
        if(user && user.isAnonymous){
          try{
            await auth_.linkWithPopup(user, provider);       // keeps this browser's data
          }catch(err){
            if(err.code === 'auth/credential-already-in-use') await auth_.signInWithPopup(auth, provider);
            else throw err;
          }
        } else {
          await auth_.signInWithPopup(auth, provider);
        }
        closeModal('authOverlay');
      }catch(err){
        errEl.textContent = (err.code || '').replace('auth/', '') + ' — ' + err.message;
        errEl.style.display = 'block';
      }
    };

    /* Sign-in modal: link the anonymous account if possible (keeps the
       current data), otherwise sign in / create and adopt the cloud copy. */
    window.submitAuth = async (e) => {
      e.preventDefault();
      const email = document.getElementById('authEmail').value.trim();
      const password = document.getElementById('authPassword').value;
      const errEl = document.getElementById('authError');
      errEl.style.display = 'none';
      try{
        const cred = auth_.EmailAuthProvider.credential(email, password);
        const user = auth.currentUser;
        if(user && user.isAnonymous){
          try{
            await auth_.linkWithCredential(user, cred);   // keeps this browser's data
          }catch(err){
            if(err.code === 'auth/email-already-in-use' || err.code === 'auth/credential-already-in-use'){
              await auth_.signInWithEmailAndPassword(auth, email, password); // adopt existing account
            } else throw err;
          }
        } else {
          try{
            await auth_.signInWithEmailAndPassword(auth, email, password);
          }catch(err){
            if(err.code === 'auth/user-not-found') await auth_.createUserWithEmailAndPassword(auth, email, password);
            else throw err;
          }
        }
        closeModal('authOverlay');
      }catch(err){
        errEl.textContent = err.code ? err.code.replace('auth/', '') + ' — ' + err.message : err.message;
        errEl.style.display = 'block';
      }
    };

    window.cloudSignOut = async () => {
      if(!confirm('Sign out? This browser will fall back to its local copy and a new anonymous account.')) return;
      await auth_.signOut(auth);
    };

    window.openAuthModal = () => {
      document.getElementById('authForm').reset();
      document.getElementById('authError').style.display = 'none';
      openModal('authOverlay');
    };
  }catch(e){
    cloudStatus('err', 'Firebase failed to load: ' + e.message + ' — storing locally.');
  }
}

/* Buttons must not throw when Firebase is absent. */
window.openAuthModal = window.openAuthModal || (() => alert('Add your Firebase project to firebase-config.js first.'));
window.cloudSignOut = window.cloudSignOut || (() => {});
window.submitAuth = window.submitAuth || ((e) => e.preventDefault());
window.signInGoogle = window.signInGoogle || (() => alert('Add your Firebase project to firebase-config.js first.'));
