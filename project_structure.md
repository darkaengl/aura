# Aura Project Structure

## 🏗️ **Recommended Project Structure for future development**

```
aura/
├── 📁 src/
│   ├── 📁 main/                          # Main process
│   │   ├── main.js                       # Entry point
│   │   ├── 📁 services/                  # Business logic services
│   │   │   ├── speechService.js          # Google Cloud Speech integration
│   │   │   ├── openaiService.js          # OpenAI/GPT integration
│   │   │   ├── accessibilityService.js   # WCAG analysis
│   │   │   └── automationService.js      # Web automation commands
│   │   ├── 📁 handlers/                  # IPC handlers
│   │   │   ├── speechHandlers.js         # Speech-related IPC
│   │   │   ├── aiHandlers.js            # AI/chat IPC
│   │   │   ├── fileHandlers.js          # File operations
│   │   │   └── automationHandlers.js     # Automation IPC
│   │   └── 📁 utils/                     # Main process utilities
│   │       ├── logger.js                # Centralized logging
│   │       └── config.js                # Configuration management
│   │
│   ├── 📁 renderer/                      # Renderer process
│   │   ├── renderer.js                   # Main renderer entry
│   │   ├── 📁 components/                # UI components
│   │   │   ├── 📁 navigation/
│   │   │   │   ├── AddressBar.js         # Address bar component
│   │   │   │   └── NavigationButtons.js  # Back/Forward/Refresh
│   │   │   ├── 📁 speech/
│   │   │   │   ├── WakeWordDetector.js   # Wake word functionality
│   │   │   │   ├── SpeechRecorder.js     # Speech recording logic
│   │   │   │   └── VoiceIndicator.js     # Visual feedback
│   │   │   ├── 📁 chat/
│   │   │   │   ├── ChatContainer.js      # Chat UI container
│   │   │   │   ├── ChatMessage.js        # Message component
│   │   │   │   └── ChatInput.js          # Input handling
│   │   │   ├── 📁 automation/
│   │   │   │   ├── FormFiller.js         # Form filling logic
│   │   │   │   ├── CommandExecutor.js    # Command execution
│   │   │   │   └── PageAnalyzer.js       # DOM analysis
│   │   │   ├── 📁 accessibility/
│   │   │   │   ├── WCAGAnalyzer.js       # WCAG analysis UI
│   │   │   │   └── AccessibilityReport.js # Report display
│   │   │   └── 📁 floating-widget/
│   │   │       ├── FloatingWidget.js     # Main widget container
│   │   │       └── FeatureButtons.js     # Feature button components
│   │   ├── 📁 services/                  # Renderer services
│   │   │   ├── speechClient.js           # Speech API client
│   │   │   ├── aiClient.js              # AI API client
│   │   │   └── automationClient.js       # Automation API client
│   │   └── 📁 utils/                     # Renderer utilities
│   │       ├── audioProcessor.js         # Audio processing utilities
│   │       ├── domExtractor.js          # DOM extraction helpers
│   │       └── eventBus.js              # Component communication
│   │
│   ├── 📁 shared/                        # Shared code
│   │   ├── preload.js                    # Preload script
│   │   ├── 📁 constants/                 # Shared constants
│   │   │   ├── events.js                # IPC event names
│   │   │   ├── commands.js              # Automation commands
│   │   │   └── speechCommands.js        # Speech command definitions
│   │   ├── 📁 types/                    # TypeScript types (if using TS)
│   │   │   ├── speech.d.ts
│   │   │   ├── automation.d.ts
│   │   │   └── api.d.ts
│   │   └── 📁 utils/                    # Shared utilities
│   │       ├── validation.js            # Input validation
│   │       └── formatters.js            # Data formatters
│   │
│   └── 📁 webview/                      # Webview injection scripts
│       ├── contentScript.js             # Main content script
│       ├── 📁 injectors/                # Feature injectors
│       │   ├── accessibilityInjector.js # Accessibility tools
│       │   ├── formHelperInjector.js    # Form assistance
│       │   └── visualIndicatorInjector.js # Visual feedback
│       └── 📁 extractors/               # Data extractors
│           ├── domExtractor.js          # DOM structure extraction
│           └── formExtractor.js         # Form field detection
│
├── 📁 assets/                           # Static assets
│   ├── 📁 icons/                        # App icons
│   ├── 📁 images/                       # UI images
│   │   ├── 📁 brand/                    # Brand assets
│   │   └── 📁 buttons/                  # Button icons
│   ├── 📁 audio/                        # Audio assets
│   └── 📁 styles/                       # CSS files
│       ├── main.css                     # Main styles
│       ├── components.css               # Component styles
│       └── themes.css                   # Theme definitions
│
├── 📁 config/                           # Configuration files
│   ├── development.json                 # Dev config
│   ├── production.json                  # Prod config
│   └── speech-commands.json             # Speech command definitions
│
├── 📁 scripts/                          # Build and utility scripts
│   ├── build.js                         # Build script
│   ├── dev.js                          # Development script
│   └── package.js                      # Packaging script
│
├── 📁 tests/                           # Test files
│   ├── 📁 unit/                        # Unit tests
│   ├── 📁 integration/                 # Integration tests
│   └── 📁 e2e/                        # End-to-end tests
│
├── 📁 docs/                            # Documentation
│   ├── API.md                          # API documentation
│   ├── SPEECH_COMMANDS.md             # Speech command guide
│   └── AUTOMATION.md                  # Automation guide
│
├── 📁 logs/                            # Application logs
├── 📁 temp/                            # Temporary files
├── google-cloud-key.json              # Google Cloud credentials
├── package.json
├── package-lock.json
├── .env                                # Environment variables
├── .gitignore
└── README.md
```

