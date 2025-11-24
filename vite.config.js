import { defineConfig } from "vite";
import { resolve } from "path";
import { copyFileSync } from "fs";

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "src/popup/popup.html"),
        'background/service-worker': resolve(__dirname, "src/background/service-worker.ts")
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background/service-worker') {
            return 'background/service-worker.js';
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
        copyFileSync(
          resolve(__dirname, 'src/rules.json'),
          resolve(__dirname, 'dist/rules.json')
        );
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