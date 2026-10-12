const fs = require('fs');

const fileContent = fs.readFileSync('app/(tabs)/index.tsx', 'utf-8');

// Regex to extract all styles
const cMatch = fileContent.match(/const C = {[\s\S]*?};\n/);
const fontMatch = fileContent.match(/const FONT = {[\s\S]*?};\n/);
const isCompactMatch = fileContent.match(/const IS_COMPACT = width < 380;/);
const isShortMatch = fileContent.match(/const IS_SHORT = height < 780;/);
const widthHeightMatch = fileContent.match(/const { width, height } = Dimensions.get\('window'\);/);

const styles = [];
const styleRegex = /const (\w+) = StyleSheet\.create\({[\s\S]*?}\);/g;
let match;
while ((match = styleRegex.exec(fileContent)) !== null) {
  styles.push(match[0]);
}

const stylesContent = `import { StyleSheet, Dimensions, Platform } from 'react-native';\n\n` +
  `${widthHeightMatch[0]}\n` +
  `export ${isCompactMatch[0]}\n` +
  `export ${isShortMatch[0]}\n\n` +
  `export ${cMatch[0]}\n` +
  `export ${fontMatch[0]}\n` +
  styles.map(s => `export ${s}`).join('\n\n') + '\n';

fs.writeFileSync('app/login/login.styles.ts', stylesContent);

let newIndexContent = fileContent;

// Remove styles from index
newIndexContent = newIndexContent.replace(widthHeightMatch[0], '');
newIndexContent = newIndexContent.replace(isCompactMatch[0], '');
newIndexContent = newIndexContent.replace(isShortMatch[0], '');
newIndexContent = newIndexContent.replace(cMatch[0], '');
newIndexContent = newIndexContent.replace(fontMatch[0], '');
styles.forEach(s => {
  newIndexContent = newIndexContent.replace(s, '');
});

// Add import
const importStr = `import { C, FONT, IS_COMPACT, IS_SHORT, bgS, lhS, wmS, lpS, inS, btnS, trS, ldS, s } from './login.styles';\n`;
newIndexContent = newIndexContent.replace(/import { SafeAreaView } from 'react-native-safe-area-context';/, `import { SafeAreaView } from 'react-native-safe-area-context';\n${importStr}`);

fs.writeFileSync('app/login/index.tsx', newIndexContent);

// replace tabs index
const tabsContent = `import { Redirect } from 'expo-router';\n\nexport default function Index() {\n  return <Redirect href="/login" />;\n}\n`;
fs.writeFileSync('app/(tabs)/index.tsx', tabsContent);

console.log('Done');
