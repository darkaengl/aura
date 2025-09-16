// llm-config.js
// Central registry mapping application features to their LLM provider/model/api key env var and optional fallback.
// This is renderer-side (ESM) but we add a CommonJS export guard for safety.
// Feature identifiers:
//  - navigator              : command generation / multi-step actions
//  - simplification         : page text simplification
//  - css_refactor           : CSS optimization
//  - next_steps             : post-navigation suggestion generation
//  - accessibility_advisor  : (placeholder) summarizing axe results in future
//  - classification         : intent classification (currently spawn-based Ollama)
//
// ENV variables (optional):
//  OPENAI_NAV_API_KEY, OPENAI_SIMPLIFY_API_KEY, OPENAI_CSS_API_KEY, OPENAI_WCAG_API_KEY
// Fallback order for OpenAI keys if feature-specific key missing: feature env -> OPENAI_API_KEY -> CHATGPT_API_KEY.

export const LLM_FEATURES = {
  navigator: {
    provider: 'openai',
    model: 'gpt-3.5-turbo',
    env: 'OPENAI_NAV_API_KEY',
    fallback: { provider: 'ollama', model: 'llama3.2' }
  },
  simplification: {
    provider: 'openai',
    model: 'gpt-3.5-turbo',
    env: 'OPENAI_SIMPLIFY_API_KEY',
    fallback: { provider: 'ollama', model: 'llama3.2' }
  },
  css_refactor: {
    provider: 'openai',
    model: 'gpt-3.5-turbo',
    env: 'OPENAI_SIMPLIFY_API_KEY',
    fallback: { provider: 'ollama', model: 'llama3.2' }
  },
  next_steps: {
    provider: 'ollama',
    model: 'llama3.2'
  },
  accessibility_advisor: {
    provider: 'openai',
    model: 'gpt-3.5-turbo',
    env: 'OPENAI_WCAG_API_KEY',
    fallback: { provider: 'ollama', model: 'llama3.2' }
  },
  classification: {
    provider: 'ollama',
    model: 'mistral:7b-instruct-v0.2-q4_0'
  }
};

export function getFeatureConfig(feature) {
  return LLM_FEATURES[feature] || null;
}

// Attempt to find appropriate API key for an OpenAI-backed feature.
export function resolveApiKeyForFeature(feature) {
  const cfg = getFeatureConfig(feature);
  if (!cfg || cfg.provider !== 'openai') return '';
  const specific = cfg.env ? process.env[cfg.env] : '';
  return specific || process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY || '';
}

// CommonJS compatibility
// eslint-disable-next-line no-undef
if (typeof module !== 'undefined') {
  // eslint-disable-next-line no-undef
  module.exports = { LLM_FEATURES, getFeatureConfig, resolveApiKeyForFeature };
}
