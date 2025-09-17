// formFillingHandler.js
// Handles detecting form fields in the active webview and guiding user (voice or text) to fill them.

/* Contract
 * initFormSession(webview, addMessage): Detects form fields and returns session id/state.
 * handleFormInput(message): Processes user answer for current field.
 * isActive(): whether a form session is active.
 * cancel(): abort session.
 * getState(): snapshot {index, total, currentLabel}.
 */

let session = null;

function resetSession() {
  session = null;
}

export function isFormSessionActive() { return !!session; }

export function getFormSessionState() {
  if (!session) return null;
  const { currentIndex, fields } = session;
  return {
    index: currentIndex,
    total: fields.length,
    currentLabel: fields[currentIndex] && fields[currentIndex].label
  };
}

export async function initFormSession(webview, addMessage) {
  if (!webview) throw new Error('No webview provided');
  // If already active, return existing state
  if (session) return getFormSessionState();

  const detectionScript = `(() => {
    const formFields = [];
    
    // More comprehensive selector - include all input types and common form elements
    const allPossibleInputs = document.querySelectorAll('input, textarea, select, [contenteditable="true"]');
    console.log('Total elements found:', allPossibleInputs.length);
    
    // Log all found elements for debugging
    allPossibleInputs.forEach((element, index) => {
      console.log(\`Element \${index + 1}:\`, {
        tagName: element.tagName,
        type: element.type,
        id: element.id,
        name: element.name,
        className: element.className,
        placeholder: element.placeholder,
        disabled: element.disabled,
        readOnly: element.readOnly,
        offsetParent: element.offsetParent !== null,
        style: element.style.display
      });
    });
    
    // Filter for actual form inputs (more permissive than before)
    const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), textarea, select');
    console.log('Filtered form inputs:', inputs.length);
    
    inputs.forEach((input, index) => {
      // Enhanced visibility check - more permissive approach
      const computedStyle = window.getComputedStyle(input);
      const rect = input.getBoundingClientRect();
      
      const isVisible = (
        input.offsetParent !== null && 
        computedStyle.display !== 'none' && 
        computedStyle.visibility !== 'hidden' &&
        rect.width > 0 && 
        rect.height > 0
      ) || (
        // Fallback: if element is in viewport and not explicitly hidden
        rect.width > 0 && 
        rect.height > 0 && 
        computedStyle.display !== 'none' &&
        computedStyle.visibility !== 'hidden'
      );
      
      const isEditable = !input.disabled && !input.readOnly;
      
      console.log(\`Input \${index + 1} visibility/editability:\`, {
        tagName: input.tagName,
        type: input.type,
        isVisible: isVisible,
        isEditable: isEditable,
        offsetParent: input.offsetParent !== null,
        computedDisplay: computedStyle.display,
        computedVisibility: computedStyle.visibility,
        boundingRect: \`\${rect.width}x\${rect.height}\`,
        position: \`\${rect.left},\${rect.top}\`
      });
      
      // Accept more fields - either visible and editable, or just editable (for hidden fields that might become visible)
      if ((isVisible && isEditable) || (isEditable && input.type !== 'hidden')) {
        // Enhanced label detection
        let label = '';
        
        // Try multiple methods to get a meaningful label
        if (input.labels && input.labels.length > 0) {
          label = input.labels[0].textContent.trim();
        } else if (input.getAttribute('placeholder')) {
          label = input.getAttribute('placeholder').trim();
        } else if (input.getAttribute('aria-label')) {
          label = input.getAttribute('aria-label').trim();
        } else if (input.getAttribute('name')) {
          label = input.getAttribute('name').replace(/[_-]/g, ' ').trim();
        } else if (input.getAttribute('title')) {
          label = input.getAttribute('title').trim();
        } else if (input.id) {
          label = input.id.replace(/[_-]/g, ' ').trim();
        } else {
          // Try to find nearby text labels
          const parent = input.parentElement;
          if (parent) {
            const previousSibling = input.previousElementSibling;
            const nextSibling = input.nextElementSibling;
            
            if (previousSibling && previousSibling.textContent.trim()) {
              label = previousSibling.textContent.trim();
            } else if (nextSibling && nextSibling.textContent.trim()) {
              label = nextSibling.textContent.trim();
            } else if (parent.textContent.trim()) {
              // Use parent's text content but limit length
              label = parent.textContent.trim().substring(0, 50);
            }
          }
        }
        
        // Fallback if no label found
        if (!label) {
          label = \`\${input.type || input.tagName.toLowerCase()} field \${index + 1}\`;
        }
        
        // Create a better selector
        let selector = '';
        if (input.id) {
          selector = '#' + input.id;
        } else if (input.name) {
          selector = input.tagName.toLowerCase() + '[name="' + input.name + '"]';
        } else if (input.className) {
          selector = input.tagName.toLowerCase() + '.' + input.className.split(' ').filter(c => c).join('.');
        } else {
          // Fallback: use position-based selector
          const allSameTagInputs = Array.from(document.querySelectorAll(input.tagName.toLowerCase()));
          const inputIndex = allSameTagInputs.indexOf(input);
          selector = input.tagName.toLowerCase() + ':nth-of-type(' + (inputIndex + 1) + ')';
        }
        
        console.log('Found field:', {
          label: label.trim(),
          selector: selector,
          type: input.type || input.tagName.toLowerCase(),
          tagName: input.tagName
        });
        
        formFields.push({
          selector: selector,
          type: input.type || input.tagName.toLowerCase(),
          label: label.trim(),
          required: input.required,
          value: input.value,
          options: input.tagName.toLowerCase() === 'select' ? Array.from(input.options).map(o => o.text) : null
        });
      }
    });
    
    console.log('Total fields found:', formFields.length);
    return { success: true, fields: formFields };
  })();`;

  const result = await webview.executeJavaScript(detectionScript, true);
  if (!result.success || result.fields.length === 0) {
    addMessage && addMessage('❌ No fillable form fields detected on this page.', 'ai');
    return null;
  }

  session = {
    fields: result.fields,
    currentIndex: 0,
    answers: {},
    webview,
    addMessage
  };

  addMessage && addMessage(`🎯 **Form Detection Complete!**\n\nFound ${result.fields.length} form fields. I'll guide you through filling them one by one.\n\n📋 **Process:**\n• I'll ask for each field value individually\n• Type "NA" to skip any field you don't have information for\n• Type "cancel" at any time to stop form filling\n\nLet's start:`, 'ai');
  console.log('Form fields:', result.fields);
  askCurrent();
  return getFormSessionState();
}

