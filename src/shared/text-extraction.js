const findMainContent = () => {
    const selectors = ['article', 'main', '[role="main"]', '#main', '#content', '.post', '.entry'];
    for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
            return element;
        }
    }
    return null;
};

const extractWebpageText = (options = {}) => {
    const { 
        mode = 'full', selector = null 
    } = options;

    try {
        let targetElement;

        if (mode === 'selection') {
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                targetElement = range.commonAncestorContainer;
                if (targetElement.nodeType === 3) {
                    targetElement = targetElement.parentElement;
                }
            } else {
                return {
                    error: true,
                    message: 'No text selected'
                };
            }
        } else if (selector) {
            targetElement = document.querySelector(selector);
            if (!targetElement) {
                return {
                    error: true,
                    message: `Element not found: ${selector}`
                };
            }
        } else {
            targetElement = findMainContent() || document.body || document.documentElement;
        }

        const extractedData = extractStructuredText(targetElement, mode === 'selection');

        extractedData.title = document.title || '';
        extractedData.url = window.location.href || '';
        extractedData.extractionTime = Date.now();
        extractedData.mode = mode;

        return extractedData;

    } catch (error) {
        console.error('Text extraction error:', error);
        return {
            error: true,
            message: `Extraction failed: ${error.message}`
        };
    }
};

const extractStructuredText = (element, selectionMode = false) => {
    const elements = [];
    let fullText = '';

    const textElements = selectionMode ? [element] :
        element.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li, blockquote, article, section');

    if (textElements.length === 0) {
        const text = cleanText(element.textContent || '');
        return {
            text: text,
            wordCount: countWords(text),
            elements: [{
                type: 'paragraph',
                text: text
            }]
        };
    }

    textElements.forEach(el => {
        const text = cleanText(el.textContent || '');

        if (text.length < 10) return;

        if (isUIElement(el)) return;

        const elementType = getElementType(el);

        elements.push({
            type: elementType,
            text: text,
            level: getHeadingLevel(el)
        });

        fullText += text + ' ';
    });

    if (elements.length === 0) {
        const text = cleanText(element.textContent || '');
        fullText = text;
        elements.push({
            type: 'paragraph',
            text: text
        });
    }

    return {
        text: fullText.trim(),
        wordCount: countWords(fullText),
        elements: elements
    };
};

const isUIElement = (element) => {
    const text = element.textContent || '';
    const className = element.className || '';
    const id = element.id || '';
    const role = element.getAttribute('role') || '';
    const ariaHidden = element.getAttribute('aria-hidden') || '';

    if (text.length < 20 || ariaHidden === 'true') return true;

    const computedStyle = window.getComputedStyle(element);
    if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden') {
        return true;
    }

    const uiKeywords = [
        'nav', 'menu', 'header', 'footer', 'sidebar', 'ad', 'banner', 'popup', 'cookie', 'subscribe',
        'modal', 'dialog', 'overlay', 'widget', 'form', 'search', 'button', 'icon', 'logo',
        'skip-link', 'breadcrumb', 'pagination', 'comment', 'social', 'share', 'print'
    ];
    const combined = (className + ' ' + id + ' ' + role).toLowerCase();

    if (uiKeywords.some(keyword => combined.includes(keyword))) {
        return true;
    }

    return false;
};

const getElementType = (element) => {
    const tagName = element.tagName.toLowerCase();

    if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
        return 'heading';
    } else if (tagName === 'li') {
        return 'list-item';
    } else if (tagName === 'blockquote') {
        return 'quote';
    } else if (tagName === 'p') {
        return 'paragraph';
    } else {
        const text = element.textContent || '';
        if (text.length > 200) {
            return 'paragraph';
        } else {
            return 'text';
        }
    }
};

const getHeadingLevel = (element) => {
    const tagName = element.tagName.toLowerCase();
    const match = tagName.match(/^h([1-6])$/);
    return match ? parseInt(match[1]) : undefined;
};

const cleanText = (text) => {
    return text
        .replace(/\s+/g, ' ') 
        .replace(/\n\s*\n/g, '\n') 
        .trim();
};

const countWords = (text) => {
    return text.trim() ? text.trim().split(/\s+/).length : 0;
};

export const getTextExtractionScript = () => {
    return `(function() {
        const findMainContent = ${findMainContent.toString()};
        const extractWebpageText = ${extractWebpageText.toString()};
        const extractStructuredText = ${extractStructuredText.toString()};
        const isUIElement = ${isUIElement.toString()};
        const getElementType = ${getElementType.toString()};
        const getHeadingLevel = ${getHeadingLevel.toString()};
        const cleanText = ${cleanText.toString()};
        const countWords = ${countWords.toString()};

        window.extractWebpageText = extractWebpageText;
        return 'Text extraction script loaded successfully';
    })();
`;
};