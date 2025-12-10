import { Platform } from 'react-native';

/**
 * Polyfill for streaming fetch on React Native using XMLHttpRequest.
 * Standard fetch in RN buffers the entire response, preventing streaming.
 * XMLHttpRequest supports onprogress which allows reading partial data.
 */
export const fetchStream = (url: string, options: any, onChunk: (chunk: string) => void) => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(options.method || 'GET', url);
    
    // Set headers
    if (options.headers) {
      Object.keys(options.headers).forEach(key => {
        xhr.setRequestHeader(key, options.headers[key]);
      });
    }

    let lastIndex = 0;

    // React Native specific: onprogress gives us access to partial responseText
    xhr.onprogress = () => {
      const currResponse = xhr.responseText;
      if (currResponse.length > lastIndex) {
        const newData = currResponse.substring(lastIndex);
        lastIndex = currResponse.length;
        if (newData) {
          onChunk(newData);
        }
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(null); // Stream completed successfully
      } else {
        try {
            const err = JSON.parse(xhr.responseText);
            reject(new Error(err.error || `Request failed with status ${xhr.status}`));
        } catch {
            reject(new Error(`Request failed with status ${xhr.status}`));
        }
      }
    };

    xhr.onerror = () => reject(new Error('Network request failed'));
    xhr.ontimeout = () => reject(new Error('Request timed out'));

    if (options.body) {
      xhr.send(options.body);
    } else {
      xhr.send();
    }
  });
};
