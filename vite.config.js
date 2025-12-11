import { defineConfig } from "vite";
import { resolve } from "path";
import { copyFileSync, existsSync, mkdirSync } from "fs";
import { glob } from 'glob';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "src/popup/popup.html"),
        'background/service-worker': resolve(__dirname, "src/background/service-worker.ts"),
        'content/content-script': resolve(__dirname, "src/content/content-script.ts"),
        'content/website-score': resolve(__dirname, "src/content/website-score.ts")
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background/service-worker') {
            return 'background/service-worker.js';
          }
          if (chunkInfo.name === 'content/content-script') {
            return 'content/content-script.js';
          }
          if (chunkInfo.name === 'content/website-score') {
            return 'content/website-score.js';
          }
          return 'assets/[name].js';
        },
        chunkFileNames: "assets/[name].js",
        assetFileNames: (assetInfo) => {
          // Place popup.html in the root of dist
          if (assetInfo.name === 'popup.html') {
            return '[name][extname]';
          }
          return 'assets/[name].[ext]';
        }
      }
    }
  },
  plugins: [
    {
      name: 'copy-manifest',
      writeBundle() {
        copyFileSync(
          resolve(__dirname, 'src/manifest.json'),
          resolve(__dirname, 'dist/manifest.json')
        );
      }
    },
    {
      name: 'copy-rules',
      writeBundle() {
        const ruleFiles = glob.sync('src/rules_*.json');
        ruleFiles.forEach(file => {
          const filename = file.split('\\').pop(); // Get just the filename
          copyFileSync(
            resolve(__dirname, file),
          resolve(__dirname, 'dist/'+filename)
          );
        });

        // Copy CSS rules directory
        const cssRuleFiles = glob.sync('src/css_rules/**/*', { nodir: true });
        cssRuleFiles.forEach(file => {
          // Get the relative path from src/css_rules
          const relativePath = file.split('\\').pop();
          const destPath = resolve(__dirname, 'dist/css_rules', relativePath);
          
          // Create directory structure if it doesn't exist
          const destDir = dirname(destPath);
          if (!existsSync(destDir)) {
            mkdirSync(destDir, { recursive: true });
          }

          // Only copy files (not directories)
          if (file.endsWith('.css') || file.endsWith('.json')) {
            copyFileSync(
              resolve(__dirname, file),
              destPath
            );
          }
        });
      }
    },
    {
      name: 'debug-bundle',
      generateBundle(options, bundle) {
        console.log('Bundled files:');
        Object.keys(bundle).forEach(fileName => {
          const file = bundle[fileName];
          console.log(`- ${fileName} (${file.type})`);
        });
      }
    }
  ]
});