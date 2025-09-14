// commandExecutor.js
// Executes one or more navigation/action commands sequentially with progress messages.
// Each command object shape: { action: string, ... }
// Supported actions (initial set):
// - search_and_navigate { topic }
// - agree_and_start_form
// - start_form_filling
// - click { selector }
// - fill { selector, value }
// - select { selector, value } (for <select>)
//
// Future extensibility: push new handlers into handlers map.

import { performAcknowledgment } from './acknowledgmentHandler.js';
import { initFormSession } from './formFillingHandler.js';
import { generateNextSteps } from './nextStepSuggestions.js';

// Injected externally (avoid circular import of textChatHandler's addMessage convenience)
export async function executeCommands({ webview, commands, addMessage }) {
  if (!Array.isArray(commands)) commands = [commands];
  const total = commands.length;
  addMessage && addMessage(`📋 Executing ${total} command(s)...`, 'ai');

  for (let i = 0; i < commands.length; i++) {
    const c = commands[i];
    const indexPrefix = `${i + 1}.`;
    try {
      const result = await executeSingle({ webview, command: c, addMessage, indexPrefix });
      if (result && result.stopChain) {
        addMessage && addMessage(`⛔ Stopping remaining commands due to failure.`, 'ai');
        break;
      }
    } catch (err) {
      addMessage && addMessage(`${indexPrefix} ❌ Error executing ${c.action}: ${err.message}`, 'ai');
      break; // Stop further execution on unexpected error
    }
  }
  addMessage && addMessage(`🎉 All ${total} command(s) completed!`, 'ai');
}

async function executeSingle({ webview, command, addMessage, indexPrefix }) {
  if (!command || typeof command !== 'object') {
    addMessage && addMessage(`${indexPrefix} ❌ Invalid command object`, 'ai');
    return { stopChain: true };
  }
  const { action } = command;
  if (!action) {
    addMessage && addMessage(`${indexPrefix} ❌ Missing action`, 'ai');
    return { stopChain: true };
  }

  switch (action) {
    case 'search_and_navigate':
      return await handleSearchAndNavigate({ webview, topic: command.topic, addMessage, indexPrefix });
    case 'agree_and_start_form':
      return await handleAgreement({ webview, addMessage, indexPrefix });
    case 'start_form_filling':
      return await handleStartForm({ webview, addMessage, indexPrefix });
    case 'click':
      return await handleClick({ webview, selector: command.selector, addMessage, indexPrefix });
    case 'fill':
      return await handleFill({ webview, selector: command.selector, value: command.value, addMessage, indexPrefix });
    case 'select':
      return await handleSelect({ webview, selector: command.selector, value: command.value, addMessage, indexPrefix });
    default:
      addMessage && addMessage(`${indexPrefix} ❓ Unsupported action: ${action}`, 'ai');
      return { stopChain: false };
  }
}

