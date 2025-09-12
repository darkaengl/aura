import {
    createSimplificationPrompt,
    splitTextIntoChunks,
    validateOptions,
    estimateProcessingTime
} from '../shared/simplification-prompts.js';
import {
    marked
} from '../../node_modules/marked/lib/marked.esm.js';
import {
    showStatus
} from '../shared/utils.js';

/**
 * Processes text through Ollama for simplification
 */
export const processTextWithOllama = async (textData, options, requestId, {
    latestRequestIdRef,
    simplificationStatus,
    simplifiedTextDisplay,
    simplifiedWordCount,
    wordReduction
}) => {
    console.log(`[processTextWithOllama] Starting for request ID: ${requestId}`);
    try {
        const validatedOptions = validateOptions(options);
        const {
            text,
            title,
            url
        } = textData;

        // Immediately check if this request is still valid
        if (requestId !== latestRequestIdRef.current) {
            console.log(
                `[processTextWithOllama] Discarding request ${requestId} before processing. Newer request ${latestRequestIdRef.current} exists.`
                );
            return null; // Discard this request early
        }

        // Estimate processing time and show to user
        const estimatedTime = estimateProcessingTime(textData.wordCount, validatedOptions.complexity);
        const estimatedSeconds = Math.ceil(estimatedTime / 1000);
        showStatus(simplificationStatus, `Simplifying text... (estimated ${estimatedSeconds}s)`, 'loading');

        // For very large texts, split into chunks
        if (text.length > 8000) {
            console.log(`[processTextWithOllama] Text length > 8000, calling processTextInChunks.`);
            return await processTextInChunks(textData, {
                ...validatedOptions,
                requestId
            }, {
                latestRequestIdRef,
                simplificationStatus,
                simplifiedTextDisplay,
                simplifiedWordCount,
                wordReduction
            });
        }

        // Process single text block
        const promptData = createSimplificationPrompt(text, {
            ...validatedOptions,
            title,
            url,
            wordCount: textData.wordCount
        });
        console.log(`[processTextWithOllama] Processing single text block for request ID: ${requestId}`);

        const result = await window.textSimplificationAPI.processText(textData, validatedOptions);
        console.log(`[processTextWithOllama] Result from textSimplificationAPI.processText (single block):`,
            result);

        if (result.error) {
            throw new Error(result.message);
        }

        // Check again after processing, in case a new request came in during the Ollama call
        if (requestId !== latestRequestIdRef.current) {
            console.log(
                `[processTextWithOllama] Discarding result for request ${requestId} after processing. Newer request ${latestRequestIdRef.current} exists.`
                );
            return null; // Return null or throw an error to indicate discard
        }

        // Return a structured result similar to processTextInChunks
        const finalResult = {
            original: textData.text,
            simplified: result.simplified,
            complexity: validatedOptions.complexity,
            processingTime: Date.now(),
            model: 'llama3.2',
            wordReduction: parseFloat(((textData.wordCount - result.simplified.split(/\s+/).filter(word =>
                word.length > 0).length) / textData.wordCount * 100).toFixed(1)),
            metadata: {
                originalWordCount: textData.wordCount,
                simplifiedWordCount: result.simplified.split(/\s+/).filter(word => word.length > 0).length,
                title: textData.title,
                url: textData.url,
                chunks: 1
            }
        };
        console.log(`[processTextWithOllama] Returning final result (single block):`, finalResult);
        return finalResult;

    } catch (error) {
        console.error('Text processing failed:', error);
        throw error;
    }
};

/**
 * Processes large text by splitting into chunks
 */
const processTextInChunks = async (textData, options, {
    latestRequestIdRef,
    simplificationStatus,
    simplifiedTextDisplay,
    simplifiedWordCount,
    wordReduction
}) => {
    console.log(`[processTextInChunks] Starting for request ID: ${options.requestId}`);
    const chunks = splitTextIntoChunks(textData.text, 3000);
    let combinedSimplifiedText = '';
    let currentSimplifiedWordCount = 0;
    const originalWordCount = textData.wordCount;
    const requestId = options.requestId;

    // Immediately check if this request is still valid
    if (requestId !== latestRequestIdRef.current) {
        console.log(
            `[processTextInChunks] Discarding chunk processing for request ${requestId} before starting. Newer request ${latestRequestIdRef.current} exists.`
            );
        return null; // Discard this request early
    }

    // Clear previous simplified text display
    simplifiedTextDisplay.textContent = '';
    simplifiedWordCount.textContent = '0';
    wordReduction.textContent = '0%';

    showStatus(simplificationStatus, `Processing ${chunks.length} text chunks...`, 'loading');

    for (let i = 0; i < chunks.length; i++) {
        // Check if this is still the latest request before processing each chunk
        if (requestId !== latestRequestIdRef.current) {
            console.log(
                `[processTextInChunks] Discarding chunk processing for request ${requestId}. Newer request ${latestRequestIdRef.current} exists.`
                );
            return null; // Discard the entire chunk processing
        }

        showStatus(simplificationStatus, `Processing chunk ${i + 1} of ${chunks.length}...`, 'loading');

        const chunkData = {
            text: chunks[i],
            title: textData.title,
            url: textData.url
        };

        const result = await window.textSimplificationAPI.processText(chunkData, options);
        console.log(`[processTextInChunks] Result for chunk ${i + 1} of ${chunks.length}:`, result);

        if (result.error) {
            throw new Error(`Chunk ${i + 1} failed: ${result.message}`);
        }

        // Append simplified chunk to display and combined text
        const simplifiedChunk = result.simplified;
        combinedSimplifiedText += (i > 0 ? '\n\n' : '') + simplifiedChunk;
        simplifiedTextDisplay.innerHTML = marked.parse(
        combinedSimplifiedText); // Update display after each chunk

        // Update word counts dynamically
        currentSimplifiedWordCount = combinedSimplifiedText.split(/\s+/).filter(word => word.length > 0).length;
        simplifiedWordCount.textContent = currentSimplifiedWordCount.toLocaleString();

        const currentWordReductionPercent = ((originalWordCount - currentSimplifiedWordCount) /
            originalWordCount * 100).toFixed(1);
        wordReduction.textContent = `${currentWordReductionPercent}%`;
    }

    // Final result object
    const finalResult = {
        original: textData.text,
        simplified: combinedSimplifiedText,
        complexity: options.complexity,
        processingTime: Date.now(),
        model: 'llama3.2',
        wordReduction: parseFloat(((originalWordCount - currentSimplifiedWordCount) / originalWordCount *
            100).toFixed(1)),
        metadata: {
            originalWordCount,
            simplifiedWordCount: currentSimplifiedWordCount,
            title: textData.title,
            url: textData.url,
            chunks: chunks.length
        }
    };
    console.log(`[processTextInChunks] Returning final result:`, finalResult);
    return finalResult;
};