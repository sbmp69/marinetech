// Debug script to verify form field mapping
const fs = require('fs');
const path = require('path');

// Read schema file
const schemaPath = path.join(__dirname, 'web', 'schema.js');
const schemaContent = fs.readFileSync(schemaPath, 'utf8');

// Extract field IDs from schema
const fieldIdRegex = /id:\s*['"]([^'"]+)['"]/g;
const schemaFields = [];
let match;
while ((match = fieldIdRegex.exec(schemaContent)) !== null) {
  schemaFields.push(match[1]);
}

console.log('=== FORM FIELD VERIFICATION ===\n');
console.log(`Total schema fields: ${schemaFields.length}\n`);

console.log('Expected form field names (for certificate 0):');
schemaFields.forEach(fieldId => {
  console.log(`  cert-0-${fieldId}`);
});

console.log('\nExpected data collection keys:');
schemaFields.forEach(fieldId => {
  console.log(`  ${fieldId}`);
});

console.log('\nExpected template placeholders:');
schemaFields.forEach(fieldId => {
  console.log(`  {{${fieldId}}}`);
});

console.log('\n=== SAMPLE FORM GENERATION TEST ===');
console.log('Form field generation pattern:');
console.log('  Input name: cert-${i}-${field.id}');
console.log('  Data collection: fieldName = input.name.replace(`cert-${formIndex}-`, "")');
console.log('  Template replacement: {{fieldName}}');

console.log('\nExample for header.vesselName:');
console.log('  1. Form input name: cert-0-header.vesselName');
console.log('  2. Data collection key: header.vesselName');
console.log('  3. Nested structure: {header: {vesselName: "value"}}');
console.log('  4. Template placeholder: {{header.vesselName}}');
