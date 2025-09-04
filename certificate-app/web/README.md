# Certificate Generation Web App (Static, No Build)

This is a minimal, dependency-free frontend that:
- Lets you select how many certificates to fill
- Renders forms for all 145 fields (grouped by section)
- Accepts a DOCX template upload
- Fills placeholders using docxtemplater in the browser
- Downloads a filled DOCX (single file) with support for template loops

Important
- The template must be authored to use a loop over `certificates` with a page break per item.
- Example block inside Word (using docxtemplater syntax):
  - Start loop: {#certificates}
  - Use placeholders like {{header.vesselName}} etc.
  - Insert a page break at the end of the block
  - End loop: {/certificates}

How to run locally
1) Serve the `web/` folder with any static server
   - If you have Node installed: `node server.js` (provided)
   - Or use any other static server you prefer
2) Open http://localhost:5173 in your browser

Workflow
1) Upload your DOCX template with placeholders matching our schema.
2) Choose number of certificates to generate.
3) Fill out or paste data for each certificate.
4) Click "Generate DOCX" to download the filled document.

Limitations / Next steps
- PDF conversion is not included here (browser-only). You can:
  - Convert DOCX to PDF externally (e.g., Desktop Word/LibreOffice), or
  - Add a backend endpoint that accepts DOCX and returns merged PDF.
- Supabase integration (DB + Storage) is not wired up yet in this static seed. This can be added next.
