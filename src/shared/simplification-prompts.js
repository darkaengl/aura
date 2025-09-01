/**
 * Text simplification prompting strategies for Ollama
 * This module provides different prompting approaches for various complexity levels
 */

/**
 * Creates a structured prompt for text simplification
 * @param {string} text - The text to be simplified
 * @param {Object} options - Simplification options
 * @param {string} options.complexity - 'simple', 'moderate', or 'advanced'
 * @param {string} options.title - Page title for context
 * @param {string} options.url - Page URL for context
 * @param {boolean} options.preserveFormatting - Whether to maintain structure
 * @param {number} options.wordCount - Original word count
 * @returns {Object} Structured prompt for Ollama
 */
export const createSimplificationPrompt = (text, options = {}) => {
  const {
    complexity = 'moderate',
    title = '',
    url = '',
    preserveFormatting = false,
    wordCount = 0
  } = options;

  const systemPrompt = createSystemPrompt(complexity, preserveFormatting);
  const userPrompt = createUserPrompt(text, title, url, wordCount);

  return {
    model: 'llama3.2',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    stream: false
  };
};

/**
 * Creates the system prompt based on complexity level
 * @param {string} complexity - Simplification level
 * @param {boolean} preserveFormatting - Whether to preserve formatting
 * @returns {string} System prompt
 */
const createSystemPrompt = (complexity, preserveFormatting) => {
  const basePrompt = `You are an expert text simplification specialist. Your goal is to make content more accessible and easier to understand while preserving all important information and meaning.`;

  const complexityInstructions = getComplexityInstructions(complexity);
  const formattingInstructions = getFormattingInstructions(preserveFormatting);
  const generalGuidelines = getGeneralGuidelines();

  return `${basePrompt}\n\n${complexityInstructions}\n\n${formattingInstructions}\n\n${generalGuidelines}\n\nIMPORTANT: Return only the simplified text without any explanations, comments, or meta-text. Do not add phrases like \"Here is the simplified version:\" or similar introductory text.`;
};

/**
 * Gets complexity-specific instructions
 * @param {string} complexity - Simplification level
 * @returns {string} Complexity instructions
 */
const getComplexityInstructions = (complexity) => {
  switch (complexity) {
    case 'simple':
      return `COMPLEXITY LEVEL: SIMPLE (Elementary/Middle School)\n- Use only common, everyday words that a 12-year-old would understand\n- Keep sentences very short (maximum 15 words)\n- Avoid all technical terms, jargon, and complex concepts\n- Replace difficult words with simpler alternatives\n- Break complex ideas into multiple simple sentences\n- Use active voice instead of passive voice\n- Target reading level: 6th-8th grade`;

    case 'advanced':
      return `COMPLEXITY LEVEL: ADVANCED (Clear Professional)\n- Use professional vocabulary but avoid unnecessary jargon\n- Keep sentences reasonably short (maximum 25 words)\n- Explain technical terms when they must be used\n- Maintain sophisticated ideas but improve clarity\n- Use precise but accessible language\n- Keep logical flow and detailed information\n- Target reading level: College level`;

    case 'moderate':
    default:
      return `COMPLEXITY LEVEL: MODERATE (High School)\n- Use common vocabulary that most adults would understand\n- Keep sentences at a reasonable length (maximum 20 words)\n- Explain technical terms in simple words when they appear\n- Replace overly complex words with clearer alternatives\n- Break long, complex sentences into shorter ones\n- Maintain important details while improving readability\n- Target reading level: 9th-12th grade`;
  }
};

/**
 * Gets formatting preservation instructions
 * @param {boolean} preserveFormatting - Whether to preserve formatting
 * @returns {string} Formatting instructions
 */
const getFormattingInstructions = (preserveFormatting) => {
  if (preserveFormatting) {
    return `FORMATTING PRESERVATION:\n- Keep paragraph breaks and structure\n- Maintain headings and their hierarchy\n- Preserve lists and bullet points\n- Keep important emphasis and structure\n- Maintain logical document flow`;
  } else {
    return `FORMATTING APPROACH:\n- Focus on content clarity over formatting\n- Create natural paragraph breaks for readability\n- Structure information in logical flow\n- Don't worry about preserving original formatting`;
  }
};

/**
 * Gets general simplification guidelines
 * @returns {string} General guidelines
 */
