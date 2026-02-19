/* ================================================= */
/* =============  3. קוד ה-JavaScript  ============= */
/* ================================================= */

// =======================================================================
// אזהרה: הקוד הבא תלוי בפונקציות ומשתנים מהקובץ המקורי שלך.
// אם תפריד אותו לחלוטין, תצטרך לספק לו את התלויות החסרות.
// לדוגמה: allRides, datePicker, firebaseModules, initializeAppData וכו'.
// לצורך הדגמה, הקוד כאן יזרוק שגיאות אם ירוץ לבד ללא התאמות.
// =======================================================================

// ✅ המתן לטעינת ה-DOM לפני אתחול
document.addEventListener('DOMContentLoaded', function() {
    // אתחול הצ'אטבוט רק אחרי שכל ה-HTML נטען
    if (typeof DriverChatBot !== 'undefined') {
        window.driverChatBot = new DriverChatBot();
        console.log('✅ ChatBot initialized successfully!');
    }
});
// Enhanced message rendering
function addMessageEnhanced(text, sender = 'bot', buttons = null) {
  const messagesContainer = document.getElementById('chatMessages');
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message-wrapper';

  if (sender === 'user') {
    messageDiv.innerHTML = `
      <div class="user-message">
        <p class="text-sm">${escapeHTML(text)}</p>
      </div>
    `;
  } else {
    messageDiv.innerHTML = `
      <div class="bot-message-container">
        <div class="bot-avatar-small">
          <i class="fas fa-robot text-white text-sm"></i>
        </div>
        <div class="bot-message">
          ${text}
          ${buttons ? `<div class="mt-3 space-y-2">${buttons}</div>` : ''}
        </div>
      </div>
    `;
  }
  
  messagesContainer.appendChild(messageDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Enhanced button templates
function createActionButtons(actions) {
  return actions.map(action => `
    <button 
      onclick="${action.onclick}" 
      class="message-action-btn ${action.type === 'success' ? 'btn-success' : 'btn-primary'}">
      <i class="${action.icon}"></i>
      <span>${action.text}</span>
    </button>
  `).join('');
}

// ========= 1) Utilities: נרמול וסניטציה =========
function escapeHTML(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function stripNiqqud(str = "") {
  // הסרת ניקוד ותווי כיווניות
  return str.normalize("NFKD").replace(/[\u0591-\u05C7\u200e\u200f]/g, "");
}
function hebrewDigitsToArabic(str = "") {
  // המרת ספרות עבריות/ערביות לארביות רגילות
  const map = { '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9' };
  return str.replace(/[٠-٩]/g, d => map[d] || d);
}
function normalizeSpaces(str = "") {
  return str.replace(/\s+/g, " ").trim();
}
function normalizeText(str = "") {
  return normalizeSpaces(hebrewDigitsToArabic(stripNiqqud(str)));
}

// ========= 2) מילונים ועזר =========
const PAYMENT_SYNONYMS = [
  { re: /\b(מזומן|cash)\b/i, method: "מזומן" },
  { re: /\b(ביט|bit)\b/i, method: "ביט" },
  { re: /\b(פייבוקס|paybox|פיי)\b/i, method: "פייבוקס" },
  { re: /\b(בנק|בנקאית|העברה|transfer|bank)\b/i, method: "העברה בנקאית" },
  { re: /\b(פתק|note|חוב|אשראי)\b/i, method: "פתק" },
];

const WEEKDAYS = {
  'ראשון':0,'א׳':0,'א':0,'יום ראשון':0,
  'שני':1,'ב׳':1,'ב':1,'יום שני':1,
  'שלישי':2,'ג׳':2,'ג':2,'יום שלישי':2,
  'רביעי':3,'ד׳':3,'ד':3,'יום רביעי':3,
  'חמישי':4,'ה׳':4,'ה':4,'יום חמישי':4,
  'שישי':5,'ו׳':5,'ו':5,'יום שישי':5,
  'שבת':6,'ש׳':6,'ש':6,'יום שבת':6
};

const MONTHS_HE = {
  'ינואר':0,'יני':0,'jan':0,'1':0,'01':0,
  'פברואר':1,'פבר':1,'feb':1,'2':1,'02':1,
  'מרץ':2,'mar':2,'3':2,'03':2,
  'אפריל':3,'אפר':3,'apr':3,'4':3,'04':3,
  'מאי':4,'may':4,'5':4,'05':4,
  'יוני':5,'יונ':5,'jun':5,'6':5,'06':5,
  'יולי':6,'יול':6,'jul':6,'7':6,'07':6,
  'אוגוסט':7,'אוג':7,'aug':7,'8':7,'08':7,
  'ספטמבר':8,'ספט':8,'sep':8,'9':8,'09':8,
  'אוקטובר':9,'אוק':9,'oct':9,'10':9,
  'נובמבר':10,'נוב':10,'nov':10,'11':10,
  'דצמבר':11,'דצמ':11,'dec':11,'12':11
};

const TIME_WORDS = {
  'בבוקר': 9,   // 09:00
  'בצהריים': 13, // 13:00
  'בערב': 20,    // 20:00
  'בלילה': 22    // 22:00
};

// ========= Voice Recognition Class - הוסף אחרי השורה עם TIME_WORDS =========
class VoiceRecognition {
  constructor(chatBot) {
    this.chatBot = chatBot;
    this.recognition = null;
    this.isRecording = false;
    this.isSupported = false;
    
    this.initializeVoiceRecognition();
  }

initializeVoiceRecognition() {
    // בדיקת תמיכה בזיהוי דיבור
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
      
      // 🚀 הגדרות מהירות ומדויקות לעברית
      this.recognition.lang = 'he-IL';
      this.recognition.continuous = false;        // לא המשכי
      this.recognition.interimResults = true;     // תוצאות ביניים
      this.recognition.maxAlternatives = 1;       // חלופה אחת בלבד
      
      // ⚡ הגדרות מהירות חדשות - הסר את השורה הבעייתית
      // this.recognition.grammars = null;  <- הסר את השורה הזו!
      
      // 🎯 הוסף timeout מותאם אישית
      this.silenceTimeout = null;
      this.lastSpeechTime = null;
      
      this.setupVoiceEvents();
      this.isSupported = true;
      
      console.log('🎤 Voice recognition initialized for Hebrew with speed optimizations');
    } else {
      console.warn('⚠️ Speech recognition not supported in this browser');
      this.isSupported = false;
      // הסתר את כפתור המיקרופון
      const voiceBtn = document.getElementById('voiceBtn');
      if (voiceBtn) {
        voiceBtn.style.display = 'none';
      }
    }
  }

setupVoiceEvents() {
    if (!this.recognition) return;

    this.recognition.onstart = () => {
      console.log('🎤 Voice recognition started');
      this.isRecording = true;
      this.updateVoiceUI(true);
      this.lastSpeechTime = Date.now();
    };

    this.recognition.onresult = (event) => {
      this.lastSpeechTime = Date.now(); // עדכן זמן דיבור אחרון
      
      let transcript = '';
      let isFinal = false;

      // עיבוד כל התוצאות
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          transcript += result[0].transcript;
          isFinal = true;
        } else {
          // תוצאות ביניים - הצג בזמן אמת
          const interimTranscript = result[0].transcript;
          document.getElementById('chatInput').placeholder = 
            `מזהה: "${interimTranscript}"...`;
            
          // 🚀 אם יש טקסט ביניים, איפוס טיימר השקט
          this.resetSilenceTimer();
        }
      }

      if (isFinal && transcript.trim()) {
        console.log('🎤 Final transcript:', transcript);
        this.processVoiceInput(transcript.trim());
        this.clearSilenceTimer();
      } else if (!isFinal) {
        // ⚡ התחל טיימר השקט רק אם אין תוצאות ביניים
        this.startSilenceTimer();
      }
    };

    this.recognition.onspeechstart = () => {
      console.log('🎤 Speech detected');
      this.clearSilenceTimer();
    };

    this.recognition.onspeechend = () => {
      console.log('🎤 Speech ended, starting silence timer');
      this.startSilenceTimer();
    };

    this.recognition.onerror = (event) => {
      console.error('❌ Voice recognition error:', event.error);
      this.isRecording = false;
      this.updateVoiceUI(false);
      this.clearSilenceTimer();
      
      let errorMessage = '';
      let instructions = '';
      
      switch (event.error) {
        case 'not-allowed':
          errorMessage = 'אין הרשאה לשימוש במיקרופון 🚫';
          instructions = `
          
**כיצד לאפשר:**
1. לחץ על 🔒 ליד כתובת האתר
2. שנה "מיקרופון" ל-"אפשר" 
3. רענן את הדף 🔄
          `;
          break;
        case 'no-speech':
          errorMessage = 'לא זוהה דיבור';
          instructions = '\n\n💡 **טיפ:** דבר בקרוב למיקרופון ובבירור';
          break;
        case 'audio-capture':
          errorMessage = 'לא ניתן לגשת למיקרופון 🎤';
          instructions = '\n\n🔍 **בדוק:**\n• המיקרופון מחובר\n• המיקרופון לא מושתק\n• אין אפליקציה אחרת שמשתמשת במיקרופון';
          break;
        case 'network':
          errorMessage = 'בעיית רשת - זיהוי דיבור זקוק לאינטרנט 🌐';
          instructions = '\n\n🔄 בדוק את החיבור לאינטרנט';
          break;
        case 'aborted':
          // אל תציג שגיאה במקרה של ביטול רגיל
          return;
        case 'service-not-allowed':
          errorMessage = 'שירות זיהוי הדיבור חסום 🚫';
          instructions = '\n\n💡 נסה דפדפן אחר או בדוק הגדרות האבטחה';
          break;
        default:
          errorMessage = `שגיאה בזיהוי הדיבור: ${event.error}`;
          instructions = '\n\n🔄 נסה שוב או השתמש בהקלדה';
      }
      
      this.addMessage(`🎤 ${errorMessage}${instructions}`);
    };

    this.recognition.onend = () => {
      console.log('🎤 Voice recognition ended');
      this.isRecording = false;
      this.updateVoiceUI(false);
      this.clearSilenceTimer();
      document.getElementById('chatInput').placeholder = 
        'שאל אותי משהו או לחץ על המיקרופון... 💬🎤';
    };
  }

  // ⚡ פונקציות טיימר השקט החדשות
  startSilenceTimer() {
    this.clearSilenceTimer();
    this.silenceTimeout = setTimeout(() => {
      if (this.isRecording && this.recognition) {
        console.log('🎤 Silence timeout reached, stopping recording');
        this.recognition.stop();
      }
    }, 1500); // 1.5 שניות במקום 3-4 שניות ברירת מחדל
  }

  resetSilenceTimer() {
    if (this.silenceTimeout) {
      this.clearSilenceTimer();
      this.startSilenceTimer();
    }
  }

  clearSilenceTimer() {
    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout);
      this.silenceTimeout = null;
    }
  }

  startRecording() {
    if (!this.isSupported) {
      this.addMessage('🎤 זיהוי דיבור אינו נתמך בדפדפן זה');
      return;
    }

    if (this.isRecording) {
      this.stopRecording();
      return;
    }

    try {
      this.recognition.start();
      this.addMessage('🎤 מתחיל להקליט... דבר עכשיו!');
    } catch (error) {
      console.error('Error starting recognition:', error);
      this.addMessage('🎤 שגיאה בהפעלת זיהוי הדיבור');
    }
  }

stopRecording() {
    this.clearSilenceTimer();
    if (this.recognition && this.isRecording) {
      this.recognition.stop();
    }
  }

  updateVoiceUI(isRecording) {
    const voiceBtn = document.getElementById('voiceBtn');
    const voiceIcon = document.getElementById('voiceIcon');
    const voiceIndicator = document.getElementById('voiceIndicator');

    if (!voiceBtn || !voiceIcon || !voiceIndicator) return;

    if (isRecording) {
      voiceBtn.classList.add('recording');
      voiceIcon.className = 'fas fa-stop text-white text-sm';
      voiceIndicator.classList.add('active');
      voiceBtn.title = 'עצור הקלטה';
    } else {
      voiceBtn.classList.remove('recording');
      voiceIcon.className = 'fas fa-microphone text-white text-sm';
      voiceIndicator.classList.remove('active');
      voiceBtn.title = 'הקלט קולית';
    }
  }

  processVoiceInput(transcript) {
    // נקה את הטקסט המוקלט
    const cleanedText = this.cleanVoiceInput(transcript);
    
    console.log('🎤 Processing voice input:', cleanedText);
    
    // הצג את הטקסט בשדה הקלט
    document.getElementById('chatInput').value = cleanedText;
    
    // שלח את ההודעה אוטומטיטו
    this.chatBot.sendMessage();
    
    // הצג הודעת אישור
    this.chatBot.addMessage(`🎤 זוהה: "${cleanedText}"`);
  }

