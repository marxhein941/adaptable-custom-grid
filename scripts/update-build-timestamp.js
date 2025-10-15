const fs = require('fs');
const path = require('path');

// Get current timestamp
const now = new Date();
const timestamp = now.toISOString().replace('T', ' ').substring(0, 19);

// Create the TypeScript content
const content = `// Auto-generated file - DO NOT EDIT MANUALLY
// This file is automatically updated during the build process

export const BUILD_TIMESTAMP = '${timestamp}';
`;

// Write to the constants file
const filePath = path.join(__dirname, '../GridChangeTracker/buildConstants.ts');
fs.writeFileSync(filePath, content, 'utf8');

console.log(`Build timestamp updated to: ${timestamp}`);