const getGeneralGuidelines = () => {
  return `GENERAL GUIDELINES:\n
  - Never lose important information or meaning\n
  - Always preserve facts, numbers, and key details\n
  - Use concrete examples when possible\n
  - Replace abstract concepts with specific examples\n
  - Maintain the author's intent and tone\n
  - Use transitions to connect ideas clearly\n
  - Remove unnecessary filler words and redundancy\n
  - Make sure the simplified text flows naturally\n- Format the simplified text using Markdown. Use headings (##), bold (**text**), italics (*text*), lists (- item), and code blocks where appropriate to improve readability and structure.\n
  - Focus simplification ONLY on natural language prose.\n
  - If a section is clearly not natural language (e.g., a block of CSS, a JavaScript function, or a JSON object), output it verbatim within a code block.\n
  - Never simplify javascript / browser cookies related content `;
};

/**
 * Creates the user prompt with context
 * @param {string} text - Text to simplify
 * @param {string} title - Page title
 * @param {string} url - Page URL
 * @param {number} wordCount - Original word count
 * @returns {string} User prompt
 */
const createUserPrompt = (text, title, url, wordCount) => {
  let contextInfo = '';
  
  if (title || url || wordCount > 0) {
    contextInfo += 'CONTEXT INFORMATION:\n';
    if (title) contextInfo += `- Page Title: ${title}\n`;
    if (url) contextInfo += `- Source URL: ${url}\n`;
    if (wordCount > 0) contextInfo += `- Original Word Count: ${wordCount} words\n`;
    contextInfo += '\n';
  }

  return `${contextInfo}Please simplify the following text:\n\n${text}`;
};

/**
 * Creates a prompt specifically for chunked text processing
 * @param {string} chunk - Text chunk to simplify
 * @param {number} chunkIndex - Current chunk index
 * @param {number} totalChunks - Total number of chunks
 * @param {Object} options - Simplification options
 * @returns {Object} Structured prompt for chunk processing
 */
export const createChunkPrompt = (chunk, chunkIndex, totalChunks, options = {}) => {
  const baseOptions = { ...options };
  const systemPrompt = createSystemPrompt(baseOptions.complexity || 'moderate', baseOptions.preserveFormatting || false);
  
  const userPrompt = `CHUNK PROCESSING: This is part ${chunkIndex + 1} of ${totalChunks} from a larger document.\n\n${baseOptions.title ? `Original Document: ${baseOptions.title}` : ''}\n\nPlease simplify this text chunk while maintaining consistency with the overall document:\n\n${chunk}`;
  
  return {
    model: 'llama3.2',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    stream: false
  };
};

/**
 * Splits large text into manageable chunks for processing
 * @param {string} text - Text to split
 * @param {number} maxChunkSize - Maximum characters per chunk (default: 3000)
 * @returns {Array<string>} Array of text chunks
 */
export const splitTextIntoChunks = (text, maxChunkSize = 3000) => {
  if (text.length <= maxChunkSize) {
    return [text];
  }

  const chunks = [];
  const sentences = text.split(/[.!?]+(?:\s+|$)/);
  let currentChunk = '';

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    if (!trimmedSentence) continue;

    const sentenceWithPunctuation = trimmedSentence + (sentence.match(/[.!?]+\s*$/) ? '' : '.');
    
    // If adding this sentence would exceed the limit, start a new chunk
    if (currentChunk.length + sentenceWithPunctuation.length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = sentenceWithPunctuation + ' ';
    } else {
      currentChunk += sentenceWithPunctuation + ' ';
    }
  }

  // Add the remaining chunk
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks.length > 0 ? chunks : [text]; // Fallback to original text if no chunks created
};

/**
 * Validates simplification options
 * @param {Object} options - Options to validate
 * @returns {Object} Validated and normalized options
 */
export const validateOptions = (options = {}) => {
  const validComplexityLevels = ['simple', 'moderate', 'advanced'];
  
  return {
    complexity: validComplexityLevels.includes(options.complexity) ? options.complexity : 'moderate',
    preserveFormatting: Boolean(options.preserveFormatting),
    title: String(options.title || ''),
    url: String(options.url || ''),
    wordCount: Math.max(0, Number(options.wordCount || 0))
  };
};

/**
 * Estimates processing time based on text length and complexity
 * @param {number} wordCount - Number of words to process
 * @param {string} complexity - Complexity level
 * @returns {number} Estimated processing time in milliseconds
 */
export const estimateProcessingTime = (wordCount, complexity = 'moderate') => {
  // Base processing time per word in milliseconds
  const baseTimePerWord = {
    simple: 50,     // Simple requires less processing
    moderate: 75,   // Moderate complexity
    advanced: 100   // Advanced requires more nuanced processing
  };

  const timePerWord = baseTimePerWord[complexity] || baseTimePerWord.moderate;
  const baseTime = wordCount * timePerWord;
  
  // Add overhead for API calls and chunk processing
  const overhead = Math.min(2000, wordCount * 5); // Max 2 seconds overhead
  
  return Math.max(1000, baseTime + overhead); // Minimum 1 second
};