cleanVoiceInput(text) {
    return text
      // תיקון קיצורי ערים - **בעדיפות גבוהה**
      .replace(/\bבב\b/gi, 'בני ברק')
      .replace(/\bים\b/gi, 'ירושלים') 
      .replace(/\bתא\b/gi, 'תל אביב')
      .replace(/\bרג\b/gi, 'רמת גן')
      .replace(/\bבש\b/gi, 'באר שבע')
      .replace(/\bפת\b/gi, 'פתח תקווה')
      .replace(/\bבת\b/gi, 'בת ים')
      .replace(/\bחל\b/gi, 'חולון')
      .replace(/\bהר\b/gi, 'הרצליה')
      .replace(/\bנת\b/gi, 'נתניה')
      .replace(/\bאש\b/gi, 'אשדוד')
      .replace(/\bאק\b/gi, 'אשקלון')
      
      // תיקון שמות ערים מלאים
      .replace(/\bבני ברק\b/gi, 'בני ברק')
      .replace(/\bבניברק\b/gi, 'בני ברק')
      .replace(/\bתל אביב\b/gi, 'תל אביב')
      .replace(/\bתלאביב\b/gi, 'תל אביב')
      .replace(/\bבת ים\b/gi, 'בת ים')
      .replace(/\bבתים\b/gi, 'בת ים')
      .replace(/\bפתח תקווה\b/gi, 'פתח תקווה')
      .replace(/\bפתחתקווה\b/gi, 'פתח תקווה')
      .replace(/\bרמת גן\b/gi, 'רמת גן')
      .replace(/\bרמתגן\b/gi, 'רמת גן')
      .replace(/\bבאר שבע\b/gi, 'באר שבע')
      .replace(/\bבאר|שבע\b/gi, 'באר שבע')
      
      // תיקון טעויות זיהוי ספציפיות
      .replace(/\bבאב\b/gi, 'בני ברק')  // תיקון ספציפי לבעיה שלך
      .replace(/\bבעב\b/gi, 'בני ברק')
      .replace(/\bבאח\b/gi, 'בני ברק')
      .replace(/\bיים\b/gi, 'ירושלים')
      .replace(/\bירם\b/gi, 'ירושלים')
      
      // תיקון מספרים שנאמרו בעברית
      .replace(/\bמאה\b/gi, '100')
      .replace(/\bמאתיים\b/gi, '200')
      .replace(/\bשלש מאות\b/gi, '300')
      .replace(/\bשלושמאות\b/gi, '300')
      .replace(/\bחמישים\b/gi, '50')
      .replace(/\bשישים\b/gi, '60')
      .replace(/\bשבעים\b/gi, '70')
      .replace(/\bשמונים\b/gi, '80')
      .replace(/\bתשעים\b/gi, '90')
      
      // תיקון אמצעי תשלום
      .replace(/\bביט\b/gi, 'ביט')
      .replace(/\bפייבוקס\b/gi, 'פייבוקס')
      .replace(/\bמזומן\b/gi, 'מזומן')
      .replace(/\bכסף\b/gi, 'מזומן')
      .trim();
  }
}

// ========= 3) מחלקת NLU רבת יכולות =========
class HebrewNLU {
  constructor() {}

  normalize(text) {
    return normalizeText(text || "");
  }

  // ---- תשלומים מפוצלים: "100 ביט ו-50 מזומן" ----
  extractPayments(text) {
    const payments = [];
    // תבנית: סכום + (ש"ח|₪|שקל|שקלים)? + שם שיטה
    // תומך במספרים עשרוניים, פסיקים ונקודות
    const amountRe = "(\\d{1,3}(?:[\\.,]\\d{3})*|\\d+)(?:[\\.,]\\d+)?";
    const currencyRe = "(?:\\s*(?:₪|שח|ש\"ח|ש׳׳ח|שקל(?:ים)?))?";
    const methodRe = "(?:\\s*(מזומן|cash|ביט|bit|פייבוקס|paybox|פיי|בנקאית|בנק|העברה|transfer|note|פתק|אשראי))";
    const splitRe = new RegExp(`${amountRe}${currencyRe}\\s*${methodRe}`, "gi");

    let match;
    while ((match = splitRe.exec(text)) !== null) {
      const raw = match[1].replace(/[.,](?=\d{3}\b)/g, ""); // הסר מפרידי אלפים
      const amount = parseFloat(raw.replace(",", "."));
      const methodText = match[3] || match[2] || "";
      const method = this.normalizeMethod(methodText);
      if (!isNaN(amount) && method) {
        payments.push({ method, amount, note: method === 'פתק' ? '' : '' });
      }
    }
    return payments;
  }

  // ---- סכום מחיר כללי (אם לא הופק מתשלומים) ----
  extractPrice(text) {
    // חפש "₪ 150", "150 ש\"ח", "150", אך התעלם ממספרי טלפון ושעות
    const priceRe = /\b(\d{2,}(?:[.,]\d+)?)(?:\s*(?:₪|שח|ש\"ח|שקל(?:ים)?))?\b/gi;
    let max = 0;
    let m;
    while ((m = priceRe.exec(text)) !== null) {
      const n = parseFloat(m[1].replace(",", "."));
      if (!isNaN(n) && n > max) max = n;
    }
    return max > 0 ? max : null;
  }


// ---- עמלה: קבועה או באחוזים ----
extractCommission(text, price) {
    console.log("Extracting commission from:", text); // דיבוג

    // דפוסי זיהוי עמלה - **מסודרים מהמדויק יותר לכללי יותר**
    const shekelPattern = /עמלה\s+(\d+(?:\.\d+)?)\s*שקל/i;           // "עמלה 15 שקל"
    const percentWordPattern = /עמלה\s+(\d+(?:\.\d+)?)\s*אחוז/i;      // "עמלה 11.8 אחוז"
    const percentSymbolPattern = /(\d+(?:\.\d+)?)\s*%\s*עמלה/i;       // "15% עמלה"
    const afterWordPattern = /עמלה[:\s]+(\d+(?:\.\d+)?)/i;           // "עמלה: 20" או "עמלה 10"
    const beforeWordPattern = /(\d+(?:\.\d+)?)\s+עמלה/i;             // "20 עמלה"

    // בדיקה לעמלה בשקלים קבועים - **הכי גבוהה בעדיפות**
    let match = text.match(shekelPattern);
    if (match) {
        const fixedAmount = parseFloat(match[1]);
        console.log("Found shekel commission:", fixedAmount);
        return fixedAmount; // החזר כסכום קבוע
    }

    // בדיקה לעמלה באחוזים (עם המילה "אחוז")
    match = text.match(percentWordPattern);
    if (match && price) {
        const percent = parseFloat(match[1]);
        const calculatedCommission = +(price * (percent / 100)).toFixed(2);
        console.log("Found percentage word commission:", percent, "% of", price, "=", calculatedCommission);
        return calculatedCommission;
    }

    // בדיקה לעמלה עם סימן אחוזים
    match = text.match(percentSymbolPattern);
    if (match && price) {
        const percent = parseFloat(match[1]);
        const calculatedCommission = +(price * (percent / 100)).toFixed(2);
        console.log("Found percentage symbol commission:", percent, "% of", price, "=", calculatedCommission);
        return calculatedCommission;
    }

    // בדיקה לעמלה כללית אחרי המילה "עמלה"
    match = text.match(afterWordPattern);
    if (match) {
        const val = parseFloat(match[1]);
        console.log("Found commission after word:", val);
        
        if (price) {
            // אם הערך קטן מ-1, נניח שזה כבר אחוז (0.15 = 15%)
            // אם גדול מ-1 אבל קטן מ-100, נניח שזה אחוזים (15 = 15%)
            // אם גדול מ-100, נניח שזה שקלים קבועים
            if (val <= 1) {
                const calculatedCommission = +(price * (val * 100) / 100).toFixed(2);
                console.log("Treating as decimal percentage:", val * 100, "%");
                return calculatedCommission;
            } else if (val < 100) {
                const calculatedCommission = +(price * (val / 100)).toFixed(2);
                console.log("Treating as percentage:", val, "%");
                return calculatedCommission;
            } else {
                console.log("Treating as fixed shekel amount:", val);
                return val; // סכום קבוע בשקלים
            }
        }
        
        // אם אין מחיר, נניח שזה שקלים קבועים
        console.log("No price available, treating as fixed amount:", val);
        return val;
    }

    // בדיקה לעמלה לפני המילה "עמלה"
    match = text.match(beforeWordPattern);
    if (match) {
        const val = parseFloat(match[1]);
        console.log("Found commission before word:", val);
        
        if (price) {
            if (val <= 1) {
                const calculatedCommission = +(price * (val * 100) / 100).toFixed(2);
                console.log("Treating as decimal percentage:", val * 100, "%");
                return calculatedCommission;
            } else if (val < 100) {
                const calculatedCommission = +(price * (val / 100)).toFixed(2);
                console.log("Treating as percentage:", val, "%");
                return calculatedCommission;
            } else {
                console.log("Treating as fixed shekel amount:", val);
                return val;
            }
        }
        
        console.log("No price available, treating as fixed amount:", val);
        return val;
    }

    console.log("No commission pattern found, returning null");
    return null; // לא נמצאה עמלה - ייחושב 12% בהמשך
}
  // ---- טלפון ----
  extractPhone(text) {
    const m = text.match(/\b(?:\+?972-?)?0?5\d-?\d{7}\b/);
    if (!m) return null;
    let clean = m[0].replace(/[^\d]/g, "");
    if (clean.startsWith("972")) clean = "0" + clean.slice(3);
    if (clean.length === 10 && clean.startsWith("05"))
      return clean.slice(0, 3) + "-" + clean.slice(3);
    return m[0];
  }

  // ---- אמצעי תשלום כללי (כאשר יש רק מילה אחת בלי סכום) ----
  extractSingleMethod(text) {
    for (const syn of PAYMENT_SYNONYMS) {
      if (syn.re.test(text)) return syn.method;
    }
    return null;
  }
  normalizeMethod(token) {
    const t = (token || "").toLowerCase();
    for (const syn of PAYMENT_SYNONYMS) {
      if (syn.re.test(t)) return syn.method;
    }
    return null;
  }

  // ---- תאריך/שעה: היום/מחר/אתמול, ימי השבוע, חודשים, dd/mm[,yyyy] [hh:mm] ----
  extractDateTime(text) {
    const now = new Date();
    const lower = text.toLowerCase();

    // יחסי
    if (/\bהיום\b/.test(lower)) return this.setTimeFromWords(new Date(), lower);
    if (/\bמחר\b/.test(lower)) return this.setTimeFromWords(this.addDays(new Date(), 1), lower);
    if (/\bאתמול\b/.test(lower)) return this.setTimeFromWords(this.addDays(new Date(), -1), lower);

    // ימי השבוע: "ביום שלישי", "שני", ...
    for (const name in WEEKDAYS) {
      if (lower.includes(name)) {
        const targetD = WEEKDAYS[name];
        const d = this.nextWeekday(now, targetD);
        return this.setTimeFromWords(d, lower);
      }
    }

    // תבניות מספריות dd/mm/yyyy hh:mm | dd.mm | dd-mm | dd/mm hh[:mm]
    const dateTimeRe = /(\d{1,2})[\/\.\-](\d{1,2})(?:[\/\.\-](\d{2,4}))?(?:\s+(\d{1,2})(?::(\d{2}))?)?/;
    let dm = lower.match(dateTimeRe);
    if (dm) {
      const day = +dm[1], month = +dm[2] - 1, year = dm[3] ? this.normYear(dm[3]) : now.getFullYear();
      let hour = dm[4] ? +dm[4] : 9, minute = dm[5] ? +dm[5] : 0;
      const d = new Date(year, month, day, hour, minute);
      return d;
    }

    // חודשי עברית: "במרץ 2024", "בספטמבר", "מרץ"
    const monthRe = new RegExp(`\\b(${Object.keys(MONTHS_HE).join("|")})\\b(?:\\s+(\\d{4}))?`, "i");
    dm = lower.match(monthRe);
    if (dm) {
      const mi = MONTHS_HE[dm[1]];
      const y = dm[2] ? +dm[2] : now.getFullYear();
      return new Date(y, mi, 1, 9, 0);
    }

    // שעה בלבד: "בשעה 14:30" | "ב-21:00" | "ב8"
    const timeRe = /\b(?:בשעה|ב-|ב)?\s*(\d{1,2})(?::(\d{2}))?\b/;
    dm = lower.match(timeRe);
    if (dm) {
      const h = +dm[1], m = dm[2] ? +dm[2] : 0;
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
      return d;
    }

    // מילים כלליות "בבוקר"/"בערב" וכו'
    for (const word in TIME_WORDS) {
      if (lower.includes(word)) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), TIME_WORDS[word], 0);
        return d;
      }
    }

