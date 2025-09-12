// Helper: Extract visible, interactive elements for LLM context
export const extractScreenContextFromWebview = async (webview) => {
    return await webview.executeJavaScript(`
        (() => {
          function isVisible(element) {
            if (!element) return false;
            if (element.nodeType !== Node.ELEMENT_NODE) return false;
            const style = window.getComputedStyle(element);
            return style && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
          }
          function isInteractive(element) {
            const tag = element.tagName.toLowerCase();
            return (
              tag === 'button' ||
              tag === 'a' ||
              tag === 'input' ||
              tag === 'select' ||
              tag === 'textarea' ||
              (element.hasAttribute('role') && ['button','link','textbox','searchbox','menuitem'].includes(element.getAttribute('role')))
            );
          }
          function getElementInfo(element) {
            if (!isVisible(element) || !isInteractive(element)) return null;
            return {
              tag: element.tagName.toLowerCase(),
              id: element.id || undefined,
              class: element.className || undefined,
              name: element.getAttribute('name') || undefined,
              type: element.getAttribute('type') || undefined,
              value: element.value || undefined,
              placeholder: element.getAttribute('placeholder') || undefined,
              ariaLabel: element.getAttribute('aria-label') || undefined,
              role: element.getAttribute('role') || undefined,
              text: element.innerText ? element.innerText.trim() : undefined,
              href: element.getAttribute('href') || undefined
            };
          }
          const elements = Array.from(document.querySelectorAll('a,button,input,select,textarea,[role]'));
          const context = elements.map(getElementInfo).filter(Boolean);
          return context;
        })();
      `, true);
};

// Helper: Extract all visible text from the webview
export const extractVisibleTextFromWebview = async (webview) => {
    return await webview.executeJavaScript(`
        (() => {
          function getVisibleText(element) {
            if (!element) return '';
            if (element.nodeType === Node.TEXT_NODE) {
              return element.textContent.trim();
            }
            if (element.nodeType !== Node.ELEMENT_NODE) return '';
            const style = window.getComputedStyle(element);
            if (style && (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0')) {
              return '';
            }
            let text = '';
            for (const child of element.childNodes) {
              text += getVisibleText(child) + ' ';
            }
            return text.trim();
          }
          return getVisibleText(document.body);
        })();
      `, true);
};