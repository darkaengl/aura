# Epic 3 Interface Definition

This document defines the interface contracts and dependencies for Epic 3: AI-Powered Text Simplification.

## Dependencies from Previous Epics

### Epic 1: Foundational Browser Infrastructure (Required)
Epic 3 depends on the following components from Epic 1:

#### Webview Access
- **Component**: `#webview` element in `index.html`
- **Required Methods**: 
  - `webview.executeJavaScript(code)` - For DOM text extraction
  - `webview.getURL()` - For context in prompts
  - Event listener support for `did-finish-load`

#### Main Process Infrastructure
- **Component**: `src/main/main.js`
- **Required Features**:
  - IPC handler registration capability
  - Window management for modals/overlays
  - Error handling patterns

#### Renderer Process Framework
- **Component**: `src/renderer/renderer.js` 
- **Required Features**:
  - Access to webview element
  - Event listener management
  - DOM manipulation capabilities

#### Preload Security Bridge
- **Component**: `src/shared/preload.js`
- **Required API**: `contextBridge.exposeInMainWorld()` for new APIs

### Epic 2: WCAG Report Generation (Reference Pattern)
Epic 3 will reuse UI patterns from Epic 2:

#### Modal Display System
- **Reference**: Accessibility report modal in `index.html`
- **Pattern**: Overlay modal with close button and content area
- **CSS Classes**: Modal styling from existing accessibility report

#### IPC Communication Pattern
- **Reference**: File reading IPC handler pattern
- **Pattern**: `ipcMain.handle()` in main process, `ipcRenderer.invoke()` via preload

## Epic 3 Interface Contracts

### Text Extraction API

#### IPC Handler: `simplify:extract-text`
**Location**: `src/main/main.js`
```javascript
ipcMain.handle('simplify:extract-text', async (event, options) => {
  // options: { mode: 'full' | 'selection', selector?: string }
  // returns: { text: string, metadata: object }
})
```

#### Webview Text Extraction
**Injection Target**: Current webview via `executeJavaScript`
```javascript
// Extracts text content from DOM
const extractTextContent = (options) => {
  // Returns structured text data
  return {
    text: string,
    title: string,
    url: string,
    wordCount: number,
    elements: Array<{type: string, text: string}>
  }
}
```

### Text Simplification API

#### IPC Handler: `simplify:process-text`
**Location**: `src/main/main.js`
```javascript
ipcMain.handle('simplify:process-text', async (event, textData, options) => {
  // textData: extracted text object
  // options: { complexity: 'simple' | 'moderate' | 'advanced', preserve: string[] }
  // returns: { simplified: string, original: string, processingTime: number }
})
```

#### Preload API Exposure
**Location**: `src/shared/preload.js`
```javascript
contextBridge.exposeInMainWorld('textSimplificationAPI', {
  extractText: (options) => ipcRenderer.invoke('simplify:extract-text', options),
  processText: (textData, options) => ipcRenderer.invoke('simplify:process-text', textData, options)
})
```

### UI Component Interface

#### Simplification Button
**Location**: Address bar in `index.html`
- **ID**: `#simplify-text-btn`
- **Classes**: `.nav-btn` (reuse existing button styling)
- **States**: enabled, disabled, loading

#### Simplification Modal
**Location**: `index.html` (similar to accessibility report)
- **ID**: `#text-simplification-modal`
- **Components**:
  - Close button (`#close-simplification-btn`)
  - Original text display (`#original-text-display`)
  - Simplified text display (`#simplified-text-display`)
  - Copy button (`#copy-simplified-text`)
  - Settings panel (`#simplification-settings`)

### Data Structures

#### TextExtractionResult
```javascript
{
  text: string,           // Full text content
  title: string,          // Page title
  url: string,            // Current URL
  wordCount: number,      // Total words
  elements: Array<{       // Structured elements
    type: 'heading' | 'paragraph' | 'list' | 'quote',
    text: string,
    level?: number        // For headings
  }>,
  metadata: {
    extractionTime: number,
    method: 'full' | 'selection'
  }
}
```

#### SimplificationResult
```javascript
{
  original: string,       // Original text
  simplified: string,     // Simplified version
  complexity: string,     // Applied complexity level
  processingTime: number, // Time taken for processing
  model: string,          // Model used (e.g., 'llama3.2')
  wordReduction: number,  // Percentage reduction
  metadata: {
    chunks: number,       // Number of text chunks processed
    prompt: string        // Prompt strategy used
  }
}
```

### Ollama Integration Interface

#### Existing Ollama Handler (Reuse)
**Location**: `src/main/main.js` - `ollama:chat` handler
- Epic 3 will use existing `ollamaAPI.chat(messages)` interface
- No changes needed to existing handler

#### Prompting Strategy
**Implementation**: New module `src/shared/simplification-prompts.js`
```javascript
export const createSimplificationPrompt = (text, options) => {
  // Returns structured prompt for Ollama
  return {
    model: 'llama3.2',
    messages: Array<{role: string, content: string}>,
    options: object
  }
}
```

### Error Handling Interface

#### Error States
- **Network Error**: Ollama server unavailable
- **Processing Error**: Text too long, model failure
- **Extraction Error**: Cannot access webview content
- **UI Error**: Modal display issues

#### Error Display
- Reuse existing error patterns from accessibility system
- Display errors in simplification modal
- Provide user-friendly fallback messages

### Integration Points

#### Renderer Process Integration
**Location**: `src/renderer/renderer.js`
- Add event listeners for simplification button
- Handle modal display/hide logic
- Manage loading states and user feedback

#### Shared Utilities Integration
**Location**: `src/shared/utils.js`
- Add text processing utilities
- Word count calculations
- Text chunk splitting functions

#### CSS Integration
**Location**: `index.html` `<style>` section
- Extend existing modal CSS patterns
- Add simplification-specific styling
- Maintain consistent visual design

## Implementation Dependencies

### External Dependencies (Already Available)
- Ollama server running on `http://localhost:11434`
- Electron IPC system
- Webview tag functionality

### New Dependencies (To Be Created)
- Text extraction JavaScript injection
- Simplification prompting module
- Text display and formatting system
- User preference storage (optional)

## Backward Compatibility

Epic 3 implementation will:
- Not modify existing Epic 1 or Epic 2 functionality
- Reuse existing UI patterns and styling
- Extend preload API without breaking existing APIs
- Add new IPC handlers without affecting existing ones

## Success Criteria

Epic 3 implementation is complete when:
1. Users can click button to simplify text
2. Text extraction works for full pages
3. Simplified text displays in modal
4. All user stories 3.1-3.5 are implemented
5. Error handling covers all failure modes
6. UI maintains existing design consistency