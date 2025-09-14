// nextStepSuggestions.js
// Generates follow-up "Next Steps" suggestions based on current page content.

function buildExtractionScript(limit=25) {
  return `(() => {
    try {
      const elements = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, null, false);
      let node; let count=0;
      while ((node = walker.nextNode()) && count < ${limit}) {
        const tag = node.tagName.toLowerCase();
        if (!['a','button','input','h1','h2','h3','p','section','article','nav','li','span','div'].includes(tag)) continue;
        const rect = node.getBoundingClientRect();
        if (rect.width < 40 || rect.height < 12) continue;
        const style = window.getComputedStyle(node);
        if (style.visibility==='hidden' || style.display==='none') continue;
        const text = (node.innerText||'').trim();
        if (!text) continue;
        elements.push({tag, text: text.substring(0,160), top: Math.round(rect.top), left: Math.round(rect.left)});
        count++;
      }
      return {success:true, title: document.title, url: location.href, elements};
    } catch (e) { return {success:false, error:e.message}; }
  })();`;
}

export async function generateNextSteps(webview, addMessage) {
  if (!webview) return;
  try {
    const snapshot = await webview.executeJavaScript(buildExtractionScript(), true);
    if (!snapshot.success) {
      addMessage && addMessage('⚠️ Could not analyze page for suggestions.', 'ai');
      return;
    }
    const list = snapshot.elements.map((el,i)=>`${i+1}. <${el.tag}> ${el.text}` ).join('\n');
    const prompt = `You are a helpful web navigation assistant. A user just completed an action on a page. Based ONLY on the following visible elements, suggest exactly 2 concise, high-value next steps they could take. Avoid generic statements. Each step must reference real text.\n\nPAGE: ${snapshot.title}\nURL: ${snapshot.url}\nELEMENTS:\n${list}\n\nFormat strictly as:\n💡 **Next Steps:**\n1. <action>\n2. <action>`;
    const response = await window.ollamaAPI.chat([{role:'user', content: prompt}]);
    // Basic guard: ensure formatting line present; if not, wrap
    const formatted = response.includes('Next Steps') ? response : `💡 **Next Steps:**\n${response}`;
    addMessage && addMessage(formatted, 'ai');
  } catch (e) {
    addMessage && addMessage('⚠️ Failed generating next steps: ' + e.message, 'ai');
  }
}
