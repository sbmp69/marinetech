// Script to verify all schema fields have corresponding template placeholders
const fs = require('fs');
const path = require('path');

// Read schema file
const schemaPath = path.join(__dirname, 'web', 'schema.js');
const templatePath = path.join(__dirname, 'web', 'templates', 'exact-docx.html');

// Read files
const schemaContent = fs.readFileSync(schemaPath, 'utf8');
const templateContent = fs.readFileSync(templatePath, 'utf8');

// Extract field IDs from schema
const fieldIdRegex = /id:\s*['"]([^'"]+)['"]/g;
const schemaFields = [];
let match;
while ((match = fieldIdRegex.exec(schemaContent)) !== null) {
  schemaFields.push(match[1]);
}

// Extract placeholders from template
const placeholderRegex = /\{\{([^}]+)\}\}/g;
const templatePlaceholders = [];
let placeholderMatch;
while ((placeholderMatch = placeholderRegex.exec(templateContent)) !== null) {
  templatePlaceholders.push(placeholderMatch[1].trim());
}

// Remove duplicates
const uniqueSchemaFields = [...new Set(schemaFields)];
const uniqueTemplatePlaceholders = [...new Set(templatePlaceholders)];

console.log('=== SCHEMA VERIFICATION REPORT ===\n');

console.log(`Total schema fields: ${uniqueSchemaFields.length}`);
console.log(`Total template placeholders: ${uniqueTemplatePlaceholders.length}\n`);

// Find missing placeholders in template
const missingInTemplate = uniqueSchemaFields.filter(field => 
  !uniqueTemplatePlaceholders.includes(field)
);

// Find extra placeholders in template (not in schema)
const extraInTemplate = uniqueTemplatePlaceholders.filter(placeholder => 
  !uniqueSchemaFields.includes(placeholder)
);

if (missingInTemplate.length > 0) {
  console.log('❌ MISSING IN TEMPLATE:');
  missingInTemplate.forEach(field => console.log(`  - ${field}`));
  console.log('');
}

if (extraInTemplate.length > 0) {
  console.log('⚠️  EXTRA IN TEMPLATE (not in schema):');
  extraInTemplate.forEach(placeholder => console.log(`  - ${placeholder}`));
  console.log('');
}

if (missingInTemplate.length === 0 && extraInTemplate.length === 0) {
  console.log('✅ All schema fields have corresponding template placeholders!');
} else {
  console.log('📋 SUMMARY:');
  console.log(`  Missing in template: ${missingInTemplate.length}`);
  console.log(`  Extra in template: ${extraInTemplate.length}`);
}

console.log('\n=== ALL SCHEMA FIELDS ===');
uniqueSchemaFields.sort().forEach(field => {
  const status = uniqueTemplatePlaceholders.includes(field) ? '✅' : '❌';
  console.log(`${status} ${field}`);
});

console.log('\n=== ALL TEMPLATE PLACEHOLDERS ===');
uniqueTemplatePlaceholders.sort().forEach(placeholder => {
  const status = uniqueSchemaFields.includes(placeholder) ? '✅' : '⚠️';
  console.log(`${status} ${placeholder}`);
});