    return null;
  }
  setTimeFromWords(date, lowerText) {
    // אם יש שעה מפורשת – תדרוס
    const timeRe = /\b(?:בשעה|ב-|ב)?\s*(\d{1,2})(?::(\d{2}))?\b/;
    const m = lowerText.match(timeRe);
    if (m) {
      const h = +m[1], mm = m[2] ? +m[2] : 0;
      date.setHours(h, mm, 0, 0);
      return date;
    }
    // אחרת השתמש ברמז מילולי
    for (const word in TIME_WORDS) {
      if (lowerText.includes(word)) {
        date.setHours(TIME_WORDS[word], 0, 0, 0);
        return date;
      }
    }
    // ברירת מחדל 09:00
    date.setHours(9,0,0,0);
    return date;
  }
  nextWeekday(from, targetDow) {
    const d = new Date(from);
    const diff = (targetDow + 7 - d.getDay()) % 7 || 7;
    d.setDate(d.getDate() + diff);
    return d;
    }
  addDays(d, n) { const c = new Date(d); c.setDate(c.getDate() + n); return c; }
  normYear(y) { y = +y; return y < 100 ? 2000 + y : y; }

  // ---- מסלול "מ... ל..." + fallback ----
  extractRoute(text) {
    // דפוסים: "מ<עיר> ל<עיר>", "מתל אביב לחיפה", "מ ירושלים ל תל אביב"
    const routeRe = /מ\s*([^\s,]+(?:\s[^\s,]+)?)\s+ל\s*([^\s,]+(?:\s[^\s,]+)?)/i;
    let m = text.match(routeRe);
    if (m) {
      return { source: this.cleanPlace(m[1]), destination: this.cleanPlace(m[2]) };
    }
    // fallback: שתי מילים/ישויות ראשונות שאינן מספר/טלפון/שיטה
    const tokens = text.split(/\s+/).filter(t => t.length > 1);
    const blacklist = (t)=> /^\d/.test(t) || this.normalizeMethod(t) || /₪|שח|ש"ח|%/.test(t) || /\d/.test(t) && t.length>=9;
    const cities = tokens.filter(t=>!blacklist(t));
    if (cities.length >= 2) {
      return { source: this.cleanPlace(cities[0]), destination: this.cleanPlace(cities[1]) };
    }
    return { source: null, destination: null };
  }
  cleanPlace(s) {
    return s.replace(/^[\"'“”„]+|[\"'“”„]+$/g, "");
  }

  // ---- Parser כולל לנסיעה ----
  parseRide(message) {
    const raw = message || "";
    const text = this.normalize(raw);

    // תשלומים מפוצלים
    const payments = this.extractPayments(text);

    // מחיר: אם יש תשלומים – המחיר הוא סכום התשלומים; אחרת חפש מחיר כללי
    let price = null;
    if (payments.length > 0) {
        price = payments.reduce((s,p)=>s+(p.amount||0),0);
    } else {
        price = this.extractPrice(text);
    }

    // אמצעי תשלום בודד, אם אין פירוט מפוצל
    let singleMethod = payments.length === 0 ? this.extractSingleMethod(text) : null;

    // עמלה - *** כאן השינוי החשוב! ***
    const commission = this.extractCommission(text, price || 0);

    // טלפון
    const phone = this.extractPhone(text);

    // תאריך/שעה
    const date = this.extractDateTime(text);

    // מסלול
    const { source, destination } = this.extractRoute(text);

    // הערת פתק (אם צוין בפועל לצד המילה "פתק", נשאיר לבוט להשלים אם חסר)
    let noteDetails = null;
    if ((singleMethod === 'פתק' || payments.some(p=>p.method==='פתק'))) {
      // נסה לחלץ טקסט אחרי המילה "פתק"
      const m = text.match(/פתק\s+([^]+?)$/i);
      if (m) noteDetails = normalizeSpaces(m[1]).replace(/^(ב|מ|ל)\s*/,'');
    }

    return {
        source, destination,
        price,
        commission, // ← זה כבר מכיל את העמלה הנכונה או null
        phone,
        paymentMethod: singleMethod || null,
        payments,
        noteDetails,
        date
    };
  }

  // ---- Parser להוצאה ----
  parseExpense(message) {
    const raw = message || "";
    const text = this.normalize(raw);
    let type = 'הוצאה כללית';
    if (/דלק/.test(text)) type = 'דלק';
    else if (/ביטוח/.test(text)) type = 'ביטוח';
    else if (/מוסך/.test(text)) type = 'מוסך';
    else if (/רישוי/.test(text)) type = 'רישוי';
    else if (/בדיקה/.test(text)) type = 'בדיקה שנתית';

    // סכום
    const amount = this.extractPrice(text);

    // חודשית?
    const isRecurring = /(חודשית|קבועה|כל\s+חודש|מידי\s+חודש)/.test(text);

    // הערה משאר הטקסט
    const cleaned = text
      .replace(/הוצאה|דלק|ביטוח|מוסך|רישוי|בדיקה/gi,'')
      .replace(/חודשית|קבועה|כל\s+חודש|מידי\s+חודש/gi,'')
      .replace(/₪|שח|ש\"ח/gi,'')
      .trim();

    return { type, amount: amount || 0, note: cleaned || '', isRecurring };
  }
}




// ChatBot functionality
class DriverChatBot {
  constructor() {
    this.isOpen = false;
    this.isTyping = false;
    this.waitingForNoteDetails = false;
    this.pendingRideData = null;
    this.nlu = new HebrewNLU(); // <-- הוסף
	this.voiceRecognition = new VoiceRecognition(this); // <-- הוסף השורה הזו
    
    // ================== ✨ ניהול הקשר (Context) ✨ ==================
    this.lastIntent = null; // נושא השיחה האחרון (לדוגמה: 'stats')
    this.lastEntities = {}; // הפרטים האחרונים (לדוגמה: { period: 'monthly' })
    // ============================================================

    this.init();
  }
    escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}


normalizePlaceForCompare(s) {
  return normalizeText(s || '')
    .toLowerCase()
    .replace(/[\s"׳״'’`\-–—]/g, '');
}



// מילון חודשים בעברית
getHebrewMonths() {
    return {
        'ינואר': 0, 'יני': 0, 'jan': 0, '1': 0, '01': 0,
        'פברואר': 1, 'פבר': 1, 'feb': 1, '2': 1, '02': 1,
        'מרץ': 2, 'mar': 2, '3': 2, '03': 2,
        'אפריל': 3, 'אפר': 3, 'apr': 3, '4': 3, '04': 3,
        'מאי': 4, 'may': 4, '5': 4, '05': 4,
        'יוני': 5, 'יונ': 5, 'jun': 5, '6': 5, '06': 5,
        'יולי': 6, 'יול': 6, 'jul': 6, '7': 6, '07': 6,
        'אוגוסט': 7, 'אוג': 7, 'aug': 7, '8': 7, '08': 7,
        'ספטמבר': 8, 'ספט': 8, 'sep': 8, '9': 8, '09': 8,
        'אוקטובר': 9, 'אוק': 9, 'oct': 9, '10': 9,
        'נובמבר': 10, 'נוב': 10, 'nov': 10, '11': 10,
        'דצמבר': 11, 'דצמ': 11, 'dec': 11, '12': 11
    };
}

// פרשנות תאריכים מטקסט
parseDateFromText(text) {
    const months = this.getHebrewMonths();
    const currentYear = new Date().getFullYear();
    const t = (text || '').toLowerCase().replace(/בחודש\s+/g, ''); // הסר "בחודש "

    // dd/mm/yyyy או dd.mm.yyyy או dd-mm-yyyy
    let m = t.match(/(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{4})/i);
    if (m) {
        const day = parseInt(m[1], 10);
        const month = parseInt(m[2], 10) - 1;
        const year = parseInt(m[3], 10);
        return new Date(year, month, day);
    }

    // dd/mm או dd.mm (שנה נוכחית)
    m = t.match(/(\d{1,2})[\/\.\-](\d{1,2})\b(?!\d)/i);
    if (m) {
        const day = parseInt(m[1], 10);
        const month = parseInt(m[2], 10) - 1;
        return new Date(currentYear, month, day);
    }

    // "<חודש> <שנה>"
    m = t.match(new RegExp(
        '\\b(ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר|יני|פבר|אפר|יונ|יול|אוג|ספט|אוק|נוב|דצמ)\\s+(\\d{4})\\b',
        'i'
    ));
    if (m) {
        const monthName = m[1].toLowerCase();
        const year = parseInt(m[2], 10);
        const mi = months[monthName];
        if (mi !== undefined) return new Date(year, mi, 1);
    }

    // "<חודש>" (שנה נוכחית)
    m = t.match(new RegExp(
        '\\b(ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר|יני|פבר|אפר|יונ|יול|אוג|ספט|אוק|נוב|דצמ)\\b',
        'i'
    ));
    if (m) {
        const monthName = m[1].toLowerCase();
        const mi = months[monthName];
        if (mi !== undefined) return new Date(currentYear, mi, 1);
    }

    return null;
}

// פרשנות טווח תאריכים
parseDateRange(text) {
    const rangeKeywords = ['עד', 'ל', 'עד ל', 'בין', 'ועד', 'עד יום', 'עד תאריך'];
    
    for (const keyword of rangeKeywords) {
        if (text.includes(keyword)) {
            const parts = text.split(keyword);
            if (parts.length >= 2) {
                const startDate = this.parseDateFromText(parts[0].trim());
                const endDate = this.parseDateFromText(parts[1].trim());
                
                if (startDate && endDate) {
                    return { startDate, endDate };
                }
            }
        }
    }
    
    return null;
}

// זיהוי בקשות סיכום מתקדמות
detectAdvancedStatsIntent(message) {
    const advancedKeywords = [
        'סיכום', 'מ', 'עד', 'בין', 'תקופה', 'טווח',
        'חודש', 'תאריך', 'יום', 'משך', 'בחודש'
    ];
    
    const hasAdvancedKeyword = advancedKeywords.some(keyword => 
        message.includes(keyword)
    );
    
    // זיהוי תאריכים או חודשים בהודעה
    const hasDate = this.parseDateFromText(message) !== null;
    const hasDateRange = this.parseDateRange(message) !== null;
    
    return hasAdvancedKeyword && (hasDate || hasDateRange);
}

    
        // מילון קיצורי ערים - הוסף כאן
    getCityAbbreviations() {
    return {
        'ים': 'ירושלים',
        'בב': 'בני ברק',
        'ספר': 'ספרדים',
        'חר': 'חריש',
        'רא': 'רמת אביב',
        'רג': 'רמת גן',
        'פ': 'פתח תקווה',
        'חל': 'חולון',
        'בת': 'בת ים',
        'הר': 'הרצליה',
        'כפ': 'כפר סבא',
        'נת': 'נתניה',
        'אש': 'אשדוד',
        'אק': 'אשקלון',
        'בש': 'באר שבע',
        'חיפה': 'חיפה',
        'טב': 'טבריה',
        'צפ': 'צפת',
        'נצ': 'נצרת',
        'תא': 'תל אביב',
        'אלעד': 'אלעד',
        'רשבי': 'רשב"י',
        'מרון': 'מירון',
        'טבע': 'טבעון',
        'tlv': 'תל אביב',
        'ra': 'רמת אביב',
        'bb': 'בני ברק',
        'jer': 'ירושלים'
    };
}

    // הרחבת קיצורי ערים - הוסף כאן
expandCityAbbreviations(text) {
  const abbreviations = this.getCityAbbreviations();
  let result = String(text || '');

  // גבולות: תחילת/סוף טקסט או רווח/פיסוק/מפרידים
  const leftBoundary = '(^|[\\s,.;:()\\-_"“”\'״׳|\\/])';
  const rightBoundary = '(?=$|[\\s,.;:()\\-_"“”\'״׳|\\/])';

  for (const abbr of Object.keys(abbreviations)) {
    const pattern = new RegExp(leftBoundary + '(' + this.escapeRegex(abbr) + ')' + rightBoundary, 'gi');
    result = result.replace(pattern, (match, left, token) => {
      return `${left}${abbreviations[abbr]}`;
    });
  }
  return result;
}

isVeryShortToken(token) {
  return (token || '').trim().length <= 2;
}

buildQueryVariants(token) {
  if (!token) return { variants: [], variantsNorm: [] };
  const abbrs = this.getCityAbbreviations();
  const low = token.toLowerCase();
  const expanded = abbrs[low] || token;

  // אם זה קיצור מוכר או קצר מאוד – אל תחזיק את המקורי
  const useOnlyExpanded = !!abbrs[low] || this.isVeryShortToken(token);

  const variants = useOnlyExpanded ? [expanded] : Array.from(new Set([token, expanded]));
  const variantsNorm = variants.map(v => this.normalizePlaceForCompare(v));
  return { variants, variantsNorm };
}

matchesCandidates(textCandidates, normCandidates, variants, variantsNorm) {
  // textCandidates: ['ירושלים', 'ירושלים (מורחב)'] באותיות קטנות
  // normCandidates: מועמדים מנורמלים (ללא רווחים/גרשיים וכו')
  for (let i = 0; i < variants.length; i++) {
    const v = variants[i];
    const vn = variantsNorm[i];

    const short = this.isVeryShortToken(v);
    if (short) {
      // התאמה קשיחה לפי נרמול מלא
      if (normCandidates.some(c => c === vn)) return true;
    } else {
      const vl = v.toLowerCase();
      if (textCandidates.some(c => c.includes(vl))) return true;
      if (normCandidates.some(c => c.includes(vn))) return true;
    }
  }
  return false;
}

// שמירת תוצאות אחרונות עבור "הצג הכל"
lastSearchResults = [];

// פותח מודל תוצאות מלאות
openFullSearchResults() {
  if (Array.isArray(this.lastSearchResults) && this.lastSearchResults.length) {
    // יש פונקציה גלובלית קיימת שמציגה תוצאות במודל
    // במערכת מופרדת, תצטרך לממש את הפונקציה הזו
    if (typeof displaySearchResults === 'function') {
        displaySearchResults(this.lastSearchResults);
    } else {
        this.addMessage('מודל התוצאות המלאות אינו זמין בגרסה זו.');
    }
  } else {
    this.addMessage('אין תוצאות להצגה כרגע.');
  }
}

    
async openRideFormWithData(rideData) {
  try {
    // ================= הוסף את השורה הזו =================
    this.closeChat(); // <-- סגור את הצ'אטבוט
    // =======================================================

    // פונקציות אלו תלויות בקוד המקורי
    if (typeof openAddModal === 'function') {
        openAddModal();
    } else {
        this.addMessage('פתיחת טופס אינה נתמכת בגרסה זו.');
        return;
    }

    setTimeout(() => {
      if (rideData.source) document.getElementById("source").value = rideData.source;
      if (rideData.destination) document.getElementById("destination").value = rideData.destination;
      if (rideData.price) document.getElementById("price").value = rideData.price;
      if (rideData.commission != null) document.getElementById("commission").value = rideData.commission;
      if (rideData.phone) document.getElementById("customerPhone").value = rideData.phone;

      // תאריך/שעה
      if (rideData.date && window.rideDateTimePicker) {
        rideDateTimePicker.setDate(rideData.date);
      }

      // תשלומים
      const container = document.getElementById("payment-splits");
      if (container && typeof addPaymentRow === 'function') {
        container.innerHTML = "";
        if (rideData.payments?.length) {
          rideData.payments.forEach(p => addPaymentRow({ method: p.method, amount: p.amount, note: p.note || (p.method==='פתק' ? (rideData.noteDetails||'') : '') }));
        } else if (rideData.paymentMethod && rideData.price) {
          addPaymentRow({ method: rideData.paymentMethod, amount: rideData.price, note: rideData.noteDetails || '' });
        } else {
          addPaymentRow();
        }
        if (typeof updatePaymentTotal === 'function') updatePaymentTotal();
      }

      // אין צורך להציג הודעה בצ'אט כי הוא נסגר
      // this.addMessage('✅ הטופס מולא אוטומטית. ניתן לעדכן ולשמור.');
    }, 300);
  } catch (e) {
    console.error(e);
    // אין טעם להציג הודעת שגיאה בצ'אט אם הוא נסגר
    // this.addMessage('❌ שגיאה בפתיחת הטופס.');
  }
}

    // פרשנות מתקדמת של הודעת נסיעה - הוסף כאן
parseAdvancedRideFormat(message) {
    const expandedMessage = this.expandCityAbbreviations(message);
    const data = {};
    
    let cleanMessage = expandedMessage
        .replace(/נסיעה|הוסף|רשום|נסעתי|לקוח|עשיתי/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
    
    console.log('Starting with:', cleanMessage);
    
    // 🔥 1️⃣ תחילה חלץ אמצעי תשלום (לפני המחיר!)
    const paymentMethods = [
        { keywords: ['מזומן', 'cash', 'כסף'], method: 'מזומן' },
        { keywords: ['ביט', 'bit'], method: 'ביט' },
        { keywords: ['פייבוקס', 'paybox', 'פיי'], method: 'פייבוקס' },
        { keywords: ['העברה', 'בנקאית', 'בנק', 'bank', 'transfer'], method: 'העברה בנקאית' },
        { keywords: ['פתק', 'note', 'חוב', 'אשראי'], method: 'פתק' }
    ];
    
    for (const payment of paymentMethods) {
        for (const keyword of payment.keywords) {
            const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
            if (regex.test(cleanMessage)) {
                data.paymentMethod = payment.method;
                cleanMessage = cleanMessage.replace(regex, '').replace(/\s+/g, ' ').trim();
                console.log('Found payment method:', data.paymentMethod);
                console.log('After payment removal:', cleanMessage);
                break;
            }
        }
        if (data.paymentMethod) break;
    }
    
    // 2️⃣ חלץ עמלה מותאמת אישית
    const commissionPatterns = [
        /עמלה\s+(\d+(?:\.\d+)?)/gi,
        /עמלה:?\s*(\d+(?:\.\d+)?)/gi,
        /(\d+(?:\.\d+)?)\s*עמלה/gi
    ];
    
    for (const pattern of commissionPatterns) {
        const match = cleanMessage.match(pattern);
        if (match) {
            data.customCommission = parseFloat(match[1]);
            cleanMessage = cleanMessage.replace(pattern, '').replace(/\s+/g, ' ').trim();
            console.log('Found commission:', data.customCommission);
            break;
        }
    }
    
    // 3️⃣ חלץ מחיר (עכשיו אחרי שאמצעי התשלום כבר הוסר)
    const pricePatterns = [
        /(\d+(?:\.\d+)?)\s*שקל/gi,
        /(\d+(?:\.\d+)?)\s*₪/gi,
        /₪\s*(\d+(?:\.\d+)?)/gi,
        /\b(\d{2,}(?:\.\d+)?)\b/gi // כל מספר בן 2+ ספרות
    ];
    
    for (const pattern of pricePatterns) {
        const matches = [...cleanMessage.matchAll(pattern)];
        if (matches.length > 0) {
            const prices = matches.map(match => parseFloat(match[1] || match[0].replace(/[^\d.]/g, '')));
            data.price = Math.max(...prices); // קח את הגדול ביותר
            cleanMessage = cleanMessage.replace(matches[0][0], '').replace(/\s+/g, ' ').trim();
            console.log('Found price:', data.price);
            break;
        }
    }
    
    // 4️⃣ חילוץ טלפון
    const phoneMatch = cleanMessage.match(/05\d-?\d{7}|05\d\d{7}/);
    if (phoneMatch) {
        data.phone = phoneMatch[0];
        cleanMessage = cleanMessage.replace(phoneMatch[0], '').trim();
        console.log('Found phone:', data.phone);
    }
    
    // 5️⃣ חילוץ מקור ויעד
    const cityWords = cleanMessage.split(/\s+/).filter(word => 
        word.length > 1 && 
        !['שקל', 'ב', 'עם', 'על', 'של', 'ו', 'את', 'אל', 'מ', 'ל'].includes(word.toLowerCase()) &&
        !/^\d+$/.test(word)
    );
    
    if (cityWords.length >= 2) {
        data.source = cityWords[0];
        data.destination = cityWords[1];
        console.log('Found route:', data.source, '→', data.destination);
    }
    
    // 6️⃣ טיפול בפתקים
    if (data.paymentMethod === 'פתק' && cityWords.length > 2) {
        data.noteDetails = cityWords.slice(2).join(' ');
        console.log('Found note details:', data.noteDetails);
    }
    
    console.log('Final parsed data:', data);
    return data;
}

    init() {
        this.setupEventListeners();
        this.setupQuickActions();
		 this.setupVoiceRecognition(); // <-- הוסף השורה הזו
    }

    setupEventListeners() {
        // Float button toggle
        document.getElementById('chatbotBtn').addEventListener('click', () => {
            this.toggleChat();
        });

        // Close button
        document.getElementById('closeChatbot').addEventListener('click', () => {
            this.closeChat();
        });

        // Send message
        document.getElementById('sendBtn').addEventListener('click', () => {
            this.sendMessage();
        });

        // Enter key to send
        document.getElementById('chatInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            }
        });

       

        // Click outside to close
        document.addEventListener('click', (e) => {
            if (this.isOpen && !e.target.closest('#chatbotModal') && !e.target.closest('#chatbotFloat')) {
                this.closeChat();
            }
        });
    }

	setupVoiceRecognition() {
    // Voice button
    const voiceBtn = document.getElementById('voiceBtn');
    if (voiceBtn && this.voiceRecognition) {
        voiceBtn.addEventListener('click', () => {
            this.voiceRecognition.startRecording();
        });
    }
}

    setupQuickActions() {
        document.querySelectorAll('.quick-action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.action;
                this.handleQuickAction(action);
            });
        });
    }

    toggleChat() {
        if (this.isOpen) {
            this.closeChat();
        } else {
            this.openChat();
        }
    }

openChat() {
    this.isOpen = true;
    const modal = document.getElementById('chatbotModal');
    const icon = document.getElementById('chatbotIcon');
    
    if (!modal || !icon) {
        console.error('❌ Chat elements not found!');
        return;
    }
    
    // הסר hidden ולאחר מכן הוסף show
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.add('show'), 10);
    document.body.classList.add('chat-open');
    
    // שנה אייקון לסגירה
    icon.className = 'fas fa-times text-white text-xl';
}

