import { SCHEMA } from './schema.js';

const templateInput = document.getElementById('templateInput');
const countInput = document.getElementById('count');
const buildFormsBtn = document.getElementById('buildFormsBtn');
const formsContainer = document.getElementById('formsContainer');
const generateBtn = document.getElementById('generateBtn');
const delimiterSelect = document.getElementById('delimiters');
const statusBox = document.getElementById('status');
const debugMissingEl = document.getElementById('debugMissing');

let templateArrayBuffer = null;
let formsBuilt = false;
let templateValid = false;

function setStatus(msg) {
  statusBox.textContent = msg || '';
}

function createInput(fieldId, type, labelText) {
  const wrapper = document.createElement('div');
  wrapper.className = 'form-item';
  const label = document.createElement('label');
  label.htmlFor = fieldId;
  label.textContent = labelText;

  let input;
  if (type === 'textarea') {
    input = document.createElement('textarea');
  } else {
    input = document.createElement('input');
    if (type === 'date') input.type = 'date';
    else if (type === 'number') input.type = 'number';
    else input.type = 'text';
  }
  input.id = fieldId;
  input.name = fieldId;

  wrapper.appendChild(label);
  wrapper.appendChild(input);
  return wrapper;
}

function buildForms() {
  const numCertificates = parseInt(countInput.value) || 1;
  formsContainer.innerHTML = '';
  
  for (let i = 0; i < numCertificates; i++) {
    const form = document.createElement('form');
    form.id = `certificate-form-${i}`;
    form.className = 'certificate-form';
    
    const formTitle = document.createElement('h2');
    formTitle.textContent = `Certificate ${i + 1}`;
    form.appendChild(formTitle);
    
    // Process each section in the schema
    SCHEMA.forEach(section => {
      const fieldset = document.createElement('fieldset');
      const legend = document.createElement('legend');
      legend.textContent = section.group; // Use the group name as the section title
      fieldset.appendChild(legend);
      
      // Add fields for this section
      section.fields.forEach(field => {
        const input = createInput(`cert-${i}-${field.id}`, field.type, field.label);
        fieldset.appendChild(input);
      });
      
      form.appendChild(fieldset);
    });
    
    formsContainer.appendChild(form);
  }
  
  formsBuilt = true;
  ensureGenerateEnabled();
}

function ensureGenerateEnabled() {
  generateBtn.disabled = !(templateValid && formsBuilt);
}

function getNested(obj, path) {
  return path.split('.').reduce((acc, k) => (acc ? acc[k] : undefined), obj);
}

function setNested(obj, path, value) {
  const parts = path.split('.');
  let curr = obj;
  for (let i = 0; i < parts.length; i++) {
    const key = parts[i];
    if (i === parts.length - 1) {
      curr[key] = value;
    } else {
      if (!curr[key] || typeof curr[key] !== 'object') curr[key] = {};
      curr = curr[key];
    }
  }
}

function collectCertificateData(formIndex) {
  const form = document.getElementById(`certificate-form-${formIndex}`);
  if (!form) {
    console.error(`Form with ID certificate-form-${formIndex} not found`);
    return {};
  }
  
  const data = {};
  const inputs = form.querySelectorAll('input, textarea, select');
  
  console.log(`Found ${inputs.length} form fields in certificate ${formIndex}`);
  
  // First collect all field values
  inputs.forEach(input => {
    let value;
    if (input.type === 'checkbox') {
      value = input.checked;
    } else if (input.type === 'radio') {
      if (input.checked) {
        value = input.value;
      } else {
        return; // Skip unchecked radio buttons
      }
    } else {
      value = input.value;
    }
    
    // Only add if the value exists and isn't an empty string
    if (value !== undefined && value !== '' && !(typeof value === 'string' && !value.trim())) {
      data[input.name] = value;
      console.log(`Collected field: ${input.name} =`, value);
    }
  });
  
  console.log(`Final data for certificate ${formIndex}:`, data);
  return data;
}

