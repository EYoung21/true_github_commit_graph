import * as fs from 'fs';
import * as path from 'path';

export function writeSVG(outputDir: string, filename: string, svgContent: string): void {
  // Ensure directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const filepath = path.join(outputDir, `${filename}.svg`);
  fs.writeFileSync(filepath, svgContent);
  console.log(`✅ Generated: ${filepath}`);
}

export function writeJSON(outputDir: string, filename: string, data: unknown): void {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const filepath = path.join(outputDir, `${filename}.json`);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
  console.log(`✅ Generated: ${filepath}`);
}

