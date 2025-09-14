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
    const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), textarea, select');
    inputs.forEach((input, idx) => {
      const style = window.getComputedStyle(input);
      const rect = input.getBoundingClientRect();
      const visible = rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      const editable = !input.disabled && !input.readOnly;
      if (!visible || !editable) return;
      let label = '';
      if (input.labels && input.labels.length) label = input.labels[0].textContent.trim();
      else if (input.placeholder) label = input.placeholder.trim();
      else if (input.getAttribute('aria-label')) label = input.getAttribute('aria-label').trim();
      else if (input.name) label = input.name.replace(/[_-]/g,' ').trim();
      else if (input.id) label = input.id.replace(/[_-]/g,' ').trim();
      else {
        const prev = input.previousElementSibling; if (prev && prev.textContent.trim()) label = prev.textContent.trim();
      }
      if (!label) label = (input.type || input.tagName.toLowerCase()) + ' field ' + (idx+1);
      // Build selector preference order
      let selector = '';
      if (input.id) selector = '#' + input.id;
      else if (input.name) selector = input.tagName.toLowerCase() + '[name="' + input.name + '"]';
      else if (input.className) selector = input.tagName.toLowerCase() + '.' + Array.from(input.classList).join('.');
      else {
        const allTag = Array.from(document.querySelectorAll(input.tagName.toLowerCase()));
        const pos = allTag.indexOf(input);
        selector = input.tagName.toLowerCase() + ':nth-of-type(' + (pos+1) + ')';
      }
      formFields.push({
        selector,
        label,
        tag: input.tagName.toLowerCase(),
        type: input.type || input.tagName.toLowerCase(),
        required: !!input.required,
        options: input.tagName.toLowerCase()==='select' ? Array.from(input.options).map(o=>o.textContent.trim()) : null
      });
    });
    return { success:true, fields: formFields };
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

  addMessage && addMessage(`📝 Form session started. Detected ${result.fields.length} fields. Say or type your answers. Say "cancel" to stop, "skip" or "next" to skip a field.`, 'ai');
  askCurrent();
  return getFormSessionState();
}

function askCurrent() {
  if (!session) return;
  const f = session.fields[session.currentIndex];
  const suffix = f.options ? ` (options: ${f.options.slice(0,6).join(', ')}${f.options.length>6?'…':''})` : '';
  session.addMessage && session.addMessage(`➡️ Field ${session.currentIndex+1}/${session.fields.length}: ${f.label}${suffix}${f.required?' (required)':''}`, 'ai');
}

export async function handleFormInput(message) {
  if (!session) return false; // not consumed
  const lower = message.trim().toLowerCase();
  if (['cancel','stop','abort','quit'].includes(lower)) {
    session.addMessage && session.addMessage('🚫 Form filling cancelled.', 'ai');
    resetSession();
    return true;
  }
  if (['skip','next','na','n/a'].includes(lower)) {
    session.addMessage && session.addMessage('⏭️ Skipped.', 'ai');
    advance();
    return true;
  }
  await fillCurrentField(message); // ensure ordering of confirmation before next prompt
  advance();
  return true;
}

async function fillCurrentField(value) {
  if (!session) return;
  const field = session.fields[session.currentIndex];
  const escaped = value.replace(/`/g,'').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
  const script = `(() => { const el = document.querySelector(${JSON.stringify(field.selector)}); if (el) { if(el.tagName==='SELECT'){ const opt=[...el.options].find(o=>o.textContent.trim().toLowerCase()===${JSON.stringify(value.toLowerCase())}); if(opt){ el.value=opt.value; } } else { el.value='${escaped}'; } el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); el.style.outline='2px solid #4caf50'; setTimeout(()=>{el.style.outline='';},1500); return {ok:true}; } return {ok:false}; })();`;
  try {
    const r = await session.webview.executeJavaScript(script, true);
    if (!r || !r.ok) {
      session.addMessage && session.addMessage(`⚠️ Could not fill field: ${field.label}`, 'ai');
      return false;
    } else {
      session.addMessage && session.addMessage(`✅ Filled: ${field.label}`, 'ai');
      return true;
    }
  } catch (err) {
    session.addMessage && session.addMessage(`❌ Error filling ${field.label}: ${err.message}`,'ai');
    return false;
  }
}

function advance() {
  if (!session) return;
  session.currentIndex += 1;
  if (session.currentIndex >= session.fields.length) {
    session.addMessage && session.addMessage('🎉 Form filling complete. Review the entries before submitting.', 'ai');
    resetSession();
    return;
  }
  askCurrent();
}

export function cancelFormSession() { if (session) { resetSession(); } }
