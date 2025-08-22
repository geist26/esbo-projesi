// Dosya: client/src/hooks/useCopyToClipboard.js
import { useState } from 'react';

export const useCopyToClipboard = () => {
    const [copiedText, setCopiedText] = useState(null);

    const copy = async (text) => {
        if (!navigator?.clipboard) {
            console.warn('Clipboard not supported');
            return false;
        }
        try {
            await navigator.clipboard.writeText(text);
            setCopiedText(text);
            setTimeout(() => setCopiedText(null), 2000); // 2 saniye sonra durumu sıfırla
            return true;
        } catch (error) {
            console.warn('Copy failed', error);
            setCopiedText(null);
            return false;
        }
    };

    return [copiedText, copy];
};