closeChat() {
    this.isOpen = false;
    const modal = document.getElementById('chatbotModal');
    const icon = document.getElementById('chatbotIcon');
    
    if (!modal || !icon) return;
    
    // עצור הקלטת קול אם פעילה
    if (this.voiceRecognition && this.voiceRecognition.isRecording) {
        this.voiceRecognition.stopRecording();
    }
    
    // הסר show ולאחר מכן הוסף hidden
    modal.classList.remove('show');
    setTimeout(() => modal.classList.add('hidden'), 200);
    document.body.classList.remove('chat-open');
    
    // החזר אייקון רובוט
    icon.className = 'fas fa-robot text-white text-xl';
}

    async sendMessage() {
        const input = document.getElementById('chatInput');
        const message = input.value.trim();
        
        if (!message) return;

        // Add user message
        this.addMessage(message, 'user');
        input.value = '';

        // Show typing indicator
        this.showTyping();

        // Process message
        await this.processMessage(message);
    }

addMessage(text, sender = 'bot', buttons = null) {
  const messagesContainer = document.getElementById('chatMessages');
  const messageDiv = document.createElement('div');
  // ** שינוי: הסרת העיצוב הישן של ההודעות **
  messageDiv.className = 'message-wrapper';

  if (sender === 'user') {
    // הודעת משתמש נשארת אותו דבר
    messageDiv.innerHTML = `
      <div class="user-message">
        <p>${escapeHTML(text)}</p>
      </div>
    `;
  } else {
    // ** שינוי: הוספת תמיכה ב-HTML עשיר עבור הודעות הבוט **
    messageDiv.innerHTML = `
      <div class="bot-message-container">
        <div class="bot-avatar-small">
          <i class="fas fa-robot text-white text-xs"></i>
        </div>
        <div class="bot-message">
          ${text}
          ${buttons ? `<div class="mt-4">${buttons}</div>` : ''}
        </div>
      </div>
    `;
  }
  messagesContainer.appendChild(messageDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}


    showTyping() {
        this.isTyping = true;
        document.getElementById('typingIndicator').classList.remove('hidden');
    }

    hideTyping() {
        this.isTyping = false;
        document.getElementById('typingIndicator').classList.add('hidden');
    }

async processMessage(message) {
    await new Promise(r => setTimeout(r, 1000 + Math.random() * 1000));
    this.hideTyping();

    if (this.waitingForNoteDetails && this.pendingRideData) {
        await this.handleNoteDetailsInput(message);
        return;
    }

    const lowerMessage = (message || '').toLowerCase().trim();

    // ================== ✨ בדיקת הקשר לפני הכל ✨ ==================
    if (this.lastIntent) {
        const isFollowUp = /(מה עם|ומה לגבי|בהשוואה ל|וגם)/.test(lowerMessage);
        if (isFollowUp) {
            // אם ההקשר האחרון היה סטטיסטיקות
            if (this.lastIntent === 'stats') {
                // המשתמש שאל על סטטיסטיקות, ועכשיו שואל שאלה משווה
                if (lowerMessage.includes('שבוע שעבר')) {
                    await this.handleStats('סיכום שבוע שעבר');
                    return;
                }
                if (lowerMessage.includes('חודש שעבר') || lowerMessage.includes('הקודם')) {
                    await this.handleStats('סיכום חודש שעבר');
                    return;
                }
                if (lowerMessage.includes('היום')) {
                    await this.handleStats('סיכום היום');
                    return;
                }
            }
            // אפשר להוסיף כאן עוד תנאים להקשרים אחרים (למשל, חיפוש)
        }
    }
    // ============================================================

    // חיפוש קודם כדי ש"מצא נסיעות ..." לא ייפול לסטטיסטיקות
    if (this.detectSearchIntent(lowerMessage)) {
        await this.handleSearch(message);
    } else if (this.detectAddExpenseIntent(lowerMessage)) {
        await this.handleAddExpense(message);
    } else if (this.detectAddRideIntent(lowerMessage)) {
        await this.handleAddRide(message);
    } else if (this.detectStatsIntent(lowerMessage)) {
        await this.handleStats(lowerMessage);
    } else {
        // אם אף כוונה לא זוהתה, אפס את ההקשר
        this.lastIntent = null;
        this.lastEntities = {};
        this.handleGeneralQuery(lowerMessage);
    }
}

containsRideCues(text) {
    const msg = (text || "").toLowerCase();
    const hasKeyword = /(נסיעה|הוסף נסיעה|רשום נסיעה|נסעתי|לקוח)/.test(msg);
    const hasRoutePattern = /(?:\bמ\s*\S+)\s+ל\s*\S+/.test(msg) || /→/.test(msg);
    const hasPhone = /(?:\+?972-?)?0?5\d-?\d{7}\b/.test(msg);
    const hasPayment = /(מזומן|ביט|פייבוקס|paybox|bit|cash|העברה|בנק|bank|transfer|פתק|note)/.test(msg);
    const hasPrice = /\b\d{2,}(?:[.,]\d+)?(?:\s*(?:₪|שח|ש״ח|ש"ח|שקל(?:ים)?))?\b/.test(msg);
    // מספיק: מילת מפתח, או מסלול + מחיר, או מחיר + (טלפון/אמצעי תשלום)
    return hasKeyword || (hasRoutePattern && hasPrice) || (hasPrice && (hasPhone || hasPayment));
}

async handleNoteDetailsInput(stationName) {
    try {
        const cleanStationName = stationName.trim();
        if (!cleanStationName) {
            this.addMessage('🚫 שם תחנה לא יכול להיות ריק. אנא הזן שם תחנה תקין.');
            return;
        }
        
        this.pendingRideData.noteDetails = cleanStationName;
        
        this.waitingForNoteDetails = false;
        const rideData = this.pendingRideData;
        this.pendingRideData = null;
        
        const buttons = createActionButtons([
            { onclick: `driverChatBot.confirmAddRide(${JSON.stringify(rideData).replace(/"/g, '&quot;')})`, text: '⚡ שמור מהר', icon: 'fas fa-check', type: 'success' },
            { onclick: `driverChatBot.openRideFormWithData(${JSON.stringify(rideData).replace(/"/g, '&quot;')})`, text: '📝 פתח לעריכה', icon: 'fas fa-pencil-alt', type: 'primary' }
        ]);

        const text = this.createRideCard(rideData, "✅ מעולה! הנתונים שלמים:");
        this.addMessage(text, 'bot', buttons);
        
    } catch (error) {
        console.error('Error handling note details:', error);
        this.addMessage('❌ שגיאה בעיבוד שם התחנה. נסה שוב.');
        this.waitingForNoteDetails = false;
        this.pendingRideData = null;
    }
}

    // Intent Detection Methods
detectAddRideIntent(message) {
    const msg = (message || "").toLowerCase();

    // אם נראה כמו סיכום/דוח – לא נסיעה
    if (/(סיכום|דוח|דו"ח)/.test(msg)) return false;

    // אם זוהתה כסטטיסטיקה – אל תתפוס כנסיעה
    if (this.detectStatsIntent(msg)) return false;

    // חובה שיהיו "רמזי נסיעה"
    return this.containsRideCues(msg);
}
    detectAddExpenseIntent(message) {
        const expenseKeywords = ['הוצאה', 'הוסף הוצאה', 'דלק', 'ביטוח', 'מוסך', 'שילמתי'];
        return expenseKeywords.some(keyword => message.includes(keyword));
    }

// החלף את detectStatsIntent הקיימת (בערך שורה 1005):
detectStatsIntent(message) {
    const msg = (message || '').toLowerCase();

    // אם זו שאילתת חיפוש – לא סטטיסטיקות
    if (this.detectSearchIntent(msg)) return false;

    // מילות מפתח מובהקות לסטטיסטיקות/סיכומים/טווחי זמן
    const statsKeywords = [
        'כמה', 'סיכום', 'נטו', 'ברוטו', 'הכנסות', 'הוצאות',
        'היום', 'השבוע', 'החודש', 'חודש שעבר', 'החודש הקודם',
        'כל הזמנים', 'סהכ', 'סה״כ', 'השנה', 'חודשיים', '2 חודשים', 'שנה זו'
    ];
    const basicStats = statsKeywords.some(k => msg.includes(k));

    // זיהוי תאריך/טווח (מתקדם)
    const advancedStats = this.detectAdvancedStatsIntent(msg);

    return basicStats || advancedStats;
}

getMultiWordCities() {
  // לשמירה קלה – הכל באותיות קטנות
  return new Set([
    'בני ברק',
    'בית שמש',
    'פתח תקווה',
    'כפר סבא',
    'ראשון לציון',
    'תל אביב',
    'רמת גן',
    'בת ים',
    'באר שבע',
    'קרית שמונה',
    'קריית שמונה',
    'קרית גת',
    'קריית גת',
    'קרית מוצקין',
    'קריית מוצקין',
    'קרית ביאליק',
    'קריית ביאליק',
    'קרית ים',
    'קריית ים',
    'מודיעין עילית',
    'ביתר עילית',
  ]);
}

    detectSearchIntent(message) {
  const msg = (message || '').toLowerCase();
  const keywords = ['חפש', 'מצא', 'הצג', 'חיפוש', 'רשימה'];
  const hasKeyword = keywords.some(k => msg.includes(k));
  const hasRoutePattern = /(?:^|\s)מ\s*\S+(?:\s+|.*\s)ל\s*\S+/.test(msg);

  // אם המשתמש כתב "נסיעה" (או "הוסף נסיעה") – זו לא שאילתת חיפוש
  if (/(^|\s)(נסיעה|הוסף\s+נסיעה|רשום\s+נסיעה)(\s|$)/.test(msg)) {
    return false;
  }

  return hasKeyword || hasRoutePattern;
}

// ** שינוי: הוספת פונקציות ליצירת כרטיסים ויזואליים **
createRideCard(rideData, title = "מעולה! זיהיתי נסיעה:") {
    const price = rideData.price || 0;
    const commission = rideData.commission || 0;
    const net = price - commission;

    let paymentsHtml = '';
    if (rideData.payments?.length) {
        paymentsHtml = rideData.payments.map(p => `
            <div class="flex items-center justify-between text-xs p-1.5 bg-black/5 dark:bg-white/5 rounded-md">
                <span class="font-medium text-indigo-600 dark:text-indigo-400">${escapeHTML(p.method)}</span>
                <span class="font-semibold">₪${(p.amount || 0).toFixed(2)}</span>
            </div>
        `).join('');
    } else if (rideData.paymentMethod) {
        paymentsHtml = `<div class="flex items-center justify-between text-xs p-1.5 bg-black/5 dark:bg-white/5 rounded-md">
            <span class="font-medium text-indigo-600 dark:text-indigo-400">${escapeHTML(rideData.paymentMethod)}</span>
            <span class="font-semibold">₪${price.toFixed(2)}</span>
        </div>`;
    }

    return `
        <p class="font-bold mb-3">${title}</p>
        <div class="space-y-3 text-sm">
            <!-- Route -->
            <div class="flex items-center gap-3 bg-indigo-50 dark:bg-indigo-500/10 p-2.5 rounded-lg">
                <i class="fas fa-route text-indigo-500 fa-lg"></i>
                <div class="flex-1">
                    <div class="text-xs text-indigo-800 dark:text-indigo-300">מקור</div>
                    <div class="font-bold text-base">${escapeHTML(rideData.source)}</div>
                </div>
                <i class="fas fa-arrow-right text-indigo-400"></i>
                <div class="flex-1 text-left">
                    <div class="text-xs text-indigo-800 dark:text-indigo-300">יעד</div>
                    <div class="font-bold text-base">${escapeHTML(rideData.destination)}</div>
                </div>
            </div>

            <!-- Financials -->
            <div class="grid grid-cols-3 gap-2 text-center">
                <div>
                    <div class="text-xs opacity-70">מחיר</div>
                    <div class="font-semibold text-base">₪${price.toFixed(2)}</div>
                </div>
                <div>
                    <div class="text-xs opacity-70">עמלה</div>
                    <div class="font-semibold text-base text-red-500">- ₪${commission.toFixed(2)}</div>
                </div>
                <div class="bg-green-100 dark:bg-green-500/10 p-1 rounded-lg">
                    <div class="text-xs text-green-800 dark:text-green-300 font-medium">נטו</div>
                    <div class="font-bold text-lg text-green-600 dark:text-green-400">₪${net.toFixed(2)}</div>
                </div>
            </div>

            <!-- Payments -->
            ${paymentsHtml ? `
            <div>
                <div class="text-xs font-medium mb-1 opacity-80">פירוט תשלומים:</div>
                <div class="space-y-1">${paymentsHtml}</div>
            </div>
            ` : ''}

            <!-- Other Details -->
            <div class="border-t dark:border-white/10 pt-2 space-y-1.5 text-xs">
                ${rideData.phone ? `
                <div class="flex items-center gap-2 opacity-90">
                    <i class="fas fa-phone-alt fa-fw w-4 text-center"></i>
                    <span>${escapeHTML(rideData.phone)}</span>
                </div>` : ''}
                ${rideData.date ? `
                <div class="flex items-center gap-2 opacity-90">
                    <i class="fas fa-calendar-alt fa-fw w-4 text-center"></i>
                    <span>${rideData.date.toLocaleString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </div>` : ''}
                 ${rideData.noteDetails ? `
                <div class="flex items-center gap-2 opacity-90">
                    <i class="fas fa-sticky-note fa-fw w-4 text-center"></i>
                    <span>פתק: ${escapeHTML(rideData.noteDetails)}</span>
                </div>` : ''}
            </div>
        </div>
    `;
}

    // Action Handlers
async handleAddRide(message) {
try {
    // ================== ✨ עדכון הקשר ✨ ==================
    this.lastIntent = 'add_ride';
    this.lastEntities = {};
    // =======================================================
    
    const rideData = this.parseRideFromMessage(message);
    if (rideData.source && rideData.destination && (rideData.price || (rideData.payments && rideData.payments.length))) {
        let price = rideData.price;
        if (!price && rideData.payments?.length) {
            price = rideData.payments.reduce((s,p)=>s+(p.amount||0),0);
        }
        
        let commission;
        if (rideData.commission != null) {
            commission = rideData.commission;
        } else {
            commission = price ? +(price * 0.12).toFixed(2) : 0;
        }

      const fullRideData = { ...rideData, price, commission };

      const hasNotePayment = rideData.payments?.some(p=>p.method==='פתק');
      if ((rideData.paymentMethod === 'פתק' || hasNotePayment) && !rideData.noteDetails) {
        this.waitingForNoteDetails = true;
        this.pendingRideData = fullRideData;
        this.addMessage(`
            <p class="font-medium">💳 זיהיתי תשלום בפתק.</p>
            <p class="mt-2">נסיעה: <b>${escapeHTML(rideData.source)} → ${escapeHTML(rideData.destination)}</b></p>
            <p class="mt-2">🏪 אנא הזן שם תחנה עבור הפתק (למשל: "דרכי השלום").</p>
        `);
        return;
      }

      const buttons = createActionButtons([
          { onclick: `driverChatBot.confirmAddRide(${JSON.stringify(fullRideData).replace(/"/g, '&quot;')})`, text: '⚡ שמור מהר', icon: 'fas fa-check', type: 'success' },
          { onclick: `driverChatBot.openRideFormWithData(${JSON.stringify(fullRideData).replace(/"/g, '&quot;')})`, text: '📝 פתח לעריכה', icon: 'fas fa-pencil-alt', type: 'primary' }
      ]);
      
      const text = this.createRideCard(fullRideData);
      this.addMessage(text, 'bot', buttons);

    } else {
      this.addMessage('לא הצלחתי לזהות את כל הפרטים. דוגמאות:<br>• "נסיעה מתל אביב לחיפה 150 ביט"<br>• "מחר ב-8:00 נסיעה מירושלים לרמת גן 220 ₪, עמלה 10%"');
    }
  } catch (e) {
    console.error(e);
    this.addMessage('שגיאה בעיבוד הנסיעה. נסה לנסח מחדש.');
  }
}


parseFixedFormatRide(message) {
  const data = {};
  const expandedMessage = this.expandCityAbbreviations(message);
  const lower = expandedMessage.toLowerCase();

  // אם אין רמזי נסיעה – אל תנסה לפרסר
  if (!this.containsRideCues(lower)) {
    return {};
  }

  // נקה את ההודעה ממילים כלליות
  let cleanMessage = expandedMessage
    .replace(/נסיעה|הוסף|רשום|נסעתי|לקוח|עשיתי|שקל|שח|ש״ח|ש"ח/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const parts = cleanMessage.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return {};

  // דברי עזר
  const isSentinel = (p) => this.isNumber(p) || this.isPhone(p) || this.isPaymentMethod(p) || /עמלה/i.test(p);
  const multiSet = this.getMultiWordCities();

  // 3.1 מצא את האינדקס הראשון של "סמן" (מספר מחיר / טלפון / אמצעי תשלום / "עמלה")
  let stopIdx = parts.findIndex(isSentinel);
  if (stopIdx === -1) stopIdx = parts.length;

  // 3.2 הטוקנים של מקומות נמצאים לפני stopIdx
  const placeTokens = parts.slice(0, stopIdx);

  // אם אין לפחות 2 טוקנים – נחכה להמשך עיבוד
  if (placeTokens.length === 0) {
    // ננסה לפחות לתפוס מחיר ו/או פרטים נוספים
  } else {
    // 3.3 יעד: ננסה לזהות 2 מילים אחרונות כעיר דו-מילתית ("בני ברק", "בית שמש", ...)
    let destTokens = [];
    let srcTokens = [];

    if (placeTokens.length >= 2) {
      const lastTwo = (placeTokens.slice(-2).join(' ')).toLowerCase();
      if (multiSet.has(lastTwo)) {
        destTokens = placeTokens.slice(-2);
        srcTokens = placeTokens.slice(0, -2);
      } else {
        // יעד הוא המילה האחרונה, מקור – כל השאר
        destTokens = placeTokens.slice(-1);
        srcTokens = placeTokens.slice(0, -1);
      }
    } else {
      // מקרה קצה: יש רק מילה אחת – נניח מקור בלבד (יכוסה בparseAdvancedRideFormat בהמשך)
      srcTokens = placeTokens.slice();
      destTokens = [];
    }

    const srcStr = srcTokens.join(' ').trim();
    const dstStr = destTokens.join(' ').trim();

    if (srcStr) data.source = srcStr;
    if (dstStr) data.destination = dstStr;
  }

  // 3.4 מחיר: אם יש מספר מיד ב-stopIdx
  if (parts[stopIdx] && this.isNumber(parts[stopIdx])) {
    data.price = parseFloat(parts[stopIdx].replace(',', '.'));
  } else {
    // חיפוש מספר ראשון לאחר stopIdx שכנראה אינו טלפון
    for (let i = stopIdx; i < parts.length; i++) {
      const p = parts[i];
      if (this.isPhone(p)) continue;
      if (this.isNumber(p)) {
        // אל תבלבל עם "X עמלה"
        const prev = parts[i - 1] || '';
        if (!/עמלה/i.test(prev)) {
          data.price = parseFloat(p.replace(',', '.'));
          break;
        }
      }
    }
  }

  // 3.5 סריקה של שאר הפרטים
  for (let i = stopIdx; i < parts.length; i++) {
    const part = parts[i];

    if (this.isPaymentMethod(part)) {
      data.paymentMethod = this.normalizePaymentMethod(part);

      // אם "פתק" – אסוף טקסט עד טלפון/סוף
      if (data.paymentMethod === 'פתק') {
        let noteDetails = [];
        let j = i + 1;
        for (; j < parts.length; j++) {
          if (this.isPhone(parts[j]) || this.isPaymentMethod(parts[j]) || this.isNumber(parts[j])) break;
          noteDetails.push(parts[j]);
        }
        if (noteDetails.length > 0) {
          data.noteDetails = noteDetails.join(' ');
          i = j - 1;
        }
      }
    } else if (this.isPhone(part)) {
      data.phone = this.normalizePhone(part);
    } else if (this.isNumber(part) && data.price == null) {
      // אם טרם מצאנו מחיר, קח את המספר הראשון שאינו טלפון ואינו "עמלה"
      const prev = parts[i - 1] || '';
      if (!/עמלה/i.test(prev)) {
        data.price = parseFloat(part.replace(',', '.'));
      }
    } else if (this.isNumber(part) && !data.customCommission) {
      // זיהוי "עמלה X"
      const prev = parts[i - 1] || '';
      if (/עמלה/i.test(prev)) {
        data.customCommission = parseFloat(part.replace(',', '.'));
      }
    }
  }

  return data;
}

// פונקציות עזר לזיהוי
isNumber(str) {
    return /^\d+(\.\d+)?$/.test(str);
}

isPhone(str) {
    return /^0?5\d-?\d{7}$/.test(str) || /^0?5\d{8}$/.test(str);
}

isPaymentMethod(str) {
    const methods = ['ביט', 'bit', 'מזומן', 'cash', 'פייבוקס', 'paybox', 'פיי', 'בנק', 'בנקאית', 'העברה', 'פתק', 'note'];
    return methods.some(method => str.toLowerCase().includes(method.toLowerCase()));
}

normalizePaymentMethod(str) {
    const lowerStr = str.toLowerCase();
    if (lowerStr.includes('ביט') || lowerStr.includes('bit')) return 'ביט';
    if (lowerStr.includes('מזומן') || lowerStr.includes('cash')) return 'מזומן';
    if (lowerStr.includes('פייבוקס') || lowerStr.includes('paybox') || lowerStr.includes('פיי')) return 'פייבוקס';
    if (lowerStr.includes('בנק') || lowerStr.includes('בנקאית') || lowerStr.includes('העברה')) return 'העברה בנקאית';
    if (lowerStr.includes('פתק') || lowerStr.includes('note')) return 'פתק';
    return str;
}

normalizePhone(str) {
    // נקה את הטלפון ותקן פורמט
    let clean = str.replace(/[^\d]/g, '');
    if (clean.startsWith('972')) {
        clean = '0' + clean.substring(3);
    }
    if (clean.length === 10 && clean.startsWith('05')) {
        return clean.substring(0, 3) + '-' + clean.substring(3);
    }
    return str;
}
// במקום handleAddExpense הקיימת, החלף ל:
async handleAddExpense(message) {
    try {
        // ================== ✨ עדכון הקשר ✨ ==================
        this.lastIntent = 'add_expense';
        this.lastEntities = {};
        // =======================================================

        const expenseData = this.parseExpenseFromMessage(message);
        
        if (expenseData.type && expenseData.amount) {
            const buttons = createActionButtons([
                { onclick: `driverChatBot.confirmAddExpense(${JSON.stringify(expenseData).replace(/"/g, '&quot;')})`, text: '✅ אשר הוספה', icon: 'fas fa-check', type: 'success' }
            ]);
            
            const text = `
                <p class="font-bold mb-3">זיהיתי הוצאה חדשה:</p>
                <div class="space-y-2 text-sm">
                    <div class="flex items-center gap-3 p-2.5 bg-red-50 dark:bg-red-500/10 rounded-lg">
                        <i class="fas fa-receipt text-red-500 fa-lg"></i>
                        <div>
                            <div class="text-xs text-red-800 dark:text-red-300">סוג</div>
                            <div class="font-bold">${escapeHTML(expenseData.type)}</div>
                        </div>
                        <div class="mr-auto text-left">
                            <div class="text-xs text-red-800 dark:text-red-300">סכום</div>
                            <div class="font-bold text-base">₪${expenseData.amount.toFixed(2)}</div>
                        </div>
                    </div>
                    ${expenseData.note ? `
                    <div class="text-xs opacity-80 p-2 border-t dark:border-white/10">
                        <i class="fas fa-pen fa-fw"></i>
                        ${escapeHTML(expenseData.note)}
                    </div>
                    ` : ''}
                     <div class="text-xs opacity-80 p-2 border-t dark:border-white/10">
                        <i class="fas ${expenseData.isRecurring ? 'fa-sync-alt' : 'fa-calendar-check'} fa-fw"></i>
                        ${expenseData.isRecurring ? 'הוצאה חודשית קבועה' : 'הוצאה חד פעמית'}
                    </div>
                </div>
                <p class="mt-3 font-medium">האם לאשר הוספה?</p>
            `;

            this.addMessage(text, 'bot', buttons);
        } else {
            this.addMessage('אני צריך עוד פרטים להוספת ההוצאה. אנא ציין:<br>• סוג הוצאה<br>• סכום<br><br>דוגמאות:<br>• "הוצאה דלק 200 שקל"<br>• "הוצאה ביטוח 350 שקל חודשית"');
        }
    } catch (error) {
        this.addMessage('משהו השתבש בפרישת ההוצאה. נסה שוב עם פורמט ברור יותר.');
    }
}

// החלף את handleStats הקיימת (בערך שורה 1015):
async handleStats(message) {
    // ================== ✨ עדכון הקשר ✨ ==================
    this.lastIntent = 'stats';
    this.lastEntities = {}; // איפוס לפני הגדרה מחדש
    // =======================================================
    
    const today = new Date();
    const selectedDate = (typeof datePicker !== 'undefined' && datePicker?.selectedDates[0]) ? datePicker.selectedDates[0] : today;

    
    // בדיקה לסיכום מתקדם
    if (this.detectAdvancedStatsIntent(message)) {
        this.lastEntities.type = 'advanced';
        await this.handleAdvancedStats(message);
        return;
    }
    
    // סיכומים בסיסיים (הקוד הקיים)
    if (message.includes('היום')) {
        this.lastEntities.period = 'daily';
        this.showDayStats(selectedDate);
    } else if (message.includes('החודש') || message.includes('חודש זה')) {
        this.lastEntities.period = 'monthly';
        this.showMonthStats(selectedDate);
    } else if (message.includes('חודש שעבר') || message.includes('החודש הקודם')) {
        this.lastEntities.period = 'last_month';
        const lastMonth = new Date(selectedDate);
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        this.showMonthStats(lastMonth);
    } else if (message.includes('חודשיים') || message.includes('2 חודשים')) {
        this.lastEntities.period = 'two_months';
        const twoMonthsAgo = new Date(selectedDate);
        twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
        this.showMonthStats(twoMonthsAgo);
    } else if (message.includes('כל הזמנים') || message.includes('סה״כ') || message.includes('סהכ')) {
        this.lastEntities.period = 'all_time';
        this.showAllTimeStats();
    } else if (message.includes('השנה') || message.includes('שנה זו')) {
        this.lastEntities.period = 'yearly';
        this.showYearStats(selectedDate.getFullYear());
    } else {
        // אם לא זוהתה כוונה ספציפית בסטטיסטיקות, אפס את ההקשר
        this.lastIntent = null;
        this.addMessage('📊 אתה יכול לבקש:<br>• "כמה הרווחתי היום?"<br>• "סיכום החודש"<br>• "סיכום מינואר עד מרץ"<br>• "סיכום מרץ 2024"<br>• "סיכום מ15/01 עד 20/02"<br>• "סיכום חודש שעבר"');
    }
}

// הוסף פונקציה חדשה אחרי handleStats:
async handleAdvancedStats(message) {
    try {
        // בדיקת טווח תאריכים
        const dateRange = this.parseDateRange(message);
        if (dateRange) {
            this.lastEntities.range = dateRange;
            this.showDateRangeStats(dateRange.startDate, dateRange.endDate);
            return;
        }
        
        // בדיקת חודש/תאריך יחיד
        const singleDate = this.parseDateFromText(message);
        if (singleDate) {
            this.lastEntities.date = singleDate;
            // אם זה יום ראשון בחודש - הצג סיכום חודש
            if (singleDate.getDate() === 1) {
                this.showMonthStats(singleDate);
            } else {
                // אחרת הצג סיכום יום
                this.showDayStats(singleDate);
            }
            return;
        }
        
        // אם לא הצלחנו לפרש - הצג הוראות
        this.addMessage(`❓ לא הצלחתי להבין את הטווח המבוקש.

📅 **דוגמאות לשימוש:**
• "סיכום מרץ 2024"
• "סיכום מינואר עד מרץ"  
• "סיכום מ15/01 עד 20/02"
• "סיכום מ01/01/2024 עד 31/03/2024"
• "הכנסות מפברואר עד מאי"

💡 **חודשים נתמכים:**
ינואר, פברואר, מרץ, אפריל, מאי, יוני, יולי, אוגוסט, ספטמבר, אוקטובר, נובמבר, דצמבר`);
        
    } catch (error) {
        console.error('Error in handleAdvancedStats:', error);
        this.addMessage('❌ שגיאה בעיבוד הבקשה. נסה שוב עם פורמט פשוט יותר.');
    }
}
// הוסף פונקציה חדשה למציאת נתונים בטווח:
showDateRangeStats(startDate, endDate) {
    // וידוא שהתאריך הסופי גדול מההתחלתי
    if (endDate < startDate) {
        [startDate, endDate] = [endDate, startDate];
    }
    
    // סינון נסיעות ופוצאות בטווח
    const rangeRides = (typeof allRides !== 'undefined' ? allRides : []).filter(r => {
        if (r.type !== 'ride' || !r.rideDate) return false;
        const rideDate = r.rideDate.toDate ? r.rideDate.toDate() : new Date(r.rideDate.seconds * 1000);
        return rideDate >= startDate && rideDate <= endDate;
    });
    
    const rangeExpenses = (typeof allRides !== 'undefined' ? allRides : []).filter(r => {
        if (r.type !== 'expense' || !r.rideDate) return false;
        const expenseDate = r.rideDate.toDate ? r.rideDate.toDate() : new Date(r.rideDate.seconds * 1000);
        return expenseDate >= startDate && expenseDate <= endDate;
    });
    
    // חישובי סיכום
    const totalIncome = rangeRides.reduce((sum, r) => sum + (r.price || 0), 0);
    const totalNet = rangeRides.reduce((sum, r) => sum + ((r.price || 0) - (r.commission || 0)), 0);
    const totalExpenses = rangeExpenses.reduce((sum, r) => sum + Math.abs(r.price || 0), 0);
    const finalNet = totalNet - totalExpenses;
    
    // חישוב ימי פעילות
    const startTime = startDate.getTime();
    const endTime = endDate.getTime();
    const totalDays = Math.ceil((endTime - startTime) / (1000 * 60 * 60 * 24)) + 1;
    
    // חישוב ימי עבודה בפועל (ימים עם נסיעות)
    const workingDays = new Set(rangeRides.map(r => {
        const date = r.rideDate.toDate ? r.rideDate.toDate() : new Date(r.rideDate.seconds * 1000);
        return date.toDateString();
    })).size;
    
    // פורמט תאריכים להצגה
    const startFormatted = startDate.toLocaleDateString('he-IL');
    const endFormatted = endDate.toLocaleDateString('he-IL');
    
    // בדיקות מיוחדות לתצוגה משופרת
    const isFullMonth = startDate.getDate() === 1 && 
                       endDate.getDate() === new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0).getDate();
    
    let periodDescription;
    if (isFullMonth && startDate.getMonth() === endDate.getMonth()) {
        periodDescription = `${this.getMonthName(startDate.getMonth())} ${startDate.getFullYear()}`;
    } else {
        periodDescription = `${startFormatted} עד ${endFormatted}`;
    }
    
    const stats = {
        'נסיעות': { value: rangeRides.length, icon: 'fa-taxi', note: `ב-${workingDays} ימי עבודה` },
        'ברוטו': { value: `₪${totalIncome.toFixed(2)}`, icon: 'fa-wallet' },
        'נטו מנסיעות': { value: `₪${totalNet.toFixed(2)}`, icon: 'fa-money-bill-wave' },
        'הוצאות': { value: `₪${totalExpenses.toFixed(2)}`, icon: 'fa-receipt', color: 'text-red-500' },
        'נטו סופי': { value: `₪${finalNet.toFixed(2)}`, icon: 'fa-gem', color: 'text-green-600 dark:text-green-400', isLarge: true },
    };

    const statsHtml = Object.entries(stats).map(([key, { value, icon, note, color, isLarge }]) => `
        <div class="flex items-center p-2 rounded-lg ${isLarge ? 'col-span-2 bg-green-50 dark:bg-green-500/10' : 'bg-gray-50 dark:bg-white/5'}">
            <i class="fas ${icon} fa-fw w-5 text-center opacity-70"></i>
            <div class="flex-1 ml-2">
                <div class="text-xs opacity-80">${key}</div>
                <div class="font-bold ${color || ''} ${isLarge ? 'text-xl' : 'text-base'}">${value}</div>
            </div>
            ${note ? `<div class="text-xs opacity-60">${note}</div>` : ''}
        </div>
    `).join('');

    this.addMessage(`
        <p class="font-bold mb-3">📊 סיכום התקופה ${periodDescription}:</p>
        <div class="grid grid-cols-2 gap-2">${statsHtml}</div>
    `);
}

// פונקציית עזר לשמות חודשים
getMonthName(monthIndex) {
    const months = [
        'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
        'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
    ];
    return months[monthIndex] || '';
}

// הוסף פונקציות עזר חדשות:
showDayStats(date) {
    const rides = typeof allRides !== 'undefined' ? allRides : [];
    const todayRides = rides.filter(r => {
        if (r.type !== 'ride' || !r.rideDate) return false;
        const rideDate = r.rideDate.toDate ? r.rideDate.toDate() : new Date(r.rideDate.seconds * 1000);
        return rideDate.toDateString() === date.toDateString();
    });
    
    const todayExpenses = rides.filter(r => {
        if (r.type !== 'expense' || !r.rideDate) return false;
        const expenseDate = r.rideDate.toDate ? r.rideDate.toDate() : new Date(r.rideDate.seconds * 1000);
        return expenseDate.toDateString() === date.toDateString();
    });
    
    const todayIncome = todayRides.reduce((sum, r) => sum + (r.price || 0), 0);
    const todayNet = todayRides.reduce((sum, r) => sum + ((r.price || 0) - (r.commission || 0)), 0);
    const todayExpensesSum = todayExpenses.reduce((sum, r) => sum + Math.abs(r.price || 0), 0);
    const finalNet = todayNet - todayExpensesSum;

    const stats = {
        'נסיעות': { value: todayRides.length, icon: 'fa-taxi' },
        'ברוטו': { value: `₪${todayIncome.toFixed(2)}`, icon: 'fa-wallet' },
        'הוצאות': { value: `₪${todayExpensesSum.toFixed(2)}`, icon: 'fa-receipt', color: 'text-red-500' },
        'נטו סופי': { value: `₪${finalNet.toFixed(2)}`, icon: 'fa-gem', color: 'text-green-600 dark:text-green-400', isLarge: true },
    };

    const statsHtml = Object.entries(stats).map(([key, { value, icon, color, isLarge }]) => `
        <div class="flex items-center p-2 rounded-lg ${isLarge ? 'col-span-2 bg-green-50 dark:bg-green-500/10' : 'bg-gray-50 dark:bg-white/5'}">
            <i class="fas ${icon} fa-fw w-5 text-center opacity-70"></i>
            <div class="flex-1 ml-2">
                <div class="text-xs opacity-80">${key}</div>
                <div class="font-bold ${color || ''} ${isLarge ? 'text-xl' : 'text-base'}">${value}</div>
            </div>
        </div>
    `).join('');
    
    this.addMessage(`
        <p class="font-bold mb-3">📊 סיכום ${date.toLocaleDateString('he-IL')}:</p>
        <div class="grid grid-cols-2 gap-2">${statsHtml}</div>
    `);
}

showMonthStats(date) {
    const rides = typeof allRides !== 'undefined' ? allRides : [];
    const monthRides = rides.filter(r => {
        if (r.type !== 'ride' || !r.rideDate) return false;
        const rideDate = r.rideDate.toDate ? r.rideDate.toDate() : new Date(r.rideDate.seconds * 1000);
        return rideDate.getMonth() === date.getMonth() && rideDate.getFullYear() === date.getFullYear();
    });
    
    const monthExpenses = rides.filter(r => {
        if (r.type !== 'expense' || !r.rideDate) return false;
        const expenseDate = r.rideDate.toDate ? r.rideDate.toDate() : new Date(r.rideDate.seconds * 1000);
        return expenseDate.getMonth() === date.getMonth() && expenseDate.getFullYear() === date.getFullYear();
    });
    
    const monthIncome = monthRides.reduce((sum, r) => sum + (r.price || 0), 0);
    const monthNet = monthRides.reduce((sum, r) => sum + ((r.price || 0) - (r.commission || 0)), 0);
    const monthExpensesSum = monthExpenses.reduce((sum, r) => sum + Math.abs(r.price || 0), 0);
    const finalNet = monthNet - monthExpensesSum;
    
    const monthName = date.toLocaleDateString('he-IL', { year: 'numeric', month: 'long' });

    const stats = {
        'נסיעות': { value: monthRides.length, icon: 'fa-taxi' },
        'ברוטו': { value: `₪${monthIncome.toFixed(2)}`, icon: 'fa-wallet' },
        'הוצאות': { value: `₪${monthExpensesSum.toFixed(2)}`, icon: 'fa-receipt', color: 'text-red-500' },
        'נטו סופי': { value: `₪${finalNet.toFixed(2)}`, icon: 'fa-gem', color: 'text-green-600 dark:text-green-400', isLarge: true },
    };
     const statsHtml = Object.entries(stats).map(([key, { value, icon, color, isLarge }]) => `
        <div class="flex items-center p-2 rounded-lg ${isLarge ? 'col-span-2 bg-green-50 dark:bg-green-500/10' : 'bg-gray-50 dark:bg-white/5'}">
            <i class="fas ${icon} fa-fw w-5 text-center opacity-70"></i>
            <div class="flex-1 ml-2">
                <div class="text-xs opacity-80">${key}</div>
                <div class="font-bold ${color || ''} ${isLarge ? 'text-xl' : 'text-base'}">${value}</div>
            </div>
        </div>
    `).join('');
    
    this.addMessage(`
        <p class="font-bold mb-3">📊 סיכום ${monthName}:</p>
        <div class="grid grid-cols-2 gap-2">${statsHtml}</div>
    `);
}

showAllTimeStats() {
    const rides = typeof allRides !== 'undefined' ? allRides : [];
    const allTimeRides = rides.filter(r => r.type === 'ride');
    const allTimeExpenses = rides.filter(r => r.type === 'expense');
    
    const totalIncome = allTimeRides.reduce((sum, r) => sum + (r.price || 0), 0);
    const totalNet = allTimeRides.reduce((sum, r) => sum + ((r.price || 0) - (r.commission || 0)), 0);
    const totalExpenses = allTimeExpenses.reduce((sum, r) => sum + Math.abs(r.price || 0), 0);
    const finalNet = totalNet - totalExpenses;
    
    const dates = allTimeRides.map(r => r.rideDate?.toDate ? r.rideDate.toDate() : new Date(r.rideDate?.seconds * 1000)).sort();
    const firstDate = dates[0];
    const lastDate = dates[dates.length - 1];
    const activeDays = firstDate && lastDate ? Math.ceil((lastDate - firstDate) / (1000 * 60 * 60 * 24)) + 1 : 0;
    
     const stats = {
        'נסיעות': { value: allTimeRides.length, icon: 'fa-taxi', note: `ב-${activeDays} ימים` },
        'ברוטו': { value: `₪${totalIncome.toFixed(2)}`, icon: 'fa-wallet' },
        'הוצאות': { value: `₪${totalExpenses.toFixed(2)}`, icon: 'fa-receipt', color: 'text-red-500' },
        'נטו סופי': { value: `₪${finalNet.toFixed(2)}`, icon: 'fa-gem', color: 'text-green-600 dark:text-green-400', isLarge: true },
    };
     const statsHtml = Object.entries(stats).map(([key, { value, icon, note, color, isLarge }]) => `
        <div class="flex items-center p-2 rounded-lg ${isLarge ? 'col-span-2 bg-green-50 dark:bg-green-500/10' : 'bg-gray-50 dark:bg-white/5'}">
            <i class="fas ${icon} fa-fw w-5 text-center opacity-70"></i>
            <div class="flex-1 ml-2">
                <div class="text-xs opacity-80">${key}</div>
                <div class="font-bold ${color || ''} ${isLarge ? 'text-xl' : 'text-base'}">${value}</div>
            </div>
            ${note ? `<div class="text-xs opacity-60">${note}</div>` : ''}
        </div>
    `).join('');

    this.addMessage(`
        <p class="font-bold mb-3">🏆 סיכום כל הזמנים:</p>
        <div class="grid grid-cols-2 gap-2">${statsHtml}</div>
    `);
}

showYearStats(year) {
    const rides = typeof allRides !== 'undefined' ? allRides : [];
    const yearRides = rides.filter(r => {
        if (r.type !== 'ride' || !r.rideDate) return false;
        const rideDate = r.rideDate.toDate ? r.rideDate.toDate() : new Date(r.rideDate.seconds * 1000);
        return rideDate.getFullYear() === year;
    });
    
    const yearExpenses = rides.filter(r => {
        if (r.type !== 'expense' || !r.rideDate) return false;
        const expenseDate = r.rideDate.toDate ? r.rideDate.toDate() : new Date(r.rideDate.seconds * 1000);
        return expenseDate.getFullYear() === year;
    });
    
    const yearIncome = yearRides.reduce((sum, r) => sum + (r.price || 0), 0);
    const yearNet = yearRides.reduce((sum, r) => sum + ((r.price || 0) - (r.commission || 0)), 0);
    const yearExpensesSum = yearExpenses.reduce((sum, r) => sum + Math.abs(r.price || 0), 0);
    const finalNet = yearNet - yearExpensesSum;
    
    const stats = {
        'נסיעות': { value: yearRides.length, icon: 'fa-taxi' },
        'ברוטו': { value: `₪${yearIncome.toFixed(2)}`, icon: 'fa-wallet' },
        'הוצאות': { value: `₪${yearExpensesSum.toFixed(2)}`, icon: 'fa-receipt', color: 'text-red-500' },
        'נטו סופי': { value: `₪${finalNet.toFixed(2)}`, icon: 'fa-gem', color: 'text-green-600 dark:text-green-400', isLarge: true },
    };
     const statsHtml = Object.entries(stats).map(([key, { value, icon, color, isLarge }]) => `
        <div class="flex items-center p-2 rounded-lg ${isLarge ? 'col-span-2 bg-green-50 dark:bg-green-500/10' : 'bg-gray-50 dark:bg-white/5'}">
            <i class="fas ${icon} fa-fw w-5 text-center opacity-70"></i>
            <div class="flex-1 ml-2">
                <div class="text-xs opacity-80">${key}</div>
                <div class="font-bold ${color || ''} ${isLarge ? 'text-xl' : 'text-base'}">${value}</div>
            </div>
        </div>
    `).join('');
    
    this.addMessage(`
        <p class="font-bold mb-3">📊 סיכום שנת ${year}:</p>
        <div class="grid grid-cols-2 gap-2">${statsHtml}</div>
    `);
}

async handleSearch(message) {
  // ================== ✨ עדכון הקשר ✨ ==================
  this.lastIntent = 'search';
  this.lastEntities = { query: message };
  // =======================================================

  const rawTerm = this.extractSearchTerm(message) || '';
  const msg = (message || '').toLowerCase();
  const rides = typeof allRides !== 'undefined' ? allRides : [];

  // טווח תאריכים
  let startDate = null, endDate = null;
  const range = this.parseDateRange(msg);
  if (range) {
    startDate = new Date(range.startDate); startDate.setHours(0,0,0,0);
    endDate = new Date(range.endDate); endDate.setHours(23,59,59,999);
  } else {
    const d = this.parseDateFromText(msg);
    if (d) {
      if (d.getDate() === 1) {
        startDate = new Date(d.getFullYear(), d.getMonth(), 1, 0,0,0,0);
        endDate = new Date(d.getFullYear(), d.getMonth()+1, 0, 23,59,59,999);
      } else {
        startDate = new Date(d); startDate.setHours(0,0,0,0);
        endDate = new Date(d); endDate.setHours(23,59,59,999);
      }
    }
  }

  // "מתחילות ב-"
  let prefixToken = null;
  const prefixMatch = msg.match(/מתחיל(?:ות)?\s*ב-?([^\s]+)/);
  if (prefixMatch) prefixToken = prefixMatch[1];

  // זיהוי "מ... ל..." מלא
  let srcToken = null, dstToken = null;
  const routeRe = /(?:^|\s)מ\s*([^\s,]+(?:\s[^\s,]+)?)\s+ל\s*([^\s,]+(?:\s[^\s,]+)?)/i;
  const rm = message.match(routeRe);
  if (rm) {
    srcToken = rm[1].trim();
    dstToken = rm[2].trim();
  } else {
    // אין מסלול – ניסיון לפיצול "Term Term"
    const tokens = rawTerm.split(/\s+/).filter(Boolean);
    if (tokens.length >= 2) {
      srcToken = tokens[0];
      dstToken = tokens[1];
    }
  }

  // דיוק כיוון כאשר אין מסלול מלא:
  // אם לא נמצא מסלול:
  let forceDestOnly = false;
  let forceSrcOnly = false;
  if (!srcToken && !dstToken) {
    // " ... לXXXX" ללא "מ" → יעד בלבד
    const loneDest = message.match(/(?:^|\s)ל([^\s]+)/);
    const loneSrc  = message.match(/(?:^|\s)מ([^\s]+)/);
    if (!rm && loneDest && !loneSrc) {
      dstToken = loneDest[1].trim();
      forceDestOnly = true;
    } else if (!rm && loneSrc && !loneDest) {
      srcToken = loneSrc[1].trim();
      forceSrcOnly = true;
    }
  }

  // בנה וריאנטים (מורחב בלבד לטוקנים קצרים/קיצורים)
  const { variants: qVariants, variantsNorm: qVariantsNorm } = this.buildQueryVariants(prefixToken ? prefixToken : rawTerm);
  const srcV = this.buildQueryVariants(srcToken);
  const dstV = this.buildQueryVariants(dstToken);

  const results = rides.filter(r => {
    if (r.type === 'expense') return false;

    // זמן
    if (startDate && endDate) {
      const d = r.rideDate?.toDate ? r.rideDate.toDate() :
                new Date(r.rideDate?.seconds ? r.rideDate.seconds * 1000 : r.rideDate);
      if (!d || d < startDate || d > endDate) return false;
    }

    const sourceRaw = r.source || '';
    const destRaw = r.destination || '';
    const phone = (r.customerPhone || '');

    // הרחבת שדות הנתונים
    const sourceExp = this.expandCityAbbreviations(sourceRaw);
    const destExp = this.expandCityAbbreviations(destRaw);

    // מועמדים להשוואה (raw+expanded)
    const sourceCandidates = [sourceRaw, sourceExp].map(s => (s || '').toLowerCase());
    const destCandidates   = [destRaw, destExp].map(s => (s || '').toLowerCase());

    // מועמדים מנורמלים
    const sourceCandidatesNorm = [sourceRaw, sourceExp].map(s => this.normalizePlaceForCompare(s));
    const destCandidatesNorm   = [destRaw, destExp].map(s => this.normalizePlaceForCompare(s));

    // "מתחילות ב-"
    if (prefixToken) {
      return (
        this.matchesCandidates(sourceCandidates, sourceCandidatesNorm, qVariants, qVariantsNorm) ||
        this.matchesCandidates(destCandidates,   destCandidatesNorm,   qVariants, qVariantsNorm)
      );
    }

    // מסלול "מ... ל..."
    if (srcV.variants.length || dstV.variants.length) {
      const sOk = !srcV.variants.length || this.matchesCandidates(sourceCandidates, sourceCandidatesNorm, srcV.variants, srcV.variantsNorm);
      const dOk = !dstV.variants.length || this.matchesCandidates(destCandidates, destCandidatesNorm, dstV.variants, dstV.variantsNorm);
      // אם יש מסלול מלא – נדרוש שניהם. אם יש רק צד אחד – נתחשב בכפייה לפי ל/מ.
      if (srcV.variants.length && dstV.variants.length) return sOk && dOk;
      if (srcV.variants.length && !dstV.variants.length) return sOk; // מקור בלבד
      if (!srcV.variants.length && dstV.variants.length) return dOk; // יעד בלבד
      return sOk && dOk;
    }

    // כפייה לפי ל/מ ללא מסלול
    if (forceDestOnly && dstV.variants.length) {
      return this.matchesCandidates(destCandidates, destCandidatesNorm, dstV.variants, dstV.variantsNorm);
    }
    if (forceSrcOnly && srcV.variants.length) {
      return this.matchesCandidates(sourceCandidates, sourceCandidatesNorm, srcV.variants, srcV.variantsNorm);
    }

    // חיפוש כללי (אם אין כלום אחר)
    if (!qVariants.length) return false;

    const foundByText =
      this.matchesCandidates(sourceCandidates, sourceCandidatesNorm, qVariants, qVariantsNorm) ||
      this.matchesCandidates(destCandidates,   destCandidatesNorm,   qVariants, qVariantsNorm) ||
      qVariants.some(q => phone.includes(q.toLowerCase()));

    return foundByText;
  });

  if (results.length === 0) {
    this.addMessage(
      `😕 לא נמצאו נסיעות${startDate ? ` בטווח ${startDate.toLocaleDateString('he-IL')}–${endDate.toLocaleDateString('he-IL')}` : ''}` +
      `${(srcV.variants.length || dstV.variants.length) ? ` עבור ${srcToken || ''}${dstToken ? ` → ${dstToken}` : ''}` : (rawTerm ? ` עבור "${rawTerm}"` : '')}`
    );
    return;
  }

  // שמור להצגת "הצג הכל"
  this.lastSearchResults = results;

  const top = results.slice(0, 5);
  let title = `🔍 מצאתי ${results.length} נסיעות`;
  if (startDate && endDate) {
    title += ` (${startDate.toLocaleDateString('he-IL')}–${endDate.toLocaleDateString('he-IL')})`;
  }

  const resultsHtml = top.map(r => {
    const d = r.rideDate?.toDate ? r.rideDate.toDate() :
              new Date(r.rideDate?.seconds ? r.rideDate.seconds * 1000 : r.rideDate);
    return `
        <div class="flex items-center gap-3 p-2.5 bg-gray-50 dark:bg-white/5 rounded-lg">
            <div class="flex-1">
                <div class="font-semibold">${escapeHTML(r.source)} → ${escapeHTML(r.destination)}</div>
                <div class="text-xs opacity-70 mt-1">
                    <span>${d ? d.toLocaleDateString('he-IL') : 'אין תאריך'}</span>
                    <span class="mx-1.5">•</span>
                    <span class="font-mono">₪${(r.price || 0).toFixed(2)}</span>
                </div>
            </div>
        </div>
    `;
  }).join('');

  let footer = '';
  if (results.length > 5) {
    footer = `<p class="text-xs text-center opacity-80 mt-2">... ועוד ${results.length - 5} תוצאות</p>`;
  }

  const buttons = createActionButtons([
      { onclick: `driverChatBot.openFullSearchResults()`, text: '📑 הצג הכל במודל', icon: 'fas fa-th-list', type: 'primary' }
  ]);

  this.addMessage(`
    <p class="font-bold mb-3">${title}:</p>
    <div class="space-y-2">${resultsHtml}</div>
    ${footer}
  `, 'bot', buttons);
}

    handleGeneralQuery(message) {
        const responses = [
            "🤔 לא בטוח שהבנתי. תוכל לנסות:<br>• 'הוסף נסיעה'<br>• 'כמה הרווחתי היום?'<br>• 'חפש נסיעות לחיפה'",
            "💡 אתה יכול לבקש ממני:<br>• להוסיף נסיעה או הוצאה<br>• לקבל סטטיסטיקות<br>• לחפש נסיעות<br>• לענות על שאלות כלליות",
            "🎯 נסה להיות יותר ספציפי. למשל:<br>• 'רשום נסיעה לתל אביב 100 שקל'<br>• 'הצג לי הכנסות השבוע'<br>• 'מצא נסיעות מירושלים'"
        ];
        
        const randomResponse = responses[Math.floor(Math.random() * responses.length)];
        this.addMessage(randomResponse);
    }

// עדכן את handleQuickAction (בערך שורה 1240):
handleQuickAction(action) {
    switch (action) {
        case 'add-ride':
            this.addMessage('אתה יכול להוסיף נסיעה באופן הבא:<br><br>"הוסף נסיעה מ[מקור] ל[יעד] [מחיר] שקל"<br><br>דוגמה: "נסיעה מתל אביב לחיפה 150 שקל ביט"');
            break;
        case 'add-expense':
            this.addMessage('אתה יכול להוסיף הוצאה באופן הבא:<br><br>"הוסף הוצאה [סוג] [סכום] שקל"<br><br>דוגמה: "הוצאה דלק 200 שקל"');
            break;
        case 'monthly-expense':
            this.addMessage('הוסף הוצאה חודשית קבועה:<br><br>"הוצאה [סוג] [סכום] שקל חודשית"<br><br>דוגמה: "הוצאה ביטוח 350 שקל חודשית"');
            break;
        case 'daily-stats':
            this.handleStats('כמה הרווחתי היום?');
            break;
        case 'monthly-stats':
            this.handleStats('סיכום החודש');
            break;
        case 'alltime-stats':
            this.handleStats('סיכום כל הזמנים');
            break;
        case 'search':
            this.addMessage('מה תרצה לחפש?<br><br>דוגמאות:<br>• "חפש נסיעות לחיפה"<br>• "מצא נסיעות מהשבוע"<br>• "הצג נסיעות עם מספר 052..."<br><br>📊 **סיכומים מתקדמים:**<br>• "סיכום מרץ 2024"<br>• "סיכום מינואר עד מרץ"<br>• "סיכום מ15/01 עד 20/02"');
            break;
    }
    
    document.getElementById('chatInput').focus();
}

    // Parsing Methods

parseRideFromMessage(message) {
// אם אין רמזים לנסיעה – אל תנתח כנסיעה
if (!this.containsRideCues(message)) {
    return {};
}

// 1) נסה פורמט קבוע
const fixedFormatData = this.parseFixedFormatRide(message);
if (fixedFormatData.source && fixedFormatData.destination) {
    return fixedFormatData;
}

// 2) נסה פרשנות מתקדמת
const advancedData = this.parseAdvancedRideFormat(message);
if (advancedData.source && advancedData.destination && (advancedData.price || (advancedData.payments && advancedData.payments.length))) {
    return advancedData;
}

// 3) נפילה אחרונה ל-NLU
const nluData = this.nlu.parseRide(message);

// תאימות לאחור: בנה payments יחיד אם אין פירוט מפוצל
if ((!nluData.payments || nluData.payments.length === 0) && nluData.paymentMethod && nluData.price) {
    nluData.payments = [{ method: nluData.paymentMethod, amount: nluData.price, note: nluData.noteDetails || '' }];
}

return nluData;
}

// השלם/החלף את הפונקציה הקיימת:
parseExpenseFromMessage(message) {
  // ננסה קודם את ה-NLU שכבר בנית
  const parsed = this.nlu?.parseExpense ? this.nlu.parseExpense(message) : {};

  let type = parsed.type || 'הוצאה כללית';
  let amount = parsed.amount || 0;
  let note = parsed.note || '';
  let isRecurring = !!parsed.isRecurring;

  // אם לא זוהה סכום – נסה תבניות רחבות: ₪, שח/ש"ח, או מספר לבד
  if (!amount || amount <= 0) {
    const text = String(message || '');

    // 150 ₪ | ₪ 150 | 150 ש"ח | 150 שח | 150 שקל/שקלים | גם עשרוניים עם פסיק/נקודה
    const amtRe = /(?:₪\s*)?(\d{1,3}(?:[.,]\d{3})*|\d+)(?:[.,]\d+)?(?:\s*(?:₪|שח|ש״ח|ש"ח|שקל(?:ים)?))?/i;
    const m = text.match(amtRe);
    if (m) {
      const raw = m[1].replace(/[.,](?=\d{3}\b)/g, ''); // הסר מפרידי אלפים
      amount = parseFloat(raw.replace(',', '.')) || 0;
    }
  }

  // זיהוי חודשי/קבוע
  if (!isRecurring) {
    isRecurring = /(חודשית|קבועה|כל\s*חודש|מידי\s*חודש)/.test(message);
  }

  // אם אין הערה – נסה לנקות טקסט לתוך הערה
  if (!note) {
    note = String(message || '')
      .replace(/הוצאה|דלק|ביטוח|מוסך|רישוי|בדיקה/gi, '')
      .replace(/₪|\bשח\b|ש״ח|ש"ח|שקל(?:ים)?/gi, '')
      .replace(/\d{1,3}(?:[.,]\d{3})*|\d+(?:[.,]\d+)?/g, '')
      .replace(/חודשית|קבועה|כל\s*חודש|מידי\s*חודש/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  return { type, amount, note, isRecurring };
}


   extractSearchTerm(message) {
  // מסיר רק מילות חיפוש בתחילת המשפט, בלי למחוק ל/מ בתוך מילים
  let q = (message || '').trim();

  // הסר פקודות מובילות
  q = q.replace(/^(חפש|מצא|הצג)\s*/g, '');

  // הסר את המילה "נסיעות"/"נסיעה" אם מופיעה בהתחלה
  q = q.replace(/^(נסיעות|נסיעה)\s*/g, '');

  // אם נשארה תחילית ל/מ בתחילת השאילתה – הסר רק את התחילית הראשונה
  q = q.replace(/^[למ][-\s]?/, '');

  // נרמול רווחים
  q = q.replace(/\s+/g, ' ').trim();

  return q || null;
}

    // Confirmation methods
async confirmAddRide(rideData) {
  // אם אין גישה ל-Firebase, פשוט נדפיס לקונסול
  if (typeof firebaseModules === 'undefined' || typeof ridesCollectionRef === 'undefined') {
      console.log("DEMO: Adding ride with data:", rideData);
      this.addMessage(`✅ (הדגמה) הנסיעה נשמרה!<br>• ${rideData.source} → ${rideData.destination}`);
      return;
  }
  try {
    // בנה מערך payments
    let payments = [];
    if (rideData.payments?.length) {
      payments = rideData.payments.map(p => ({
        method: p.method,
        amount: Number(p.amount) || 0,
        note: p.method === 'פתק' ? (p.note || rideData.noteDetails || '') : (p.note || '')
      }));
    } else if (rideData.paymentMethod && rideData.price) {
      payments = [{
        method: rideData.paymentMethod,
        amount: rideData.price,
        note: rideData.paymentMethod === 'פתק' ? (rideData.noteDetails || '') : ''
      }];
    }

    const price = rideData.price || payments.reduce((s,p)=>s+(p.amount||0),0);
    const formData = {
      source: rideData.source,
      destination: rideData.destination,
      price: price,
      commission: rideData.commission != null ? rideData.commission : +(price*0.12).toFixed(2),
      customerPhone: rideData.phone || '',
      payment: payments,
      rideDate: firebaseModules.Timestamp.fromDate(rideData.date || new Date()),
      createdAt: firebaseModules.serverTimestamp()
    };

    await firebaseModules.addDoc(ridesCollectionRef, formData);

    this.addMessage(`✅ הנסיעה נשמרה!<br>• ${escapeHTML(rideData.source)} → ${escapeHTML(rideData.destination)}<br>• ברוטו: ₪${price.toFixed(2)} | נטו: ₪${(price - formData.commission).toFixed(2)}`);

    if (typeof initializeAppData === 'function') await initializeAppData();
  } catch (error) {
    console.error(error);
    this.addMessage('❌ שגיאה בהוספת הנסיעה. נסה שוב.');
  }
}

    async confirmAddExpense(expenseData) {
        // אם אין גישה ל-Firebase, פשוט נדפיס לקונסול
        if (typeof firebaseModules === 'undefined' || typeof db === 'undefined' || typeof appId === 'undefined' || typeof userId === 'undefined') {
            console.log("DEMO: Adding expense with data:", expenseData);
            this.addMessage(`✅ (הדגמה) ההוצאה נוספה!`);
            return;
        }
        try {
            if (expenseData.isRecurring) {
                // Add recurring expense
                const recurringRef = await firebaseModules.addDoc(
                    firebaseModules.collection(db, `artifacts/${appId}/users/${userId}/recurringExpenses`),
                    {
                        type: expenseData.type,
                        amount: expenseData.amount,
                        note: expenseData.note || '',
                        startDate: firebaseModules.Timestamp.fromDate(new Date()),
                        createdAt: firebaseModules.serverTimestamp(),
                        lastProcessed: null
                    }
                );
                
                // Create first instance
                await firebaseModules.addDoc(
                    firebaseModules.collection(db, `artifacts/${appId}/users/${userId}/expenses`),
                    {
                        type: expenseData.type,
                        amount: expenseData.amount,
                        note: `${expenseData.note || ''} (הוצאה חודשית)`,
                        expenseDate: firebaseModules.Timestamp.fromDate(new Date()),
                        isFromRecurring: true,
                        recurringId: recurringRef.id,
                        createdAt: firebaseModules.serverTimestamp()
                    }
                );
            } else {
                // Add regular expense
                await firebaseModules.addDoc(
                    firebaseModules.collection(db, `artifacts/${appId}/users/${userId}/expenses`),
                    {
                        type: expenseData.type,
                        amount: expenseData.amount,
                        note: expenseData.note || '',
                        expenseDate: firebaseModules.Timestamp.fromDate(new Date()),
                        createdAt: firebaseModules.serverTimestamp()
                    }
                );
            }
            
            this.addMessage(`✅ ההוצאה נוספה בהצלחה!<br><br>${expenseData.isRecurring ? '🔄 ההוצאה תחזור אוטומטית כל חודש.' : '📅 הוצאה חד פעמית נרשמה.'}<br><br>🎉 המערכת עודכנה אוטומטית.`);
            
            // Refresh data
            if (typeof initializeAppData === 'function') await initializeAppData();
            
        } catch (error) {
            this.addMessage('❌ שגיאה בהוספת ההוצאה. נסה שוב או השתמש בטופס הרגיל.');
            console.error('Error adding expense:', error);
        }
    }
}

// פונקציית אתחול שנקרא לה מבחוץ
function initializeDynamicChatbot() {
if (typeof DriverChatBot !== 'undefined' && !window.driverChatBot) {
window.driverChatBot = new DriverChatBot();
console.log("Chatbot initialized dynamically!");
}
}