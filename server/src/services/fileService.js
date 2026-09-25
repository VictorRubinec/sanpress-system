import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * Opens a file on the host OS using the default registered application.
 * @param {string} filePath - Absolute or relative path to the file.
 * @returns {Promise<void>}
 */
export function openFileLocally(filePath) {
  return new Promise((resolve, reject) => {
    if (!filePath) {
      return reject(new Error('Caminho do arquivo não fornecido.'));
    }

    // Standardize slashes for the host OS
    const resolvedPath = path.normalize(filePath);

    if (!fs.existsSync(resolvedPath)) {
      return reject(new Error(`Arquivo não encontrado no caminho: ${resolvedPath}`));
    }

    // Windows command: start "" "path"
    exec(`start "" "${resolvedPath}"`, (error) => {
      if (error) {
        return reject(new Error(`Falha ao abrir arquivo: ${error.message}`));
      }
      resolve();
    });
  });
}