async function handleSearchAndNavigate({ webview, topic, addMessage, indexPrefix }) {
  if (!topic) {
    addMessage && addMessage(`${indexPrefix} ❌ search_and_navigate missing topic`, 'ai');
    return { stopChain: false };
  }
  const rawTopic = topic.trim();
  // Direct URL detection
  const domainMatch = rawTopic.match(/^(?:go\s+to\s+|open\s+)?([a-z0-9.-]+\.[a-z]{2,})(?:\s*\/[^\s]*)?$/i);
  const urlLike = /^(https?:\/\/)/i.test(rawTopic) || domainMatch;
  if (urlLike) {
    let targetUrl = rawTopic;
    if (domainMatch) targetUrl = domainMatch[1];
    if (!/^https?:\/\//i.test(targetUrl)) targetUrl = 'https://' + targetUrl.replace(/^go to\s+/i,'');
    addMessage && addMessage(`${indexPrefix} 🌐 Navigating to: ${targetUrl}`, 'ai');
    webview.loadURL(targetUrl);
    // After final command overall suggestions will run externally (caller) to avoid duplication
    return { stopChain: false };
  }
  addMessage && addMessage(`${indexPrefix} 🔍 Searching for: ${topic}`, 'ai');
  const script = `(() => {
    const searchTerm = ${JSON.stringify(topic)};
    const searchVariations = [
      searchTerm.toLowerCase(),
      searchTerm.toLowerCase().replace(/\s+/g, ''),
      ...searchTerm.toLowerCase().split(' '),
    ];
    if (searchTerm.toLowerCase().includes('vehicle') || searchTerm.toLowerCase().includes('vehical')) {
      searchVariations.push('vrt', 'vehicle registration tax', 'motor tax');
    }
    if (searchTerm.toLowerCase().includes('tax')) {
      searchVariations.push('vrt', 'taxation', 'revenue');
    }
    if (searchTerm.toLowerCase().includes('registration')) {
      searchVariations.push('vrt', 'register', 'registration');
    }
    const clickableElements = document.querySelectorAll('a, button, [role="button"], [onclick]');
    const clickableMatches = [];
    clickableElements.forEach(element => {
      if (element.offsetParent !== null) {
        const text = element.textContent.toLowerCase();
        const href = element.getAttribute('href') || '';
        if (href.startsWith('#')) return; // ignore hash-only anchors
        for (const variation of searchVariations) {
          if (!variation || variation.length < 2) continue;
            if (text.includes(variation) || href.toLowerCase().includes(variation)) {
              const rect = element.getBoundingClientRect();
              if (rect.height > 10 && rect.width > 50) {
                clickableMatches.push({
                  element: element,
                  text: element.textContent.trim(),
                  href: href,
                  matchedTerm: variation,
                  relevanceScore: calculateRelevance(text + ' ' + href, searchVariations),
                  rect: rect
                });
                break;
              }
            }
        }
      }
    });
    clickableMatches.sort((a,b)=>{ if (a.relevanceScore !== b.relevanceScore) return b.relevanceScore - a.relevanceScore; return a.rect.top - b.rect.top; });
    if (clickableMatches.length > 0) {
      const best = clickableMatches[0];
      best.element.style.backgroundColor = '#00ff00';
      best.element.style.transition = 'background-color 0.3s';
      best.element.style.border = '2px solid #0066ff';
      setTimeout(()=>{ best.element.click(); }, 400);
      return { success:true, clicked:true, text: best.text, href: best.href };
    }
    return { success:true, clicked:false };
    function calculateRelevance(text, terms){ let score=0; for(const t of terms){ if(t && text.includes(t)) score += t.length; } return score; }
  })();`;
  try {
    const result = await webview.executeJavaScript(script, true);
    if (result.clicked) {
      addMessage && addMessage(`${indexPrefix} ✅ Navigated via click: ${result.href || result.text}`, 'ai');
    } else {
      addMessage && addMessage(`${indexPrefix} ⚠️ No match found for "${topic}"`, 'ai');
    }
  } catch (err) {
    addMessage && addMessage(`${indexPrefix} ❌ Error searching: ${err.message}`, 'ai');
  }
  return { stopChain: false };
}

async function handleAgreement({ webview, addMessage, indexPrefix }) {
  addMessage && addMessage(`${indexPrefix} ✅ Checking agreement boxes...`, 'ai');
  try {
    const ack = await performAcknowledgment(webview);
    if (ack.success && ack.acknowledged.length) {
      addMessage && addMessage(`${indexPrefix} ✅ Acknowledged: ${ack.acknowledged.map(a=>a.label).join(', ')}`, 'ai');
    } else if (ack.success) {
      addMessage && addMessage(`${indexPrefix} ❌ No agreement checkboxes found.`, 'ai');
    } else {
      addMessage && addMessage(`${indexPrefix} ❌ Agreement error: ${ack.error}`, 'ai');
    }
  } catch (e) {
    addMessage && addMessage(`${indexPrefix} ❌ Agreement failure: ${e.message}`, 'ai');
  }
  return { stopChain: false };
}

async function handleStartForm({ webview, addMessage, indexPrefix }) {
  addMessage && addMessage(`${indexPrefix} 📝 Starting form session...`, 'ai');
  const state = await initFormSession(webview, addMessage);
  if (!state) {
    addMessage && addMessage(`${indexPrefix} ⚠️ No form fields detected.`, 'ai');
  }
  return { stopChain: false };
}

async function handleClick({ webview, selector, addMessage, indexPrefix }) {
  if (!selector) {
    addMessage && addMessage(`${indexPrefix} ❌ click missing selector`, 'ai');
    return { stopChain: false };
  }
  const script = `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if(!el) return {ok:false, reason:'not_found'}; el.click(); el.style.outline='2px solid #ff9800'; setTimeout(()=>{el.style.outline='';},1500); return {ok:true}; })();`;
  try {
    const r = await webview.executeJavaScript(script, true);
    if (r.ok) addMessage && addMessage(`${indexPrefix} ✅ Clicked: ${selector}`, 'ai');
    else addMessage && addMessage(`${indexPrefix} ⚠️ Could not find: ${selector}`, 'ai');
  } catch (e) {
    addMessage && addMessage(`${indexPrefix} ❌ Click error for ${selector}: ${e.message}`, 'ai');
  }
  return { stopChain: false };
}

async function handleFill({ webview, selector, value, addMessage, indexPrefix }) {
  if (!selector || typeof value === 'undefined') {
    addMessage && addMessage(`${indexPrefix} ❌ fill requires selector & value`, 'ai');
    return { stopChain: false };
  }
  const escaped = (''+value).replace(/`/g,'').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
  const script = `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if(!el) return {ok:false, reason:'not_found'}; el.value='${escaped}'; el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); el.style.outline='2px solid #4caf50'; setTimeout(()=>{el.style.outline='';},1500); return {ok:true}; })();`;
  try {
    const r = await webview.executeJavaScript(script, true);
    if (r.ok) addMessage && addMessage(`${indexPrefix} ✅ Filled ${selector} with "${value}"`, 'ai');
    else addMessage && addMessage(`${indexPrefix} ⚠️ Could not fill: ${selector}`, 'ai');
  } catch (e) {
    addMessage && addMessage(`${indexPrefix} ❌ Fill error for ${selector}: ${e.message}`, 'ai');
  }
  return { stopChain: false };
}

async function handleSelect({ webview, selector, value, addMessage, indexPrefix }) {
  if (!selector || typeof value === 'undefined') {
    addMessage && addMessage(`${indexPrefix} ❌ select requires selector & value`, 'ai');
    return { stopChain: false };
  }
  const script = `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if(!el) return {ok:false, reason:'not_found'}; if(el.tagName!=='SELECT') return {ok:false, reason:'not_select'}; const opts=[...el.options]; const match = opts.find(o=>o.textContent.trim().toLowerCase()===${JSON.stringify((''+value).toLowerCase())}); if(match){ el.value = match.value; } else { return {ok:false, reason:'no_option'}; } el.dispatchEvent(new Event('change',{bubbles:true})); el.style.outline='2px solid #2196f3'; setTimeout(()=>{el.style.outline='';},1500); return {ok:true}; })();`;
  try {
    const r = await webview.executeJavaScript(script, true);
    if (r.ok) addMessage && addMessage(`${indexPrefix} ✅ Selected "${value}" in ${selector}`, 'ai');
    else addMessage && addMessage(`${indexPrefix} ⚠️ Could not select option in: ${selector}`, 'ai');
  } catch (e) {
    addMessage && addMessage(`${indexPrefix} ❌ Select error for ${selector}: ${e.message}`, 'ai');
  }
  return { stopChain: false };
}