## 🎯 **Key Improvements**

### **1. Separation of Concerns**
```javascript
// src/main/services/speechService.js
class SpeechService {
  constructor(credentials) {
    this.speechClient = new speech.SpeechClient({ keyFilename: credentials });
  }
  
  async transcribe(audioBuffer, sampleRate) {
    // Speech transcription logic
  }
  
  async startStreaming() {
    // Streaming speech logic
  }
}

// src/renderer/components/speech/WakeWordDetector.js
class WakeWordDetector {
  constructor(wakeWord = 'browser') {
    this.wakeWord = wakeWord;
    this.isActive = false;
  }
  
  start() { /* Wake word detection logic */ }
  stop() { /* Cleanup logic */ }
}
```

### **2. Event-Driven Architecture**
```javascript
// src/shared/constants/events.js
export const SPEECH_EVENTS = {
  WAKE_WORD_DETECTED: 'speech:wake-word-detected',
  TRANSCRIPTION_COMPLETE: 'speech:transcription-complete',
  RECORDING_START: 'speech:recording-start',
  RECORDING_STOP: 'speech:recording-stop'
};

// src/renderer/utils/eventBus.js
class EventBus {
  constructor() {
    this.events = {};
  }
  
  on(event, callback) { /* Event registration */ }
  emit(event, data) { /* Event emission */ }
  off(event, callback) { /* Event cleanup */ }
}
```

### **3. Configuration Management**
```javascript
// config/speech-commands.json
{
  "wakeWords": ["browser", "aura"],
  "stopCommands": [
    "stop listening",
    "stop executing commands",
    "end session"
  ],
  "continuousMode": {
    "enabled": true,
    "silenceThreshold": -50,
    "silenceDuration": 2000,
    "maxRecordingDuration": 15000
  }
}

// src/main/utils/config.js
class ConfigManager {
  static load(environment = 'development') {
    return require(`../../config/${environment}.json`);
  }
}
```

### **4. Modular Components**
```javascript
// src/renderer/components/automation/FormFiller.js
class FormFiller {
  constructor(webview, eventBus) {
    this.webview = webview;
    this.eventBus = eventBus;
    this.currentFields = [];
    this.currentIndex = 0;
  }
  
  async detectFields() { /* Form detection logic */ }
  async fillField(index, value) { /* Field filling logic */ }
  askNextQuestion() { /* User interaction logic */ }
}

// src/renderer/components/speech/SpeechRecorder.js
class SpeechRecorder {
  constructor(config, eventBus) {
    this.config = config;
    this.eventBus = eventBus;
    this.recorder = null;
    this.isRecording = false;
  }
  
  async startRecording() { /* Recording logic */ }
  async stopRecording() { /* Stop and process logic */ }
  detectSilence() { /* Silence detection logic */ }
}
```

## 🔧 **Implementation Benefits**

### **Maintainability**
- **Single Responsibility**: Each class/module has one clear purpose
- **Easy Testing**: Components can be tested in isolation
- **Clear Dependencies**: Easy to understand what depends on what

### **Scalability**
- **Plugin Architecture**: Easy to add new features as modules
- **Event System**: Loose coupling between components
- **Configuration**: Easy to modify behavior without code changes

### **Developer Experience**
- **Hot Reload**: Components can be reloaded independently
- **Debugging**: Clear separation makes debugging easier
- **Documentation**: Each module can be documented separately

### **Code Reusability**
- **Shared Utilities**: Common functions in one place
- **Component Library**: Reusable UI components
- **Service Layer**: Business logic can be reused

## 🚀 **Migration Strategy**

1. **Phase 1**: Extract services from main.js and renderer.js
2. **Phase 2**: Break down renderer.js into components
3. **Phase 3**: Implement event system and configuration
4. **Phase 4**: Add proper error handling and logging
5. **Phase 5**: Add comprehensive testing