async function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// PDF generation with template matching
async function downloadPDF(certificates, filename) {
  console.log('Raw certificate data:', certificates);
  
  // Force .pdf extension
  filename = filename.replace(/\.pdf$/i, '') + '.pdf';

  try {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // Process each certificate
    for (let certIndex = 0; certIndex < certificates.length; certIndex++) {
      const cert = certificates[certIndex];
      console.log(`Processing certificate ${certIndex + 1}:`, cert);
      
      if (certIndex > 0) {
        pdf.addPage();
      }

      // Create a temporary div for the certificate
      const tempDiv = document.createElement('div');
      tempDiv.style.padding = '20px';
      tempDiv.style.fontFamily = 'Arial, sans-serif';
      tempDiv.style.lineHeight = '1.6';
      document.body.appendChild(tempDiv);

      try {
        // Create certificate HTML
        let html = `
          <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="font-size: 24px; margin-bottom: 30px;">CERTIFICATE OF INSPECTION</h1>
        `;

        // Add sections from the certificate data
        for (const [key, value] of Object.entries(cert)) {
          if (key.includes('.')) {
            const [section, field] = key.split('.');
            html += `
              <div style="margin: 10px 0; text-align: left; padding: 0 20px;">
                <strong>${field.replace(/([A-Z])/g, ' $1').toUpperCase()}:</strong> ${value || ''}
              </div>
            `;
          } else {
            html += `
              <div style="margin: 10px 0; text-align: left; padding: 0 20px;">
                <strong>${key.replace(/([A-Z])/g, ' $1').toUpperCase()}:</strong> ${value || ''}
              </div>
            `;
          }
        }

        html += `</div>`;
        tempDiv.innerHTML = html;

        // Convert to canvas
        const canvas = await html2canvas(tempDiv, {
          scale: 2,
          useCORS: true,
          logging: true,
          backgroundColor: '#ffffff'
        });

        // Add to PDF
        const imgData = canvas.toDataURL('image/png');
        pdf.addImage(imgData, 'PNG', 10, 10, 190, 0, undefined, 'FAST');

      } catch (error) {
        console.error('Error generating certificate:', error);
        throw error; // Re-throw to be caught by the outer try-catch
      } finally {
        // Clean up
        if (document.body.contains(tempDiv)) {
          document.body.removeChild(tempDiv);
        }
      }
    }
    
    // Generate a blob from the PDF
    const blob = pdf.output('blob');
    
    // Create a download link
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    
    // Set the filename with .pdf extension
    a.download = 'certificate.pdf';
    a.href = url;
    
    // Append to body, click and remove
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 100);
    
    setStatus('PDF generated: certificate.pdf');
    
  } catch (error) {
    console.error('Error generating PDF:', error);
    setStatus('Error generating PDF. Please try again.');
  }
}

// Event handlers

templateInput.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) {
    templateArrayBuffer = null;
    templateValid = false;
    ensureGenerateEnabled();
    return;
  }
  try {
    // Basic validation: ensure .docx extension
    const name = (file.name || '').toLowerCase();
    if (!name.endsWith('.docx')) {
      templateArrayBuffer = null;
      templateValid = false;
      setStatus('Please upload a .docx file (Word OpenXML). .doc files are not supported.');
      ensureGenerateEnabled();
      return;
    }

    setStatus('Reading template...');
    templateArrayBuffer = await readFileAsArrayBuffer(file);
    templateValid = true;
    setStatus('Template loaded.');
  } catch (err) {
    console.error(err);
    setStatus('Failed to read template. Check console.');
    templateArrayBuffer = null;
    templateValid = false;
  }
  ensureGenerateEnabled();
});

buildFormsBtn.addEventListener('click', () => {
  const count = Math.max(1, Math.min(50, Number(countInput.value) || 1));
  formsContainer.innerHTML = '';
  for (let i = 0; i < count; i++) {
    buildForms();
  }
  formsBuilt = true;
  ensureGenerateEnabled();
  setStatus(`Built ${count} certificate form(s).`);
});

generateBtn.addEventListener('click', async () => {
  if (!formsBuilt) {
    setStatus('Please build the forms first.');
    return;
  }

  try {
    const certificates = [];
    const formCount = parseInt(countInput.value, 10) || 1;

    for (let i = 0; i < formCount; i++) {
      const form = document.getElementById(`certificate-form-${i}`);
      if (!form) continue;
      certificates.push(collectCertificateData(i));
    }

    // Generate PDF
    setStatus('Generating PDF...');
    await downloadPDF(certificates, 'certificate');
    setStatus('PDF generated successfully!');
  } catch (error) {
    console.error('Error generating PDF:', error);
    setStatus('Error generating PDF. Please try again.');
  }
});
