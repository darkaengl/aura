const { ipcRenderer } = require('electron');

// Function to convert DOM to JSON
const domToJson = (node, currentDepth = 0, maxDepth = 4) => {
  if (currentDepth > maxDepth) {
    return null;
  }

  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent.trim();
    return text ? text : null;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }

  const tagName = node.tagName.toLowerCase();
  // Exclude script and style tags, and potentially other non-interactive tags
  if (['script', 'style', 'noscript', 'meta', 'link', 'br', 'hr'].includes(tagName)) {
    return null;
  }

  const attributes = {};
  // Only include a limited set of relevant attributes
  const relevantAttributes = ['id', 'class', 'name', 'type', 'value', 'placeholder', 'aria-label', 'role', 'title', 'alt', 'href', 'src', 'for', 'tabindex'];
  for (const attr of relevantAttributes) {
    if (node.hasAttribute(attr)) {
      attributes[attr] = node.getAttribute(attr);
    }
  }

  const children = Array.from(node.childNodes)
    .map(child => domToJson(child, currentDepth + 1, maxDepth))
    .filter(child => child !== null);

  const obj = {
    tagName,
  };

  if (Object.keys(attributes).length > 0) {
    obj.attributes = attributes;
  }

  if (children.length > 0) {
    obj.children = children;
  } else {
    // Only include textContent if it's a leaf node and has no other children
    let text = node.textContent.trim();
    if (text) {
      if (text.length > 100) {
        text = text.substring(0, 100) + '...';
      }
      obj.textContent = text;
    }
  }

  // If the object is too sparse (e.g., just a div with no relevant content/attributes/children), return null
  if (Object.keys(obj).length === 1 && !obj.textContent && !obj.children) { // Only has tagName and no textContent or children
      return null;
  }

  return obj;
};

// Listen for a request from the renderer to extract the DOM
ipcRenderer.on('extract-dom', () => {
  console.log('extract-dom message received in webview preload');
  const jsonDom = domToJson(document.body, 0, 4); // Pass maxDepth
  console.log('DOM converted to JSON in webview preload:', jsonDom);
  ipcRenderer.sendToHost('dom-extracted', jsonDom);
  console.log('dom-extracted message sent to host');
});