function askCurrent() {
  if (!session) return;
  if (session.currentIndex >= session.fields.length) {
    // All fields completed
    session.addMessage && session.addMessage('✅ **Form filling completed!** All fields have been processed.', 'ai');
    resetSession();
    return;
  }
  
  const field = session.fields[session.currentIndex];
  let question = `📝 **Field ${session.currentIndex + 1} of ${session.fields.length}**\n\nPlease provide a value for "${field.label}"`;
  
  if (field.type === 'select' && field.options) {
    question += `\n\n📋 **Available options:** ${field.options.join(', ')}`;
  } else if (field.type === 'email') {
    question += '\n\n📧 **Format:** Email address (e.g., user@example.com)';
  } else if (field.type === 'tel') {
    question += '\n\n📞 **Format:** Phone number';
  } else if (field.type === 'date') {
    question += '\n\n📅 **Format:** Date (YYYY-MM-DD)';
  }
  
  if (field.required) {
    question += '\n\n⚠️ **This field is required**';
  }
  
  question += '\n\n💡 **Tip:** Type "NA" to skip this field if you don\'t have the information.';
  
  session.addMessage && session.addMessage(question, 'ai');
}

export async function handleFormInput(message) {
  if (!session) return false; // not consumed
  const lower = message.trim().toLowerCase();
  
  // Check for cancel commands
  if (['cancel','stop','abort','quit'].includes(lower)) {
    session.addMessage && session.addMessage('🚫 Form filling cancelled.', 'ai');
    resetSession();
    return true;
  }
  
  // Check for skip commands
  if (['skip','next','na','n/a','not applicable'].includes(lower)) {
    const currentField = session.fields[session.currentIndex];
    session.addMessage && session.addMessage(`⏭️ Skipping "${currentField.label}"`, 'ai');
    advance();
    return true;
  }
  
  // Fill the current field with the provided value
  const success = await fillCurrentField(message);
  if (success) {
    advance();
  }
  return true;
}

