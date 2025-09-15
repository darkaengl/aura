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