// Robust PDF download handler with multiple fallback methods
// This ensures consistent filename and extension handling across all browsers and server restarts

class PDFDownloadHandler {
  constructor() {
    this.downloadAttempts = 0;
    this.maxAttempts = 3;
  }

  async downloadPDF(html, filename) {
    this.downloadAttempts = 0;
    
    // Ensure filename always has .pdf extension
    const cleanFilename = this.sanitizeFilename(filename);
    console.log(`Starting PDF download with filename: ${cleanFilename}`);
    
    return this.attemptDownload(html, cleanFilename);
  }

  sanitizeFilename(filename) {
    // Remove any existing extension and add .pdf
    const baseName = filename.replace(/\.[^/.]+$/, '');
    const sanitized = baseName.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `${sanitized}.pdf`;
  }

  async attemptDownload(html, filename) {
    try {
      this.downloadAttempts++;
      console.log(`Download attempt ${this.downloadAttempts} for: ${filename}`);

      // Generate unique request ID to prevent caching
      const requestId = Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      
      const response = await fetch('/generate-pdf', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'X-Request-ID': requestId
        },
        body: JSON.stringify({ 
          html,
          filename,
          requestId
        })
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
      }

      // Verify response is actually PDF
      const contentType = response.headers.get('Content-Type');
      if (!contentType || !contentType.includes('application/pdf')) {
        throw new Error(`Invalid content type: ${contentType}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      
      // Verify PDF content
      const uint8Array = new Uint8Array(arrayBuffer);
      if (uint8Array.length < 4 || 
          String.fromCharCode(...uint8Array.slice(0, 4)) !== '%PDF') {
        throw new Error('Response is not a valid PDF file');
      }

      console.log(`PDF validated, size: ${arrayBuffer.byteLength} bytes`);

      // Try multiple download methods
      const success = await this.tryDownloadMethods(arrayBuffer, filename);
      
      if (!success && this.downloadAttempts < this.maxAttempts) {
        console.log('Download failed, retrying...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        return this.attemptDownload(html, filename);
      }

      return success;

    } catch (error) {
      console.error(`Download attempt ${this.downloadAttempts} failed:`, error);
      
      if (this.downloadAttempts < this.maxAttempts) {
        console.log('Retrying download...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        return this.attemptDownload(html, filename);
      }
      
      throw error;
    }
  }

  async tryDownloadMethods(arrayBuffer, filename) {
    const methods = [
      () => this.modernDownload(arrayBuffer, filename),
      () => this.traditionalDownload(arrayBuffer, filename),
      () => this.forceDownload(arrayBuffer, filename),
      () => this.fallbackDownload(arrayBuffer, filename)
    ];

    for (let i = 0; i < methods.length; i++) {
      try {
        console.log(`Trying download method ${i + 1}`);
        await methods[i]();
        console.log(`Download method ${i + 1} succeeded`);
        return true;
      } catch (error) {
        console.warn(`Download method ${i + 1} failed:`, error);
      }
    }

    return false;
  }

  async modernDownload(arrayBuffer, filename) {
    if (!window.showSaveFilePicker) {
      throw new Error('Modern download API not supported');
    }

    const fileHandle = await window.showSaveFilePicker({
      suggestedName: filename,
      types: [{
        description: 'PDF files',
        accept: { 'application/pdf': ['.pdf'] }
      }]
    });

    const writable = await fileHandle.createWritable();
    await writable.write(arrayBuffer);
    await writable.close();
  }

  async traditionalDownload(arrayBuffer, filename) {
    const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    a.setAttribute('download', filename);
    a.setAttribute('type', 'application/pdf');

    document.body.appendChild(a);
    a.click();

    // Cleanup after delay
    setTimeout(() => {
      URL.revokeObjectURL(url);
      if (document.body.contains(a)) {
        document.body.removeChild(a);
      }
    }, 1000);
  }

  async forceDownload(arrayBuffer, filename) {
    const blob = new Blob([arrayBuffer], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';

    document.body.appendChild(a);

    // Force click with event
    const event = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window
    });
    a.dispatchEvent(event);

    setTimeout(() => {
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }, 1000);
  }

  async fallbackDownload(arrayBuffer, filename) {
    // Last resort: open in new window
    const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    
    const newWindow = window.open(url, '_blank');
    if (!newWindow) {
      throw new Error('Popup blocked - please allow popups and try again');
    }

    // Try to trigger download in the new window
    setTimeout(() => {
      try {
        const doc = newWindow.document;
        const a = doc.createElement('a');
        a.href = url;
        a.download = filename;
        doc.body.appendChild(a);
        a.click();
      } catch (e) {
        console.warn('Could not trigger download in new window:', e);
      }
    }, 1000);
  }
}

// Export for use in app.js
window.PDFDownloadHandler = PDFDownloadHandler;
