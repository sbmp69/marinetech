import { SCHEMA } from './schema.js';

// DOM elements
const countInput = document.getElementById('count');
const buildFormsBtn = document.getElementById('buildFormsBtn');
const formsContainer = document.getElementById('formsContainer');
const generateBtn = document.getElementById('generateBtn');
const statusBox = document.getElementById('status');

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
  generateBtn.disabled = !formsBuilt;
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
    // Skip the submit button if it exists
    if (input.type === 'submit') return;
    
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
      // Convert input name to the format expected by the template
      const fieldName = input.name.replace(`cert-${formIndex}-`, '');
      data[fieldName] = value;
      console.log(`Collected field: ${fieldName} =`, value);
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

// Load HTML template
async function loadHtmlTemplate() {
  const response = await fetch('/templates/exact-docx.html');
  if (!response.ok) {
    console.error('Error loading template:', response.status, response.statusText);
    throw new Error('Failed to load template');
  }
  return await response.text();
}

// PDF generation with Puppeteer
async function downloadPDF(certificates) {
  try {
    const template = await loadHtmlTemplate();
    
    for (const [index, cert] of certificates.entries()) {
      // Transform data for the template
      const data = {
        ...cert,
        certificateNumber: cert['header.certificateNo'] || `CERT-${Date.now()}`,
        vesselName: cert['header.vesselName'] || '',
        manufacturedBy: cert['header.manufacturedBy'] || '',
        ownerName: cert['header.ownerName'] || '',
        inspectionDate: new Date().toISOString().split('T')[0]
      };
      
      // Replace placeholders
      let html = template;
      for (const [key, value] of Object.entries(data)) {
        html = html.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
      }
      
      // Generate PDF
      const response = await fetch('/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          html,
          filename: `certificate_${data.certificateNumber}.pdf` 
        })
      });
      
      if (!response.ok) {
        let errorMessage = 'PDF generation failed';
        try {
          const errorData = await response.json();
          console.error('Server error details:', errorData);
          errorMessage = errorData.details || errorMessage;
        } catch (e) {
          console.error('Failed to parse error response:', e);
        }
        throw new Error(errorMessage);
      }
      
      // Create a simple, clean filename
      const vesselName = data.vesselName || 'Unknown';
      const certNumber = data.certificateNumber || Date.now();
      const cleanVesselName = vesselName.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `Certificate_${cleanVesselName}_${certNumber}.pdf`;
      
      // Create a blob URL for the PDF with explicit PDF type
      const blob = new Blob([await response.arrayBuffer()], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      
      // Create and trigger download with explicit attributes
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      a.setAttribute('download', filename);
      a.type = 'application/pdf';
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 100);
    }
    
    setStatus('PDF generated successfully!');
  } catch (error) {
    console.error('Error:', error);
    setStatus('Error: ' + error.message);
  }
}

// Event handlers

// Load template when the page loads
async function loadTemplate() {
  try {
    setStatus('Loading template...');
    const templatePath = '/docx-templates/New%20Liferaft%20certificate%20-%20(15%20PERSON)%20DOLPHIN%20NO%20-06-17054.docx';
    const response = await fetch(templatePath);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    templateArrayBuffer = await response.arrayBuffer();
    templateValid = true;
    setStatus('Template loaded successfully.');
  } catch (err) {
    console.error('Error loading template:', err);
    setStatus('Failed to load template. Please check console for details.');
    templateValid = false;
  }
  ensureGenerateEnabled();
}

// Load template when the page loads
loadTemplate();

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
      const certData = collectCertificateData(i);
      if (Object.keys(certData).length > 0) {
        certificates.push(certData);
      }
    }

    if (certificates.length === 0) {
      setStatus('No valid certificate data found.');
      return;
    }

    // Generate PDF
    setStatus('Generating PDF...');
    await downloadPDF(certificates);
    setStatus('PDF generated successfully!');
  } catch (error) {
    console.error('Error generating PDF:', error);
    setStatus('Error generating PDF. Please try again.');
  }
});
