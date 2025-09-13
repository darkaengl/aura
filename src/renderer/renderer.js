import {
    initializeAccessibility
} from '../ui/accessibility.js';
import {
    getTextExtractionScript
} from '../shared/text-extraction.js';
import {
    createSimplificationPrompt,
    splitTextIntoChunks,
    validateOptions,
    estimateProcessingTime
} from '../shared/simplification-prompts.js';
import {
    marked
} from '../../node_modules/marked/lib/marked.esm.js'; // Import marked library
import {
    initializeNavigatorFeatures
} from '../navigator/navigator.js';
import {
    initializePdfHandler
} from '../langhelp/pdfHandler.js';
import {
    showStatus,
    clearStatus,
    copyToClipboard
} from '../shared/utils.js';
import {
    processTextWithOllama
} from '../langhelp/ollamaHandler.js';
import {
    setProcessingState,
    extractPageText,
    updateTextDisplay,
    extractText,
    simplifyText,
    replacePageTextWithSimplified,
    refreshSimplification,
    simplifyParagraphsInPlace
} from '../langhelp/textSimplification.js';

window.onload = async () => {
    const urlInput = document.getElementById('url-input');
    const backBtn = document.getElementById('back-btn');
    const forwardBtn = document.getElementById('forward-btn');
    const refreshBtn = document.getElementById('refresh-btn');
    const browserLogo = document.getElementById('browser-logo'); // New Browser Logo
    const webview = document.getElementById('webview');
    const wcagBtn = document.getElementById('wcag-btn');
    const accessibilityReport = document.getElementById('accessibility-report');
    const reportDetails = document.getElementById('report-details');
    const closeReportBtn = document.getElementById('close-report-btn');
    const downloadReportBtn = document.getElementById('download-report-btn');
    const simplifyBtn = document.getElementById('simplify-btn');

    // Text Simplification Elements
    const simplifyTextBtn = document.getElementById('simplify-text-btn');
    const textSimplificationSidebar = document.getElementById('text-simplification-sidebar');
    const closeSimplificationBtn = document.getElementById('close-simplification-btn');
    const complexitySelect = document.getElementById('complexity-select');
    const simplificationStatus = document.getElementById('simplification-status');
    const originalTextDisplay = document.getElementById('original-text-display');
    const simplifiedTextDisplay = document.getElementById('simplified-text-display');
    const originalWordCount = document.getElementById('original-word-count');
    const simplifiedWordCount = document.getElementById('simplified-word-count');
    const wordReduction = document.getElementById('word-reduction');
    const copySimplifiedText = document.getElementById('copy-simplified-text');
    const replacePageText = document.getElementById('replace-page-text');
    const refreshSimplificationBtn = document.getElementById('refresh-simplification-btn');
    const simplifyParagraphsInPlaceBtn = document.getElementById('simplify-paragraphs-in-place-btn');

    // Tab elements
    const originalTextTabBtn = document.getElementById('original-text-tab-btn');
    const simplifiedTextTabBtn = document.getElementById('simplified-text-tab-btn');
    const originalTextTabContent = document.getElementById('original-text-tab-content');
    const simplifiedTextTabContent = document.getElementById('simplified-text-tab-content');

    // Function to switch tabs
    const switchTab = (tabId) => {
        // Deactivate all tab buttons and content
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

        // Activate the selected tab button and content
        document.getElementById(`${tabId}-tab-btn`).classList.add('active');
        document.getElementById(`${tabId}-tab-content`).classList.add('active');
    };

    // Event listeners for tab buttons
    originalTextTabBtn.addEventListener('click', () => switchTab('original-text'));
    simplifiedTextTabBtn.addEventListener('click', () => switchTab('simplified-text'));

    // PDF Upload Elements
    const uploadPdfBtn = document.getElementById('upload-pdf-btn');
    const pdfUploadInput = document.getElementById('pdf-upload-input');

    const simplifyPageBtn = document.getElementById('simplify-page-btn');
    const moreSimplificationOptionsBtn = document.getElementById('more-simplification-options-btn');
    const moreSimplificationOptions = document.getElementById('more-simplification-options');
    const useOpenAICheckbox = document.getElementById('use-openai-checkbox');

    // Chat interface elements (from aura)
    const micBtn = document.getElementById('mic-btn');
    const chatContainer = document.getElementById('chat-container');
    const closeChatBtn = document.getElementById('close-chat-btn');
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const chatSendBtn = document.getElementById('chat-send-btn');
    const micChatBtn = document.getElementById('mic-chat-btn');

    // Initialize voice and text navigator features
    initializeNavigatorFeatures(webview, chatInput, chatMessages, micChatBtn, micBtn,
        chatContainer, closeChatBtn, chatSendBtn);

    // Initialize accessibility features
    initializeAccessibility({
        wcagBtn,
        accessibilityReport,
        reportDetails,
        closeReportBtn,
        downloadReportBtn
    }, webview);

    let latestRequestId = 0;
    const latestRequestIdRef = {
        current: 0
    };

    let currentTextDataRef = {
        current: null
    };
    let isProcessingRef = {
        current: false
    };
    let pageContentStateRef = {
        current: []
    }; // Stores { originalHtml, simplifiedHtml, element }
    let isPageSimplifiedRef = {
        current: false
    };

    // Initialize PDF handling
    initializePdfHandler({
        uploadPdfBtn,
        pdfUploadInput,
        simplificationStatus,
        processTextWithOllama: (textData, options, requestId) => processTextWithOllama(textData,
            options, requestId, {
                latestRequestIdRef,
                simplificationStatus,
                simplifiedTextDisplay,
                simplifiedWordCount,
                wordReduction
            }),
        updateTextDisplay: (textData, simplificationResult) => updateTextDisplay(textData,
            simplificationResult, {
                originalTextDisplay,
                originalWordCount,
                simplifiedTextDisplay,
                simplifiedWordCount,
                wordReduction,
                copySimplifiedText,
                replacePageText
            }),
        setProcessingState: (processing) => setProcessingState(processing, {
            simplifyPageBtn,
            simplifyTextBtn
        }),
        originalTextDisplay,
        simplifiedTextDisplay,
        originalWordCount,
        simplifiedWordCount,
        wordReduction,
        complexitySelect,
        latestRequestId: latestRequestIdRef.current,
        currentTextData: currentTextDataRef.current,
    });



    /**
     * Navigates the webview to the URL in the input field.
     */
    const navigate = () => {
        let url = urlInput.value.trim();
        if (url) {
            // Prepend 'https://' if the protocol is missing
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                url = 'https://' + url;
            }
            webview.src = url;
        }
    };

    backBtn.addEventListener('click', () => {
        webview.goBack();
    });

    forwardBtn.addEventListener('click', () => {
        webview.goForward();
    });

    refreshBtn.addEventListener('click', () => {
        webview.reload();
    });

    browserLogo.addEventListener('click', () => {
        window.location.href = 'homepage.html'; // Navigate to homepage.html when logo is clicked
    });

    // Handle navigation from main process (e.g., from homepage links)
    window.electronAPI.onNavigateWebview((url) => {
        webview.src = url;
        urlInput.value = url; // Update URL input as well
    });



    // Add event listener for the 'Enter' key press in the input field
    urlInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            navigate();
        }
    });

    // Update the URL input when the webview navigates
    webview.addEventListener('did-navigate', () => {
        urlInput.value = webview.getURL();
    });

    
    const simplificationDeps = {
        isProcessingRef,
        latestRequestIdRef,
        setProcessingState,
        clearStatus,
        extractPageText,
        currentTextDataRef,
        originalTextDisplay,
        originalWordCount,
        simplificationStatus,
        complexitySelect,
        processTextWithOllama,
        updateTextDisplay,
        simplifiedTextDisplay,
        simplifiedWordCount,
        wordReduction,
        copySimplifiedText,
        replacePageText,
        webview,
        simplifyPageBtn,
        simplifyTextBtn,
        isPageSimplifiedRef,
        pageContentStateRef,
        textSimplificationSidebar,
        closeSimplificationBtn,
        refreshSimplificationBtn,
        simplifyParagraphsInPlaceBtn, // New dependency
        useOpenAI: useOpenAICheckbox.checked
    };

    simplifyTextBtn.addEventListener('click', () => {
        textSimplificationSidebar.classList.add('open');
        document.body.classList.add('sidebar-open');
    });

    closeSimplificationBtn.addEventListener('click', () => {
        textSimplificationSidebar.classList.remove('open');
        document.body.classList.remove('sidebar-open');
    });

    simplifyPageBtn.addEventListener('click', async () => {
        if (isProcessingRef.current) return;
        setProcessingState(true, simplificationDeps);
        clearStatus(simplificationStatus);
        try {
            await extractText(simplificationDeps);
            await simplifyText(simplificationDeps);
        } catch (error) {
            console.error('Error during simplification process:', error);
            showStatus(simplificationStatus, 'Error during simplification.', 'error');
        }
        setProcessingState(false, simplificationDeps);
    });

    moreSimplificationOptionsBtn.addEventListener('click', () => {
        moreSimplificationOptions.classList.toggle('hidden-options');
    });

    copySimplifiedText.addEventListener('click', () => copyToClipboard(simplifiedTextDisplay.textContent));

    replacePageText.addEventListener('click', () => replacePageTextWithSimplified(simplificationDeps));

    refreshSimplificationBtn.addEventListener('click', () => refreshSimplification(simplificationDeps));

    simplifyParagraphsInPlaceBtn.addEventListener('click', () => simplifyParagraphsInPlace(simplificationDeps));
    // Call the Ollama model to read and simplify the CSS of the current page
    // TODO: prompt engineering for improved output
    simplifyBtn.addEventListener('click', () => {
        let newCSS = webview.executeJavaScript(`
      Array.from(document.styleSheets)
        .map(sheet => {
          try {
            return Array.from(sheet.cssRules).map(rule => rule.cssText).join('\n');
          } catch (e) {
            // Skip CORS-protected sheets
            return '';
          }
        })
        .filter(text => text.length)
        .join('\n')
      `).then(async cssText => {
            const messages = [{
                role: 'user',
                content: 'Respond only with valid CSS contained within triple backticks (e.g: ``` CSS_HERE ```). Optimise the following CSS, making the resulting page simplified and more readable. CSS: ' +
                    cssText
            }];

            let llmResponse = await window.ollamaAPI.chat(messages);
            const escaped = llmResponse.split("```")[1].slice(4)
                .replace(/\\/g, '\\') // escape backslashes
                .replace(/`/g, '\`') // escape backticks
                .replace(/\$/g, '\$'); // escape dollar signs if using ${}

            const script = `
          (function() {
            let style = document.getElementById('dynamic-style');
            if (!style) {
              style = document.createElement('style');
              style.id = 'dynamic-style';
              document.head.appendChild(style);
            }
            style.textContent = "${escaped}";
          })();
        `;

            return webview.executeJavaScript(script);
        });
    });

}