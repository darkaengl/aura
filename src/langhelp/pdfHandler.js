import {
    showStatus,
    clearStatus
} from '../shared/utils.js';

export const initializePdfHandler = ({
    uploadPdfBtn,
    pdfUploadInput,
    textSimplificationModal,
    processTextWithOllama,
    updateTextDisplay,
    setProcessingState,
    originalTextDisplay,
    simplifiedTextDisplay,
    originalWordCount,
    simplifiedWordCount,
    wordReduction,
    complexitySelect,
    latestRequestId,
    currentTextData,
}) => {
    uploadPdfBtn.addEventListener('click', () => {
        pdfUploadInput.click(); // Trigger the hidden file input click
    });

    pdfUploadInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (file && file.type === 'application/pdf') {
            showStatus(simplificationStatus, 'Processing PDF for simplification...', 'loading');
            textSimplificationModal.style.display = 'flex'; // Open the simplification modal

            const reader = new FileReader();
            reader.onload = async (e) => {
                const arrayBuffer = e.target.result;
                try {
                    // Send PDF data to main process for text extraction
                    const textData = await window.textSimplificationAPI
                        .processPdfForSimplification(arrayBuffer);
                    currentTextData = textData; // Store for later use

                    if (textData && textData.text) {
                        originalTextDisplay.textContent = textData.text;
                        originalWordCount.textContent = textData.wordCount.toLocaleString();
                        showStatus(simplificationStatus,
                            `Extracted ${textData.wordCount} words from PDF. Processing with Ollama...`,
                            'loading');

                        const complexity = complexitySelect.value;
                        const requestId = ++
                        latestRequestId; // Generate new request ID for PDF processing
                        const result = await processTextWithOllama(textData, {
                            complexity
                        }, requestId);

                        if (requestId !== latestRequestId || result === null) {
                            console.log(
                                `[PDF Simplification] Discarding result for request ${requestId}. Newer request ${latestRequestId} exists or result was null.`
                            );
                            return;
                        }

                        updateTextDisplay(textData, result);
                        showStatus(simplificationStatus,
                            `PDF text simplified successfully! Reduced by ${result.wordReduction}% (${result.metadata.originalWordCount} → ${result.metadata.simplifiedWordCount} words)`,
                            'success');
                    } else {
                        throw new Error('No text could be extracted from the PDF.');
                    }
                } catch (error) {
                    console.error('Error processing PDF:', error);
                    showStatus(simplificationStatus, `Error processing PDF: ${error.message}`,
                        'error');
                    originalTextDisplay.textContent = '';
                    simplifiedTextDisplay.textContent = '';
                    originalWordCount.textContent = '0';
                    simplifiedWordCount.textContent = '0';
                    wordReduction.textContent = '0%';
                } finally {
                    pdfUploadInput.value =
                        ''; // Clear the input so the same file can be selected again
                    setProcessingState(false);
                }
            };
            reader.readAsArrayBuffer(file);
        } else {
            showStatus(simplificationStatus, 'Please select a valid PDF file.', 'error');
        }
    });
};