async function fillCurrentField(value) {
  if (!session) return false;
  const field = session.fields[session.currentIndex];
  console.log('Filling field:', field.label, 'with value:', value, 'using selector:', field.selector);
  
  const fillScript = `
    (() => {
      try {
        console.log('Looking for element with selector: ${field.selector}');
        let element = document.querySelector('${field.selector}');
        
        if (!element) {
          console.log('Element not found, trying alternative selectors...');
          // Try alternative selectors
          const allInputs = document.querySelectorAll('input, textarea, select');
          let foundElement = null;
          
          for (let input of allInputs) {
            const inputLabel = input.labels?.[0]?.textContent || 
                             input.getAttribute('placeholder') || 
                             input.getAttribute('aria-label') || 
                             input.getAttribute('name') || '';
            
            if (inputLabel.toLowerCase().includes('${field.label}'.toLowerCase().substring(0, 10))) {
              foundElement = input;
              break;
            }
          }
          
          if (!foundElement) {
            return { success: false, error: 'Field not found with selector: ${field.selector}' };
          } else {
            console.log('Found element using label matching');
            element = foundElement;
          }
        }
        
        console.log('Found element:', element.tagName, element.type, element.id, element.name);
        
        // Focus on the element first
        element.focus();
        
        // Clear existing value
        element.value = '';
        
        // Set the value
        if (element.tagName.toLowerCase() === 'select') {
          console.log('Handling select element');
          const options = Array.from(element.options);
          console.log('Available options:', options.map(o => o.text));
          
          const matchingOption = options.find(opt => 
            opt.text.toLowerCase().includes('${value}'.toLowerCase()) || 
            opt.value.toLowerCase().includes('${value}'.toLowerCase())
          );
          
          if (matchingOption) {
            element.value = matchingOption.value;
            console.log('Selected option:', matchingOption.text);
          } else {
            element.value = '${value}';
            console.log('No matching option found, set value directly');
          }
        } else {
          console.log('Setting text value');
          element.value = '${value}';
        }
        
        // Trigger multiple events to ensure the form recognizes the change
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        element.dispatchEvent(new Event('blur', { bubbles: true }));
        
        // Highlight the filled field briefly
        const originalStyle = element.style.cssText;
        element.style.backgroundColor = '#90EE90';
        element.style.transition = 'background-color 0.3s';
        element.style.border = '2px solid #00AA00';
        
        setTimeout(() => {
          element.style.backgroundColor = '';
          element.style.border = '';
          setTimeout(() => {
            element.style.cssText = originalStyle;
          }, 300);
        }, 1500);
        
        return { success: true, value: element.value };
      } catch (e) {
        console.error('Fill field error:', e);
        return { success: false, error: e.message };
      }
    })();
  `;
  
  try {
    const result = await session.webview.executeJavaScript(fillScript, true);
    if (result.success) {
      session.addMessage && session.addMessage(`✓ Filled "${field.label}" with: ${value}`, 'ai');
      return true;
    } else {
      session.addMessage && session.addMessage(`❌ Error filling field "${field.label}": ${result.error}`, 'ai');
      return false;
    }
  } catch (e) {
    console.error('Fill field error:', e);
    session.addMessage && session.addMessage(`❌ Error filling field: ${e.message}`, 'ai');
    return false;
  }
}

function advance() {
  if (!session) return;
  session.currentIndex += 1;
  
  // Wait a moment then ask for next field
  setTimeout(() => {
    askCurrent();
  }, 500);
}

export function cancelFormSession() { if (session) { resetSession(); } }
